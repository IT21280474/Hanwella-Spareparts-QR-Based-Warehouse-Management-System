<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class SalesOrder extends Model
{
    use HasFactory;

    public const PAID = 'PAID';
    public const PENDING = 'PENDING';
    public const PARTIALLY_PAID = 'PARTIALLY_PAID';
    public const CANCELLED = 'CANCELLED';

    public const PAYMENT_STATUSES = [self::PAID, self::PENDING, self::PARTIALLY_PAID, self::CANCELLED];
    public const PAYMENT_MODES = ['CASH', 'CARD', 'BANK_TRANSFER', 'CREDIT'];

    /** Where the order stands at the yard gate. Derived, never stored. */
    public const YARD_READY = 'READY_FOR_DISPATCH';
    public const YARD_DISPATCHED = 'DISPATCHED';
    public const YARD_NOT_ELIGIBLE = 'NOT_ELIGIBLE';

    public const MSG_NOT_FULLY_PAID = 'This order cannot be dispatched because full payment has not been completed.';
    public const MSG_ALREADY_DISPATCHED = 'This order has already been dispatched.';
    public const MSG_CANCELLED = 'Cancelled orders cannot be dispatched.';

    protected $fillable = [
        'order_no', 'customer_name', 'customer_phone', 'subtotal', 'discount',
        'total', 'paid_amount', 'payment_status', 'payment_mode', 'status',
        'cashier_id', 'ordered_at',
    ];

    // `paid_at`, `dispatched_at` and `dispatched_by` are deliberately absent
    // from $fillable: the first is derived below, the other two are written
    // only by DispatchService's guarded update. No request payload can set them.

    protected function casts(): array
    {
        return [
            'subtotal' => 'decimal:2',
            'discount' => 'decimal:2',
            'total' => 'decimal:2',
            'paid_amount' => 'decimal:2',
            'ordered_at' => 'datetime',
            'paid_at' => 'datetime',
            'dispatched_at' => 'datetime',
        ];
    }

    /**
     * `paid_at` records when the order entered the yard. Kept in step on
     * every save — whichever code path changes the payment — so it can never
     * say "paid" about an order the money no longer covers.
     */
    protected static function booted(): void
    {
        static::saving(function (SalesOrder $order) {
            if ($order->isFullyPaid()) {
                $order->paid_at ??= now();
            } else {
                $order->paid_at = null;
            }
        });
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

    public function dispatchRecord(): HasOne
    {
        return $this->hasOne(Dispatch::class);
    }

    public function getOutstandingAttribute(): float
    {
        return round((float) $this->total - (float) $this->paid_amount, 2);
    }

    public function isCancelled(): bool
    {
        return $this->payment_status === self::CANCELLED || $this->status === 'CANCELLED';
    }

    public function isDispatched(): bool
    {
        return $this->dispatched_at !== null;
    }

    /**
     * Settled in full: marked PAID *and* the money actually covers the total.
     * Compared in whole cents so float noise can never let a rupee through.
     */
    public function isFullyPaid(): bool
    {
        return $this->payment_status === self::PAID
            && self::cents($this->paid_amount) >= self::cents($this->total);
    }

    /**
     * Why this order may not leave the yard, or null when it may. The single
     * server-side statement of the dispatch rule — {@see scopeReadyForDispatch}
     * is the same rule expressed as SQL.
     */
    public function dispatchBlocker(): ?string
    {
        return match (true) {
            $this->isCancelled() => self::MSG_CANCELLED,
            $this->isDispatched() => self::MSG_ALREADY_DISPATCHED,
            ! $this->isFullyPaid() => self::MSG_NOT_FULLY_PAID,
            default => null,
        };
    }

    public function yardStatus(): string
    {
        if ($this->isDispatched()) {
            return self::YARD_DISPATCHED;
        }

        return $this->dispatchBlocker() === null ? self::YARD_READY : self::YARD_NOT_ELIGIBLE;
    }

    /**
     * Yard stock: fully paid, not cancelled, not yet dispatched. DECIMAL
     * columns compare exactly in SQL, so `paid_amount >= total` needs no
     * rounding tolerance here.
     */
    public function scopeReadyForDispatch(Builder $query): Builder
    {
        return $query
            ->where('payment_status', self::PAID)
            ->where('status', 'COMPLETED')
            ->whereNull('dispatched_at')
            ->whereColumn('paid_amount', '>=', 'total');
    }

    private static function cents(mixed $amount): int
    {
        return (int) round((float) $amount * 100);
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
