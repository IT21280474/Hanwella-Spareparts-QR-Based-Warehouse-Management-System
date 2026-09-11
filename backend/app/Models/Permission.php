<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class Permission extends Model
{
    use HasFactory;

    protected $fillable = ['slug', 'name', 'group'];

    /**
     * The complete permission vocabulary. Anything not listed here is not a
     * permission — the seeder and the `permission:` middleware both read from
     * this one array, so a typo in a route fails loudly at seed time.
     *
     * @var array<string, array<string, string>>
     */
    public const CATALOGUE = [
        'Dashboard' => [
            'view_dashboard' => 'View dashboard',
        ],
        'Inventory' => [
            'view_inventory' => 'View inventory',
            'create_inventory' => 'Create parts',
            'update_inventory' => 'Update parts and stock',
            'delete_inventory' => 'Delete parts',
        ],
        'QR' => [
            'scan_qr' => 'Scan QR codes',
            'print_labels' => 'Generate and print QR labels',
        ],
        'Stock' => [
            'view_transactions' => 'View stock movements',
            'create_stock_in' => 'Record stock in',
            'create_stock_out' => 'Record stock out and sales',
        ],
        'Reports' => [
            'view_reports' => 'View reports',
            'export_reports' => 'Export reports',
        ],
        'Security' => [
            'view_yard_stock' => 'View yard stock and dispatch history',
            'dispatch_orders' => 'Dispatch fully paid orders from the yard',
        ],
        'Administration' => [
            'manage_users' => 'Manage users and audit logs',
            'manage_settings' => 'Manage settings and reference data',
        ],
    ];

    /** @return list<string> */
    public static function allSlugs(): array
    {
        return array_merge(...array_map(array_keys(...), array_values(self::CATALOGUE)));
    }

    public function roles(): BelongsToMany
    {
        return $this->belongsToMany(Role::class);
    }
}
