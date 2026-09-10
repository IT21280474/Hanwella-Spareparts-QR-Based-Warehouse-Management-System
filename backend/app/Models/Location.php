<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * One node in the Warehouse -> Zone -> Rack -> Shelf -> Bin tree.
 */
class Location extends Model
{
    use HasFactory;

    public const ZONE = 'ZONE';
    public const RACK = 'RACK';
    public const SHELF = 'SHELF';
    public const BIN = 'BIN';

    /** Valid child type for each level; a BIN is a leaf. */
    public const CHILD_OF = [
        self::ZONE => self::RACK,
        self::RACK => self::SHELF,
        self::SHELF => self::BIN,
    ];

    protected $fillable = [
        'warehouse_id', 'parent_id', 'type', 'name', 'code', 'full_path', 'is_active',
    ];

    protected function casts(): array
    {
        return ['is_active' => 'boolean'];
    }

    public function warehouse(): BelongsTo
    {
        return $this->belongsTo(Warehouse::class);
    }

    public function parent(): BelongsTo
    {
        return $this->belongsTo(self::class, 'parent_id');
    }

    public function children(): HasMany
    {
        return $this->hasMany(self::class, 'parent_id');
    }

    public function inventory(): HasMany
    {
        return $this->hasMany(Inventory::class);
    }

    /**
     * Rebuild the denormalised display path from the parent chain.
     */
    public function buildPath(): string
    {
        $segments = [$this->code];

        for ($node = $this->parent; $node !== null; $node = $node->parent) {
            array_unshift($segments, $node->code);
        }

        array_unshift($segments, $this->warehouse?->code ?? '');

        return implode(' / ', array_filter($segments));
    }
}
