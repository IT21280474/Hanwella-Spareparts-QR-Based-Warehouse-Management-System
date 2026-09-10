<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\PartResource;
use App\Http\Resources\SalesOrderResource;
use App\Models\Part;
use App\Models\SalesOrder;
use App\Models\StockMovement;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * The warehouse overview.
 *
 * Everything the dashboard shows comes from this one call, so the KPI tiles,
 * the trend and the watchlist can never disagree with each other by having
 * been fetched a few seconds apart against a catalogue that changed
 * in between.
 */
class DashboardController extends Controller
{
    private const TREND_DAYS = 14;
    private const WATCHLIST_LIMIT = 8;
    private const RECENT_ORDERS_LIMIT = 6;
    private const TOP_PARTS_LIMIT = 5;

    public function index(): JsonResponse
    {
        $today = Carbon::today();
        $monthStart = $today->copy()->startOfMonth();

        return ApiResponse::success([
            'kpis' => $this->kpis($today, $monthStart),
            'sales_trend' => $this->salesTrend($today),
            'payment_split' => $this->paymentSplit(),
            'top_parts' => $this->topParts(),
            'watchlist' => $this->watchlist(),
            'recent_orders' => $this->recentOrders(),
            'alerts' => $this->alerts(),
        ], 'Dashboard summary retrieved successfully.');
    }

    private function kpis(Carbon $today, Carbon $monthStart): array
    {
        $partsTotal = Part::count();
        $unitsOnHand = (int) DB::table('inventory')->sum('quantity');
        $stockValue = (float) DB::table('inventory')
            ->join('parts', 'parts.id', '=', 'inventory.part_id')
            ->sum(DB::raw('inventory.quantity * parts.selling_price'));

        $statusCounts = $this->stockStatusCounts();

        $ordersToday = SalesOrder::whereDate('ordered_at', $today)->where('payment_status', '!=', SalesOrder::CANCELLED)->count();
        $salesToday = (float) SalesOrder::whereDate('ordered_at', $today)->where('payment_status', '!=', SalesOrder::CANCELLED)->sum('total');

        $pending = SalesOrder::whereIn('payment_status', [SalesOrder::PENDING, SalesOrder::PARTIALLY_PAID])
            ->selectRaw('COUNT(*) as orders, SUM(total - paid_amount) as outstanding')
            ->first();

        return [
            'parts' => $partsTotal,
            'units_on_hand' => $unitsOnHand,
            'stock_value' => round($stockValue, 2),
            'low_stock' => $statusCounts['low'],
            'out_of_stock' => $statusCounts['out'],
            'orders_today' => $ordersToday,
            'sales_today' => round($salesToday, 2),
            'pending_payments' => round((float) ($pending->outstanding ?? 0), 2),
            'pending_orders' => (int) ($pending->orders ?? 0),
            'parts_added_this_month' => Part::where('created_at', '>=', $monthStart)->count(),
        ];
    }

    /** Bucketed the same way the inventory list's status tabs are, so the two never disagree. */
    private function stockStatusCounts(): array
    {
        $rows = Part::withStock()->get(['parts.id', 'parts.min_stock']);
        $counts = ['in' => 0, 'low' => 0, 'out' => 0];

        foreach ($rows as $part) {
            $counts[$part->stock_status === Part::IN_STOCK ? 'in' : ($part->stock_status === Part::LOW_STOCK ? 'low' : 'out')]++;
        }

        return $counts;
    }

    private function salesTrend(Carbon $today): array
    {
        $from = $today->copy()->subDays(self::TREND_DAYS - 1);

        $rows = SalesOrder::query()
            ->where('payment_status', '!=', SalesOrder::CANCELLED)
            ->whereDate('ordered_at', '>=', $from)
            ->selectRaw('DATE(ordered_at) as day, SUM(total) as total, COUNT(*) as orders')
            ->groupBy('day')
            ->get()
            ->keyBy('day');

        $trend = [];
        for ($i = 0; $i < self::TREND_DAYS; $i++) {
            $date = $from->copy()->addDays($i)->toDateString();
            $row = $rows->get($date);

            $trend[] = [
                'date' => $date,
                'total' => round((float) ($row->total ?? 0), 2),
                'orders' => (int) ($row->orders ?? 0),
            ];
        }

        return $trend;
    }

    private function paymentSplit(): array
    {
        return SalesOrder::query()
            ->selectRaw('payment_status as status, SUM(total) as amount, COUNT(*) as orders')
            ->groupBy('payment_status')
            ->get()
            ->map(fn ($row) => [
                'status' => $row->status,
                'amount' => round((float) $row->amount, 2),
                'orders' => (int) $row->orders,
            ])
            ->all();
    }

    private function topParts(): array
    {
        return StockMovement::query()
            ->where('stock_movements.type', StockMovement::SALE)
            ->where('stock_movements.created_at', '>=', now()->subDays(30))
            ->join('parts', 'parts.id', '=', 'stock_movements.part_id')
            ->selectRaw('stock_movements.part_id, parts.name, SUM(-stock_movements.quantity) as units')
            ->groupBy('stock_movements.part_id', 'parts.name')
            ->orderByDesc('units')
            ->limit(self::TOP_PARTS_LIMIT)
            ->get()
            ->map(fn ($row) => [
                'part_id' => $row->part_id,
                'name' => $row->name,
                'units' => (int) $row->units,
            ])
            ->all();
    }

    private function watchlist(): array
    {
        $parts = Part::query()
            ->with(['category:id,name', 'qrCode:id,part_id,code'])
            ->withStock()
            ->stockStatus(null)
            ->havingRaw('COALESCE(total_stock, 0) <= parts.min_stock')
            ->orderByRaw('COALESCE(total_stock, 0) ASC')
            ->limit(self::WATCHLIST_LIMIT)
            ->get();

        return PartResource::collection($parts)->resolve();
    }

    private function recentOrders(): array
    {
        $orders = SalesOrder::query()
            ->with('cashier:id,name')
            ->withCount('items')
            ->orderByDesc('ordered_at')
            ->limit(self::RECENT_ORDERS_LIMIT)
            ->get();

        return SalesOrderResource::collection($orders)->resolve();
    }

    private function alerts(): array
    {
        $alerts = [];
        $counts = $this->stockStatusCounts();

        if ($counts['out'] > 0) {
            $alerts[] = [
                'level' => 'danger',
                'text' => "{$counts['out']} spare part(s) are completely out of stock.",
                'meta' => 'Blocking counter sales',
                'link' => '/inventory?status=out',
            ];
        }

        if ($counts['low'] > 0) {
            $alerts[] = [
                'level' => 'warning',
                'text' => "{$counts['low']} spare part(s) are at or below their minimum level.",
                'meta' => 'Needs restocking',
                'link' => '/inventory?status=low',
            ];
        }

        $pendingCount = SalesOrder::whereIn('payment_status', [SalesOrder::PENDING, SalesOrder::PARTIALLY_PAID])->count();
        if ($pendingCount > 0) {
            $alerts[] = [
                'level' => 'info',
                'text' => "{$pendingCount} order(s) have an outstanding balance.",
                'meta' => 'Follow up on payment',
                'link' => '/orders?payment_status=PENDING',
            ];
        }

        $unassigned = Part::doesntHave('qrCode')->count();
        if ($unassigned > 0) {
            $alerts[] = [
                'level' => 'info',
                'text' => "{$unassigned} spare part(s) have no QR identity yet.",
                'meta' => 'Generate labels',
                'link' => '/qr-labels',
            ];
        }

        return $alerts;
    }
}
