<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use LogicException;

/**
 * Append-only stock ledger.
 *
 * Rows are written once and never touched again — the model actively refuses
 * updates and deletes rather than relying on nobody calling them, so an
 * accidental `->save()` on a loaded movement fails loudly instead of quietly
 * rewriting history.
 */
class StockMovement extends Model
{
    use HasFactory;

    public const UPDATED_AT = null;

    public const STOCK_IN = 'STOCK_IN';
    public const STOCK_OUT = 'STOCK_OUT';
    public const ADJUSTMENT = 'ADJUSTMENT';
    public const TRANSFER = 'TRANSFER';
    public const RETURN = 'RETURN';
    public const SALE = 'SALE';

    public const TYPES = [
        self::STOCK_IN,
        self::STOCK_OUT,
        self::ADJUSTMENT,
        self::TRANSFER,
        self::RETURN,
        self::SALE,
    ];

    protected $fillable = [
        'part_id', 'inventory_id', 'warehouse_id', 'location_id',
        'from_location_id', 'to_location_id', 'type', 'quantity',
        'quantity_before', 'quantity_after', 'reference_type', 'reference_id',
        'reference_no', 'reason', 'user_id',
    ];

    protected function casts(): array
    {
        return [
            'created_at' => 'datetime',
            'quantity' => 'integer',
            'quantity_before' => 'integer',
            'quantity_after' => 'integer',
        ];
    }

    protected static function booted(): void
    {
        static::updating(function (): never {
            throw new LogicException('Stock movements are immutable. Record a compensating movement instead.');
        });

        static::deleting(function (): never {
            throw new LogicException('Stock movements are immutable and cannot be deleted.');
        });
    }

    // ---------- relations ----------

    public function part(): BelongsTo
    {
        return $this->belongsTo(Part::class);
    }

    public function warehouse(): BelongsTo
    {
        return $this->belongsTo(Warehouse::class);
    }

    public function location(): BelongsTo
    {
        return $this->belongsTo(Location::class);
    }

    public function fromLocation(): BelongsTo
    {
        return $this->belongsTo(Location::class, 'from_location_id');
    }

    public function toLocation(): BelongsTo
    {
        return $this->belongsTo(Location::class, 'to_location_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    // ---------- scopes ----------

    public function scopeOfType(Builder $query, ?string $type): Builder
    {
        return $type !== null && in_array($type, self::TYPES, true)
            ? $query->where('type', $type)
            : $query;
    }

    public function scopeBetween(Builder $query, ?string $from, ?string $to): Builder
    {
        return $query
            ->when($from, fn (Builder $q) => $q->where('created_at', '>=', $from.' 00:00:00'))
            ->when($to, fn (Builder $q) => $q->where('created_at', '<=', $to.' 23:59:59'));
    }
}
