<?php

use App\Models\Role;
use App\Services\OrderService;
use App\Services\StockService;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->seed(RolePermissionSeeder::class);
    makeWarehouse();
});

it('denies the warehouse dashboard to security', function () {
    $security = makeRoleUser(Role::SECURITY);

    $this->actingAs($security)->getJson('/api/v1/dashboard')->assertForbidden();
});

it('denies the security dashboard to a sales person', function () {
    $salesPerson = makeRoleUser(Role::SALES_PERSON);

    $this->actingAs($salesPerson)->getJson('/api/v1/dashboard/security')->assertForbidden();
});

it('shows security only paid, undispatched orders as ready — never a pending or already-dispatched one', function () {
    $part = makePart(['selling_price' => 1000]);
    app(StockService::class)->stockIn($part, 10);
    $security = makeRoleUser(Role::SECURITY);

    // One actingAs() for the whole test — direct service calls plus the one
    // HTTP request under test, all as the same user. See OrderTest.php's
    // notes on why switching actingAs() mid-test is avoided here.
    $this->actingAs($security);

    $paid = app(OrderService::class)->create(
        [['part_id' => $part->id, 'quantity' => 1]],
        'Walk-in customer', null, 0.0, \App\Models\SalesOrder::PAID, 'CASH', 0.0,
    );
    app(OrderService::class)->create(
        [['part_id' => $part->id, 'quantity' => 1]],
        'Walk-in customer', null, 0.0, \App\Models\SalesOrder::PENDING, 'CASH', 0.0,
    );
    $dispatched = app(OrderService::class)->create(
        [['part_id' => $part->id, 'quantity' => 1]],
        'Walk-in customer', null, 0.0, \App\Models\SalesOrder::PAID, 'CASH', 0.0,
    );
    app(OrderService::class)->dispatch($dispatched);

    $response = $this->getJson('/api/v1/dashboard/security')->assertOk();

    $response->assertJsonPath('data.kpis.ready_for_dispatch', 1)
        ->assertJsonPath('data.kpis.dispatched_today', 1)
        ->assertJsonPath('data.kpis.dispatched_total', 1)
        ->assertJsonCount(1, 'data.ready_orders')
        ->assertJsonPath('data.ready_orders.0.id', $paid->id)
        ->assertJsonCount(1, 'data.recent_dispatches')
        ->assertJsonPath('data.recent_dispatches.0.id', $dispatched->id)
        ->assertJsonPath('data.recent_dispatches.0.dispatched_by.id', $security->id);
});
