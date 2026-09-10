<?php

return [

    /*
    |--------------------------------------------------------------------------
    | QR identity
    |--------------------------------------------------------------------------
    |
    | Identities are `<prefix>-<zero-padded sequence>` — SJL-00001 — matching
    | the printed label reference. Changing these affects newly generated
    | identities only; existing codes are immutable once printed onto stock.
    |
    */

    'qr' => [
        'prefix' => env('WMS_QR_PREFIX', 'SJL'),
        'pad' => (int) env('WMS_QR_PAD', 5),

        // Error-correction level and cell metrics reproduced from the reference
        // label sheet so a regenerated label scans identically to a printed one.
        'error_correction' => 'M',
        'cell_size' => 4,
        'margin' => 2,

        // Label sheet layouts offered in the UI. `per_sheet` must equal
        // columns * rows.
        'layouts' => [
            'A4_4x10' => ['label' => 'A4 · 4 × 10 (40 labels)', 'columns' => 4, 'rows' => 10, 'per_sheet' => 40],
            'A4_3x8' => ['label' => 'A4 · 3 × 8 (24 labels)', 'columns' => 3, 'rows' => 8, 'per_sheet' => 24],
            'A4_5x13' => ['label' => 'A4 · 5 × 13 (65 labels)', 'columns' => 5, 'rows' => 13, 'per_sheet' => 65],
        ],
        'default_layout' => 'A4_4x10',

        // The reference warns before rendering more than 80 labels and refuses
        // beyond 200 in a single run.
        'batch_warning_threshold' => 80,
        'max_batch' => 200,
    ],

    /*
    |--------------------------------------------------------------------------
    | Inventory
    |--------------------------------------------------------------------------
    */

    'inventory' => [
        // Stock may never go below zero. Left as a setting because the brief
        // allows for an explicitly configured backorder mode; nothing in the
        // codebase enables it, and the DB CHECK constraint would refuse it.
        'allow_negative_stock' => false,

        'default_min_stock' => 8,
        'default_unit' => 'pcs',
    ],

    /*
    |--------------------------------------------------------------------------
    | Bulk photo import
    |--------------------------------------------------------------------------
    |
    | A .zip of photos, one file per part, matched by filename against
    | part_number then sku. Caps here exist to bound a single request's
    | work — this is unzipped and validated synchronously, not queued.
    */

    'photo_import' => [
        'max_zip_kb' => 25600, // 25MB archive
        'max_entries' => 500,
        'max_entry_kb' => 8192, // 8MB per photo, before validating it is really an image
    ],

    /*
    |--------------------------------------------------------------------------
    | Presentation defaults
    |--------------------------------------------------------------------------
    */

    'currency' => env('WMS_CURRENCY', 'Rs'),
    'per_page' => 10,
    'max_per_page' => 100,

    'company' => [
        'name' => env('WMS_COMPANY_NAME', 'Hanwella Spareparts Warehouse'),
        'address' => env('WMS_COMPANY_ADDRESS'),
        'contact' => env('WMS_COMPANY_CONTACT'),
        'registration_no' => env('WMS_COMPANY_REG_NO'),
    ],

];
