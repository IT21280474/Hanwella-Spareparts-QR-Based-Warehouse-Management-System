<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin \App\Models\InventoryAdjustment
 */
class InventoryAdjustmentResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'adjustment_type' => $this->adjustment_type,
            'quantity_before' => $this->quantity_before,
            'adjustment' => $this->adjustment,
            'quantity_after' => $this->quantity_after,
            'reason' => $this->reason,
            'note' => $this->note,
            'user' => $this->whenLoaded('user', fn () => $this->user === null ? null : [
                'id' => $this->user->id,
                'name' => $this->user->name,
            ]),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
