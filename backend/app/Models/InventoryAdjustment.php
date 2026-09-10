<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class InventoryAdjustment extends Model
{
    use HasFactory;

    public const UPDATED_AT = null;

    /** The reference's four adjustment types. */
    public const STOCK_RECEIVED = 'STOCK_RECEIVED';
    public const MANUAL_ADJUSTMENT = 'MANUAL_ADJUSTMENT';
    public const SALE_CORRECTION = 'SALE_CORRECTION';
    public const DAMAGE_WRITE_OFF = 'DAMAGE_WRITE_OFF';

    /** Types that subtract rather than add. */
    public const NEGATIVE_TYPES = [self::SALE_CORRECTION, self::DAMAGE_WRITE_OFF];

    protected $fillable = [
        'part_id', 'inventory_id', 'adjustment_type', 'quantity_before',
        'adjustment', 'quantity_after', 'reason', 'note', 'user_id',
    ];

    protected function casts(): array
    {
        return [
            'created_at' => 'datetime',
            'quantity_before' => 'integer',
            'adjustment' => 'integer',
            'quantity_after' => 'integer',
        ];
    }

    public function part(): BelongsTo
    {
        return $this->belongsTo(Part::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
