<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * The permanent record of an order leaving the yard.
 *
 * Written once by {@see \App\Services\DispatchService} and never edited:
 * there is no update or delete route, and every display field is a snapshot
 * of the order at the moment Security confirmed the goods at the gate.
 */
class Dispatch extends Model
{
    use HasFactory;

    protected $fillable = [
        'sales_order_id', 'order_no', 'customer_name', 'customer_phone',
        'items_count', 'total_quantity', 'total', 'paid_amount',
        'payment_status_at_dispatch', 'items',
        'dispatched_by', 'dispatched_by_name', 'dispatched_at', 'notes',
    ];

    protected function casts(): array
    {
        return [
            'items' => 'array',
            'items_count' => 'integer',
            'total_quantity' => 'integer',
            'total' => 'decimal:2',
            'paid_amount' => 'decimal:2',
            'dispatched_at' => 'datetime',
        ];
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(SalesOrder::class, 'sales_order_id');
    }

    public function dispatchedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'dispatched_by');
    }

    /** `DSP-000042` — derived from the key, so it can never disagree with it. */
    public function getDispatchNoAttribute(): string
    {
        return sprintf('DSP-%06d', $this->id);
    }

    public function scopeSearch(Builder $query, ?string $term): Builder
    {
        $term = trim((string) $term);

        if ($term === '') {
            return $query;
        }

        $like = '%'.$term.'%';

        return $query->where(function (Builder $q) use ($term, $like) {
            $q->where('order_no', 'like', $like)
                ->orWhere('customer_name', 'like', $like)
                ->orWhere('customer_phone', 'like', $like)
                ->orWhere('dispatched_by_name', 'like', $like);

            // "DSP-000042" or "42" finds the dispatch by its number.
            if (preg_match('/^(?:DSP-?)?0*(\d{1,9})$/i', $term, $m)) {
                $q->orWhere('id', (int) $m[1]);
            }
        });
    }
}
