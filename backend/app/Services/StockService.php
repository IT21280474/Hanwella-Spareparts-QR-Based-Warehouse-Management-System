<?php

namespace App\Services;

use App\Exceptions\InsufficientStockException;
use App\Models\Inventory;
use App\Models\InventoryAdjustment;
use App\Models\Location;
use App\Models\Part;
use App\Models\StockMovement;
use App\Models\Warehouse;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

/**
 * Every quantity change in the system goes through here.
 *
 * The contract each public method upholds:
 *   1. open a transaction
 *   2. SELECT ... FOR UPDATE the inventory row
 *   3. re-read the quantity *after* the lock is held
 *   4. validate against that freshly-read number
 *   5. write the new quantity and an immutable ledger row together
 *
 * Step 3 is the one that matters. Reading before the lock is what produces the
 * classic race: two cashiers both see 10, both pass validation, and the second
 * write lands on a row that no longer holds 10.
 */
class StockService
{
    public function __construct(
        private readonly AuditLogger $audit,
    ) {}

    /**
     * Receive stock into a location.
     *
     * `$type` defaults to a genuine goods receipt; an order cancellation
     * passes `RETURN` so the ledger records the units coming back for what
     * they are, not as a second unrelated receipt.
     */
    public function stockIn(
        Part $part,
        int $quantity,
        ?int $warehouseId = null,
        ?int $locationId = null,
        ?string $referenceNo = null,
        ?string $reason = null,
        string $type = StockMovement::STOCK_IN,
        ?Model $reference = null,
    ): StockMovement {
        $this->assertPositive($quantity);

        return DB::transaction(function () use ($part, $quantity, $warehouseId, $locationId, $referenceNo, $reason, $type, $reference) {
            $row = $this->lockRow($part, $warehouseId, $locationId);

            $before = $row->quantity;
            $after = $before + $quantity;

            $row->quantity = $after;
            $row->save();

            $movement = $this->recordMovement($part, $row, $type, $quantity, $before, $after, [
                'reference_no' => $referenceNo,
                'reason' => $reason,
                'reference_type' => $reference !== null ? class_basename($reference) : null,
                'reference_id' => $reference?->getKey(),
            ]);

            $this->audit->log('stock.in', $part, ['quantity' => $before], ['quantity' => $after],
                sprintf('Received %d unit(s) of %s', $quantity, $part->part_number));

            return $movement;
        });
    }

    /**
     * Issue stock out of a location.
     *
     * @throws InsufficientStockException when the locked row cannot cover it
     */
    public function stockOut(
        Part $part,
        int $quantity,
        ?int $warehouseId = null,
        ?int $locationId = null,
        ?string $referenceNo = null,
        ?string $reason = null,
        string $type = StockMovement::STOCK_OUT,
        ?Model $reference = null,
    ): StockMovement {
        $this->assertPositive($quantity);

        return DB::transaction(function () use ($part, $quantity, $warehouseId, $locationId, $referenceNo, $reason, $type, $reference) {
            $row = $this->lockRow($part, $warehouseId, $locationId);

            // Re-read under the lock. This is the guard against the race.
            $before = $row->quantity;

            if ($before < $quantity) {
                throw new InsufficientStockException($part->part_number, $before, $quantity);
            }

            $after = $before - $quantity;

            $row->quantity = $after;
            $row->save();

            $movement = $this->recordMovement($part, $row, $type, -$quantity, $before, $after, [
                'reference_no' => $referenceNo,
                'reason' => $reason,
                'reference_type' => $reference !== null ? class_basename($reference) : null,
                'reference_id' => $reference?->getKey(),
            ]);

            $this->audit->log('stock.out', $part, ['quantity' => $before], ['quantity' => $after],
                sprintf('Issued %d unit(s) of %s', $quantity, $part->part_number));

            return $movement;
        });
    }

    /**
     * Apply an adjustment. Never overwrites a quantity blind: the before, the
     * delta, the after, the reason and the actor are all recorded.
     */
    public function adjust(
        Part $part,
        string $adjustmentType,
        int $quantity,
        ?int $warehouseId = null,
        ?int $locationId = null,
        ?string $reason = null,
        ?string $note = null,
    ): InventoryAdjustment {
        $this->assertPositive($quantity);

        if (! in_array($adjustmentType, [
            InventoryAdjustment::STOCK_RECEIVED,
            InventoryAdjustment::MANUAL_ADJUSTMENT,
            InventoryAdjustment::SALE_CORRECTION,
            InventoryAdjustment::DAMAGE_WRITE_OFF,
        ], true)) {
            throw new InvalidArgumentException("Unknown adjustment type [{$adjustmentType}].");
        }

        $negative = in_array($adjustmentType, InventoryAdjustment::NEGATIVE_TYPES, true);
        $delta = $negative ? -$quantity : $quantity;

        return DB::transaction(function () use ($part, $adjustmentType, $delta, $quantity, $negative, $warehouseId, $locationId, $reason, $note) {
            $row = $this->lockRow($part, $warehouseId, $locationId);

            $before = $row->quantity;

            if ($negative && $before < $quantity) {
                throw new InsufficientStockException($part->part_number, $before, $quantity);
            }

            $after = $before + $delta;

            $row->quantity = $after;
            $row->save();

            $adjustment = InventoryAdjustment::create([
                'part_id' => $part->id,
                'inventory_id' => $row->id,
                'adjustment_type' => $adjustmentType,
                'quantity_before' => $before,
                'adjustment' => $delta,
                'quantity_after' => $after,
                'reason' => $reason,
                'note' => $note,
                'user_id' => Auth::id(),
            ]);

            $this->recordMovement($part, $row, StockMovement::ADJUSTMENT, $delta, $before, $after, [
                'reason' => $reason ?? $adjustmentType,
                'reference_type' => 'InventoryAdjustment',
                'reference_id' => $adjustment->id,
            ]);

            $this->audit->log('stock.adjust', $part,
                ['quantity' => $before],
                ['quantity' => $after, 'adjustment_type' => $adjustmentType],
                sprintf('%s: %+d unit(s) of %s', $adjustmentType, $delta, $part->part_number));

            return $adjustment;
        });
    }

    /**
     * Move stock between two locations. Both rows are locked in a stable order
     * (lowest id first) so two opposing transfers can never deadlock.
     */
    public function transfer(
        Part $part,
        int $quantity,
        int $fromLocationId,
        int $toLocationId,
        ?string $reason = null,
    ): StockMovement {
        $this->assertPositive($quantity);

        if ($fromLocationId === $toLocationId) {
            throw new InvalidArgumentException('Source and destination locations must differ.');
        }

        return DB::transaction(function () use ($part, $quantity, $fromLocationId, $toLocationId, $reason) {
            // Acquire both locks in a stable order so two opposing transfers
            // can never each hold the row the other is waiting on.
            $ascending = $fromLocationId < $toLocationId;
            [$firstId, $secondId] = $ascending
                ? [$fromLocationId, $toLocationId]
                : [$toLocationId, $fromLocationId];

            $first = $this->lockRow($part, null, $firstId);
            $second = $this->lockRow($part, null, $secondId);

            [$source, $target] = $ascending ? [$first, $second] : [$second, $first];

            $sourceBefore = $source->quantity;

            if ($sourceBefore < $quantity) {
                throw new InsufficientStockException($part->part_number, $sourceBefore, $quantity);
            }

            $targetBefore = $target->quantity;

            $source->quantity = $sourceBefore - $quantity;
            $source->save();

            $target->quantity = $targetBefore + $quantity;
            $target->save();

            $movement = StockMovement::create([
                'part_id' => $part->id,
                'inventory_id' => $target->id,
                'warehouse_id' => $target->warehouse_id,
                'location_id' => $target->location_id,
                'from_location_id' => $fromLocationId,
                'to_location_id' => $toLocationId,
                'type' => StockMovement::TRANSFER,
                'quantity' => $quantity,
                'quantity_before' => $targetBefore,
                'quantity_after' => $target->quantity,
                'reason' => $reason,
                'user_id' => Auth::id(),
            ]);

            $this->audit->log('stock.transfer', $part,
                ['from_location_id' => $fromLocationId, 'quantity' => $sourceBefore],
                ['to_location_id' => $toLocationId, 'quantity' => $target->quantity],
                sprintf('Transferred %d unit(s) of %s', $quantity, $part->part_number));

            return $movement;
        });
    }

    // ---------- internals ----------

    /**
     * Fetch the inventory row for this part/warehouse/location under a row
     * lock, creating it first if it does not exist yet.
     *
     * `firstOrCreate` runs outside the lock deliberately: the unique index on
     * (part, warehouse, location) is what makes the create safe under
     * concurrency, and we then re-select FOR UPDATE so the caller always holds
     * a genuine lock on a row that exists.
     */
    private function lockRow(Part $part, ?int $warehouseId, ?int $locationId): Inventory
    {
        // A location already knows its warehouse; only fall back to the default
        // when the caller named neither.
        $warehouseId ??= $locationId !== null
            ? Location::whereKey($locationId)->value('warehouse_id')
            : null;

        $warehouseId ??= $this->defaultWarehouseId();

        Inventory::firstOrCreate(
            [
                'part_id' => $part->id,
                'warehouse_id' => $warehouseId,
                'location_id' => $locationId,
            ],
            ['quantity' => 0, 'reserved_quantity' => 0],
        );

        return Inventory::where('part_id', $part->id)
            ->where('warehouse_id', $warehouseId)
            ->where(fn ($q) => $locationId === null
                ? $q->whereNull('location_id')
                : $q->where('location_id', $locationId))
            ->lockForUpdate()
            ->firstOrFail();
    }

    private function defaultWarehouseId(): int
    {
        return Warehouse::query()->where('is_active', true)->value('id')
            ?? throw new InvalidArgumentException('No active warehouse is configured.');
    }

    private function recordMovement(
        Part $part,
        Inventory $row,
        string $type,
        int $signedQuantity,
        int $before,
        int $after,
        array $extra = [],
    ): StockMovement {
        return StockMovement::create(array_merge([
            'part_id' => $part->id,
            'inventory_id' => $row->id,
            'warehouse_id' => $row->warehouse_id,
            'location_id' => $row->location_id,
            'type' => $type,
            'quantity' => $signedQuantity,
            'quantity_before' => $before,
            'quantity_after' => $after,
            'user_id' => Auth::id(),
        ], array_filter($extra, static fn ($v) => $v !== null)));
    }

    private function assertPositive(int $quantity): void
    {
        if ($quantity <= 0) {
            throw new InvalidArgumentException('Quantity must be greater than zero.');
        }
    }
}
