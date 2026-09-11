<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin \App\Models\SalesOrder
 *
 * An order as the yard gate sees it: who collects it, what the money says,
 * and what must physically leave. Deliberately narrower than
 * SalesOrderResource — no unit prices, discounts, payment mode or cashier —
 * because Security verifies goods, not pricing.
 *
 * The printed bill carries the order number as its document number, so the
 * order number *is* the bill/invoice number; `bill_no` makes that explicit.
 */
class YardOrderResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'order_no' => $this->order_no,
            'bill_no' => $this->order_no,
            'customer_name' => $this->customer_name,
            'customer_phone' => $this->customer_phone,
            'ordered_at' => $this->ordered_at?->toIso8601String(),
            'paid_at' => $this->paid_at?->toIso8601String(),

            // From withCount/withSum on list queries, or the loaded lines on detail.
            'items_count' => $this->when(
                isset($this->items_count) || $this->relationLoaded('items'),
                fn () => (int) ($this->items_count ?? $this->items->count()),
            ),
            'total_quantity' => $this->when(
                isset($this->items_sum_quantity) || $this->relationLoaded('items'),
                fn () => (int) ($this->items_sum_quantity ?? $this->items->sum('quantity')),
            ),

            'total' => (float) $this->total,
            'paid_amount' => (float) $this->paid_amount,
            'balance' => max(0.0, $this->outstanding),
            'payment_status' => $this->payment_status,
            'is_fully_paid' => $this->isFullyPaid(),

            'yard_status' => $this->yardStatus(),
            'dispatch_status' => $this->isDispatched() ? 'DISPATCHED' : 'AWAITING_DISPATCH',

            'items' => $this->whenLoaded('items', fn () => $this->items->map(fn ($item) => [
                'id' => $item->id,
                'part_name' => $item->part_name,
                'part_number' => $item->part_number,
                'qr_code' => $item->qr_code,
                'quantity' => $item->quantity,
                'unit' => $item->relationLoaded('part') ? $item->part?->unit : null,
            ])->values()),

            'dispatch' => $this->whenLoaded('dispatchRecord', fn () => $this->dispatchRecord === null ? null : [
                'id' => $this->dispatchRecord->id,
                'dispatch_no' => $this->dispatchRecord->dispatch_no,
                'dispatched_at' => $this->dispatchRecord->dispatched_at?->toIso8601String(),
                'dispatched_by' => [
                    'id' => $this->dispatchRecord->dispatched_by,
                    'name' => $this->dispatchRecord->dispatched_by_name,
                ],
                'notes' => $this->dispatchRecord->notes,
            ]),
        ];
    }
}
