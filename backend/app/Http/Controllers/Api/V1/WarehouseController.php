<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Catalog\WarehouseRequest;
use App\Http\Resources\WarehouseResource;
use App\Models\Warehouse;
use App\Services\AuditLogger;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class WarehouseController extends Controller
{
    public function __construct(private readonly AuditLogger $audit) {}

    public function index(Request $request): JsonResponse
    {
        $perPage = min((int) $request->integer('per_page', config('wms.per_page')), config('wms.max_per_page'));

        $warehouses = Warehouse::query()
            ->when($request->filled('search'), fn ($q) => $q->where('name', 'like', '%'.$request->string('search').'%'))
            ->when($request->filled('is_active'), fn ($q) => $q->where('is_active', $request->boolean('is_active')))
            ->orderBy('name')
            ->paginate($perPage);

        return ApiResponse::paginated(WarehouseResource::collection($warehouses), 'Warehouses retrieved successfully.');
    }

    public function store(WarehouseRequest $request): JsonResponse
    {
        $warehouse = Warehouse::create($request->validated() + ['is_active' => true]);
        $this->audit->log('warehouse.create', $warehouse, [], $warehouse->getAttributes(), "Warehouse {$warehouse->name} created");

        return ApiResponse::created(new WarehouseResource($warehouse), 'Warehouse created successfully.');
    }

    public function show(Warehouse $warehouse): JsonResponse
    {
        return ApiResponse::success(new WarehouseResource($warehouse), 'Warehouse retrieved successfully.');
    }

    public function update(WarehouseRequest $request, Warehouse $warehouse): JsonResponse
    {
        $before = $warehouse->getAttributes();
        $warehouse->update($request->validated());
        $this->audit->log('warehouse.update', $warehouse, $before, $warehouse->getAttributes(), "Warehouse {$warehouse->name} updated");

        return ApiResponse::success(new WarehouseResource($warehouse), 'Warehouse updated successfully.');
    }

    public function destroy(Warehouse $warehouse): JsonResponse
    {
        if ($warehouse->inventory()->where('quantity', '>', 0)->exists()) {
            return ApiResponse::error('This warehouse still holds stock. Move it out before removing the warehouse.', 409);
        }

        $warehouse->delete();
        $this->audit->log('warehouse.delete', $warehouse, $warehouse->getAttributes(), [], "Warehouse {$warehouse->name} deleted");

        return ApiResponse::deleted('Warehouse deleted successfully.');
    }
}
