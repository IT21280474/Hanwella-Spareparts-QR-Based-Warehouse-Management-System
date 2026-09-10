<?php

use App\Models\Role;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->seed(RolePermissionSeeder::class);
});

function makeUser(string $roleSlug = Role::ADMIN, array $attributes = []): User
{
    return User::create(array_merge([
        'name' => 'Test User',
        'email' => 'test@hanwellaspares.lk',
        'password' => 'correct-horse-battery',
        'role_id' => Role::where('slug', $roleSlug)->value('id'),
        'is_active' => true,
    ], $attributes));
}

it('signs a user in with valid credentials', function () {
    makeUser();

    $this->postJson('/api/v1/auth/login', [
        'email' => 'test@hanwellaspares.lk',
        'password' => 'correct-horse-battery',
    ])
        ->assertOk()
        ->assertJsonPath('success', true)
        ->assertJsonPath('data.email', 'test@hanwellaspares.lk')
        ->assertJsonPath('data.role.slug', Role::ADMIN);

    $this->assertAuthenticated();
});

it('rejects a wrong password with 422 and the standard envelope', function () {
    makeUser();

    $this->postJson('/api/v1/auth/login', [
        'email' => 'test@hanwellaspares.lk',
        'password' => 'wrong-password',
    ])
        ->assertStatus(422)
        ->assertJsonPath('success', false)
        ->assertJsonPath('message', 'Validation failed.')
        ->assertJsonStructure(['errors' => ['email']]);

    $this->assertGuest();
});

it('gives the same message for an unknown email as for a wrong password', function () {
    makeUser();

    $unknown = $this->postJson('/api/v1/auth/login', [
        'email' => 'nobody@hanwellaspares.lk',
        'password' => 'correct-horse-battery',
    ])->json('errors.email');

    $wrong = $this->postJson('/api/v1/auth/login', [
        'email' => 'test@hanwellaspares.lk',
        'password' => 'wrong-password',
    ])->json('errors.email');

    expect($unknown)->toBe($wrong);
});

it('refuses a deactivated account', function () {
    makeUser(Role::ADMIN, ['is_active' => false]);

    $this->postJson('/api/v1/auth/login', [
        'email' => 'test@hanwellaspares.lk',
        'password' => 'correct-horse-battery',
    ])->assertStatus(422);

    $this->assertGuest();
});

it('records the sign-in timestamp', function () {
    $user = makeUser();

    expect($user->last_login_at)->toBeNull();

    $this->postJson('/api/v1/auth/login', [
        'email' => 'test@hanwellaspares.lk',
        'password' => 'correct-horse-battery',
    ])->assertOk();

    expect($user->fresh()->last_login_at)->not->toBeNull();
});

it('writes an audit log entry on sign-in and sign-out', function () {
    $user = makeUser();

    $this->postJson('/api/v1/auth/login', [
        'email' => 'test@hanwellaspares.lk',
        'password' => 'correct-horse-battery',
    ])->assertOk();

    $this->assertDatabaseHas('audit_logs', [
        'action' => 'auth.login',
        'user_id' => $user->id,
    ]);

    $this->postJson('/api/v1/auth/logout')->assertOk();

    $this->assertDatabaseHas('audit_logs', [
        'action' => 'auth.logout',
        'user_id' => $user->id,
    ]);
});

it('never returns the password hash', function () {
    makeUser();

    $response = $this->postJson('/api/v1/auth/login', [
        'email' => 'test@hanwellaspares.lk',
        'password' => 'correct-horse-battery',
    ])->assertOk();

    expect($response->json('data'))->not->toHaveKey('password');
    expect(json_encode($response->json()))->not->toContain('$2y$');
});

it('rejects an unauthenticated call to me with 401', function () {
    $this->getJson('/api/v1/auth/me')
        ->assertStatus(401)
        ->assertJsonPath('success', false)
        ->assertJsonPath('message', 'Unauthenticated.');
});

it('returns the current user with their permissions', function () {
    $user = makeUser(Role::VIEWER);

    $this->actingAs($user)
        ->getJson('/api/v1/auth/me')
        ->assertOk()
        ->assertJsonPath('data.role.slug', Role::VIEWER)
        ->assertJsonPath('data.permissions', [
            'view_dashboard', 'view_inventory', 'view_transactions', 'view_reports',
        ]);
});

it('ends the session on logout', function () {
    makeUser();

    // Drive a real sign-in rather than actingAs(): the point of this test is
    // that the *session* is destroyed, and actingAs() never creates one.
    $this->postJson('/api/v1/auth/login', [
        'email' => 'test@hanwellaspares.lk',
        'password' => 'correct-horse-battery',
    ])->assertOk();

    $this->getJson('/api/v1/auth/me')->assertOk();

    $this->postJson('/api/v1/auth/logout')->assertOk();

    // A real request resolves its guards against a fresh container; the test
    // harness reuses one, so Sanctum's RequestGuard would otherwise hand back
    // the user it cached before logout. Dropping the resolved guards
    // reproduces what the next HTTP request actually sees.
    $this->app['auth']->forgetGuards();

    // The session is gone, so the next call is unauthenticated again.
    $this->getJson('/api/v1/auth/me')->assertStatus(401);
});

it('throttles repeated failed sign-in attempts', function () {
    makeUser();

    // The limiter allows 6 per minute; the seventh must be refused.
    foreach (range(1, 6) as $ignored) {
        $this->postJson('/api/v1/auth/login', [
            'email' => 'test@hanwellaspares.lk',
            'password' => 'wrong-password',
        ]);
    }

    $this->postJson('/api/v1/auth/login', [
        'email' => 'test@hanwellaspares.lk',
        'password' => 'wrong-password',
    ])->assertStatus(429);
});

it('returns 404 in the standard envelope for an unknown endpoint', function () {
    $this->getJson('/api/v1/does-not-exist')
        ->assertStatus(404)
        ->assertJsonPath('success', false);
});
