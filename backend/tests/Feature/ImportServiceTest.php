<?php

use App\Models\Inventory;
use App\Services\ImportService;
use App\Services\StockService;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->seed(RolePermissionSeeder::class);
});

/** Builds a CSV upload matching ImportService::COLUMNS' order exactly. */
function makeImportCsv(array $rows): UploadedFile
{
    $path = tempnam(sys_get_temp_dir(), 'import').'.csv';
    $handle = fopen($path, 'w');
    fputcsv($handle, ['part_number', 'name', 'category', 'supplier', 'unit', 'selling_price', 'cost_price', 'min_stock', 'quantity']);
    foreach ($rows as $row) {
        fputcsv($handle, $row);
    }
    fclose($handle);

    return new UploadedFile($path, 'import.csv', 'text/csv', null, true);
}

it('tops up an existing part in its real bin, not a phantom warehouse-only row', function () {
    // Same regression as OrderService: stockIn must find the part's actual
    // (warehouse, location), not default to a location=null row that never
    // matches where a normally-stocked part's inventory actually lives.
    $warehouse = makeWarehouse();
    $bin = makeLocation($warehouse);
    $category = makeCategory();
    $part = makePart(['part_number' => 'IMP-001', 'category_id' => $category->id]);
    app(StockService::class)->stockIn($part, 5, $warehouse->id, $bin->id);

    $csv = makeImportCsv([
        ['IMP-001', $part->name, $category->name, '', 'pcs', '1000', '', '', '20'],
    ]);

    $imports = app(ImportService::class);
    $batch = $imports->upload($csv);
    $imports->confirm($batch->fresh());

    $this->assertDatabaseHas('inventory', [
        'part_id' => $part->id, 'warehouse_id' => $warehouse->id, 'location_id' => $bin->id, 'quantity' => 25,
    ]);
    expect(Inventory::where('part_id', $part->id)->count())->toBe(1);
});
