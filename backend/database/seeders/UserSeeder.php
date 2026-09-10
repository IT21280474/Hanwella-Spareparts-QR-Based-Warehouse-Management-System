<?php

namespace Database\Seeders;

use App\Models\Role;
use App\Models\User;
use Illuminate\Database\Seeder;

/**
 * Development accounts, one per role.
 *
 * The password comes from DEV_SEED_PASSWORD so that no credential is committed
 * to the repository. It falls back to a well-known development value, which is
 * fine precisely because these accounts only ever exist in a seeded dev
 * database — production is provisioned through `php artisan wms:create-admin`.
 */
class UserSeeder extends Seeder
{
    private const USERS = [
        ['Sadeeka Perera', 'sadeeka@hanwellaspares.lk', Role::ADMIN],
        ['Ruwan Perera', 'ruwan@hanwellaspares.lk', Role::MANAGER],
        ['Kasun Adikari', 'kasun@hanwellaspares.lk', Role::WAREHOUSE_STAFF],
        ['Nimali Silva', 'nimali@hanwellaspares.lk', Role::VIEWER],
    ];

    public function run(): void
    {
        $password = env('DEV_SEED_PASSWORD', 'password');
        $roles = Role::pluck('id', 'slug');

        foreach (self::USERS as [$name, $email, $roleSlug]) {
            User::updateOrCreate(
                ['email' => $email],
                [
                    'name' => $name,
                    'password' => $password,
                    'role_id' => $roles[$roleSlug],
                    'is_active' => true,
                    'email_verified_at' => now(),
                ],
            );
        }
    }
}
