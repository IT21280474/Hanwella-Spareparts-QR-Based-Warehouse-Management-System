<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;

class Part extends Model
{
    use HasFactory, SoftDeletes;

    public const ACTIVE = 'ACTIVE';
    public const ARCHIVED = 'ARCHIVED';

    /** Stock status buckets, matching the reference's three states. */
    public const IN_STOCK = 'in';
    public const LOW_STOCK = 'low';
    public const OUT_OF_STOCK = 'out';

    protected $fillable = [
        'part_number', 'sku', 'name', 'description', 'image_path', 'category_id', 'supplier_id',
        'vehicle_model_id', 'unit', 'selling_price', 'cost_price', 'min_stock',
        'status', 'created_by',
    ];

    protected function casts(): array
    {
        return [
            'selling_price' => 'decimal:2',
            'cost_price' => 'decimal:2',
            'min_stock' => 'integer',
        ];
    }

    // ---------- relations ----------

    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class);
    }

    public function supplier(): BelongsTo
    {
        return $this->belongsTo(Supplier::class);
    }

    public function vehicleModel(): BelongsTo
    {
        return $this->belongsTo(VehicleModel::class);
    }

    public function qrCode(): HasOne
    {
        return $this->hasOne(QrCode::class);
    }

    public function inventory(): HasMany
    {
        return $this->hasMany(Inventory::class);
    }

    public function movements(): HasMany
    {
        return $this->hasMany(StockMovement::class);
    }

    public function adjustments(): HasMany
    {
        return $this->hasMany(InventoryAdjustment::class);
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    // ---------- derived ----------

    /**
     * Total on-hand across every location. Prefer the `total_stock` aggregate
     * added by {@see scopeWithStock()} — this accessor falls back to a query
     * only when the aggregate is absent.
     */
    public function getTotalStockAttribute(): int
    {
        if (array_key_exists('total_stock', $this->attributes)) {
            return (int) $this->attributes['total_stock'];
        }

        return (int) $this->inventory()->sum('quantity');
    }

    public function getStockStatusAttribute(): string
    {
        $stock = $this->total_stock;

        return match (true) {
            $stock === 0 => self::OUT_OF_STOCK,
            $stock <= $this->min_stock => self::LOW_STOCK,
            default => self::IN_STOCK,
        };
    }

    // ---------- scopes ----------

    /**
     * Attach `total_stock` so status and sorting never trigger N+1 queries.
     *
     * `groupBy('parts.id')` is a no-op on the actual rows returned (grouping
     * by the primary key produces exactly one group per row, same as
     * ungrouped) — it exists only so `ONLY_FULL_GROUP_BY` (on by default on
     * MySQL 8 and stricter still on some MariaDB builds) allows referencing
     * `parts.*` columns and the `total_stock` alias in the HAVING/ORDER BY
     * clauses {@see scopeStockStatus()} and its callers add on top of this.
     */
    public function scopeWithStock(Builder $query): Builder
    {
        return $query->withSum('inventory as total_stock', 'quantity')->groupBy('parts.id');
    }

    public function scopeSearch(Builder $query, ?string $term): Builder
    {
        $term = trim((string) $term);

        if ($term === '') {
            return $query;
        }

        return $query->where(function (Builder $q) use ($term) {
            $like = '%'.$term.'%';

            $q->where('parts.name', 'like', $like)
                ->orWhere('parts.part_number', 'like', $like)
                ->orWhere('parts.sku', 'like', $like)
                ->orWhereHas('qrCode', fn (Builder $qr) => $qr->where('code', 'like', $like))
                ->orWhereHas('category', fn (Builder $c) => $c->where('name', 'like', $like));
        });
    }

    /**
     * Filter by stock bucket. Applied against the summed quantity, so it has to
     * run as a HAVING clause on the aggregate rather than a WHERE.
     */
    public function scopeStockStatus(Builder $query, ?string $status): Builder
    {
        return match ($status) {
            self::OUT_OF_STOCK => $query->havingRaw('COALESCE(total_stock, 0) = 0'),
            self::LOW_STOCK => $query->havingRaw('COALESCE(total_stock, 0) > 0 AND COALESCE(total_stock, 0) <= parts.min_stock'),
            self::IN_STOCK => $query->havingRaw('COALESCE(total_stock, 0) > parts.min_stock'),
            default => $query,
        };
    }

    public function scopeActive(Builder $query): Builder
    {
        return $query->where('parts.status', self::ACTIVE);
    }
}
