<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class SalesOrder extends Model
{
    use HasFactory;

    public const PAID = 'PAID';
    public const PENDING = 'PENDING';
    public const PARTIALLY_PAID = 'PARTIALLY_PAID';
    public const CANCELLED = 'CANCELLED';

    public const PAYMENT_STATUSES = [self::PAID, self::PENDING, self::PARTIALLY_PAID, self::CANCELLED];
    public const PAYMENT_MODES = ['CASH', 'CARD', 'BANK_TRANSFER', 'CREDIT'];

    protected $fillable = [
        'order_no', 'customer_name', 'customer_phone', 'subtotal', 'discount',
        'total', 'paid_amount', 'payment_status', 'payment_mode', 'status',
        'cashier_id', 'ordered_at', 'stock_deducted_at', 'dispatched_at', 'dispatched_by',
    ];

    protected function casts(): array
    {
        return [
            'subtotal' => 'decimal:2',
            'discount' => 'decimal:2',
            'total' => 'decimal:2',
            'paid_amount' => 'decimal:2',
            'ordered_at' => 'datetime',
            'stock_deducted_at' => 'datetime',
            'dispatched_at' => 'datetime',
        ];
    }

    public function items(): HasMany
    {
        return $this->hasMany(SalesOrderItem::class);
    }

    public function cashier(): BelongsTo
    {
        return $this->belongsTo(User::class, 'cashier_id');
    }

    public function dispatchedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'dispatched_by');
    }

    public function getOutstandingAttribute(): float
    {
        return round((float) $this->total - (float) $this->paid_amount, 2);
    }

    public function scopeSearch(Builder $query, ?string $term): Builder
    {
        $term = trim((string) $term);

        if ($term === '') {
            return $query;
        }

        $like = '%'.$term.'%';

        return $query->where(fn (Builder $q) => $q
            ->where('order_no', 'like', $like)
            ->orWhere('customer_name', 'like', $like)
            ->orWhereHas('cashier', fn (Builder $c) => $c->where('name', 'like', $like)));
    }
}
