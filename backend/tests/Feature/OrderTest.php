<?php

use App\Models\Part;
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

it('creates an order at full catalogue price when no discount is given', function () {
    $staff = makeRoleUser(Role::WAREHOUSE_STAFF);
    $part = makePart(['selling_price' => 1000]);
    app(StockService::class)->stockIn($part, 10);

    $this->actingAs($staff)->postJson('/api/v1/orders', [
        'payment_status' => 'PAID',
        'payment_mode' => 'CASH',
        'items' => [['part_id' => $part->id, 'quantity' => 2]],
    ])
        ->assertCreated()
        ->assertJsonPath('data.subtotal', 2000)
        ->assertJsonPath('data.total', 2000)
        ->assertJsonPath('data.items.0.discount', 0)
        ->assertJsonPath('data.items.0.line_total', 2000)
        ->assertJsonPath('data.items.0.note', null);
});

it('applies a per-item discount to that line only, and records the note', function () {
    $staff = makeRoleUser(Role::WAREHOUSE_STAFF);
    $partA = makePart(['selling_price' => 1000]);
    $partB = makePart(['selling_price' => 500]);
    app(StockService::class)->stockIn($partA, 10);
    app(StockService::class)->stockIn($partB, 10);

    $response = $this->actingAs($staff)->postJson('/api/v1/orders', [
        'payment_status' => 'PAID',
        'payment_mode' => 'CASH',
        'items' => [
            ['part_id' => $partA->id, 'quantity' => 1, 'discount' => 150, 'note' => 'Slightly scratched casing'],
            ['part_id' => $partB->id, 'quantity' => 2],
        ],
    ])->assertCreated();

    // subtotal is the full catalogue value (1000 + 1000); only the
    // discounted line's total reflects the discount.
    $response->assertJsonPath('data.subtotal', 2000);
    $response->assertJsonPath('data.total', 1850);

    $items = collect($response->json('data.items'));
    $lineA = $items->firstWhere('part_id', $partA->id);
    $lineB = $items->firstWhere('part_id', $partB->id);

    expect((float) $lineA['discount'])->toBe(150.0);
    expect((float) $lineA['line_total'])->toBe(850.0);
    expect($lineA['note'])->toBe('Slightly scratched casing');
    expect((float) $lineB['discount'])->toBe(0.0);
    expect((float) $lineB['line_total'])->toBe(1000.0);
});

it('never lets an item discount push that line below zero', function () {
    $staff = makeRoleUser(Role::WAREHOUSE_STAFF);
    $part = makePart(['selling_price' => 500]);
    app(StockService::class)->stockIn($part, 10);

    $response = $this->actingAs($staff)->postJson('/api/v1/orders', [
        'payment_status' => 'PAID',
        'payment_mode' => 'CASH',
        'items' => [['part_id' => $part->id, 'quantity' => 1, 'discount' => 999999]],
    ])->assertCreated();

    $response->assertJsonPath('data.items.0.discount', 500);
    $response->assertJsonPath('data.items.0.line_total', 0);
    $response->assertJsonPath('data.total', 0);
});

it('applies the order-level discount on top of item-level discounts without going negative', function () {
    $staff = makeRoleUser(Role::WAREHOUSE_STAFF);
    $part = makePart(['selling_price' => 1000]);
    app(StockService::class)->stockIn($part, 10);

    $response = $this->actingAs($staff)->postJson('/api/v1/orders', [
        'payment_status' => 'PAID',
        'payment_mode' => 'CASH',
        'discount' => 999999,
        'items' => [['part_id' => $part->id, 'quantity' => 1, 'discount' => 200]],
    ])->assertCreated();

    // Item discount (200) leaves 800; the order discount can only claim
    // what is left, not the full requested amount.
    $response->assertJsonPath('data.discount', 800);
    $response->assertJsonPath('data.total', 0);
});

it('rejects a sale when stock is insufficient, and creates no order', function () {
    $staff = makeRoleUser(Role::WAREHOUSE_STAFF);
    $part = makePart(['selling_price' => 1000]);
    app(StockService::class)->stockIn($part, 1);

    $this->actingAs($staff)->postJson('/api/v1/orders', [
        'payment_status' => 'PAID',
        'payment_mode' => 'CASH',
        'items' => [['part_id' => $part->id, 'quantity' => 5]],
    ])->assertStatus(409);

    $this->assertDatabaseMissing('sales_orders', ['status' => 'COMPLETED']);
    expect((int) $part->fresh()->inventory()->sum('quantity'))->toBe(1);
});

it('sells a part whose stock sits in a specific bin, not a warehouse-only row', function () {
    // Regression: OrderService used to deduct against
    // warehouse=<default>/location=null, which never matches a part's real
    // (warehouse, location) inventory row — every sale of normally-stocked
    // inventory (i.e. anything with a bin, same as every seeded part) failed
    // with a false "insufficient stock" regardless of what was on hand.
    $staff = makeRoleUser(Role::WAREHOUSE_STAFF);
    $warehouse = makeWarehouse();
    $bin = makeLocation($warehouse);
    $part = makePart(['selling_price' => 1000]);
    app(StockService::class)->stockIn($part, 10, $warehouse->id, $bin->id);

    $this->actingAs($staff)->postJson('/api/v1/orders', [
        'payment_status' => 'PAID',
        'payment_mode' => 'CASH',
        'items' => [['part_id' => $part->id, 'quantity' => 3]],
    ])->assertCreated();

    $this->assertDatabaseHas('inventory', [
        'part_id' => $part->id, 'warehouse_id' => $warehouse->id, 'location_id' => $bin->id, 'quantity' => 7,
    ]);
    // Exactly one inventory row for this part — no phantom null-location row
    // created alongside the real bin.
    expect(\App\Models\Inventory::where('part_id', $part->id)->count())->toBe(1);
});

it('returns cancelled stock to the same bin it was sold from', function () {
    $staff = makeRoleUser(Role::WAREHOUSE_STAFF);
    $warehouse = makeWarehouse();
    $bin = makeLocation($warehouse);
    $part = makePart(['selling_price' => 1000]);
    app(StockService::class)->stockIn($part, 10, $warehouse->id, $bin->id);

    $order = $this->actingAs($staff)->postJson('/api/v1/orders', [
        'payment_status' => 'PAID',
        'payment_mode' => 'CASH',
        'items' => [['part_id' => $part->id, 'quantity' => 4]],
    ])->json('data');

    $this->actingAs($staff)->postJson("/api/v1/orders/{$order['id']}/cancel")->assertOk();

    $this->assertDatabaseHas('inventory', [
        'part_id' => $part->id, 'warehouse_id' => $warehouse->id, 'location_id' => $bin->id, 'quantity' => 10,
    ]);
    expect(\App\Models\Inventory::where('part_id', $part->id)->count())->toBe(1);
});

it('does not touch stock for a pending (unpaid) order', function () {
    $staff = makeRoleUser(Role::WAREHOUSE_STAFF);
    $warehouse = makeWarehouse();
    $bin = makeLocation($warehouse);
    $part = makePart(['selling_price' => 1000]);
    app(StockService::class)->stockIn($part, 10, $warehouse->id, $bin->id);

    $response = $this->actingAs($staff)->postJson('/api/v1/orders', [
        'payment_status' => 'PENDING',
        'payment_mode' => 'CASH',
        'items' => [['part_id' => $part->id, 'quantity' => 3]],
    ])->assertCreated();

    $response->assertJsonPath('data.stock_deducted_at', null);
    $this->assertDatabaseHas('inventory', [
        'part_id' => $part->id, 'warehouse_id' => $warehouse->id, 'location_id' => $bin->id, 'quantity' => 10,
    ]);
    // The bill still records what was agreed, even though nothing moved yet.
    $this->assertDatabaseHas('sales_order_items', ['part_id' => $part->id, 'quantity' => 3]);
});

it('deducts stock only when a pending order is later marked paid', function () {
    $staff = makeRoleUser(Role::WAREHOUSE_STAFF);
    $warehouse = makeWarehouse();
    $bin = makeLocation($warehouse);
    $part = makePart(['selling_price' => 1000]);
    app(StockService::class)->stockIn($part, 10, $warehouse->id, $bin->id);

    $orderId = $this->actingAs($staff)->postJson('/api/v1/orders', [
        'payment_status' => 'PENDING',
        'payment_mode' => 'CASH',
        'items' => [['part_id' => $part->id, 'quantity' => 3]],
    ])->json('data.id');

    $this->assertDatabaseHas('inventory', ['part_id' => $part->id, 'quantity' => 10]);

    $response = $this->actingAs($staff)->patchJson("/api/v1/orders/{$orderId}/payment", [
        'payment_status' => 'PAID',
    ])->assertOk();

    expect($response->json('data.stock_deducted_at'))->not->toBeNull();
    $this->assertDatabaseHas('inventory', ['part_id' => $part->id, 'quantity' => 7]);
});

it('returns stock when a paid order is reverted off paid, before dispatch', function () {
    $staff = makeRoleUser(Role::WAREHOUSE_STAFF);
    $warehouse = makeWarehouse();
    $bin = makeLocation($warehouse);
    $part = makePart(['selling_price' => 1000]);
    app(StockService::class)->stockIn($part, 10, $warehouse->id, $bin->id);

    $orderId = $this->actingAs($staff)->postJson('/api/v1/orders', [
        'payment_status' => 'PAID',
        'payment_mode' => 'CASH',
        'items' => [['part_id' => $part->id, 'quantity' => 3]],
    ])->json('data.id');

    $this->assertDatabaseHas('inventory', ['part_id' => $part->id, 'quantity' => 7]);

    $response = $this->actingAs($staff)->patchJson("/api/v1/orders/{$orderId}/payment", [
        'payment_status' => 'PENDING',
    ])->assertOk();

    expect($response->json('data.stock_deducted_at'))->toBeNull();
    $this->assertDatabaseHas('inventory', ['part_id' => $part->id, 'quantity' => 10]);
});

it('cancelling a never-paid (never-deducted) order returns nothing, because nothing was taken', function () {
    $staff = makeRoleUser(Role::WAREHOUSE_STAFF);
    $warehouse = makeWarehouse();
    $bin = makeLocation($warehouse);
    $part = makePart(['selling_price' => 1000]);
    app(StockService::class)->stockIn($part, 10, $warehouse->id, $bin->id);

    $orderId = $this->actingAs($staff)->postJson('/api/v1/orders', [
        'payment_status' => 'PENDING',
        'payment_mode' => 'CASH',
        'items' => [['part_id' => $part->id, 'quantity' => 3]],
    ])->json('data.id');

    $this->actingAs($staff)->postJson("/api/v1/orders/{$orderId}/cancel")->assertOk();

    // Still exactly 10 — a cancel that credited stock here would be a bug:
    // nothing was ever deducted for this order to begin with.
    $this->assertDatabaseHas('inventory', ['part_id' => $part->id, 'quantity' => 10]);
    expect(\App\Models\Inventory::where('part_id', $part->id)->count())->toBe(1);
});

/**
 * Every test below sets up its precondition order via OrderService directly
 * rather than an HTTP call as one actor followed by another HTTP call as a
 * different actor — actingAs() switching users mid-test is unreliable
 * against the stateful Sanctum guard in this app's test harness (reproduced
 * in isolation: 401 on the second identity even with auth guards forgotten
 * between calls). One real HTTP call, as one actor, is what each test here
 * actually verifies.
 */
function makePaidOrder(Part $part, int $quantity = 1): SalesOrder
{
    return app(OrderService::class)->create(
        [['part_id' => $part->id, 'quantity' => $quantity]],
        'Walk-in customer', null, 0.0, SalesOrder::PAID, 'CASH', 0.0,
    );
}

function makePendingOrder(Part $part, int $quantity = 1): SalesOrder
{
    return app(OrderService::class)->create(
        [['part_id' => $part->id, 'quantity' => $quantity]],
        'Walk-in customer', null, 0.0, SalesOrder::PENDING, 'CASH', 0.0,
    );
}

it('lets security dispatch a fully paid order, and marks who did it', function () {
    $security = makeRoleUser(Role::SECURITY);
    $warehouse = makeWarehouse();
    $bin = makeLocation($warehouse);
    $part = makePart(['selling_price' => 1000]);
    app(StockService::class)->stockIn($part, 10, $warehouse->id, $bin->id);
    $order = makePaidOrder($part);

    $response = $this->actingAs($security)->postJson("/api/v1/orders/{$order->id}/dispatch")
        ->assertOk();

    expect($response->json('data.dispatched_at'))->not->toBeNull();
    expect($response->json('data.dispatched_by.name'))->toBe($security->name);
});

it('refuses to dispatch an order that is not fully paid', function () {
    $security = makeRoleUser(Role::SECURITY);
    $part = makePart(['selling_price' => 1000]);
    app(StockService::class)->stockIn($part, 10);
    $order = makePendingOrder($part);

    $this->actingAs($security)->postJson("/api/v1/orders/{$order->id}/dispatch")
        ->assertStatus(422);
});

it('refuses to dispatch the same order twice', function () {
    $security = makeRoleUser(Role::SECURITY);
    $part = makePart(['selling_price' => 1000]);
    app(StockService::class)->stockIn($part, 10);
    $order = makePaidOrder($part);

    $this->actingAs($security)->postJson("/api/v1/orders/{$order->id}/dispatch")->assertOk();
    $this->actingAs($security)->postJson("/api/v1/orders/{$order->id}/dispatch")->assertStatus(422);
});

it('refuses to cancel or change payment on a dispatched order', function () {
    $staff = makeRoleUser(Role::WAREHOUSE_STAFF);
    $part = makePart(['selling_price' => 1000]);
    app(StockService::class)->stockIn($part, 10);
    $order = makePaidOrder($part);
    app(OrderService::class)->dispatch($order);

    $this->actingAs($staff)->patchJson("/api/v1/orders/{$order->id}/payment", ['payment_status' => 'PENDING'])
        ->assertStatus(422);
    $this->actingAs($staff)->postJson("/api/v1/orders/{$order->id}/cancel")
        ->assertStatus(422);
});

it('denies dispatch to a sales person', function () {
    $salesPerson = makeRoleUser(Role::SALES_PERSON);
    $part = makePart(['selling_price' => 1000]);
    app(StockService::class)->stockIn($part, 10);
    $order = makePaidOrder($part);

    $this->actingAs($salesPerson)->postJson("/api/v1/orders/{$order->id}/dispatch")->assertStatus(403);
});

it('denies order creation to security', function () {
    $security = makeRoleUser(Role::SECURITY);
    $part = makePart(['selling_price' => 1000]);
    app(StockService::class)->stockIn($part, 10);

    $this->actingAs($security)->postJson('/api/v1/orders', [
        'payment_status' => 'PAID', 'payment_mode' => 'CASH',
        'items' => [['part_id' => $part->id, 'quantity' => 1]],
    ])->assertStatus(403);
});

it('denies order creation to a viewer', function () {
    $viewer = makeRoleUser(Role::VIEWER);
    $part = makePart(['selling_price' => 1000]);
    app(StockService::class)->stockIn($part, 10);

    $this->actingAs($viewer)->postJson('/api/v1/orders', [
        'payment_status' => 'PAID',
        'payment_mode' => 'CASH',
        'items' => [['part_id' => $part->id, 'quantity' => 1]],
    ])->assertStatus(403);
});
