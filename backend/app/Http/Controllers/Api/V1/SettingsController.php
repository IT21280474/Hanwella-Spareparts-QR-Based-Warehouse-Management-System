<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Setting;
use App\Services\AuditLogger;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Validation\Rule;

/**
 * System settings.
 *
 * Stored as flat `group.key` rows so a new setting never needs a migration,
 * but read and written here as the nested `{company, inventory, qr,
 * notifications}` document the settings screen actually edits.
 */
class SettingsController extends Controller
{
    public function __construct(private readonly AuditLogger $audit) {}

    public function show(): JsonResponse
    {
        return ApiResponse::success($this->present(), 'Settings retrieved successfully.');
    }

    public function update(Request $request): JsonResponse
    {
        $data = $request->validate([
            'company.name' => ['required', 'string', 'max:160'],
            'company.address' => ['nullable', 'string', 'max:255'],
            'company.contact' => ['nullable', 'string', 'max:120'],
            'company.registration_no' => ['nullable', 'string', 'max:60'],

            'inventory.default_warehouse_id' => ['nullable', 'integer', 'exists:warehouses,id'],
            'inventory.default_min_stock' => ['required', 'integer', 'min:0'],
            'inventory.currency' => ['required', 'string', 'max:5'],

            'qr.prefix' => ['required', 'string', 'max:6', 'alpha'],
            'qr.padding' => ['required', 'integer', 'min:3', 'max:8'],
            'qr.default_layout' => ['required', 'string', Rule::in(array_keys(config('wms.qr.layouts')))],

            'notifications.low_stock' => ['sometimes', 'boolean'],
            'notifications.out_of_stock' => ['sometimes', 'boolean'],
            'notifications.daily_summary' => ['sometimes', 'boolean'],
            'notifications.email' => ['nullable', 'email', 'max:160'],
        ]);

        $before = $this->present();

        foreach (Arr::dot($data) as $key => $value) {
            [$group] = explode('.', $key, 2);
            Setting::updateOrCreate(['key' => $key], ['value' => $value, 'group' => $group]);
        }

        $this->audit->log('settings.update', null, $before, $this->present(), 'System settings updated');

        return ApiResponse::success($this->present(), 'Settings saved successfully.');
    }

    private function present(): array
    {
        $flat = Setting::pluck('value', 'key');

        return [
            'company' => [
                'name' => $flat->get('company.name', config('wms.company.name')),
                'address' => $flat->get('company.address', config('wms.company.address')),
                'contact' => $flat->get('company.contact', config('wms.company.contact')),
                'registration_no' => $flat->get('company.registration_no', config('wms.company.registration_no')),
            ],
            'inventory' => [
                'default_warehouse_id' => $flat->get('inventory.default_warehouse_id'),
                'default_min_stock' => $flat->get('inventory.default_min_stock', config('wms.inventory.default_min_stock')),
                'currency' => $flat->get('inventory.currency', config('wms.currency')),
            ],
            'qr' => [
                'prefix' => $flat->get('qr.prefix', config('wms.qr.prefix')),
                'padding' => $flat->get('qr.padding', config('wms.qr.pad')),
                'default_layout' => $flat->get('qr.default_layout', config('wms.qr.default_layout')),
            ],
            'notifications' => [
                'low_stock' => $flat->get('notifications.low_stock_email', false),
                'out_of_stock' => $flat->get('notifications.out_of_stock_email', true),
                'daily_summary' => $flat->get('notifications.daily_summary', false),
                'email' => $flat->get('notifications.email'),
            ],
        ];
    }
}
