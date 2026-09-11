<?php

use App\Models\Role;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->seed(RolePermissionSeeder::class);
});

it('creates a real, active admin account with a hashed password', function () {
    $this->artisan('wms:create-admin', [
        '--name' => 'Production Admin',
        '--email' => 'admin@realcompany.lk',
        '--password' => 'a-genuinely-long-password',
    ])->assertSuccessful();

    $user = User::where('email', 'admin@realcompany.lk')->first();

    expect($user)->not->toBeNull();
    expect($user->is_active)->toBeTrue();
    expect($user->role->slug)->toBe(Role::ADMIN);
    expect(\Illuminate\Support\Facades\Hash::check('a-genuinely-long-password', $user->password))->toBeTrue();
});

it('refuses a duplicate email and creates nothing', function () {
    User::create([
        'name' => 'Existing', 'email' => 'taken@realcompany.lk',
        'password' => 'whatever-password', 'role_id' => Role::where('slug', Role::VIEWER)->value('id'),
        'is_active' => true,
    ]);

    $this->artisan('wms:create-admin', [
        '--name' => 'Second Admin',
        '--email' => 'taken@realcompany.lk',
        '--password' => 'a-genuinely-long-password',
    ])->assertFailed();

    expect(User::where('email', 'taken@realcompany.lk')->count())->toBe(1);
});

it('refuses a short password', function () {
    $this->artisan('wms:create-admin', [
        '--name' => 'Weak Password Admin',
        '--email' => 'weak@realcompany.lk',
        '--password' => 'short',
    ])->assertFailed();

    expect(User::where('email', 'weak@realcompany.lk')->exists())->toBeFalse();
});

it('fails cleanly when the ADMIN role has not been seeded yet', function () {
    Role::where('slug', Role::ADMIN)->delete();

    $this->artisan('wms:create-admin', [
        '--name' => 'Production Admin',
        '--email' => 'admin@realcompany.lk',
        '--password' => 'a-genuinely-long-password',
    ])->assertFailed();

    expect(User::where('email', 'admin@realcompany.lk')->exists())->toBeFalse();
});
