<?php

namespace Database\Seeders;

use App\Models\Part;
use App\Models\Role;
use App\Models\SalesOrder;
use App\Models\User;
use App\Services\OrderService;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Auth;

/**
 * Counter sales at every stage of their life, so each role's screens open on
 * real work: the Security gate has paid orders waiting and a dispatch
 * history, Sales has orders still owed on, and the dashboard has a trend.
 *
 * Every order goes through {@see OrderService} exactly as a cashier's would —
 * prices from the catalogue, stock deducted on payment, dispatch recorded by a
 * Security account — with the clock set back to when the sale happened, so the
 * stock ledger and audit trail carry matching timestamps.
 *
 * Skips itself when orders already exist, so re-running `db:seed` never piles
 * duplicate sales onto a working database.
 */
class SalesOrderSeeder extends Seeder
{
    /**
     * [customer, phone, [[part index, qty], ...], payment status, share paid,
     *  days ago, hour, outcome] — share paid is the fraction of the total a
     *  PARTIALLY_PAID customer has handed over; outcome is null, 'dispatch'
     *  or 'cancel'.
     *
     * @var list<array{0:string,1:?string,2:list<array{0:int,1:int}>,3:string,4:float,5:int,6:int,7:?string}>
     */
    private const ORDERS = [
        // Released at the gate — the dispatch history.
        ['Nimal Auto Traders', '0771234567', [[0, 4], [1, 2]], SalesOrder::PAID, 0, 3, 10, 'dispatch'],
        ['Kandy Motor Spares', '0812234455', [[2, 6]], SalesOrder::PAID, 0, 2, 14, 'dispatch'],
        ['Walk-in customer', null, [[3, 1]], SalesOrder::PAID, 0, 0, 9, 'dispatch'],

        // Fully paid, waiting at the gate — Security's queue.
        ['Sunil Hardware & Auto', '0764445566', [[4, 3], [5, 2], [6, 1]], SalesOrder::PAID, 0, 1, 16, null],
        ['Priyantha Motors', '0719876543', [[7, 10]], SalesOrder::PAID, 0, 1, 11, null],
        ['Colombo Fleet Services', '0112345678', [[8, 2], [9, 4]], SalesOrder::PAID, 0, 0, 8, null],
        ['Gamini Three-Wheel Repairs', '0752223344', [[10, 5]], SalesOrder::PAID, 0, 0, 10, null],

        // Not cleared to leave — these must never reach the gate.
        ['Ruwan Tyre House', '0703332211', [[11, 4]], SalesOrder::PARTIALLY_PAID, 0.4, 1, 13, null],
        ['Hanwella Bus Depot', '0362255667', [[1, 3], [12, 2]], SalesOrder::PARTIALLY_PAID, 0.25, 0, 11, null],
        ['Walk-in customer', null, [[13, 1]], SalesOrder::PENDING, 0, 0, 12, null],
        ['Lanka Spare Hub', '0774561237', [[14, 2]], SalesOrder::PENDING, 0, 2, 15, 'cancel'],
    ];

    public function run(): void
    {
        if (SalesOrder::exists()) {
            $this->command?->info('Sales orders already present — skipping demo orders.');

            return;
        }

        $cashier = User::whereHas('role', fn ($q) => $q->where('slug', Role::SALES_PERSON))->first()
            ?? User::whereHas('role', fn ($q) => $q->where('slug', Role::ADMIN))->firstOrFail();
        $gate = User::whereHas('role', fn ($q) => $q->where('slug', Role::SECURITY))->orderBy('id')->get();

        if ($gate->isEmpty()) {
            $this->command?->warn('No Security account exists — dispatched demo orders will be left waiting at the gate.');
        }

        $parts = $this->sellableParts(15);
        $orders = app(OrderService::class);

        // Read the real date once: inside the loop the clock is moved back to
        // each sale, and today() would then answer with that sale's date.
        $today = Carbon::today();

        foreach (self::ORDERS as $i => [$customer, $phone, $lines, $status, $share, $daysAgo, $hour, $outcome]) {
            $at = $today->copy()->subDays($daysAgo)->setTime($hour, 5 * ($i % 12));
            Carbon::setTestNow($at);
            Auth::setUser($cashier);

            $catalogueTotal = array_sum(array_map(fn ($line) => (float) $parts[$line[0]]->selling_price * $line[1], $lines));

            $order = $orders->create(
                array_map(fn ($line) => ['part_id' => $parts[$line[0]]->id, 'quantity' => $line[1]], $lines),
                $customer,
                $phone,
                0,
                $status,
                'CASH',
                round($catalogueTotal * $share, -2),
            );

            if ($outcome === 'cancel') {
                Carbon::setTestNow($at->copy()->addHours(2));
                $orders->cancel($order, 'Customer bought elsewhere');
            }

            if ($outcome === 'dispatch' && $gate->isNotEmpty()) {
                Carbon::setTestNow($at->copy()->addMinutes(40));
                Auth::setUser($gate[$i % $gate->count()]);
                $orders->dispatch($order->fresh());
            }
        }

        Carbon::setTestNow();

        $this->command?->info(sprintf(
            'Seeded %d demo orders: %d waiting at the gate, %d dispatched.',
            count(self::ORDERS),
            SalesOrder::where('payment_status', SalesOrder::PAID)->whereNull('dispatched_at')->count(),
            SalesOrder::whereNotNull('dispatched_at')->count(),
        ));
    }

    /**
     * Parts whose fullest bin can cover any line above, taken in a fixed
     * order so every machine seeds the same sales.
     *
     * @return list<Part>
     */
    private function sellableParts(int $count): array
    {
        $parts = Part::query()
            ->where('status', Part::ACTIVE)
            ->whereHas('inventory', fn ($q) => $q->where('quantity', '>=', 15))
            ->orderBy('id')
            ->limit($count)
            ->get()
            ->all();

        if (count($parts) < $count) {
            throw new \RuntimeException("SalesOrderSeeder needs {$count} stocked parts; run PartSeeder first.");
        }

        return $parts;
    }
}
