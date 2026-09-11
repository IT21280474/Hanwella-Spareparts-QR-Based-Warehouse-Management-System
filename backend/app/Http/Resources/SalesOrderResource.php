<?php

namespace App\Http\Resources;

use App\Models\SalesOrder;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin \App\Models\SalesOrder
 */
class SalesOrderResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'order_no' => $this->order_no,
            'customer_name' => $this->customer_name,
            'customer_phone' => $this->customer_phone,
            'subtotal' => (float) $this->subtotal,
            'discount' => (float) $this->discount,
            'total' => (float) $this->total,
            'paid_amount' => (float) $this->paid_amount,
            'outstanding' => $this->outstanding,
            'payment_status' => $this->payment_status,
            'payment_mode' => $this->payment_mode,
            'status' => $this->status,
            'items_count' => $this->whenCounted('items'),
            'cashier' => $this->whenLoaded('cashier', fn () => $this->cashier === null ? null : [
                'id' => $this->cashier->id,
                'name' => $this->cashier->name,
            ]),
            'stock_deducted_at' => $this->stock_deducted_at?->toIso8601String(),
            'dispatched_at' => $this->dispatched_at?->toIso8601String(),
            'dispatched_by' => $this->whenLoaded('dispatchedBy', fn () => $this->dispatchedBy === null ? null : [
                'id' => $this->dispatchedBy->id,
                'name' => $this->dispatchedBy->name,
            ]),
            // Ready for Security to act on: paid, not cancelled, not already gone out.
            'ready_for_dispatch' => $this->payment_status === SalesOrder::PAID
                && $this->status !== 'CANCELLED'
                && $this->dispatched_at === null,
            'ordered_at' => $this->ordered_at?->toIso8601String(),
            'items' => SalesOrderItemResource::collection($this->whenLoaded('items')),
        ];
    }
}
