<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin \App\Models\Dispatch
 *
 * Every field is the snapshot taken when Security confirmed the dispatch —
 * the history reads the same however the order or catalogue changes later.
 */
class DispatchResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'dispatch_no' => $this->dispatch_no,
            'order_id' => $this->sales_order_id,
            'order_no' => $this->order_no,
            'bill_no' => $this->order_no,
            'customer_name' => $this->customer_name,
            'customer_phone' => $this->customer_phone,
            'items_count' => $this->items_count,
            'total_quantity' => $this->total_quantity,
            'total' => (float) $this->total,
            'paid_amount' => (float) $this->paid_amount,
            'payment_status_at_dispatch' => $this->payment_status_at_dispatch,
            'status' => 'DISPATCHED',
            'dispatched_by' => [
                'id' => $this->dispatched_by,
                'name' => $this->dispatched_by_name,
            ],
            'dispatched_at' => $this->dispatched_at?->toIso8601String(),
            'notes' => $this->notes,
        ];
    }
}
