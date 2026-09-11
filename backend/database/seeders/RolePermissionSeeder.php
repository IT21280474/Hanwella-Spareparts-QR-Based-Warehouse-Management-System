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
        // Deliberately narrower than WAREHOUSE_STAFF: a counter sales
        // account can look up stock, scan a part and complete/cancel a
        // sale, but cannot receive stock, adjust quantities or print
        // labels — those stay warehouse-management duties, not sales ones.
        Role::SALES_PERSON => [
            'view_dashboard',
            'view_inventory',
            'scan_qr',
            'view_transactions', 'create_stock_out',
        ],
        // The gate checkpoint: sees fully paid orders and confirms goods
        // physically leave. No inventory, pricing or sales access at all —
        // dispatching is a verification duty, not a selling or stock one.
        Role::SECURITY => [
            'view_transactions', 'dispatch_orders',
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
        Role::SALES_PERSON => ['Sales person', 'Counter sales only — scan, sell and view stock, no stock-in, adjustments or labels.'],
        Role::SECURITY => ['Security', 'Gate checkpoint — verifies and dispatches fully paid orders only.'],
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
