<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin \App\Models\VehicleModel
 */
class VehicleModelResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'vehicle_make_id' => $this->vehicle_make_id,
            'make' => $this->whenLoaded('make', fn () => ['id' => $this->make->id, 'name' => $this->make->name]),
        ];
    }
}
