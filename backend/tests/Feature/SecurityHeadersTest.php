<?php

use App\Models\Role;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->seed(RolePermissionSeeder::class);
});

it('sets the security headers on a normal successful response', function () {
    $viewer = makeRoleUser(Role::VIEWER);

    $response = $this->actingAs($viewer)->getJson('/api/v1/auth/me');

    $response->assertOk()
        ->assertHeader('X-Content-Type-Options', 'nosniff')
        ->assertHeader('X-Frame-Options', 'DENY')
        ->assertHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
        ->assertHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");

    // Symfony's Response normalises Cache-Control directives into its own
    // canonical order — assert the directives are present, not the exact
    // string, so this doesn't break if that internal ordering ever shifts.
    $cacheControl = $response->headers->get('Cache-Control');
    expect($cacheControl)->toContain('no-store')->toContain('private')->toContain('must-revalidate');

    expect($response->headers->has('X-Powered-By'))->toBeFalse();
});

it('sets the same security headers on an error response, not only successful ones', function () {
    // No auth at all — this becomes a 401 thrown from deep inside the
    // pipeline, exercising the exception-render path rather than the
    // middleware's own post-$next() code.
    $response = $this->getJson('/api/v1/auth/me');

    $response->assertStatus(401)
        ->assertHeader('X-Content-Type-Options', 'nosniff')
        ->assertHeader('X-Frame-Options', 'DENY')
        ->assertHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
});

it('sets the security headers on a 403 permission-denied response too', function () {
    $viewer = makeRoleUser(Role::VIEWER);

    $response = $this->actingAs($viewer)->postJson('/api/v1/stock/in', [
        'part_id' => 1, 'quantity' => 1,
    ]);

    $response->assertStatus(403)
        ->assertHeader('X-Content-Type-Options', 'nosniff')
        ->assertHeader('X-Frame-Options', 'DENY');
});
