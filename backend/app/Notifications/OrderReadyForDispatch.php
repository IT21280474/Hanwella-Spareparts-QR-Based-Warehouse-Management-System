<?php

namespace App\Notifications;

use App\Models\SalesOrder;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;

/** Fired once, the moment an order's payment crosses into PAID and its stock is deducted. */
class OrderReadyForDispatch extends Notification
{
    use Queueable;

    public function __construct(private readonly SalesOrder $order) {}

    public function via(object $notifiable): array
    {
        return ['database'];
    }

    public function toArray(object $notifiable): array
    {
        $customer = $this->order->customer_name ?: 'Walk-in customer';

        return [
            'type' => 'order.ready_for_dispatch',
            'level' => 'info',
            'title' => "Order {$this->order->order_no} is ready for dispatch",
            'body' => "Fully paid — {$customer} can now be released.",
            'link' => "/orders/{$this->order->id}",
        ];
    }
}
