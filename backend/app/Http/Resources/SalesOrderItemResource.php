<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin \App\Models\SalesOrderItem
 *
 * Every display field here is the snapshot taken at the moment of sale — a
 * bill printed today must read exactly as it did then, even if the part was
 * later renamed, repriced or removed from the catalogue.
 */
class SalesOrderItemResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'part_id' => $this->part_id,
            'part_name' => $this->part_name,
            'part_number' => $this->part_number,
            'qr_code' => $this->qr_code,
            'unit_price' => (float) $this->unit_price,
            'discount' => (float) $this->discount,
            'quantity' => $this->quantity,
            'line_total' => (float) $this->line_total,
            'note' => $this->note,
            // Only present when the part still exists and its live stock was
            // eager-loaded by the caller — the order screen's "on hand now"
            // hint, never used to recompute anything on the bill itself.
            'part_quantity_now' => $this->whenLoaded('part', fn () => $this->part?->total_stock),
        ];
    }
}
