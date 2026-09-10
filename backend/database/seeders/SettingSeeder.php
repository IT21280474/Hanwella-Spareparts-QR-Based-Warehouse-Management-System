<?php

namespace Database\Seeders;

use App\Models\Setting;
use Illuminate\Database\Seeder;

class SettingSeeder extends Seeder
{
    /** @var array<string, array{group: string, value: mixed}> */
    private const SETTINGS = [
        'company.name' => ['group' => 'warehouse', 'value' => 'Hanwella Spareparts Warehouse'],
        'company.address' => ['group' => 'warehouse', 'value' => null],
        'company.contact' => ['group' => 'warehouse', 'value' => null],
        'company.registration_no' => ['group' => 'warehouse', 'value' => null],

        'qr.prefix' => ['group' => 'qr', 'value' => 'SJL'],
        'qr.pad' => ['group' => 'qr', 'value' => 5],
        'qr.default_layout' => ['group' => 'qr', 'value' => 'A4_4x10'],

        'inventory.default_min_stock' => ['group' => 'inventory', 'value' => 8],
        'inventory.low_stock_banner' => ['group' => 'inventory', 'value' => true],

        'notifications.low_stock_email' => ['group' => 'notifications', 'value' => false],
        'notifications.out_of_stock_email' => ['group' => 'notifications', 'value' => true],
    ];

    public function run(): void
    {
        foreach (self::SETTINGS as $key => $meta) {
            // updateOrCreate on the key only — never clobber a value an
            // administrator has already changed.
            Setting::firstOrCreate(
                ['key' => $key],
                ['value' => $meta['value'], 'group' => $meta['group']],
            );
        }
    }
}
