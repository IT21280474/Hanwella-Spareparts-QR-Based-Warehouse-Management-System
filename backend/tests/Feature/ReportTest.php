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

it('reports out-of-stock parts, and only those genuinely at zero', function () {
    $manager = makeRoleUser(Role::MANAGER);
    $this->actingAs($manager);

    $empty = makePart(['name' => 'Empty Shelf Part', 'min_stock' => 5]);
    $stocked = makePart(['name' => 'Well Stocked Part', 'min_stock' => 5]);
    app(StockService::class)->stockIn($stocked, 20);

    $this->getJson('/api/v1/reports/out-of-stock')
        ->assertOk()
        ->assertJsonCount(1, 'data.rows')
        ->assertJsonPath('data.rows.0.name', 'Empty Shelf Part');
});

it('reports stock received, grouped by part, excluding sales and returns', function () {
    $manager = makeRoleUser(Role::MANAGER);
    $this->actingAs($manager);

    $part = makePart();
    app(StockService::class)->stockIn($part, 10);
    app(StockService::class)->stockIn($part, 5);

    $this->getJson('/api/v1/reports/stock-in')
        ->assertOk()
        ->assertJsonPath('data.rows.0.movements', 2)
        ->assertJsonPath('data.rows.0.units', 15);
});

it('reports stock issued manually, grouped by part', function () {
    $manager = makeRoleUser(Role::MANAGER);
    $this->actingAs($manager);

    $part = makePart();
    app(StockService::class)->stockIn($part, 20);
    app(StockService::class)->stockOut($part, 8);

    $this->getJson('/api/v1/reports/stock-out')
        ->assertOk()
        ->assertJsonPath('data.rows.0.movements', 1)
        ->assertJsonPath('data.rows.0.units', 8);
});

it('reports user activity, counting audit-logged actions per account', function () {
    $manager = makeRoleUser(Role::MANAGER, ['name' => 'Busy Manager']);
    $this->actingAs($manager);

    $part = makePart();
    app(StockService::class)->stockIn($part, 10);
    app(StockService::class)->stockIn($part, 5);

    $response = $this->getJson('/api/v1/reports/user-activity')->assertOk();

    $row = collect($response->json('data.rows'))->firstWhere('name', 'Busy Manager');
    expect($row)->not->toBeNull();
    expect($row['actions'])->toBeGreaterThanOrEqual(2);
});

it('denies reports to a role without view_reports', function () {
    $salesPerson = makeRoleUser(Role::SALES_PERSON);

    $this->actingAs($salesPerson)->getJson('/api/v1/reports/stock-in')->assertForbidden();
});
