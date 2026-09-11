<?php

use App\Models\Role;
use App\Models\SalesOrder;
use App\Services\OrderService;
use App\Services\StockService;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->seed(RolePermissionSeeder::class);
    makeWarehouse();
});

it('alerts admin and manager the moment a part crosses into low stock, but not again on the next issue', function () {
    $admin = makeRoleUser(Role::ADMIN);
    $manager = makeRoleUser(Role::MANAGER);
    $salesPerson = makeRoleUser(Role::SALES_PERSON);

    $part = makePart(['min_stock' => 5]);
    app(StockService::class)->stockIn($part, 10);

    expect($admin->fresh()->unreadNotifications)->toHaveCount(0);

    // 10 -> 4: crosses IN_STOCK -> LOW_STOCK.
    app(StockService::class)->stockOut($part, 6);

    expect($admin->fresh()->unreadNotifications)->toHaveCount(1);
    expect($manager->fresh()->unreadNotifications)->toHaveCount(1);
    expect($salesPerson->fresh()->unreadNotifications)->toHaveCount(0);
    expect($admin->fresh()->unreadNotifications->first()->data['type'])->toBe('stock.low');

    // 4 -> 3: still LOW_STOCK — no new alert, so a busy counter doesn't spam one per sale.
    app(StockService::class)->stockOut($part, 1);
    expect($admin->fresh()->unreadNotifications)->toHaveCount(1);

    // 3 -> 0: crosses LOW_STOCK -> OUT_OF_STOCK, a second, distinct alert.
    app(StockService::class)->stockOut($part, 3);
    $types = $admin->fresh()->unreadNotifications->pluck('data.type');
    expect($types)->toHaveCount(2);
    expect($types)->toContain('stock.low', 'stock.out_of_stock');
});

it('notifies security and admin the moment an order becomes ready for dispatch', function () {
    $security = makeRoleUser(Role::SECURITY);
    $admin = makeRoleUser(Role::ADMIN);
    $salesPerson = makeRoleUser(Role::SALES_PERSON);

    $part = makePart();
    app(StockService::class)->stockIn($part, 10);

    $order = app(OrderService::class)->create(
        [['part_id' => $part->id, 'quantity' => 1]],
        'Walk-in customer', null, 0.0, SalesOrder::PAID, 'CASH', 0.0,
    );

    expect($security->fresh()->unreadNotifications)->toHaveCount(1);
    expect($admin->fresh()->unreadNotifications)->toHaveCount(1);
    expect($salesPerson->fresh()->unreadNotifications)->toHaveCount(0);

    $notification = $security->fresh()->unreadNotifications->first();
    expect($notification->data['type'])->toBe('order.ready_for_dispatch');
    expect($notification->data['link'])->toBe("/orders/{$order->id}");
});

it('lists a users own notifications with an unread count, newest first', function () {
    $manager = makeRoleUser(Role::MANAGER);
    $part = makePart(['min_stock' => 5]);
    app(StockService::class)->stockIn($part, 10);
    app(StockService::class)->stockOut($part, 8); // crosses into LOW_STOCK

    $this->actingAs($manager)->getJson('/api/v1/notifications')
        ->assertOk()
        ->assertJsonPath('meta.unread_count', 1)
        ->assertJsonPath('data.0.type', 'stock.low')
        ->assertJsonPath('data.0.read_at', null);
});

it('marks one notification as read, and only that one', function () {
    $manager = makeRoleUser(Role::MANAGER);
    $part = makePart(['min_stock' => 5]);
    app(StockService::class)->stockIn($part, 10);
    app(StockService::class)->stockOut($part, 8); // 10 -> 2: crosses IN -> LOW
    app(StockService::class)->stockOut($part, 2); // 2 -> 0: crosses LOW -> OUT

    $this->actingAs($manager);
    $anyId = $manager->fresh()->unreadNotifications->first()->id;

    $this->postJson("/api/v1/notifications/{$anyId}/read")->assertOk();

    expect($manager->fresh()->unreadNotifications)->toHaveCount(1);
});

it('marks every notification as read in one call', function () {
    $manager = makeRoleUser(Role::MANAGER);
    $part = makePart(['min_stock' => 5]);
    app(StockService::class)->stockIn($part, 10);
    app(StockService::class)->stockOut($part, 8);
    app(StockService::class)->stockOut($part, 2);

    expect($manager->fresh()->unreadNotifications)->toHaveCount(2);

    $this->actingAs($manager)->postJson('/api/v1/notifications/read-all')->assertOk();

    expect($manager->fresh()->unreadNotifications)->toHaveCount(0);
});

it('refuses to mark another users notification as read', function () {
    $manager = makeRoleUser(Role::MANAGER);
    $admin = makeRoleUser(Role::ADMIN);
    $part = makePart(['min_stock' => 5]);
    app(StockService::class)->stockIn($part, 10);
    app(StockService::class)->stockOut($part, 8);

    $managersNotificationId = $manager->fresh()->unreadNotifications->first()->id;

    $this->actingAs($admin)->postJson("/api/v1/notifications/{$managersNotificationId}/read")
        ->assertStatus(404);
});
