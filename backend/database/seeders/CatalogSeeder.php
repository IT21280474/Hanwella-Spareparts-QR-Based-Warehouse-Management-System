<?php

namespace Database\Seeders;

use App\Models\Category;
use App\Models\Supplier;
use App\Models\VehicleMake;
use App\Models\VehicleModel;
use Illuminate\Database\Seeder;

/**
 * Reference data for the spare-parts catalogue.
 *
 * Category and make codes are the two halves of a part number
 * (`BRK-TOY-4821`), so they are fixed three-letter values rather than
 * generated ones — renaming a category must never change part numbers that
 * are already printed on shelf labels.
 */
class CatalogSeeder extends Seeder
{
    /** @var list<array{0:string,1:string,2:string}> name, code, description */
    private const CATEGORIES = [
        ['Brake System', 'BRK', 'Pads, shoes, discs, drums, callipers and brake hydraulics'],
        ['Filters', 'FLT', 'Oil, air, fuel and cabin filtration'],
        ['Engine Parts', 'ENG', 'Internal engine components, gaskets and seals'],
        ['Suspension & Steering', 'SUS', 'Shocks, bushes, ball joints, tie rods and links'],
        ['Electrical', 'ELE', 'Batteries, alternators, starters, sensors and switches'],
        ['Transmission & Clutch', 'TRN', 'Clutch kits, gearbox components and drive parts'],
        ['Cooling System', 'COL', 'Radiators, water pumps, thermostats and hoses'],
        ['Belts & Hoses', 'BLT', 'Timing belts, drive belts, tensioners and hoses'],
        ['Lighting', 'LGT', 'Head lamps, tail lamps, indicators and bulbs'],
        ['Body & Interior', 'BDY', 'Mirrors, handles, wipers, trims and body fittings'],
    ];

    /** @var array<string, array{0:string,1:list<string>}> make name => [code, models] */
    private const MAKES = [
        'Toyota' => ['TOY', ['Corolla', 'Hilux', 'Land Cruiser Prado', 'Vitz', 'Axio', 'Premio', 'Hiace']],
        'Nissan' => ['NIS', ['Sunny', 'March', 'X-Trail', 'Navara', 'Caravan', 'Leaf']],
        'Honda' => ['HON', ['Civic', 'Fit', 'Vezel', 'CR-V', 'Grace']],
        'Mitsubishi' => ['MIT', ['Lancer', 'Montero', 'L200', 'Outlander']],
        'Suzuki' => ['SUZ', ['Alto', 'Wagon R', 'Swift', 'Every', 'Baleno']],
        'Isuzu' => ['ISZ', ['D-Max', 'Elf', 'Fargo']],
        'Hyundai' => ['HYU', ['Accent', 'Tucson', 'Santa Fe', 'Elantra']],
        'Mazda' => ['MAZ', ['Familia', 'Demio', 'BT-50', 'Axela']],
    ];

    /** @var list<array<string, string>> */
    private const SUPPLIERS = [
        [
            'name' => 'Lanka Auto Imports (Pvt) Ltd',
            'contact_person' => 'Dilan Fernando',
            'phone' => '+94 11 234 5671',
            'email' => 'orders@lankaautoimports.lk',
            'address' => '148 Panchikawatte Road, Colombo 10',
            'notes' => 'Primary Japanese OEM importer. Lead time 7–10 days.',
        ],
        [
            'name' => 'Panchikawatte Motor Spares',
            'contact_person' => 'Nuwan Jayasinghe',
            'phone' => '+94 11 234 5672',
            'email' => 'sales@pmspares.lk',
            'address' => '22/4 Sri Sangaraja Mawatha, Colombo 10',
            'notes' => 'Counter pickup available same day for stocked lines.',
        ],
        [
            'name' => 'Kelani Parts Distributors',
            'contact_person' => 'Shanika Peiris',
            'phone' => '+94 11 291 8840',
            'email' => 'shanika@kelaniparts.lk',
            'address' => '76 Biyagama Road, Kelaniya',
            'notes' => 'Filters and belts specialist. Weekly delivery run to Hanwella.',
        ],
        [
            'name' => 'Ceylon Brake & Clutch Co.',
            'contact_person' => 'Mahesh Gunawardena',
            'phone' => '+94 33 227 4415',
            'email' => 'info@ceylonbrake.lk',
            'address' => '19 Colombo Road, Gampaha',
            'notes' => 'Friction material and clutch assemblies.',
        ],
        [
            'name' => 'Nippon Spares Lanka',
            'contact_person' => 'Ayesha Rajapaksa',
            'phone' => '+94 11 250 6633',
            'email' => 'procurement@nipponspares.lk',
            'address' => '303 Negombo Road, Wattala',
            'notes' => 'Genuine Nissan and Mazda lines.',
        ],
        [
            'name' => 'Highway Auto Electricals',
            'contact_person' => 'Roshan Silva',
            'phone' => '+94 36 223 1180',
            'email' => 'roshan@highwayauto.lk',
            'address' => '5 Avissawella Road, Hanwella',
            'notes' => 'Batteries, alternators and starters. Local, next-day.',
        ],
    ];

    public function run(): void
    {
        foreach (self::CATEGORIES as [$name, $code, $description]) {
            Category::updateOrCreate(
                ['code' => $code],
                ['name' => $name, 'description' => $description, 'is_active' => true],
            );
        }

        foreach (self::MAKES as $makeName => [$code, $models]) {
            $make = VehicleMake::updateOrCreate(
                ['code' => $code],
                ['name' => $makeName, 'is_active' => true],
            );

            foreach ($models as $modelName) {
                VehicleModel::updateOrCreate(
                    ['vehicle_make_id' => $make->id, 'name' => $modelName],
                    [],
                );
            }
        }

        foreach (self::SUPPLIERS as $supplier) {
            Supplier::updateOrCreate(
                ['name' => $supplier['name']],
                $supplier + ['is_active' => true],
            );
        }
    }
}
