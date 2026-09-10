<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $this->call([
            // Reference data the application cannot run without.
            RolePermissionSeeder::class,
            SettingSeeder::class,

            // Development data. Order matters: parts reference warehouses,
            // categories, suppliers and vehicle models, so the catalogue and
            // the physical location tree must exist before PartSeeder runs.
            UserSeeder::class,
            WarehouseSeeder::class,
            CatalogSeeder::class,
            PartSeeder::class,
        ]);
    }
}
