<?php

use App\Models\Role;
use App\Models\StockMovement;
use App\Services\StockService;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->seed(RolePermissionSeeder::class);
    makeWarehouse();
});

it('decreases quantity and records a stock-out movement', function () {
    $admin = makeRoleUser(Role::ADMIN);
    $part = makePart();
    app(StockService::class)->stockIn($part, 30);

    $this->actingAs($admin)->postJson('/api/v1/stock/out', ['part_id' => $part->id, 'quantity' => 12])
        ->assertOk()
        ->assertJsonPath('data.type', 'STOCK_OUT')
        ->assertJsonPath('data.quantity_before', 30)
        ->assertJsonPath('data.quantity_after', 18);

    $this->assertDatabaseHas('inventory', ['part_id' => $part->id, 'quantity' => 18]);
});

it('rejects a stock-out that exceeds on-hand quantity and leaves the row unchanged', function () {
    $admin = makeRoleUser(Role::ADMIN);
    $part = makePart();
    app(StockService::class)->stockIn($part, 10);

    $this->actingAs($admin)->postJson('/api/v1/stock/out', ['part_id' => $part->id, 'quantity' => 15])
        ->assertStatus(409)
        ->assertJsonPath('success', false);

    $this->assertDatabaseHas('inventory', ['part_id' => $part->id, 'quantity' => 10]);
    expect(StockMovement::where('part_id', $part->id)->where('type', StockMovement::STOCK_OUT)->count())->toBe(0);
});

it('never allows quantity to go negative, even across separate requests', function () {
    // A single PHP test process cannot fire two genuinely concurrent HTTP
    // requests, so this is a sequential proxy: it proves the *effect* the
    // service's SELECT ... FOR UPDATE + re-read-after-lock is meant to
    // guarantee (the second call sees the row as it actually is, not as it
    // was before the first call committed) — it does not exercise an actual
    // race between two connections.
    $admin = makeRoleUser(Role::ADMIN);
    $part = makePart();
    app(StockService::class)->stockIn($part, 10);

    $this->actingAs($admin)->postJson('/api/v1/stock/out', ['part_id' => $part->id, 'quantity' => 7])
        ->assertOk()
        ->assertJsonPath('data.quantity_after', 3);

    // Together, 7 + 5 would exceed the original 10. The second call must be
    // validated against the *current* quantity (3), not the original (10).
    $this->actingAs($admin)->postJson('/api/v1/stock/out', ['part_id' => $part->id, 'quantity' => 5])
        ->assertStatus(409);

    $this->assertDatabaseHas('inventory', ['part_id' => $part->id, 'quantity' => 3]);
});

it('rejects a non-positive quantity', function () {
    $admin = makeRoleUser(Role::ADMIN);
    $part = makePart();
    app(StockService::class)->stockIn($part, 10);

    $this->actingAs($admin)->postJson('/api/v1/stock/out', ['part_id' => $part->id, 'quantity' => -1])
        ->assertStatus(422)
        ->assertJsonStructure(['errors' => ['quantity']]);
});

it('denies stock-out to a viewer', function () {
    $viewer = makeRoleUser(Role::VIEWER);
    $part = makePart();
    app(StockService::class)->stockIn($part, 10);

    $this->actingAs($viewer)->postJson('/api/v1/stock/out', ['part_id' => $part->id, 'quantity' => 5])
        ->assertStatus(403);

    $this->assertDatabaseHas('inventory', ['part_id' => $part->id, 'quantity' => 10]);
});

it('allows stock-out for warehouse staff', function () {
    $staff = makeRoleUser(Role::WAREHOUSE_STAFF);
    $part = makePart();
    app(StockService::class)->stockIn($part, 10);

    $this->actingAs($staff)->postJson('/api/v1/stock/out', ['part_id' => $part->id, 'quantity' => 5])
        ->assertOk();
});
