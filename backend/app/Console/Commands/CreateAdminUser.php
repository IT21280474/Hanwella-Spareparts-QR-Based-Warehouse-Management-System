<?php

namespace App\Console\Commands;

use App\Models\Role;
use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Validator;

/**
 * Provisions the first real ADMIN account for a production deployment.
 *
 * `database/seeders/UserSeeder.php` exists only for local development — it
 * creates one account per role, all sharing a single well-known password.
 * Running it against production would ship every account with the same
 * guessable credential. This command is the documented alternative (see
 * `docs/deployment/README.md` §2): a single, real admin account with a
 * password only its operator knows, from which every other account is then
 * created normally through the Users screen.
 */
class CreateAdminUser extends Command
{
    protected $signature = 'wms:create-admin {--name=} {--email=} {--password=}';

    protected $description = 'Create a real ADMIN account for first-time production setup';

    public function handle(): int
    {
        $name = $this->option('name') ?: $this->ask('Name');
        $email = $this->option('email') ?: $this->ask('Email address');
        $password = $this->option('password') ?: $this->secret('Password (min 10 characters)');

        $validator = Validator::make(compact('name', 'email', 'password'), [
            'name' => ['required', 'string', 'max:120'],
            'email' => ['required', 'email', 'max:190', 'unique:users,email'],
            'password' => ['required', 'string', 'min:10'],
        ]);

        if ($validator->fails()) {
            foreach ($validator->errors()->all() as $error) {
                $this->components->error($error);
            }

            return self::FAILURE;
        }

        $adminRoleId = Role::where('slug', Role::ADMIN)->value('id');

        if ($adminRoleId === null) {
            $this->components->error(
                'The ADMIN role does not exist yet — run `php artisan db:seed --class=RolePermissionSeeder` first.',
            );

            return self::FAILURE;
        }

        $user = User::create([
            'name' => $name,
            'email' => $email,
            'password' => $password,
            'role_id' => $adminRoleId,
            'is_active' => true,
            'email_verified_at' => now(),
        ]);

        $this->components->info("Admin account created: {$user->email}");

        return self::SUCCESS;
    }
}
