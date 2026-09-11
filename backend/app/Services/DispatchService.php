<?php

namespace App\Services;

use App\Exceptions\DispatchConflictException;
use App\Models\Dispatch;
use App\Models\SalesOrder;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

/**
 * Releases a fully paid order from the yard.
 *
 * The client's opinion of the order is never consulted — the dispatch request
 * carries nothing but an optional note. Every rule is re-checked here against
 * the row as it stands, and three independent guards make a second dispatch
 * of the same order impossible:
 *
 *  1. `SELECT … FOR UPDATE` on the order serialises concurrent attempts, so
 *     the second one waits and then sees the first one's result;
 *  2. the claim is a conditional UPDATE (`WHERE dispatched_at IS NULL`) whose
 *     affected-row count must be exactly one;
 *  3. `dispatches.sales_order_id` is UNIQUE, so the database itself rejects a
 *     second record even if both guards above were somehow bypassed.
 */
class DispatchService
{
    public function __construct(private readonly AuditLogger $audit) {}

    public function dispatch(SalesOrder $order, ?string $notes = null): Dispatch
    {
        try {
            return DB::transaction(function () use ($order, $notes) {
                /** @var SalesOrder $locked */
                $locked = SalesOrder::whereKey($order->getKey())->lockForUpdate()->firstOrFail();

                if (($reason = $locked->dispatchBlocker()) !== null) {
                    throw new DispatchConflictException($reason);
                }

                $user = Auth::user();
                $now = now();

                $claimed = SalesOrder::whereKey($locked->getKey())
                    ->whereNull('dispatched_at')
                    ->update(['dispatched_at' => $now, 'dispatched_by' => $user->id]);

                if ($claimed !== 1) {
                    throw new DispatchConflictException(SalesOrder::MSG_ALREADY_DISPATCHED);
                }

                $items = $locked->items()->with('part:id,unit')->orderBy('id')->get();

                $dispatch = Dispatch::create([
                    'sales_order_id' => $locked->id,
                    'order_no' => $locked->order_no,
                    'customer_name' => $locked->customer_name,
                    'customer_phone' => $locked->customer_phone,
                    'items_count' => $items->count(),
                    'total_quantity' => (int) $items->sum('quantity'),
                    'total' => $locked->total,
                    'paid_amount' => $locked->paid_amount,
                    'payment_status_at_dispatch' => $locked->payment_status,
                    'items' => $items->map(fn ($item) => [
                        'part_id' => $item->part_id,
                        'part_number' => $item->part_number,
                        'part_name' => $item->part_name,
                        'qr_code' => $item->qr_code,
                        'quantity' => $item->quantity,
                        'unit' => $item->part?->unit,
                    ])->all(),
                    'dispatched_by' => $user->id,
                    'dispatched_by_name' => $user->name,
                    'dispatched_at' => $now,
                    'notes' => $notes !== null && trim($notes) !== '' ? trim($notes) : null,
                ]);

                $this->audit->log(
                    'order.dispatch',
                    $locked,
                    [
                        'yard_status' => SalesOrder::YARD_READY,
                        'dispatched_at' => null,
                    ],
                    [
                        'yard_status' => SalesOrder::YARD_DISPATCHED,
                        'dispatch_no' => $dispatch->dispatch_no,
                        'order_no' => $locked->order_no,
                        'dispatched_at' => $now->toIso8601String(),
                        'dispatched_by' => $user->id,
                        'dispatched_by_name' => $user->name,
                    ],
                    "Order {$locked->order_no} dispatched from the yard by {$user->name} ({$dispatch->dispatch_no})",
                );

                return $dispatch;
            });
        } catch (UniqueConstraintViolationException) {
            // Guard 3 fired: another request recorded this dispatch first.
            throw new DispatchConflictException(SalesOrder::MSG_ALREADY_DISPATCHED);
        }
    }
}
