<?php

namespace App\Notifications;

use App\Models\Part;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;

/**
 * Fired once, at the moment a part's total stock crosses downward into LOW
 * or OUT — never on every subsequent stock-out while it stays there. See
 * `StockService::notifyIfStockDropped()` for the crossing check.
 */
class LowStockAlert extends Notification
{
    use Queueable;

    public function __construct(
        private readonly Part $part,
        private readonly bool $outOfStock,
        private readonly int $quantity,
    ) {}

    public function via(object $notifiable): array
    {
        return ['database'];
    }

    public function toArray(object $notifiable): array
    {
        return [
            'type' => $this->outOfStock ? 'stock.out_of_stock' : 'stock.low',
            'level' => $this->outOfStock ? 'danger' : 'warning',
            'title' => $this->outOfStock
                ? "{$this->part->name} is out of stock"
                : "{$this->part->name} is running low",
            'body' => $this->outOfStock
                ? "{$this->part->part_number} has zero units on hand."
                : "{$this->part->part_number} has {$this->quantity} unit(s) left, at or below its minimum of {$this->part->min_stock}.",
            'link' => "/inventory/{$this->part->id}",
        ];
    }
}
