<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Facades\Storage;

/**
 * @mixin \App\Models\Part
 *
 * `quantity` is the aggregate on-hand figure the frontend's stock-status logic
 * reads; it comes from the `total_stock` sum attached by `Part::scopeWithStock()`
 * wherever this resource is used, so every caller must query through that scope.
 */
class PartResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'part_number' => $this->part_number,
            'sku' => $this->sku,
            'name' => $this->name,
            'description' => $this->description,
            'image_url' => $this->image_path ? Storage::disk('public')->url($this->image_path) : null,

            'qr_code' => $this->whenLoaded('qrCode', fn () => $this->qrCode?->code),

            'category' => $this->whenLoaded('category', fn () => $this->category === null ? null : [
                'id' => $this->category->id,
                'name' => $this->category->name,
            ]),
            'supplier' => $this->whenLoaded('supplier', fn () => $this->supplier === null ? null : [
                'id' => $this->supplier->id,
                'name' => $this->supplier->name,
            ]),

            // Flattened for display; the _id pair drives the edit form's
            // cascading make -> model selects.
            'vehicle_make_id' => $this->whenLoaded('vehicleModel', fn () => $this->vehicleModel?->make?->id),
            'vehicle_model_id' => $this->vehicle_model_id,
            'vehicle_make' => $this->whenLoaded('vehicleModel', fn () => $this->vehicleModel?->make?->name),
            'vehicle_model' => $this->whenLoaded('vehicleModel', fn () => $this->vehicleModel?->name),

            'unit' => $this->unit,
            'selling_price' => (float) $this->selling_price,
            'cost_price' => (float) $this->cost_price,
            'min_stock' => $this->min_stock,

            'quantity' => (int) ($this->total_stock ?? 0),
            'bin' => $this->when(isset($this->primary_bin), fn () => $this->primary_bin),
            'stock_value' => round(((int) ($this->total_stock ?? 0)) * (float) $this->selling_price, 2),

            'status' => $this->status,
            'sold_90d' => $this->when(isset($this->sold_90d), fn () => (int) $this->sold_90d),

            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
