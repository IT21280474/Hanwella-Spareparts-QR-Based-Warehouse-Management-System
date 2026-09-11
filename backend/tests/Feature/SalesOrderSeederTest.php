<?php

use App\Models\Role;
use App\Models\SalesOrder;
use App\Models\User;
use Database\Seeders\CatalogSeeder;
use Database\Seeders\PartSeeder;
use Database\Seeders\RolePermissionSeeder;
use Database\Seeders\SalesOrderSeeder;
use Database\Seeders\UserSeeder;
use Database\Seeders\WarehouseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

/**
 * The demo orders exist so the Security gate opens on real work after a
 * fresh `db:seed` — these checks keep it that way.
 */
uses(RefreshDatabase::class);

beforeEach(function () {
    $this->seed([
        RolePermissionSeeder::class,
        UserSeeder::class,
        WarehouseSeeder::class,
        CatalogSeeder::class,
        PartSeeder::class,
        SalesOrderSeeder::class,
    ]);
});

it('gives the security dashboard paid orders to dispatch and a dispatch history', function () {
    $security = User::whereHas('role', fn ($q) => $q->where('slug', Role::SECURITY))->firstOrFail();

    $response = $this->actingAs($security)->getJson('/api/v1/dashboard/security')
        ->assertOk()
        ->assertJsonPath('data.kpis.ready_for_dispatch', 4)
        ->assertJsonPath('data.kpis.dispatched_total', 3)
        ->assertJsonCount(4, 'data.ready_orders')
        ->assertJsonCount(3, 'data.recent_dispatches');

    // Only fully paid orders reach the gate.
    expect(collect($response->json('data.ready_orders'))->pluck('payment_status')->unique()->all())->toBe([SalesOrder::PAID]);
});

it('seeds every payment state through the real order flow', function () {
    expect(SalesOrder::where('payment_status', SalesOrder::PARTIALLY_PAID)->count())->toBe(2)
        ->and(SalesOrder::where('payment_status', SalesOrder::PENDING)->count())->toBe(1)
        ->and(SalesOrder::where('payment_status', SalesOrder::CANCELLED)->count())->toBe(1);

    // Paid orders took their stock; unpaid ones never did.
    expect(SalesOrder::where('payment_status', SalesOrder::PAID)->whereNull('stock_deducted_at')->count())->toBe(0)
        ->and(SalesOrder::where('payment_status', '!=', SalesOrder::PAID)->whereNotNull('stock_deducted_at')->count())->toBe(0);

    // A partial payment is genuinely partial, never clamped to the full total.
    SalesOrder::where('payment_status', SalesOrder::PARTIALLY_PAID)->get()
        ->each(fn (SalesOrder $o) => expect((float) $o->paid_amount)->toBeGreaterThan(0)->toBeLessThan((float) $o->total));

    // Dispatches were recorded by Security accounts.
    SalesOrder::whereNotNull('dispatched_at')->with('dispatchedBy.role')->get()
        ->each(fn (SalesOrder $o) => expect($o->dispatchedBy->role->slug)->toBe(Role::SECURITY));
});

it('spreads the orders across recent days ending today', function () {
    expect(SalesOrder::max('ordered_at'))->toStartWith(now()->toDateString())
        ->and(SalesOrder::min('ordered_at'))->toStartWith(now()->subDays(3)->toDateString())
        ->and(SalesOrder::whereDate('dispatched_at', today())->count())->toBe(1);
});

it('does not duplicate orders when seeded again', function () {
    $this->seed(SalesOrderSeeder::class);

    expect(SalesOrder::count())->toBe(11);
});
