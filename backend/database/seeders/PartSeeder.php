<?php

namespace Database\Seeders;

use App\Models\Category;
use App\Models\Inventory;
use App\Models\Location;
use App\Models\Part;
use App\Models\QrCode;
use App\Models\StockMovement;
use App\Models\Supplier;
use App\Models\User;
use App\Models\VehicleModel;
use App\Models\Warehouse;
use Illuminate\Database\Seeder;

/**
 * The spare-parts catalogue: 240 parts, each with one QR identity and stock
 * placed in a real bin.
 *
 * Seeded from a fixed RNG seed so every developer machine, CI run and demo
 * shows the same numbers — a dashboard that changes shape on every reseed is
 * impossible to test against.
 */
class PartSeeder extends Seeder
{
    private const SEED = 20260907;

    private const TARGET_PARTS = 240;

    /**
     * Component names per category code, with a realistic landed-cost band in
     * LKR.
     *
     * @var array<string, array{names: list<string>, price: array{0:int,1:int}}>
     */
    private const COMPONENTS = [
        'BRK' => [
            'names' => ['Front Brake Pad Set', 'Rear Brake Shoe Set', 'Brake Disc Rotor', 'Brake Drum',
                'Brake Master Cylinder', 'Wheel Cylinder', 'Brake Calliper Kit', 'Brake Hose',
                'Handbrake Cable', 'Brake Fluid Reservoir Cap'],
            'price' => [2400, 26000],
        ],
        'FLT' => [
            'names' => ['Oil Filter', 'Air Filter Element', 'Fuel Filter', 'Cabin Air Filter',
                'Transmission Filter Kit', 'Diesel Water Separator'],
            'price' => [850, 7800],
        ],
        'ENG' => [
            'names' => ['Cylinder Head Gasket', 'Valve Stem Seal Set', 'Piston Ring Set', 'Main Bearing Set',
                'Crankshaft Oil Seal', 'Engine Mounting', 'Oil Pump', 'Rocker Cover Gasket',
                'Timing Chain Kit', 'Sump Gasket'],
            'price' => [3200, 68000],
        ],
        'SUS' => [
            'names' => ['Front Shock Absorber', 'Rear Shock Absorber', 'Lower Ball Joint', 'Tie Rod End',
                'Stabiliser Link', 'Control Arm Bush', 'Coil Spring', 'Strut Mount Bearing',
                'Steering Rack Boot', 'Wheel Bearing Kit'],
            'price' => [1800, 42000],
        ],
        'ELE' => [
            'names' => ['Alternator Assembly', 'Starter Motor', 'Ignition Coil', 'Spark Plug Set',
                'Oxygen Sensor', 'Crankshaft Sensor', 'Battery Terminal Set', 'Window Regulator Motor',
                'Horn Assembly', 'Relay Switch'],
            'price' => [950, 88000],
        ],
        'TRN' => [
            'names' => ['Clutch Disc', 'Clutch Pressure Plate', 'Clutch Release Bearing', 'CV Joint Kit',
                'Drive Shaft Boot Kit', 'Gear Selector Cable', 'Differential Oil Seal'],
            'price' => [4200, 56000],
        ],
        'COL' => [
            'names' => ['Radiator Assembly', 'Water Pump', 'Thermostat', 'Radiator Cap',
                'Cooling Fan Motor', 'Expansion Tank', 'Radiator Upper Hose'],
            'price' => [1600, 48000],
        ],
        'BLT' => [
            'names' => ['Timing Belt', 'Alternator Drive Belt', 'Belt Tensioner Pulley', 'Idler Pulley',
                'Serpentine Belt', 'Vacuum Hose Kit'],
            'price' => [1400, 18500],
        ],
        'LGT' => [
            'names' => ['Head Lamp Assembly', 'Tail Lamp Assembly', 'Indicator Lamp', 'Fog Lamp Unit',
                'Head Lamp Bulb', 'Number Plate Lamp'],
            'price' => [700, 34000],
        ],
        'BDY' => [
            'names' => ['Side Mirror Assembly', 'Door Handle Outer', 'Wiper Blade Set', 'Bonnet Gas Strut',
                'Door Lock Actuator', 'Mud Flap Set', 'Fender Liner'],
            'price' => [900, 22000],
        ],
    ];

    public function run(): void
    {
        mt_srand(self::SEED);

        $categories = Category::pluck('id', 'code');
        $suppliers = Supplier::pluck('id')->all();
        $warehouse = Warehouse::where('code', 'HW-MAIN')->firstOrFail();
        $bins = Location::where('warehouse_id', $warehouse->id)->where('type', 'BIN')->pluck('id')->all();
        $admin = User::where('email', 'sadeeka@hanwellaspares.lk')->value('id');

        $models = VehicleModel::with('make')->get();

        /** @var array<string, list<VehicleModel>> */
        $modelsByMake = $models->groupBy(fn (VehicleModel $model) => $model->make->code)
            ->map(fn ($group) => $group->all())
            ->all();

        $makeCodes = array_keys($modelsByMake);
        $categoryCodes = array_keys(self::COMPONENTS);

        $sequence = 0;
        $usedPartNumbers = [];

        // Round-robin across categories on a fixed seed, so every category has
        // real depth instead of a few holding almost everything.
        for ($i = 0; $i < self::TARGET_PARTS; $i++) {
            $categoryCode = $categoryCodes[$i % count($categoryCodes)];
            $spec = self::COMPONENTS[$categoryCode];

            $makeCode = $makeCodes[mt_rand(0, count($makeCodes) - 1)];
            $componentName = $spec['names'][mt_rand(0, count($spec['names']) - 1)];

            /** @var VehicleModel $model */
            $model = $modelsByMake[$makeCode][mt_rand(0, count($modelsByMake[$makeCode]) - 1)];

            // Part numbers carry a unique index; retry the numeric tail rather
            // than letting the insert fail.
            do {
                $partNumber = sprintf('%s-%s-%d', $categoryCode, $makeCode, mt_rand(1000, 9999));
            } while (isset($usedPartNumbers[$partNumber]));

            $usedPartNumbers[$partNumber] = true;

            $cost = mt_rand($spec['price'][0], $spec['price'][1]);
            // Counter margin runs 22-48% over landed cost, rounded to Rs 10.
            $selling = (int) round($cost * (1 + mt_rand(22, 48) / 100), -1);
            $minStock = mt_rand(4, 15);

            $part = Part::updateOrCreate(
                ['part_number' => $partNumber],
                [
                    'sku' => sprintf('SKU-%s-%04d', $categoryCode, $i + 1),
                    'name' => sprintf('%s - %s %s', $componentName, $model->make->name, $model->name),
                    'description' => sprintf(
                        '%s suitable for %s %s. Stocked at the Hanwella main store counter.',
                        $componentName,
                        $model->make->name,
                        $model->name,
                    ),
                    'category_id' => $categories[$categoryCode],
                    'supplier_id' => $suppliers[mt_rand(0, count($suppliers) - 1)],
                    'vehicle_model_id' => $model->id,
                    'unit' => 'pcs',
                    'selling_price' => $selling,
                    'cost_price' => $cost,
                    'min_stock' => $minStock,
                    'status' => Part::ACTIVE,
                    'created_by' => $admin,
                ],
            );

            QrCode::updateOrCreate(
                ['part_id' => $part->id],
                [
                    'code' => sprintf('SJL-%05d', ++$sequence),
                    'sequence' => $sequence,
                    'status' => QrCode::ACTIVE,
                    'generated_by' => $admin,
                    'generated_at' => now()->subDays(mt_rand(30, 300)),
                ],
            );

            $opening = $this->openingQuantity($minStock);

            $row = Inventory::firstOrNew([
                'part_id' => $part->id,
                'warehouse_id' => $warehouse->id,
                'location_id' => $bins[$i % count($bins)],
            ]);

            $isNew = ! $row->exists;
            $row->fill(['quantity' => $opening, 'reserved_quantity' => 0])->save();

            // The opening balance is a real ledger entry, not a quantity that
            // appeared from nowhere: every unit on hand traces to a movement.
            if ($isNew && $opening > 0) {
                StockMovement::create([
                    'part_id' => $part->id,
                    'inventory_id' => $row->id,
                    'warehouse_id' => $row->warehouse_id,
                    'location_id' => $row->location_id,
                    'type' => StockMovement::STOCK_IN,
                    'quantity' => $opening,
                    'quantity_before' => 0,
                    'quantity_after' => $opening,
                    'reference_no' => 'OPENING',
                    'reason' => 'Opening balance at go-live',
                    'user_id' => $admin,
                    'created_at' => now()->subDays(mt_rand(20, 40)),
                ]);
            }
        }
    }

    /**
     * Opening stock, shaped so the dashboard has something real to report:
     * about one part in twenty is out, and one in seven sits at or below its
     * reorder minimum.
     */
    private function openingQuantity(int $minStock): int
    {
        $roll = mt_rand(1, 100);

        return match (true) {
            $roll <= 5 => 0,
            $roll <= 19 => mt_rand(1, $minStock),
            $roll <= 75 => mt_rand($minStock + 1, $minStock * 6),
            default => mt_rand($minStock * 6, $minStock * 14),
        };
    }
}
