<?php

namespace Database\Seeders;

use App\Models\Permission;
use App\Models\Role;
use Illuminate\Database\Seeder;

class RolePermissionSeeder extends Seeder
{
    /**
     * The role -> permission matrix.
     *
     * ADMIN is deliberately not listed: it receives every permission in the
     * catalogue, so adding a new permission cannot silently leave the
     * administrator locked out of a new feature.
     */
    private const MATRIX = [
        Role::MANAGER => [
            'view_dashboard',
            'view_inventory', 'create_inventory', 'update_inventory',
            'scan_qr', 'print_labels',
            'view_transactions', 'create_stock_in', 'create_stock_out',
            'view_reports', 'export_reports',
        ],
        Role::WAREHOUSE_STAFF => [
            'view_dashboard',
            'view_inventory', 'update_inventory',
            'scan_qr', 'print_labels',
            'view_transactions', 'create_stock_in', 'create_stock_out',
        ],
        Role::VIEWER => [
            'view_dashboard',
            'view_inventory',
            'view_transactions',
            'view_reports',
        ],
    ];

    private const ROLE_META = [
        Role::ADMIN => ['Warehouse admin', 'Full access including users, settings and audit logs.'],
        Role::MANAGER => ['Warehouse manager', 'Day-to-day operations plus reporting and exports.'],
        Role::WAREHOUSE_STAFF => ['Warehouse staff', 'Scanning, stock movements and counter sales.'],
        Role::VIEWER => ['Viewer', 'Read-only access to inventory, movements and reports.'],
    ];

    public function run(): void
    {
        $permissions = [];

        foreach (Permission::CATALOGUE as $group => $entries) {
            foreach ($entries as $slug => $name) {
                $permissions[$slug] = Permission::updateOrCreate(
                    ['slug' => $slug],
                    ['name' => $name, 'group' => $group],
                );
            }
        }

        foreach (self::ROLE_META as $slug => [$name, $description]) {
            $role = Role::updateOrCreate(
                ['slug' => $slug],
                ['name' => $name, 'description' => $description],
            );

            $granted = $slug === Role::ADMIN
                ? Permission::allSlugs()
                : self::MATRIX[$slug];

            $role->permissions()->sync(
                collect($granted)->map(fn (string $s) => $permissions[$s]->id)->all()
            );
        }
    }
}
