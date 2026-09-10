<?php

use App\Models\Role;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->seed(RolePermissionSeeder::class);
    makeWarehouse();
});

it('increases quantity and records a stock-in movement', function () {
    $admin = makeRoleUser(Role::ADMIN);
    $part = makePart();

    $this->actingAs($admin)->postJson('/api/v1/stock/in', [
        'part_id' => $part->id,
        'quantity' => 40,
        'reference_no' => 'GRN-1001',
    ])
        ->assertOk()
        ->assertJsonPath('success', true)
        ->assertJsonPath('data.type', 'STOCK_IN')
        ->assertJsonPath('data.quantity_before', 0)
        ->assertJsonPath('data.quantity_after', 40);

    $this->assertDatabaseHas('inventory', ['part_id' => $part->id, 'quantity' => 40]);
    $this->assertDatabaseHas('stock_movements', [
        'part_id' => $part->id, 'type' => 'STOCK_IN', 'quantity' => 40, 'reference_no' => 'GRN-1001',
    ]);
    $this->assertDatabaseHas('audit_logs', ['action' => 'stock.in']);
});

it('accumulates quantity correctly across multiple receipts', function () {
    $admin = makeRoleUser(Role::ADMIN);
    $part = makePart();

    $this->actingAs($admin)->postJson('/api/v1/stock/in', ['part_id' => $part->id, 'quantity' => 10])->assertOk();

    $this->actingAs($admin)->postJson('/api/v1/stock/in', ['part_id' => $part->id, 'quantity' => 15])
        ->assertOk()
        ->assertJsonPath('data.quantity_before', 10)
        ->assertJsonPath('data.quantity_after', 25);

    $this->assertDatabaseHas('inventory', ['part_id' => $part->id, 'quantity' => 25]);
});

it('rejects a non-positive quantity', function () {
    $admin = makeRoleUser(Role::ADMIN);
    $part = makePart();

    $this->actingAs($admin)->postJson('/api/v1/stock/in', ['part_id' => $part->id, 'quantity' => 0])
        ->assertStatus(422)
        ->assertJsonStructure(['errors' => ['quantity']]);
});

it('rejects stock-in for a part that does not exist', function () {
    $admin = makeRoleUser(Role::ADMIN);

    $this->actingAs($admin)->postJson('/api/v1/stock/in', ['part_id' => 999999, 'quantity' => 5])
        ->assertStatus(422)
        ->assertJsonStructure(['errors' => ['part_id']]);
});

it('denies stock-in to a viewer', function () {
    $viewer = makeRoleUser(Role::VIEWER);
    $part = makePart();

    $this->actingAs($viewer)->postJson('/api/v1/stock/in', ['part_id' => $part->id, 'quantity' => 5])
        ->assertStatus(403);

    $this->assertDatabaseMissing('inventory', ['part_id' => $part->id, 'quantity' => 5]);
});

it('allows stock-in for warehouse staff', function () {
    $staff = makeRoleUser(Role::WAREHOUSE_STAFF);
    $part = makePart();

    $this->actingAs($staff)->postJson('/api/v1/stock/in', ['part_id' => $part->id, 'quantity' => 5])
        ->assertOk();
});
