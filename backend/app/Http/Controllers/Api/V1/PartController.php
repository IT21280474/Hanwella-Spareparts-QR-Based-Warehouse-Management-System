<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Catalog\PartRequest;
use App\Http\Resources\PartResource;
use App\Http\Resources\StockMovementResource;
use App\Models\Part;
use App\Models\StockMovement;
use App\Services\AuditLogger;
use App\Services\PartImageService;
use App\Services\QrService;
use App\Services\StockService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * The part-master CRUD surface: create, edit, delete and per-part history.
 *
 * The richer, stock-aware, filterable listing used by the main inventory
 * screen lives on {@see InventoryController} instead — the two read
 * different projections of the same rows for different jobs.
 */
class PartController extends Controller
{
    public function __construct(
        private readonly AuditLogger $audit,
        private readonly QrService $qr,
        private readonly StockService $stock,
        private readonly PartImageService $images,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $perPage = min((int) $request->integer('per_page', config('wms.per_page')), config('wms.max_per_page'));

        $parts = Part::query()
            ->with(['category:id,name', 'qrCode:id,part_id,code'])
            ->withStock()
            ->search($request->string('search')->toString())
            ->when($request->filled('category'), fn ($q) => $q->where('category_id', $request->integer('category')))
            ->when($request->filled('supplier'), fn ($q) => $q->where('supplier_id', $request->integer('supplier')))
            ->when($request->filled('status'), fn ($q) => $q->where('status', $request->string('status')))
            ->orderBy($this->sortColumn($request), $request->string('direction', 'desc')->toString() === 'asc' ? 'asc' : 'desc')
            ->paginate($perPage);

        return ApiResponse::paginated(PartResource::collection($parts), 'Parts retrieved successfully.');
    }

    public function store(PartRequest $request): JsonResponse
    {
        $data = $request->validated();
        // Stored ahead of the transaction: file I/O isn't transactional, and
        // a rejected/failed DB write shouldn't hold the upload open.
        $imagePath = $request->hasFile('image') ? $this->images->store($request->file('image')) : null;

        $part = DB::transaction(function () use ($data, $request, $imagePath) {
            $part = Part::create([
                'part_number' => $data['part_number'],
                // A hand-typed SKU is optional; the part number already
                // carries a unique constraint, so it is a safe default.
                'sku' => $data['sku'] ?? $data['part_number'],
                'name' => $data['name'],
                'description' => $data['description'] ?? null,
                'image_path' => $imagePath,
                'category_id' => $data['category_id'],
                'supplier_id' => $data['supplier_id'] ?? null,
                'vehicle_model_id' => $data['vehicle_model_id'] ?? null,
                'unit' => $data['unit'] ?? config('wms.inventory.default_unit'),
                'selling_price' => $data['selling_price'],
                'cost_price' => $data['cost_price'] ?? 0,
                'min_stock' => $data['min_stock'] ?? config('wms.inventory.default_min_stock'),
                'status' => $data['status'] ?? Part::ACTIVE,
                'created_by' => $request->user()->id,
            ]);

            if (! empty($data['qr_code'])) {
                $this->qr->assignSpecific($part, $data['qr_code']);
            } else {
                $this->qr->generateFor($part);
            }

            if ((int) $data['quantity'] > 0) {
                $this->stock->stockIn(
                    $part,
                    (int) $data['quantity'],
                    $data['warehouse_id'] ?? null,
                    $data['location_id'] ?? null,
                    'OPENING',
                    'Opening stock at creation',
                );
            }

            $this->audit->log('part.create', $part, [], $part->getAttributes(), "Part {$part->name} created");

            return $part;
        });

        return ApiResponse::created($this->present($part->fresh()), 'Spare part added successfully.');
    }

    public function show(Part $part): JsonResponse
    {
        $part->load(['category:id,name', 'supplier:id,name', 'vehicleModel.make', 'qrCode']);

        return ApiResponse::success($this->present($part, withSoldCount: true), 'Spare part retrieved successfully.');
    }

    public function update(PartRequest $request, Part $part): JsonResponse
    {
        $before = $part->getAttributes();
        $data = $request->validated();

        $imagePath = $part->image_path;
        if ($request->hasFile('image')) {
            $this->images->deleteIfUnshared($imagePath, $part->id);
            $imagePath = $this->images->store($request->file('image'));
        } elseif ($request->boolean('remove_image') && $imagePath) {
            $this->images->deleteIfUnshared($imagePath, $part->id);
            $imagePath = null;
        }

        $part->fill([
            'part_number' => $data['part_number'],
            'sku' => $data['sku'] ?? $part->sku,
            'name' => $data['name'],
            'description' => $data['description'] ?? null,
            'image_path' => $imagePath,
            'category_id' => $data['category_id'],
            'supplier_id' => $data['supplier_id'] ?? null,
            'vehicle_model_id' => $data['vehicle_model_id'] ?? null,
            'unit' => $data['unit'] ?? $part->unit,
            'selling_price' => $data['selling_price'],
            'cost_price' => $data['cost_price'] ?? $part->cost_price,
            'min_stock' => $data['min_stock'] ?? $part->min_stock,
            'status' => $data['status'] ?? $part->status,
        ])->save();

        $this->audit->log('part.update', $part, $before, $part->getAttributes(), "Part {$part->name} updated");

        return ApiResponse::success($this->present($part->fresh()), 'Spare part updated successfully.');
    }

    public function destroy(Part $part): JsonResponse
    {
        $onHand = (int) $part->inventory()->sum('quantity');

        if ($onHand > 0) {
            return ApiResponse::error(
                "This part still has {$onHand} unit(s) on hand. Issue or adjust it to zero before deleting.",
                409,
            );
        }

        $part->delete();
        $this->audit->log('part.delete', $part, $part->getAttributes(), [], "Part {$part->name} deleted");

        return ApiResponse::deleted('Spare part removed successfully.');
    }

    public function movements(Request $request, Part $part): JsonResponse
    {
        $perPage = min((int) $request->integer('per_page', config('wms.per_page')), config('wms.max_per_page'));

        $movements = StockMovement::query()
            ->with(['user:id,name', 'part:id,part_number', 'part.qrCode:id,part_id,code'])
            ->where('part_id', $part->id)
            ->orderByDesc('created_at')
            ->paginate($perPage);

        return ApiResponse::paginated(StockMovementResource::collection($movements), 'Movement history retrieved successfully.');
    }

    private function sortColumn(Request $request): string
    {
        $sort = $request->string('sort', 'updated_at')->toString();

        return in_array($sort, ['name', 'selling_price', 'updated_at', 'created_at'], true) ? $sort : 'updated_at';
    }

    private function present(Part $part, bool $withSoldCount = false): PartResource
    {
        $part->loadMissing(['category:id,name', 'supplier:id,name', 'vehicleModel.make', 'qrCode']);
        $part->setAttribute('total_stock', (int) $part->inventory()->sum('quantity'));

        $primaryLocation = $part->inventory()
            ->with('location:id,full_path')
            ->whereNotNull('location_id')
            ->orderByDesc('quantity')
            ->first();
        $part->setAttribute('primary_bin', $primaryLocation?->location?->full_path);

        if ($withSoldCount) {
            $sold = StockMovement::query()
                ->where('part_id', $part->id)
                ->where('type', StockMovement::SALE)
                ->where('created_at', '>=', now()->subDays(90))
                ->sum(DB::raw('ABS(quantity)'));
            $part->setAttribute('sold_90d', (int) $sold);
        }

        return new PartResource($part);
    }
}
