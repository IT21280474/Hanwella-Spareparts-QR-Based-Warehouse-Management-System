<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\VehicleMakeResource;
use App\Http\Resources\VehicleModelResource;
use App\Models\VehicleMake;
use App\Models\VehicleModel;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Read-only fitment reference: the make/model tree a part is attached to.
 *
 * The catalogue itself is fixture data seeded by {@see \Database\Seeders\CatalogSeeder}
 * rather than something warehouse staff maintain — no write endpoints exist.
 */
class VehicleReferenceController extends Controller
{
    public function makes(): JsonResponse
    {
        $makes = VehicleMake::query()->where('is_active', true)->orderBy('name')->get();

        return ApiResponse::success(VehicleMakeResource::collection($makes), 'Vehicle makes retrieved successfully.');
    }

    public function models(Request $request): JsonResponse
    {
        $models = VehicleModel::query()
            ->with('make:id,name')
            ->when($request->filled('make'), fn ($q) => $q->where('vehicle_make_id', $request->integer('make')))
            ->orderBy('name')
            ->get();

        return ApiResponse::success(VehicleModelResource::collection($models), 'Vehicle models retrieved successfully.');
    }
}
