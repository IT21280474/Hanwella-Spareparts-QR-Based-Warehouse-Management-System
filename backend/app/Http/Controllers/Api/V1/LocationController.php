<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Catalog\LocationRequest;
use App\Http\Resources\LocationResource;
use App\Models\Location;
use App\Services\AuditLogger;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class LocationController extends Controller
{
    public function __construct(private readonly AuditLogger $audit) {}

    public function index(Request $request): JsonResponse
    {
        $perPage = min((int) $request->integer('per_page', config('wms.max_per_page')), config('wms.max_per_page'));

        $locations = Location::query()
            ->with('warehouse:id,name')
            ->when($request->filled('warehouse'), fn ($q) => $q->where('warehouse_id', $request->integer('warehouse')))
            ->when($request->filled('parent'), fn ($q) => $q->where('parent_id', $request->integer('parent')))
            ->when($request->filled('type'), fn ($q) => $q->where('type', $request->string('type')))
            ->when($request->filled('search'), fn ($q) => $q->where(function ($q) use ($request) {
                $like = '%'.$request->string('search').'%';
                $q->where('name', 'like', $like)->orWhere('full_path', 'like', $like);
            }))
            ->orderBy('full_path')
            ->paginate($perPage);

        return ApiResponse::paginated(LocationResource::collection($locations), 'Locations retrieved successfully.');
    }

    public function store(LocationRequest $request): JsonResponse
    {
        $data = $request->validated();
        $parent = isset($data['parent_id']) ? Location::find($data['parent_id']) : null;

        $location = new Location($data);
        $location->full_path = $this->buildPath($parent, $data['warehouse_id'], $data['code']);
        $location->save();

        $this->audit->log('location.create', $location, [], $location->getAttributes(), "Location {$location->full_path} created");

        return ApiResponse::created(new LocationResource($location->load('warehouse:id,name')), 'Location created successfully.');
    }

    public function show(Location $location): JsonResponse
    {
        return ApiResponse::success(new LocationResource($location->load('warehouse:id,name')), 'Location retrieved successfully.');
    }

    public function update(LocationRequest $request, Location $location): JsonResponse
    {
        $before = $location->getAttributes();
        $data = $request->validated();
        $parent = isset($data['parent_id']) ? Location::find($data['parent_id']) : null;

        $location->fill($data);
        $location->full_path = $this->buildPath($parent, $data['warehouse_id'], $data['code']);
        $location->save();

        // A renamed node's descendants carry a now-stale display cache.
        $this->rebuildDescendantPaths($location);

        $this->audit->log('location.update', $location, $before, $location->getAttributes(), "Location {$location->full_path} updated");

        return ApiResponse::success(new LocationResource($location->load('warehouse:id,name')), 'Location updated successfully.');
    }

    public function destroy(Location $location): JsonResponse
    {
        if ($location->children()->exists()) {
            return ApiResponse::error('This location has child locations. Remove them first.', 409);
        }

        if ($location->inventory()->where('quantity', '>', 0)->exists()) {
            return ApiResponse::error('This location still holds stock. Move it out before removing the location.', 409);
        }

        $location->delete();
        $this->audit->log('location.delete', $location, $location->getAttributes(), [], "Location {$location->full_path} deleted");

        return ApiResponse::deleted('Location deleted successfully.');
    }

    private function buildPath(?Location $parent, int $warehouseId, string $code): string
    {
        if ($parent !== null) {
            return $parent->full_path.' · '.$code;
        }

        return \App\Models\Warehouse::whereKey($warehouseId)->value('code').' · '.$code;
    }

    private function rebuildDescendantPaths(Location $location): void
    {
        foreach ($location->children()->get() as $child) {
            $child->full_path = $location->full_path.' · '.$child->code;
            $child->save();
            $this->rebuildDescendantPaths($child);
        }
    }
}
