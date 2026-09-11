<?php

namespace App\Services;

use App\Exceptions\InsufficientStockException;
use App\Models\Part;
use App\Models\SalesOrder;
use App\Models\SalesOrderItem;
use App\Models\StockMovement;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;
use RuntimeException;

/**
 * The counter-sale transaction.
 *
 * A sale is one atomic unit: every line's price is resolved from the
 * catalogue at the moment of sale (never trusted from the client), stock is
 * deducted line by line through {@see StockService} — so the same lock and
 * insufficient-stock guard a manual stock-out gets — and the whole order
 * commits together or not at all. A failure on line 3 of 5 undoes lines 1
 * and 2 as well; a customer is never billed for a partially-fulfilled order.
 *
 * Stock only ever leaves inventory once an order is fully paid — a PENDING
 * or PARTIALLY_PAID order records what was agreed (its line items) but takes
 * nothing from stock until `payment_status` reaches PAID, whether that
 * happens at creation or later via {@see updatePayment()}. `stock_deducted_at`
 * tracks this explicitly rather than inferring it from payment_status, so
 * cancelling an order that never took stock never credits phantom units back.
 * Dispatch ({@see dispatch()}) is a separate, later checkpoint — a fully paid
 * order still needs a human (Security) to confirm the goods actually left —
 * and does not move stock again; that already happened at payment time.
 */
class OrderService
{
    public function __construct(
        private readonly StockService $stock,
        private readonly AuditLogger $audit,
    ) {}

    /**
     * @param  list<array{part_id: int, quantity: int, discount?: float, note?: ?string}>  $items
     */
    public function create(
        array $items,
        string $customerName,
        ?string $customerPhone,
        float $discount,
        string $paymentStatus,
        string $paymentMode,
        float $requestedPaidAmount,
    ): SalesOrder {
        if ($items === []) {
            throw new InvalidArgumentException('An order must have at least one line item.');
        }

        return DB::transaction(function () use ($items, $customerName, $customerPhone, $discount, $paymentStatus, $paymentMode, $requestedPaidAmount) {
            // Resolve every line against the live catalogue first — quantities
            // (and per-line discount/note) are merged so scanning the same
            // part twice adds up rather than producing two competing
            // deductions against the same row. The frontend cart already
            // guarantees one row per part; this is the defensive fallback,
            // so a collision summing both discounts and concatenating both
            // notes is a reasonable, safe default rather than a real UX path.
            $merged = [];
            foreach ($items as $item) {
                $partId = (int) $item['part_id'];
                $existing = $merged[$partId] ?? ['quantity' => 0, 'discount' => 0.0, 'note' => null];

                $note = trim((string) ($item['note'] ?? ''));
                $existing['quantity'] += (int) $item['quantity'];
                $existing['discount'] += max(0.0, (float) ($item['discount'] ?? 0));
                $existing['note'] = $existing['note'] && $note !== '' ? "{$existing['note']}; {$note}" : ($existing['note'] ?: ($note ?: null));

                $merged[$partId] = $existing;
            }

            // A sale doesn't ask which bin a part comes from, so it must find
            // that out itself — stockOut() otherwise looks for a row at
            // warehouse=null/location=null, which never matches a part's real
            // (warehouse, location) inventory row and would reject every sale
            // as "insufficient stock" regardless of what's actually on hand.
            $parts = Part::whereIn('id', array_keys($merged))
                ->with(['inventory' => fn ($q) => $q->orderByDesc('quantity')])
                ->get()->keyBy('id');

            // Subtotal is always the full catalogue price — item discounts are
            // tracked separately so margin/reporting queries never have to
            // guess whether a stored price already reflects one.
            $subtotal = 0.0;
            $itemDiscountTotal = 0.0;
            foreach ($merged as $partId => $line) {
                $part = $parts->get($partId) ?? throw new InvalidArgumentException("Part {$partId} no longer exists.");
                $lineFullPrice = (float) $part->selling_price * $line['quantity'];
                $subtotal += $lineFullPrice;
                $itemDiscountTotal += min($line['discount'], $lineFullPrice);
            }

            // The order-level discount applies on top of item-level ones —
            // clamped to what is left after those, so the two can never
            // combine into a negative total.
            $discount = max(0.0, min($discount, $subtotal - $itemDiscountTotal));
            $total = round($subtotal - $itemDiscountTotal - $discount, 2);
            $paidAmount = $this->resolvePaidAmount($paymentStatus, $total, $requestedPaidAmount);

            $order = $this->createWithUniqueNumber([
                'customer_name' => trim($customerName) !== '' ? $customerName : 'Walk-in customer',
                'customer_phone' => $customerPhone,
                'subtotal' => round($subtotal, 2),
                'discount' => round($discount, 2),
                'total' => $total,
                'paid_amount' => $paidAmount,
                'payment_status' => $paymentStatus,
                'payment_mode' => $paymentMode,
                'status' => 'COMPLETED',
                'cashier_id' => Auth::id(),
                'ordered_at' => now(),
            ]);

            // The bill's line items are recorded regardless of payment status
            // — they describe what was agreed. Only PAID orders take stock.
            foreach ($merged as $partId => $line) {
                /** @var Part $part */
                $part = $parts->get($partId);
                $quantity = $line['quantity'];
                $lineDiscount = min($line['discount'], (float) $part->selling_price * $quantity);

                SalesOrderItem::create([
                    'sales_order_id' => $order->id,
                    'part_id' => $part->id,
                    'qr_code' => $part->qrCode?->code,
                    'part_number' => $part->part_number,
                    'part_name' => $part->name,
                    'unit_price' => $part->selling_price,
                    'discount' => round($lineDiscount, 2),
                    'quantity' => $quantity,
                    'line_total' => round((float) $part->selling_price * $quantity - $lineDiscount, 2),
                    'note' => $line['note'],
                ]);
            }

            if ($paymentStatus === SalesOrder::PAID) {
                // Throws InsufficientStockException, which unwinds the whole
                // transaction — the order and every item created above too.
                $this->deductStockForOrder($order, $parts);
            }

            $this->audit->log('order.create', $order, [], $order->getAttributes(),
                sprintf('Order %s for %s · %s %s', $order->order_no, $order->customer_name, config('wms.currency'), number_format($total, 2)));

            return $order->load('items', 'cashier:id,name');
        });
    }

    public function updatePayment(SalesOrder $order, string $paymentStatus, ?float $requestedPaidAmount): SalesOrder
    {
        if ($order->payment_status === SalesOrder::CANCELLED) {
            throw new InvalidArgumentException('A cancelled order cannot have its payment changed.');
        }

        if ($order->dispatched_at !== null) {
            throw new InvalidArgumentException('This order has already been dispatched — its payment can no longer be changed.');
        }

        return DB::transaction(function () use ($order, $paymentStatus, $requestedPaidAmount) {
            $before = $order->getAttributes();

            $order->payment_status = $paymentStatus;
            $order->paid_amount = $this->resolvePaidAmount($paymentStatus, (float) $order->total, $requestedPaidAmount ?? (float) $order->paid_amount);
            $order->save();

            // Stock moves exactly on the boundary crossing, in either
            // direction — becoming PAID takes stock; stepping back off PAID
            // (e.g. correcting a mistaken "mark paid") returns it. Throws
            // InsufficientStockException if stock ran out in the meantime,
            // which unwinds the whole transaction, payment change included.
            if ($paymentStatus === SalesOrder::PAID && $order->stock_deducted_at === null) {
                $this->deductStockForOrder($order);
            } elseif ($paymentStatus !== SalesOrder::PAID && $order->stock_deducted_at !== null) {
                $this->returnStockForOrder($order, "Order {$order->order_no} payment reverted from paid");
            }

            $this->audit->log('order.payment', $order, $before, $order->getAttributes(),
                "Order {$order->order_no} payment set to {$paymentStatus}");

            return $order->load('items', 'cashier:id,name');
        });
    }

    /**
     * Cancel an order. If it had already taken stock (i.e. it had been paid),
     * every line's units are returned to the inventory row they came from, as
     * a `RETURN` movement — the original `SALE` movement itself is never
     * edited or removed. An order that never took stock (still pending
     * payment) returns nothing, because nothing was ever taken.
     */
    public function cancel(SalesOrder $order, ?string $reason): SalesOrder
    {
        if ($order->payment_status === SalesOrder::CANCELLED) {
            throw new InvalidArgumentException('This order is already cancelled.');
        }

        if ($order->dispatched_at !== null) {
            throw new InvalidArgumentException('This order has already been dispatched and can no longer be cancelled here.');
        }

        return DB::transaction(function () use ($order, $reason) {
            $before = $order->getAttributes();

            if ($order->stock_deducted_at !== null) {
                $this->returnStockForOrder($order, $reason ?? "Order {$order->order_no} cancelled");
            }

            $order->payment_status = SalesOrder::CANCELLED;
            $order->status = 'CANCELLED';
            $order->save();

            $this->audit->log('order.cancel', $order, $before, $order->getAttributes(),
                "Order {$order->order_no} cancelled".($reason ? ": {$reason}" : ''));

            return $order->load('items', 'cashier:id,name');
        });
    }

    /**
     * Security's checkpoint: confirms a fully paid order's goods actually
     * left. Independent of the stock ledger — that already moved when the
     * order became PAID — this only records who verified the hand-over, and
     * when.
     */
    public function dispatch(SalesOrder $order): SalesOrder
    {
        if ($order->status === 'CANCELLED') {
            throw new InvalidArgumentException('A cancelled order cannot be dispatched.');
        }

        if ($order->payment_status !== SalesOrder::PAID) {
            throw new InvalidArgumentException('This order must be fully paid before it can be dispatched.');
        }

        if ($order->dispatched_at !== null) {
            throw new InvalidArgumentException('This order has already been dispatched.');
        }

        $before = $order->getAttributes();

        $order->dispatched_at = now();
        $order->dispatched_by = Auth::id();
        $order->save();

        $this->audit->log('order.dispatch', $order, $before, $order->getAttributes(),
            "Order {$order->order_no} dispatched by ".(Auth::user()?->name ?? 'unknown'));

        return $order->load('items', 'cashier:id,name', 'dispatchedBy:id,name');
    }

    /**
     * Deducts stock for every line of $order and marks it as having done so.
     * Only ever called when the order is not already marked deducted.
     *
     * @param  \Illuminate\Support\Collection<int, Part>|null  $parts  Pre-loaded parts (with inventory eager-loaded), when the caller already has them — avoids a redundant query right after create().
     */
    private function deductStockForOrder(SalesOrder $order, $parts = null): void
    {
        $items = $order->items()->whereNotNull('part_id')->get();

        if ($parts === null) {
            $parts = Part::whereIn('id', $items->pluck('part_id'))
                ->with(['inventory' => fn ($q) => $q->orderByDesc('quantity')])
                ->get()->keyBy('id');
        }

        foreach ($items as $item) {
            $part = $parts->get($item->part_id);
            if ($part === null) {
                continue; // the part has since been deleted; the bill's snapshot columns still tell the story
            }
            $primaryStock = $part->inventory->first();

            $this->stock->stockOut(
                $part,
                $item->quantity,
                $primaryStock?->warehouse_id,
                $primaryStock?->location_id,
                $order->order_no,
                "Sold on order {$order->order_no}",
                StockMovement::SALE,
                $order,
            );
        }

        $order->stock_deducted_at = now();
        $order->save();
    }

    /** Returns stock for every line of $order and clears the deducted marker. Only ever called when it was previously deducted. */
    private function returnStockForOrder(SalesOrder $order, ?string $reason): void
    {
        foreach ($order->items()->whereNotNull('part_id')->get() as $item) {
            $part = Part::find($item->part_id);
            if ($part === null) {
                continue;
            }
            $primaryStock = $part->inventory()->orderByDesc('quantity')->first();

            $this->stock->stockIn(
                $part,
                $item->quantity,
                $primaryStock?->warehouse_id,
                $primaryStock?->location_id,
                $order->order_no,
                $reason ?? "Order {$order->order_no} stock returned",
                StockMovement::RETURN,
                $order,
            );
        }

        $order->stock_deducted_at = null;
        $order->save();
    }

    /**
     * PAID always means the full total, PENDING always means nothing
     * collected yet — trusting a client-sent figure for either would let a
     * tampered request mark an order paid without money changing hands.
     * Only PARTIALLY_PAID actually reads the requested amount, and even that
     * is clamped to a sane range.
     */
    private function resolvePaidAmount(string $paymentStatus, float $total, float $requested): float
    {
        return match ($paymentStatus) {
            SalesOrder::PAID => $total,
            SalesOrder::PENDING => 0.0,
            SalesOrder::PARTIALLY_PAID => round(max(0.0, min($requested, $total)), 2),
            default => throw new InvalidArgumentException("Unknown payment status [{$paymentStatus}]."),
        };
    }

    private function createWithUniqueNumber(array $attributes, int $attempts = 5): SalesOrder
    {
        for ($attempt = 1; $attempt <= $attempts; $attempt++) {
            try {
                return SalesOrder::create($attributes + ['order_no' => $this->nextOrderNo()]);
            } catch (QueryException $e) {
                if (($e->errorInfo[1] ?? null) !== 1062 || $attempt === $attempts) {
                    throw $e;
                }
                // Another cashier's order landed on the same random suffix.
            }
        }

        throw new RuntimeException('Could not allocate a unique order number.');
    }

    private function nextOrderNo(): string
    {
        return sprintf('SO-%s-%04d', now()->format('Y'), random_int(1, 9999));
    }
}
