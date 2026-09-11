<?php

namespace App\Services;

use App\Exceptions\DispatchConflictException;
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
 */
class OrderService
{
    public function __construct(
        private readonly StockService $stock,
        private readonly AuditLogger $audit,
    ) {}

    /**
     * @param  list<array{part_id: int, quantity: int}>  $items
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
            // are merged so scanning the same part twice adds up rather than
            // producing two competing deductions against the same row.
            $merged = [];
            foreach ($items as $item) {
                $partId = (int) $item['part_id'];
                $merged[$partId] = ($merged[$partId] ?? 0) + (int) $item['quantity'];
            }

            $parts = Part::whereIn('id', array_keys($merged))->get()->keyBy('id');

            $subtotal = 0.0;
            foreach ($merged as $partId => $quantity) {
                $part = $parts->get($partId) ?? throw new InvalidArgumentException("Part {$partId} no longer exists.");
                $subtotal += (float) $part->selling_price * $quantity;
            }

            $discount = max(0.0, min($discount, $subtotal));
            $total = round($subtotal - $discount, 2);
            $paidAmount = $this->resolvePaidAmount($paymentStatus, $total, $requestedPaidAmount);
            $paymentStatus = $this->settledStatus($paymentStatus, $paidAmount, $total);

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

            foreach ($merged as $partId => $quantity) {
                /** @var Part $part */
                $part = $parts->get($partId);

                // Throws InsufficientStockException, which unwinds the whole
                // transaction — every line deducted so far in this loop too.
                $this->stock->stockOut(
                    $part,
                    $quantity,
                    null,
                    null,
                    $order->order_no,
                    "Sold on order {$order->order_no}",
                    StockMovement::SALE,
                    $order,
                );

                SalesOrderItem::create([
                    'sales_order_id' => $order->id,
                    'part_id' => $part->id,
                    'qr_code' => $part->qrCode?->code,
                    'part_number' => $part->part_number,
                    'part_name' => $part->name,
                    'unit_price' => $part->selling_price,
                    'quantity' => $quantity,
                    'line_total' => round((float) $part->selling_price * $quantity, 2),
                ]);
            }

            $this->audit->log('order.create', $order, [], $order->getAttributes(),
                sprintf('Order %s for %s · %s %s', $order->order_no, $order->customer_name, config('wms.currency'), number_format($total, 2)));

            return $order->load('items', 'cashier:id,name');
        });
    }

    /**
     * Completing the final payment is what moves an order into yard stock —
     * `paid_at` is stamped by the model the moment it becomes fully paid.
     */
    public function updatePayment(SalesOrder $order, string $paymentStatus, ?float $requestedPaidAmount): SalesOrder
    {
        return DB::transaction(function () use ($order, $paymentStatus, $requestedPaidAmount) {
            // Locked so a payment change and a gate dispatch of the same order
            // cannot interleave — one waits for the other to commit.
            $order = SalesOrder::whereKey($order->getKey())->lockForUpdate()->firstOrFail();

            if ($order->payment_status === SalesOrder::CANCELLED) {
                throw new InvalidArgumentException('A cancelled order cannot have its payment changed.');
            }

            if ($order->isDispatched()) {
                throw new DispatchConflictException('This order has already been dispatched from the yard, so its payment can no longer be changed.');
            }

            $before = $order->getAttributes();

            $paidAmount = $this->resolvePaidAmount($paymentStatus, (float) $order->total, $requestedPaidAmount ?? (float) $order->paid_amount);
            $paymentStatus = $this->settledStatus($paymentStatus, $paidAmount, (float) $order->total);

            $order->payment_status = $paymentStatus;
            $order->paid_amount = $paidAmount;
            $order->save();

            $this->audit->log('order.payment', $order, $before, $order->getAttributes(),
                "Order {$order->order_no} payment set to {$paymentStatus}");

            return $order->load('items', 'cashier:id,name');
        });
    }

    /**
     * Cancel a completed order. Every line's units are returned to the
     * inventory row they were deducted from, as a `RETURN` movement — the
     * original `SALE` movement itself is never edited or removed.
     */
    public function cancel(SalesOrder $order, ?string $reason): SalesOrder
    {
        return DB::transaction(function () use ($order, $reason) {
            // Locked for the same reason as updatePayment(): a cancel racing a
            // gate dispatch must see the dispatch, not return goods that left.
            $order = SalesOrder::whereKey($order->getKey())->lockForUpdate()->firstOrFail();

            if ($order->payment_status === SalesOrder::CANCELLED) {
                throw new InvalidArgumentException('This order is already cancelled.');
            }

            // Its goods have physically left the yard; crediting them back to
            // stock would put phantom units on the shelf.
            if ($order->isDispatched()) {
                throw new DispatchConflictException('This order has already been dispatched from the yard and cannot be cancelled.');
            }

            $before = $order->getAttributes();

            foreach ($order->items()->whereNotNull('part_id')->get() as $item) {
                $part = Part::find($item->part_id);

                // The part itself may since have been deleted; the bill's
                // snapshot columns still tell the story, but there is no
                // inventory row left to credit.
                if ($part === null) {
                    continue;
                }

                $this->stock->stockIn(
                    $part,
                    $item->quantity,
                    null,
                    null,
                    $order->order_no,
                    $reason ?? "Order {$order->order_no} cancelled",
                    StockMovement::RETURN,
                    $order,
                );
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

    /**
     * A "partial" payment that actually covers the whole total is a full
     * payment. Promoting it here means the order reaches yard stock the moment
     * the money is in, rather than waiting for someone to flip the status.
     */
    private function settledStatus(string $paymentStatus, float $paidAmount, float $total): string
    {
        if ($paymentStatus === SalesOrder::PARTIALLY_PAID && round($paidAmount, 2) >= round($total, 2)) {
            return SalesOrder::PAID;
        }

        return $paymentStatus;
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
