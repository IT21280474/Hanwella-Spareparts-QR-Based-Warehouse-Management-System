<?php

namespace App\Services;

use App\Models\Part;
use App\Models\SalesOrder;
use App\Models\StockMovement;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

/**
 * The four reports. Each returns the same shape — `kpis`, `columns`, `rows`,
 * `footnote` — so {@see \App\Http\Controllers\Api\V1\ReportController} stays
 * a thin dispatcher and the CSV export can walk any of them generically from
 * `columns` + `rows` without knowing what report produced them.
 */
class ReportService
{
    public function build(string $type, ?string $from, ?string $to): array
    {
        return match ($type) {
            'sales' => $this->sales($from, $to),
            'inventory' => $this->inventory(),
            'payments' => $this->payments($from, $to),
            'low-stock' => $this->lowStock(),
            default => throw new InvalidArgumentException("Unknown report [{$type}]."),
        };
    }

    private function money(float $amount): string
    {
        return config('wms.currency').' '.number_format($amount, 0);
    }

    private function sales(?string $from, ?string $to): array
    {
        $orders = SalesOrder::query()
            ->where('payment_status', '!=', SalesOrder::CANCELLED)
            ->when($from, fn ($q) => $q->where('ordered_at', '>=', $from.' 00:00:00'))
            ->when($to, fn ($q) => $q->where('ordered_at', '<=', $to.' 23:59:59'))
            ->selectRaw('DATE(ordered_at) as date, COUNT(*) as orders, SUM(discount) as discount, SUM(total) as total')
            ->groupBy('date')
            ->orderByDesc('date')
            ->get();

        $unitsByDate = SalesOrder::query()
            ->join('sales_order_items', 'sales_order_items.sales_order_id', '=', 'sales_orders.id')
            ->where('sales_orders.payment_status', '!=', SalesOrder::CANCELLED)
            ->when($from, fn ($q) => $q->where('ordered_at', '>=', $from.' 00:00:00'))
            ->when($to, fn ($q) => $q->where('ordered_at', '<=', $to.' 23:59:59'))
            ->selectRaw('DATE(ordered_at) as date, SUM(sales_order_items.quantity) as units')
            ->groupBy('date')
            ->pluck('units', 'date');

        $rows = $orders->map(fn ($row) => [
            'date' => $row->date,
            'orders' => (int) $row->orders,
            'units' => (int) ($unitsByDate[$row->date] ?? 0),
            'discount' => round((float) $row->discount, 2),
            'total' => round((float) $row->total, 2),
        ])->all();

        $totalOrders = array_sum(array_column($rows, 'orders'));
        $totalSales = array_sum(array_column($rows, 'total'));
        $totalUnits = array_sum(array_column($rows, 'units'));

        return [
            'kpis' => [
                ['label' => 'Orders', 'value' => number_format($totalOrders), 'sub' => 'in this period'],
                ['label' => 'Booked sales', 'value' => $this->money($totalSales), 'sub' => 'after discount'],
                ['label' => 'Units sold', 'value' => number_format($totalUnits), 'sub' => 'across all orders'],
                ['label' => 'Average order', 'value' => $this->money($totalOrders > 0 ? $totalSales / $totalOrders : 0), 'sub' => 'per order'],
            ],
            'rows' => $rows,
            'footnote' => 'Cancelled orders are excluded. Booked value is after discount and before any outstanding balance.',
        ];
    }

    private function inventory(): array
    {
        $rows = Part::query()
            ->join('categories', 'categories.id', '=', 'parts.category_id')
            ->leftJoin('inventory', 'inventory.part_id', '=', 'parts.id')
            ->whereNull('parts.deleted_at')
            ->groupBy('categories.id', 'categories.name')
            ->selectRaw('categories.name as category, COUNT(DISTINCT parts.id) as parts,
                COALESCE(SUM(inventory.quantity), 0) as units,
                COALESCE(SUM(inventory.quantity * parts.selling_price), 0) as stock_value,
                COALESCE(SUM(inventory.quantity * parts.cost_price), 0) as cost_value')
            ->orderByDesc('stock_value')
            ->get()
            ->map(fn ($row) => [
                'category' => $row->category,
                'parts' => (int) $row->parts,
                'units' => (int) $row->units,
                'stock_value' => round((float) $row->stock_value, 2),
                'cost_value' => round((float) $row->cost_value, 2),
            ])
            ->all();

        return [
            'kpis' => [
                ['label' => 'Parts', 'value' => number_format(array_sum(array_column($rows, 'parts'))), 'sub' => 'in the catalogue'],
                ['label' => 'Units on hand', 'value' => number_format(array_sum(array_column($rows, 'units'))), 'sub' => 'across every bin'],
                ['label' => 'Retail value', 'value' => $this->money(array_sum(array_column($rows, 'stock_value'))), 'sub' => 'at selling price'],
                ['label' => 'Cost value', 'value' => $this->money(array_sum(array_column($rows, 'cost_value'))), 'sub' => 'at landed cost'],
            ],
            'rows' => $rows,
            'footnote' => 'Valued at the prices held against each part today, not at the price when the stock was received.',
        ];
    }

    private function payments(?string $from, ?string $to): array
    {
        $rows = SalesOrder::query()
            ->when($from, fn ($q) => $q->where('ordered_at', '>=', $from.' 00:00:00'))
            ->when($to, fn ($q) => $q->where('ordered_at', '<=', $to.' 23:59:59'))
            ->selectRaw('payment_status, COUNT(*) as orders, SUM(total) as total, SUM(paid_amount) as paid')
            ->groupBy('payment_status')
            ->get()
            ->map(fn ($row) => [
                'payment_status' => $row->payment_status,
                'orders' => (int) $row->orders,
                'total' => round((float) $row->total, 2),
                'paid' => round((float) $row->paid, 2),
                'outstanding' => $row->payment_status === SalesOrder::CANCELLED ? 0.0 : round((float) $row->total - (float) $row->paid, 2),
            ])
            ->all();

        $billed = array_sum(array_column($rows, 'total'));
        $received = array_sum(array_column($rows, 'paid'));
        $outstanding = array_sum(array_column($rows, 'outstanding'));

        return [
            'kpis' => [
                ['label' => 'Billed', 'value' => $this->money($billed), 'sub' => 'across every order'],
                ['label' => 'Received', 'value' => $this->money($received), 'sub' => 'collected so far'],
                ['label' => 'Outstanding', 'value' => $this->money($outstanding), 'sub' => 'still to collect', 'tone' => $outstanding > 0 ? 'warning' : 'ink'],
                ['label' => 'Orders unsettled', 'value' => number_format((int) collect($rows)->where('payment_status', '!=', SalesOrder::PAID)->sum('orders')), 'sub' => 'pending or partial'],
            ],
            'rows' => $rows,
            'footnote' => 'Outstanding is billed less received. A cancelled order carries no outstanding balance.',
        ];
    }

    private function lowStock(): array
    {
        $parts = Part::query()
            ->withStock()
            ->havingRaw('COALESCE(total_stock, 0) <= parts.min_stock')
            ->orderByRaw('COALESCE(total_stock, 0) ASC')
            ->get();

        $sold = StockMovement::query()
            ->where('type', StockMovement::SALE)
            ->where('created_at', '>=', now()->subDays(90))
            ->whereIn('part_id', $parts->pluck('id'))
            ->selectRaw('part_id, SUM(-quantity) as sold')
            ->groupBy('part_id')
            ->pluck('sold', 'part_id');

        $rows = $parts->map(fn ($part) => [
            'name' => $part->name,
            'part_number' => $part->part_number,
            'quantity' => (int) $part->total_stock,
            'min_stock' => $part->min_stock,
            'sold_90d' => (int) ($sold[$part->id] ?? 0),
        ])->all();

        $restockValue = $parts->sum(fn ($part) => max(0, $part->min_stock - (int) $part->total_stock) * (float) $part->cost_price);

        return [
            'kpis' => [
                ['label' => 'Below minimum', 'value' => number_format($parts->count()), 'sub' => 'parts need attention'],
                ['label' => 'Completely out', 'value' => number_format($parts->where('total_stock', 0)->count()), 'sub' => 'zero units on hand', 'tone' => 'danger'],
                ['label' => 'Units short', 'value' => number_format((int) $parts->sum(fn ($p) => max(0, $p->min_stock - (int) $p->total_stock))), 'sub' => 'below each minimum'],
                ['label' => 'Restock cost', 'value' => $this->money($restockValue), 'sub' => 'to reach minimum'],
            ],
            'rows' => $rows,
            'footnote' => 'Ordered by how far below minimum each part sits, so the most urgent restock is first.',
        ];
    }

    /** @return list<string> */
    public function columnsFor(string $type): array
    {
        return match ($type) {
            'sales' => ['date', 'orders', 'units', 'discount', 'total'],
            'inventory' => ['category', 'parts', 'units', 'stock_value', 'cost_value'],
            'payments' => ['payment_status', 'orders', 'total', 'paid', 'outstanding'],
            'low-stock' => ['name', 'part_number', 'quantity', 'min_stock', 'sold_90d'],
            default => throw new InvalidArgumentException("Unknown report [{$type}]."),
        };
    }
}
