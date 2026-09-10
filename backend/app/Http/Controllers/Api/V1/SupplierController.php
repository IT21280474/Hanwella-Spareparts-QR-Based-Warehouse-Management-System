<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Catalog\SupplierRequest;
use App\Http\Resources\SupplierResource;
use App\Models\Supplier;
use App\Services\AuditLogger;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SupplierController extends Controller
{
    public function __construct(private readonly AuditLogger $audit) {}

    public function index(Request $request): JsonResponse
    {
        $perPage = min((int) $request->integer('per_page', config('wms.per_page')), config('wms.max_per_page'));

        $suppliers = Supplier::query()
            ->withCount('parts')
            ->when($request->filled('search'), fn ($q) => $q->where('name', 'like', '%'.$request->string('search').'%'))
            ->when($request->filled('is_active'), fn ($q) => $q->where('is_active', $request->boolean('is_active')))
            ->orderBy('name')
            ->paginate($perPage);

        return ApiResponse::paginated(SupplierResource::collection($suppliers), 'Suppliers retrieved successfully.');
    }

    public function store(SupplierRequest $request): JsonResponse
    {
        $supplier = Supplier::create($request->validated());
        $this->audit->log('supplier.create', $supplier, [], $supplier->getAttributes(), "Supplier {$supplier->name} created");

        return ApiResponse::created(new SupplierResource($supplier), 'Supplier created successfully.');
    }

    public function show(Supplier $supplier): JsonResponse
    {
        return ApiResponse::success(new SupplierResource($supplier->loadCount('parts')), 'Supplier retrieved successfully.');
    }

    public function update(SupplierRequest $request, Supplier $supplier): JsonResponse
    {
        $before = $supplier->getAttributes();
        $supplier->update($request->validated());
        $this->audit->log('supplier.update', $supplier, $before, $supplier->getAttributes(), "Supplier {$supplier->name} updated");

        return ApiResponse::success(new SupplierResource($supplier), 'Supplier updated successfully.');
    }

    public function destroy(Supplier $supplier): JsonResponse
    {
        if ($supplier->parts()->exists()) {
            return ApiResponse::error(
                'This supplier has spare parts assigned to it. Reassign or remove them first.',
                409,
            );
        }

        $supplier->delete();
        $this->audit->log('supplier.delete', $supplier, $supplier->getAttributes(), [], "Supplier {$supplier->name} deleted");

        return ApiResponse::deleted('Supplier deleted successfully.');
    }
}
