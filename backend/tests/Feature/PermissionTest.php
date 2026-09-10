<?php

use App\Models\Role;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

/**
 * Cross-cutting checks that the backend enforces permissions independently
 * of the frontend, for routes not already covered by their own module's
 * test file (Part, Qr, StockIn, StockOut, InventoryAdjustment).
 */
uses(RefreshDatabase::class);

beforeEach(function () {
    $this->seed(RolePermissionSeeder::class);
});

it('denies settings management to a manager', function () {
    $manager = makeRoleUser(Role::MANAGER);

    $this->actingAs($manager)->getJson('/api/v1/settings')->assertStatus(403);
});

it('allows settings management for an admin', function () {
    $admin = makeRoleUser(Role::ADMIN);

    $this->actingAs($admin)->getJson('/api/v1/settings')->assertOk();
});

it('denies user management to a manager', function () {
    $manager = makeRoleUser(Role::MANAGER);

    $this->actingAs($manager)->getJson('/api/v1/users')->assertStatus(403);
});

it('allows user management for an admin', function () {
    $admin = makeRoleUser(Role::ADMIN);

    $this->actingAs($admin)->getJson('/api/v1/users')->assertOk();
});

it('lets a viewer read reports but not export them', function () {
    $viewer = makeRoleUser(Role::VIEWER);

    $this->actingAs($viewer)->getJson('/api/v1/reports/inventory')->assertOk();
    $this->actingAs($viewer)->getJson('/api/v1/reports/inventory/export')->assertStatus(403);
});

it('lets a manager export reports', function () {
    $manager = makeRoleUser(Role::MANAGER);

    $this->actingAs($manager)->getJson('/api/v1/reports/inventory/export')->assertOk();
});

it('refuses every protected route without an authenticated session', function () {
    $this->getJson('/api/v1/dashboard')->assertStatus(401);
    $this->getJson('/api/v1/parts')->assertStatus(401);
    $this->postJson('/api/v1/stock/in', [])->assertStatus(401);
});
