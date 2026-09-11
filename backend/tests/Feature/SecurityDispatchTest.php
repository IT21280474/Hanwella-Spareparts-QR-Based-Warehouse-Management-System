<?php

use App\Exceptions\DispatchConflictException;
use App\Models\AuditLog;
use App\Models\Dispatch;
use App\Models\Role;
use App\Models\SalesOrder;
use App\Services\DispatchService;
use App\Services\OrderService;
use App\Services\StockService;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Foundation\Testing\RefreshDatabase;

/**
 * Sales Order → Full Payment → Yard Stock → Security Verification → Dispatch.
 *
 * Orders are created through the real OrderService, so totals, stock
 * deduction and payment resolution are exactly what a cashier produces.
 */
uses(RefreshDatabase::class);

beforeEach(function () {
    $this->seed(RolePermissionSeeder::class);
    makeWarehouse();
});

/** A real counter sale: 2 × Rs 1,000 = Rs 2,000 total unless told otherwise. */
function makeYardOrder(string $paymentStatus = SalesOrder::PAID, float $paidAmount = 0, int $quantity = 2): SalesOrder
{
    $part = makePart(['selling_price' => 1000]);
    app(StockService::class)->stockIn($part, 50);

    return app(OrderService::class)->create(
        [['part_id' => $part->id, 'quantity' => $quantity]],
        'Nimal Traders',
        '0771234567',
        0,
        $paymentStatus,
        'CASH',
        $paidAmount,
    );
}

/**
 * Act as $user in a session of their own.
 *
 * A test keeps one session store across all of its requests, and Sanctum's
 * AuthenticateSession pins that session to the first user's password hash —
 * so switching users mid-test would be signed out with a 401. In a browser
 * every person has their own session; this gives each one theirs.
 */
function actAs($test, $user)
{
    $test->flushSession();

    return $test->actingAs($user);
}

function yardOrderNos($test, $user): array
{
    return collect(actAs($test, $user)->getJson('/api/v1/security/yard-stock')->assertOk()->json('data'))
        ->pluck('order_no')
        ->all();
}

/*
|--------------------------------------------------------------------------
| Yard stock eligibility
|--------------------------------------------------------------------------
*/

it('lists a fully paid order in yard stock', function () {
    $security = makeRoleUser(Role::SECURITY);
    $order = makeYardOrder(SalesOrder::PAID);

    actAs($this, $security)->getJson('/api/v1/security/yard-stock')
        ->assertOk()
        ->assertJsonPath('data.0.order_no', $order->order_no)
        ->assertJsonPath('data.0.payment_status', SalesOrder::PAID)
        ->assertJsonPath('data.0.yard_status', SalesOrder::YARD_READY)
        ->assertJsonPath('data.0.dispatch_status', 'AWAITING_DISPATCH')
        ->assertJsonPath('data.0.total', 2000)
        ->assertJsonPath('data.0.paid_amount', 2000)
        ->assertJsonPath('data.0.balance', 0)
        ->assertJsonPath('data.0.items_count', 1)
        ->assertJsonPath('data.0.total_quantity', 2);
});

it('never lists partially paid, unpaid or cancelled orders', function () {
    $security = makeRoleUser(Role::SECURITY);

    $partial = makeYardOrder(SalesOrder::PARTIALLY_PAID, 1500);
    $unpaid = makeYardOrder(SalesOrder::PENDING);
    $cancelled = makeYardOrder(SalesOrder::PAID);
    app(OrderService::class)->cancel($cancelled, 'Customer changed their mind');
    $paid = makeYardOrder(SalesOrder::PAID);

    $listed = yardOrderNos($this, $security);

    expect($listed)->toBe([$paid->order_no])
        ->not->toContain($partial->order_no)
        ->not->toContain($unpaid->order_no)
        ->not->toContain($cancelled->order_no);
});

it('does not trust a PAID status the money does not back', function () {
    $security = makeRoleUser(Role::SECURITY);
    $order = makeYardOrder(SalesOrder::PAID);

    // Simulates a row tampered with outside the application: status says
    // PAID, but paid_amount is short of the total.
    SalesOrder::whereKey($order->id)->update(['paid_amount' => 1999.99]);

    expect(yardOrderNos($this, $security))->toBe([]);

    actAs($this, $security)->postJson("/api/v1/security/orders/{$order->id}/dispatch")
        ->assertStatus(409)
        ->assertJsonPath('message', SalesOrder::MSG_NOT_FULLY_PAID);
});

it('moves an order into yard stock the moment its final payment is recorded', function () {
    $security = makeRoleUser(Role::SECURITY);
    $cashier = makeRoleUser(Role::WAREHOUSE_STAFF);
    $order = makeYardOrder(SalesOrder::PARTIALLY_PAID, 1500);

    expect(yardOrderNos($this, $security))->toBe([]);
    expect($order->fresh()->paid_at)->toBeNull();

    actAs($this, $cashier)->patchJson("/api/v1/orders/{$order->id}/payment", ['payment_status' => SalesOrder::PAID])
        ->assertOk();

    expect(yardOrderNos($this, $security))->toBe([$order->order_no]);
    expect($order->fresh()->paid_at)->not->toBeNull();
});

it('treats a partial payment that covers the whole total as fully paid', function () {
    $security = makeRoleUser(Role::SECURITY);
    $cashier = makeRoleUser(Role::WAREHOUSE_STAFF);
    $order = makeYardOrder(SalesOrder::PARTIALLY_PAID, 500);

    actAs($this, $cashier)->patchJson("/api/v1/orders/{$order->id}/payment", [
        'payment_status' => SalesOrder::PARTIALLY_PAID,
        'paid_amount' => 2000,
    ])->assertOk()->assertJsonPath('data.payment_status', SalesOrder::PAID);

    expect(yardOrderNos($this, $security))->toBe([$order->order_no]);
});

it('drops an order back out of the yard if its payment is reduced before dispatch', function () {
    $security = makeRoleUser(Role::SECURITY);
    $cashier = makeRoleUser(Role::WAREHOUSE_STAFF);
    $order = makeYardOrder(SalesOrder::PAID);

    actAs($this, $cashier)->patchJson("/api/v1/orders/{$order->id}/payment", [
        'payment_status' => SalesOrder::PARTIALLY_PAID,
        'paid_amount' => 1000,
    ])->assertOk();

    expect(yardOrderNos($this, $security))->toBe([]);
    expect($order->fresh()->paid_at)->toBeNull();
});

it('searches and date-filters yard stock on the server', function () {
    $security = makeRoleUser(Role::SECURITY);
    $first = makeYardOrder(SalesOrder::PAID);
    $second = makeYardOrder(SalesOrder::PAID);
    SalesOrder::whereKey($second->id)->update(['customer_name' => 'Kamal Motors']);

    actAs($this, $security)->getJson('/api/v1/security/yard-stock?search=Kamal')
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.order_no', $second->order_no);

    actAs($this, $security)->getJson('/api/v1/security/yard-stock?search='.$first->order_no)
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.order_no', $first->order_no);

    actAs($this, $security)->getJson('/api/v1/security/yard-stock?from=2000-01-01&to=2000-01-02')
        ->assertOk()
        ->assertJsonCount(0, 'data');

    actAs($this, $security)->getJson('/api/v1/security/yard-stock?from=not-a-date')
        ->assertStatus(422);
});

/*
|--------------------------------------------------------------------------
| Order-number search
|--------------------------------------------------------------------------
*/

it('finds an eligible order by number, tolerating case and whitespace', function () {
    $security = makeRoleUser(Role::SECURITY);
    $order = makeYardOrder(SalesOrder::PAID, 0, 3);

    actAs($this, $security)->getJson('/api/v1/security/orders/search?order_no='.urlencode('  '.strtolower($order->order_no).' '))
        ->assertOk()
        ->assertJsonPath('meta.eligible', true)
        ->assertJsonPath('data.order_no', $order->order_no)
        ->assertJsonPath('data.customer_name', 'Nimal Traders')
        ->assertJsonPath('data.balance', 0)
        ->assertJsonPath('data.yard_status', SalesOrder::YARD_READY)
        ->assertJsonPath('data.items.0.quantity', 3)
        ->assertJsonPath('data.items.0.unit', 'pcs')
        // Security verifies goods, not pricing.
        ->assertJsonMissingPath('data.items.0.unit_price')
        ->assertJsonMissingPath('data.discount');
});

it('gives a clear message for an order number that does not exist', function () {
    $security = makeRoleUser(Role::SECURITY);

    actAs($this, $security)->getJson('/api/v1/security/orders/search?order_no=SO-2026-0000')
        ->assertNotFound()
        ->assertJsonPath('success', false)
        ->assertJsonPath('message', "No order found with number SO-2026-0000. Check the number on the customer's bill and try again.");

    actAs($this, $security)->getJson('/api/v1/security/orders/search?order_no=')->assertStatus(422);
    actAs($this, $security)->getJson('/api/v1/security/orders/search?order_no='.urlencode("x' OR 1=1 --"))->assertStatus(422);
});

it('refuses an unpaid or cancelled order at search without revealing its contents', function () {
    $security = makeRoleUser(Role::SECURITY);
    $partial = makeYardOrder(SalesOrder::PARTIALLY_PAID, 1500);
    $cancelled = makeYardOrder(SalesOrder::PAID);
    app(OrderService::class)->cancel($cancelled, null);

    actAs($this, $security)->getJson("/api/v1/security/orders/search?order_no={$partial->order_no}")
        ->assertStatus(409)
        ->assertJsonPath('message', SalesOrder::MSG_NOT_FULLY_PAID)
        ->assertJsonMissingPath('data');

    actAs($this, $security)->getJson("/api/v1/security/orders/search?order_no={$cancelled->order_no}")
        ->assertStatus(409)
        ->assertJsonPath('message', SalesOrder::MSG_CANCELLED);

    // Nor can the detail route be used to read an ineligible order.
    actAs($this, $security)->getJson("/api/v1/security/orders/{$partial->id}")->assertNotFound();
});

/*
|--------------------------------------------------------------------------
| Dispatch
|--------------------------------------------------------------------------
*/

it('dispatches a fully paid order and persists a permanent record', function () {
    $security = makeRoleUser(Role::SECURITY, ['name' => 'Gate Officer']);
    $order = makeYardOrder(SalesOrder::PAID, 0, 4);

    $response = actAs($this, $security)->postJson("/api/v1/security/orders/{$order->id}/dispatch", ['notes' => 'Loaded onto lorry WP-1234'])
        ->assertCreated()
        ->assertJsonPath('data.order.yard_status', SalesOrder::YARD_DISPATCHED)
        ->assertJsonPath('data.dispatch.status', 'DISPATCHED')
        ->assertJsonPath('data.dispatch.dispatched_by.name', 'Gate Officer');

    $dispatch = Dispatch::sole();

    expect($response->json('data.dispatch.dispatch_no'))->toBe(sprintf('DSP-%06d', $dispatch->id));
    expect($dispatch)
        ->sales_order_id->toBe($order->id)
        ->order_no->toBe($order->order_no)
        ->customer_name->toBe('Nimal Traders')
        ->dispatched_by->toBe($security->id)
        ->dispatched_by_name->toBe('Gate Officer')
        ->items_count->toBe(1)
        ->total_quantity->toBe(4)
        ->payment_status_at_dispatch->toBe(SalesOrder::PAID)
        ->notes->toBe('Loaded onto lorry WP-1234');
    expect($dispatch->items[0])->toMatchArray(['quantity' => 4, 'unit' => 'pcs']);

    $fresh = $order->fresh();
    expect($fresh->dispatched_at)->not->toBeNull()
        ->and($fresh->dispatched_by)->toBe($security->id);

    // The order itself is never deleted — it stays for audit.
    $this->assertDatabaseHas('sales_orders', ['id' => $order->id, 'status' => 'COMPLETED']);
});

it('writes an ORDER_DISPATCHED entry into the existing audit trail', function () {
    $security = makeRoleUser(Role::SECURITY, ['name' => 'Gate Officer']);
    $order = makeYardOrder(SalesOrder::PAID);

    actAs($this, $security)->postJson("/api/v1/security/orders/{$order->id}/dispatch")->assertCreated();

    $log = AuditLog::where('action', 'order.dispatch')->sole();

    expect($log)
        ->user_id->toBe($security->id)
        ->entity_type->toBe('SalesOrder')
        ->entity_id->toBe($order->id);
    expect($log->old_values)->toMatchArray(['yard_status' => SalesOrder::YARD_READY, 'dispatched_at' => null]);
    expect($log->new_values)->toMatchArray([
        'yard_status' => SalesOrder::YARD_DISPATCHED,
        'order_no' => $order->order_no,
        'dispatched_by' => $security->id,
        'dispatched_by_name' => 'Gate Officer',
    ]);
});

it('refuses to dispatch a partially paid order even when the client claims it is paid', function () {
    $security = makeRoleUser(Role::SECURITY);
    $order = makeYardOrder(SalesOrder::PARTIALLY_PAID, 1500);

    actAs($this, $security)->postJson("/api/v1/security/orders/{$order->id}/dispatch", [
        'payment_status' => 'PAID',
        'paid_amount' => 2000,
        'paymentStatus' => 'FULLY_PAID',
    ])
        ->assertStatus(409)
        ->assertJsonPath('message', SalesOrder::MSG_NOT_FULLY_PAID);

    expect(Dispatch::count())->toBe(0);
    $this->assertDatabaseHas('sales_orders', [
        'id' => $order->id,
        'payment_status' => SalesOrder::PARTIALLY_PAID,
        'paid_amount' => 1500,
        'dispatched_at' => null,
    ]);
});

it('refuses to dispatch unpaid and cancelled orders', function () {
    $security = makeRoleUser(Role::SECURITY);
    $unpaid = makeYardOrder(SalesOrder::PENDING);
    $cancelled = makeYardOrder(SalesOrder::PAID);
    app(OrderService::class)->cancel($cancelled, null);

    actAs($this, $security)->postJson("/api/v1/security/orders/{$unpaid->id}/dispatch")
        ->assertStatus(409)
        ->assertJsonPath('message', SalesOrder::MSG_NOT_FULLY_PAID);

    actAs($this, $security)->postJson("/api/v1/security/orders/{$cancelled->id}/dispatch")
        ->assertStatus(409)
        ->assertJsonPath('message', SalesOrder::MSG_CANCELLED);

    actAs($this, $security)->postJson('/api/v1/security/orders/999999/dispatch')->assertNotFound();

    expect(Dispatch::count())->toBe(0);
});

it('removes a dispatched order from yard stock and adds it to dispatch history', function () {
    $security = makeRoleUser(Role::SECURITY);
    $order = makeYardOrder(SalesOrder::PAID);
    $other = makeYardOrder(SalesOrder::PAID);

    actAs($this, $security)->postJson("/api/v1/security/orders/{$order->id}/dispatch")->assertCreated();

    expect(yardOrderNos($this, $security))->toBe([$other->order_no]);

    actAs($this, $security)->getJson('/api/v1/security/dispatch-history')
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.order_no', $order->order_no)
        ->assertJsonPath('data.0.status', 'DISPATCHED');

    // A later search shows the release rather than offering it again.
    actAs($this, $security)->getJson("/api/v1/security/orders/search?order_no={$order->order_no}")
        ->assertOk()
        ->assertJsonPath('meta.eligible', false)
        ->assertJsonPath('meta.reason', SalesOrder::MSG_ALREADY_DISPATCHED)
        ->assertJsonPath('data.yard_status', SalesOrder::YARD_DISPATCHED)
        ->assertJsonPath('data.dispatch.dispatched_by.id', $security->id);
});

it('searches dispatch history by order, customer, dispatch number and date', function () {
    $security = makeRoleUser(Role::SECURITY);
    $order = makeYardOrder(SalesOrder::PAID);
    actAs($this, $security)->postJson("/api/v1/security/orders/{$order->id}/dispatch")->assertCreated();
    $dispatch = Dispatch::sole();

    foreach ([$order->order_no, 'Nimal', $dispatch->dispatch_no] as $term) {
        actAs($this, $security)->getJson('/api/v1/security/dispatch-history?search='.urlencode($term))
            ->assertOk()
            ->assertJsonCount(1, 'data');
    }

    actAs($this, $security)->getJson('/api/v1/security/dispatch-history?search=nobody-matches')
        ->assertOk()->assertJsonCount(0, 'data');

    $today = now()->toDateString();
    actAs($this, $security)->getJson("/api/v1/security/dispatch-history?from={$today}&to={$today}")
        ->assertOk()->assertJsonCount(1, 'data');
});

it('never dispatches the same order twice', function () {
    $security = makeRoleUser(Role::SECURITY);
    $colleague = makeRoleUser(Role::SECURITY);
    $order = makeYardOrder(SalesOrder::PAID);

    actAs($this, $security)->postJson("/api/v1/security/orders/{$order->id}/dispatch")->assertCreated();

    actAs($this, $colleague)->postJson("/api/v1/security/orders/{$order->id}/dispatch")
        ->assertStatus(409)
        ->assertJsonPath('message', SalesOrder::MSG_ALREADY_DISPATCHED);

    expect(Dispatch::count())->toBe(1);
    expect($order->fresh()->dispatched_by)->toBe($security->id);
});

it('lets the database refuse a second dispatch record even if the order flag was bypassed', function () {
    $security = makeRoleUser(Role::SECURITY);
    $order = makeYardOrder(SalesOrder::PAID);
    actAs($this, $security);

    app(DispatchService::class)->dispatch($order);

    // Guard 3 in isolation: clear the order's flag behind the service's back,
    // so guards 1 and 2 both pass — the UNIQUE index must still refuse.
    SalesOrder::whereKey($order->id)->update(['dispatched_at' => null]);

    expect(fn () => app(DispatchService::class)->dispatch($order->fresh()))
        ->toThrow(DispatchConflictException::class, SalesOrder::MSG_ALREADY_DISPATCHED);

    expect(Dispatch::count())->toBe(1);
    // The failed attempt rolled back with it: the flag is still cleared.
    expect($order->fresh()->dispatched_at)->toBeNull();

    expect(fn () => Dispatch::create(Dispatch::sole()->only([
        'sales_order_id', 'order_no', 'customer_name', 'items_count', 'total_quantity',
        'total', 'paid_amount', 'payment_status_at_dispatch', 'items', 'dispatched_by_name', 'dispatched_at',
    ])))->toThrow(UniqueConstraintViolationException::class);
});

it('locks a dispatched order against cancellation and payment changes', function () {
    $security = makeRoleUser(Role::SECURITY);
    $admin = makeRoleUser(Role::ADMIN);
    $order = makeYardOrder(SalesOrder::PAID);

    actAs($this, $security)->postJson("/api/v1/security/orders/{$order->id}/dispatch")->assertCreated();

    actAs($this, $admin)->postJson("/api/v1/orders/{$order->id}/cancel")
        ->assertStatus(409)
        ->assertJsonPath('message', 'This order has already been dispatched from the yard and cannot be cancelled.');

    actAs($this, $admin)->patchJson("/api/v1/orders/{$order->id}/payment", ['payment_status' => SalesOrder::PENDING])
        ->assertStatus(409);

    $this->assertDatabaseHas('sales_orders', ['id' => $order->id, 'payment_status' => SalesOrder::PAID, 'status' => 'COMPLETED']);
});

it('keeps dispatch fields out of mass assignment', function () {
    $order = makeYardOrder(SalesOrder::PENDING);

    $order->fill(['dispatched_at' => now(), 'dispatched_by' => 1, 'paid_at' => now()])->save();

    expect($order->fresh())
        ->dispatched_at->toBeNull()
        ->dispatched_by->toBeNull()
        ->paid_at->toBeNull();
});

/*
|--------------------------------------------------------------------------
| Dashboard
|--------------------------------------------------------------------------
*/

it('summarises the yard on the security dashboard', function () {
    $security = makeRoleUser(Role::SECURITY);
    $shipped = makeYardOrder(SalesOrder::PAID, 0, 1);
    makeYardOrder(SalesOrder::PAID, 0, 3);
    $carriedOver = makeYardOrder(SalesOrder::PAID, 0, 5);
    SalesOrder::whereKey($carriedOver->id)->update(['paid_at' => now()->subDays(2)]);
    makeYardOrder(SalesOrder::PARTIALLY_PAID, 100, 7);

    actAs($this, $security)->postJson("/api/v1/security/orders/{$shipped->id}/dispatch")->assertCreated();

    actAs($this, $security)->getJson('/api/v1/security/dashboard')
        ->assertOk()
        ->assertJsonPath('data.kpis.ready_for_dispatch', 2)
        ->assertJsonPath('data.kpis.dispatched_today', 1)
        ->assertJsonPath('data.kpis.units_in_yard', 8)
        ->assertJsonPath('data.kpis.pending_from_earlier', 1)
        ->assertJsonPath('data.kpis.ready_value', 8000)
        ->assertJsonCount(1, 'data.recent_dispatches');
});

/*
|--------------------------------------------------------------------------
| Authorisation
|--------------------------------------------------------------------------
*/

it('confines a security user to the security module', function () {
    $security = makeRoleUser(Role::SECURITY);
    $order = makeYardOrder(SalesOrder::PARTIALLY_PAID, 500);

    foreach (['/api/v1/dashboard', '/api/v1/orders', "/api/v1/orders/{$order->id}", '/api/v1/parts',
        '/api/v1/inventory', '/api/v1/users', '/api/v1/settings', '/api/v1/audit-logs', '/api/v1/reports/sales', '/api/v1/roles'] as $url) {
        actAs($this, $security)->getJson($url)->assertForbidden();
    }

    actAs($this, $security)->patchJson("/api/v1/orders/{$order->id}/payment", ['payment_status' => SalesOrder::PAID])
        ->assertForbidden();
    actAs($this, $security)->postJson("/api/v1/orders/{$order->id}/cancel")->assertForbidden();
    actAs($this, $security)->postJson('/api/v1/orders', [])->assertForbidden();

    // The payment was not touched.
    expect($order->fresh()->payment_status)->toBe(SalesOrder::PARTIALLY_PAID);
});

it('keeps the security module away from roles without its permissions', function () {
    $order = makeYardOrder(SalesOrder::PAID);

    foreach ([Role::MANAGER, Role::WAREHOUSE_STAFF, Role::VIEWER] as $role) {
        $user = makeRoleUser($role);

        actAs($this, $user)->getJson('/api/v1/security/yard-stock')->assertForbidden();
        actAs($this, $user)->getJson('/api/v1/security/dashboard')->assertForbidden();
        actAs($this, $user)->getJson('/api/v1/security/dispatch-history')->assertForbidden();
        actAs($this, $user)->postJson("/api/v1/security/orders/{$order->id}/dispatch")->assertForbidden();
    }

    expect(Dispatch::count())->toBe(0);
});

it('lets an administrator work the yard gate', function () {
    $admin = makeRoleUser(Role::ADMIN);
    $order = makeYardOrder(SalesOrder::PAID);

    actAs($this, $admin)->getJson('/api/v1/security/yard-stock')->assertOk();
    actAs($this, $admin)->postJson("/api/v1/security/orders/{$order->id}/dispatch")->assertCreated();
});

it('refuses a deactivated security account', function () {
    $security = makeRoleUser(Role::SECURITY, ['is_active' => false]);

    actAs($this, $security)->getJson('/api/v1/security/yard-stock')->assertForbidden();
});

it('requires a session for every security route', function () {
    $this->getJson('/api/v1/security/dashboard')->assertUnauthorized();
    $this->getJson('/api/v1/security/yard-stock')->assertUnauthorized();
    $this->postJson('/api/v1/security/orders/1/dispatch')->assertUnauthorized();
});

/*
|--------------------------------------------------------------------------
| Security sign-in portal
|--------------------------------------------------------------------------
*/

it('signs a security user in through the security portal', function () {
    makeRoleUser(Role::SECURITY, ['email' => 'gate@hanwellaspares.lk']);

    $response = $this->postJson('/api/v1/auth/login', [
        'email' => 'gate@hanwellaspares.lk',
        'password' => 'correct-horse-battery',
        'portal' => 'security',
    ])
        ->assertOk()
        ->assertJsonPath('data.role.slug', Role::SECURITY)
        ->assertJsonMissingPath('data.password');

    expect($response->json('data.permissions'))->toEqualCanonicalizing(['view_yard_stock', 'dispatch_orders']);
    $this->assertAuthenticated();
});

it('turns a non-security account away from the security portal', function () {
    makeRoleUser(Role::WAREHOUSE_STAFF, ['email' => 'staff@hanwellaspares.lk']);

    $this->postJson('/api/v1/auth/login', [
        'email' => 'staff@hanwellaspares.lk',
        'password' => 'correct-horse-battery',
        'portal' => 'security',
    ])
        ->assertStatus(422)
        ->assertJsonPath('errors.email.0', 'This account does not have Security access. Use the main warehouse sign-in instead.');

    $this->assertGuest();
});

it('rejects wrong credentials at the security portal with the standard message', function () {
    makeRoleUser(Role::SECURITY, ['email' => 'gate@hanwellaspares.lk']);

    $this->postJson('/api/v1/auth/login', [
        'email' => 'gate@hanwellaspares.lk',
        'password' => 'wrong-password',
        'portal' => 'security',
    ])
        ->assertStatus(422)
        ->assertJsonPath('errors.email.0', 'These credentials do not match our records.');

    $this->assertGuest();
});
