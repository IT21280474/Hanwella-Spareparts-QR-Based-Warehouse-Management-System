<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Requests\Stock\TransferRequest;
use App\Http\Controllers\Controller;
use App\Http\Resources\PartResource;
use App\Models\Part;
use App\Services\StockService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * The stock-aware inventory listing: a part joined with its on-hand position.
 *
 * This is the screen a warehouse user actually lives on, so unlike
 * {@see PartController::index()} it also reports the status-tab counts and
 * the on-hand/needs-attention summary line in one round trip — the browser
 * never fetches the whole catalogue twice to build both.
 */
class InventoryController extends Controller
{
    public function __construct(private readonly StockService $stock) {}

    public function index(Request $request): JsonResponse
    {
        $perPage = min((int) $request->integer('per_page', config('wms.per_page')), config('wms.max_per_page'));
        $search = $request->string('search')->toString();
        $categoryId = $request->filled('category') ? $request->integer('category') : null;
        $supplierId = $request->filled('supplier') ? $request->integer('supplier') : null;

        // Every part is listed here regardless of ACTIVE/ARCHIVED status: a
        // discontinued part with stock still on the shelf must stay visible
        // until that stock is sold or adjusted away. Status is informational,
        // shown as a badge on the part record — not a listing filter.
        $base = fn () => Part::query()
            ->withStock()
            ->search($search)
            ->when($categoryId, fn ($q) => $q->where('category_id', $categoryId))
            ->when($supplierId, fn ($q) => $q->where('supplier_id', $supplierId));

        $rows = $base()
            ->with(['category:id,name', 'qrCode:id,part_id,code'])
            ->stockStatus($request->filled('status') ? $request->string('status')->toString() : null)
            ->orderBy($this->sortColumn($request), $request->string('direction', 'desc')->toString() === 'asc' ? 'asc' : 'desc')
            ->paginate($perPage);

        // A lean pass over the same filters (minus the status tab itself) for
        // the tab counts and the summary line — cheap because only two
        // integer columns are selected per part.
        $summary = $base()->get(['parts.id', 'parts.min_stock']);
        $counts = ['all' => $summary->count(), 'in' => 0, 'low' => 0, 'out' => 0];
        $unitsOnHand = 0;

        foreach ($summary as $part) {
            $unitsOnHand += (int) $part->total_stock;
            $counts[$part->stock_status === Part::IN_STOCK ? 'in' : ($part->stock_status === Part::LOW_STOCK ? 'low' : 'out')]++;
        }

        return ApiResponse::paginated(PartResource::collection($rows), 'Inventory retrieved successfully.', [
            'units_on_hand' => $unitsOnHand,
            'needs_attention' => $counts['low'] + $counts['out'],
            'status_counts' => $counts,
        ]);
    }

    public function show(Part $part): JsonResponse
    {
        $part->load(['category:id,name', 'supplier:id,name', 'qrCode']);
        $part->setAttribute('total_stock', (int) $part->inventory()->sum('quantity'));

        return ApiResponse::success(new PartResource($part), 'Inventory record retrieved successfully.');
    }

    public function transfer(TransferRequest $request): JsonResponse
    {
        $data = $request->validated();
        $part = Part::findOrFail($data['part_id']);

        $movement = $this->stock->transfer(
            $part,
            (int) $data['quantity'],
            (int) $data['from_location_id'],
            (int) $data['to_location_id'],
            $data['reason'] ?? null,
        );

        return ApiResponse::success(
            new \App\Http\Resources\StockMovementResource($movement->load(['part', 'warehouse:id,name', 'location'])),
            'Stock transferred successfully.',
        );
    }

    private function sortColumn(Request $request): string
    {
        $sort = $request->string('sort', 'updated_at')->toString();

        return match ($sort) {
            'name', 'selling_price', 'quantity', 'updated_at' => $sort === 'quantity' ? 'total_stock' : $sort,
            default => 'updated_at',
        };
    }
}
