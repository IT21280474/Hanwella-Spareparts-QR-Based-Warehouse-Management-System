<?php

namespace Database\Seeders;

use App\Models\Location;
use App\Models\Warehouse;
use Illuminate\Database\Seeder;

/**
 * The physical storage tree: Warehouse → Zone → Rack → Shelf → Bin.
 *
 * Locations are an adjacency list, so the depth is data rather than schema.
 * `full_path` is written here as a denormalised display cache — it is derived
 * from the parent chain and never used as the source of truth for hierarchy.
 */
class WarehouseSeeder extends Seeder
{
    /**
     * Zone code => [zone name, racks, shelves per rack, bins per shelf].
     *
     * @var array<string, array{0:string,1:int,2:int,3:int}>
     */
    private const ZONES = [
        'A' => ['Fast Moving', 3, 3, 4],
        'B' => ['Bulk Storage', 2, 3, 4],
        'C' => ['Electrical & Sensitive', 2, 2, 4],
    ];

    public function run(): void
    {
        $warehouse = Warehouse::updateOrCreate(
            ['code' => 'HW-MAIN'],
            [
                'name' => 'Hanwella Main Store',
                'address' => 'No. 212, Avissawella Road, Hanwella',
                'is_active' => true,
            ],
        );

        foreach (self::ZONES as $zoneCode => [$zoneName, $rackCount, $shelfCount, $binCount]) {
            $zone = $this->location($warehouse, null, 'ZONE', $zoneName, $zoneCode, $zoneCode);

            for ($rack = 1; $rack <= $rackCount; $rack++) {
                $rackCode = sprintf('%s-R%d', $zoneCode, $rack);
                $rackNode = $this->location($warehouse, $zone, 'RACK', "Rack {$rack}", $rackCode, "R{$rack}");

                for ($shelf = 1; $shelf <= $shelfCount; $shelf++) {
                    $shelfCode = sprintf('%s-S%d', $rackCode, $shelf);
                    $shelfNode = $this->location($warehouse, $rackNode, 'SHELF', "Shelf {$shelf}", $shelfCode, "S{$shelf}");

                    for ($bin = 1; $bin <= $binCount; $bin++) {
                        $binCode = sprintf('%s-B%02d', $shelfCode, $bin);
                        $this->location($warehouse, $shelfNode, 'BIN', "Bin {$bin}", $binCode, sprintf('B%02d', $bin));
                    }
                }
            }
        }
    }

    private function location(
        Warehouse $warehouse,
        ?Location $parent,
        string $type,
        string $name,
        string $code,
        string $pathSegment,
    ): Location {
        return Location::updateOrCreate(
            ['warehouse_id' => $warehouse->id, 'code' => $code],
            [
                'parent_id' => $parent?->id,
                'type' => $type,
                'name' => $name,
                'full_path' => $parent === null
                    ? $pathSegment
                    : $parent->full_path.' · '.$pathSegment,
                'is_active' => true,
            ],
        );
    }
}
