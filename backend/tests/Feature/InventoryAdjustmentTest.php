<?php

use App\Models\Role;
use App\Services\StockService;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->seed(RolePermissionSeeder::class);
    makeWarehouse();
});

it('records a positive manual adjustment with before, after and reason', function () {
    $admin = makeRoleUser(Role::ADMIN);
    $part = makePart();
    app(StockService::class)->stockIn($part, 50);

    $this->actingAs($admin)->postJson('/api/v1/stock/adjust', [
        'part_id' => $part->id,
        'adjustment_type' => 'STOCK_RECEIVED',
        'quantity' => 5,
        'note' => 'Recount found extra stock',
    ])
        ->assertOk()
        ->assertJsonPath('data.quantity_before', 50)
        ->assertJsonPath('data.adjustment', 5)
        ->assertJsonPath('data.quantity_after', 55)
        ->assertJsonPath('data.note', 'Recount found extra stock');

    $this->assertDatabaseHas('inventory', ['part_id' => $part->id, 'quantity' => 55]);
    $this->assertDatabaseHas('inventory_adjustments', [
        'part_id' => $part->id, 'quantity_before' => 50, 'adjustment' => 5, 'quantity_after' => 55,
    ]);
    $this->assertDatabaseHas('audit_logs', ['action' => 'stock.adjust']);
});

it('records a negative adjustment (damage write-off) and decreases quantity', function () {
    $admin = makeRoleUser(Role::ADMIN);
    $part = makePart();
    app(StockService::class)->stockIn($part, 20);

    $this->actingAs($admin)->postJson('/api/v1/stock/adjust', [
        'part_id' => $part->id,
        'adjustment_type' => 'DAMAGE_WRITE_OFF',
        'quantity' => 3,
    ])
        ->assertOk()
        ->assertJsonPath('data.adjustment', -3)
        ->assertJsonPath('data.quantity_after', 17);

    $this->assertDatabaseHas('inventory', ['part_id' => $part->id, 'quantity' => 17]);
});

it('rejects a negative adjustment larger than the quantity on hand', function () {
    $admin = makeRoleUser(Role::ADMIN);
    $part = makePart();
    app(StockService::class)->stockIn($part, 5);

    $this->actingAs($admin)->postJson('/api/v1/stock/adjust', [
        'part_id' => $part->id,
        'adjustment_type' => 'DAMAGE_WRITE_OFF',
        'quantity' => 10,
    ])->assertStatus(409);

    $this->assertDatabaseHas('inventory', ['part_id' => $part->id, 'quantity' => 5]);
});

it('rejects an unknown adjustment type before it ever reaches the service', function () {
    $admin = makeRoleUser(Role::ADMIN);
    $part = makePart();

    $this->actingAs($admin)->postJson('/api/v1/stock/adjust', [
        'part_id' => $part->id,
        'adjustment_type' => 'BOGUS_TYPE',
        'quantity' => 1,
    ])
        ->assertStatus(422)
        ->assertJsonStructure(['errors' => ['adjustment_type']]);
});

it('denies adjustment to a viewer', function () {
    $viewer = makeRoleUser(Role::VIEWER);
    $part = makePart();
    app(StockService::class)->stockIn($part, 10);

    $this->actingAs($viewer)->postJson('/api/v1/stock/adjust', [
        'part_id' => $part->id,
        'adjustment_type' => 'MANUAL_ADJUSTMENT',
        'quantity' => 1,
    ])->assertStatus(403);
});

it('allows adjustment for warehouse staff', function () {
    $staff = makeRoleUser(Role::WAREHOUSE_STAFF);
    $part = makePart();
    app(StockService::class)->stockIn($part, 10);

    $this->actingAs($staff)->postJson('/api/v1/stock/adjust', [
        'part_id' => $part->id,
        'adjustment_type' => 'MANUAL_ADJUSTMENT',
        'quantity' => 2,
    ])->assertOk();
});
