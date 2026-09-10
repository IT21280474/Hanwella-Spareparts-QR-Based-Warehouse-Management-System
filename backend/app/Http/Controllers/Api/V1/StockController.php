<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Stock\AdjustStockRequest;
use App\Http\Requests\Stock\StockMoveRequest;
use App\Http\Resources\InventoryAdjustmentResource;
use App\Http\Resources\StockMovementResource;
use App\Models\Part;
use App\Services\StockService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;

/**
 * The two ways stock changes outside a sale: a receipt, an issue, or a
 * counted correction. Every write here goes straight through
 * {@see StockService}, which is the only place a quantity is ever touched.
 */
class StockController extends Controller
{
    public function __construct(private readonly StockService $stock) {}

    public function stockIn(StockMoveRequest $request): JsonResponse
    {
        $data = $request->validated();
        $part = Part::findOrFail($data['part_id']);

        $movement = $this->stock->stockIn(
            $part,
            (int) $data['quantity'],
            $data['warehouse_id'] ?? null,
            $data['location_id'] ?? null,
            $data['reference_no'] ?? null,
            $data['note'] ?? null,
        );

        return ApiResponse::success(
            new StockMovementResource($movement->load(['part', 'warehouse:id,name', 'location'])),
            "Received {$data['quantity']} unit(s) of {$part->name}.",
        );
    }

    public function stockOut(StockMoveRequest $request): JsonResponse
    {
        $data = $request->validated();
        $part = Part::findOrFail($data['part_id']);

        $movement = $this->stock->stockOut(
            $part,
            (int) $data['quantity'],
            $data['warehouse_id'] ?? null,
            $data['location_id'] ?? null,
            $data['reference_no'] ?? null,
            $data['note'] ?? null,
        );

        return ApiResponse::success(
            new StockMovementResource($movement->load(['part', 'warehouse:id,name', 'location'])),
            "Issued {$data['quantity']} unit(s) of {$part->name}.",
        );
    }

    public function adjust(AdjustStockRequest $request): JsonResponse
    {
        $data = $request->validated();
        $part = Part::findOrFail($data['part_id']);

        $adjustment = $this->stock->adjust(
            $part,
            $data['adjustment_type'],
            (int) $data['quantity'],
            null,
            null,
            $data['adjustment_type'],
            $data['note'] ?? null,
        );

        return ApiResponse::success(
            new InventoryAdjustmentResource($adjustment->load('user:id,name')),
            "{$part->qrCode?->code} adjusted successfully.",
        );
    }
}
