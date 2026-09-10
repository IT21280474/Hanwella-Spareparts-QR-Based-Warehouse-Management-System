<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin \App\Models\StockMovement
 *
 * `part_number` and `qr_code` are flattened onto the row (rather than nested
 * only under `part`) because the movement ledger table renders them as its
 * own sortable, searchable columns.
 */
class StockMovementResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'type' => $this->type,
            'quantity' => $this->quantity,
            'quantity_before' => $this->quantity_before,
            'quantity_after' => $this->quantity_after,
            'reference_no' => $this->reference_no,
            'reason' => $this->reason,

            'part' => $this->whenLoaded('part', fn () => $this->part === null ? null : [
                'id' => $this->part->id,
                'name' => $this->part->name,
            ]),
            'part_number' => $this->whenLoaded('part', fn () => $this->part?->part_number),
            'qr_code' => $this->whenLoaded('part', fn () => $this->part?->qrCode?->code),

            'warehouse' => $this->whenLoaded('warehouse', fn () => $this->warehouse === null ? null : [
                'id' => $this->warehouse->id,
                'name' => $this->warehouse->name,
            ]),
            'location' => $this->whenLoaded('location', fn () => $this->location?->full_path),

            'user' => $this->whenLoaded('user', fn () => $this->user === null ? null : [
                'id' => $this->user->id,
                'name' => $this->user->name,
            ]),

            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
