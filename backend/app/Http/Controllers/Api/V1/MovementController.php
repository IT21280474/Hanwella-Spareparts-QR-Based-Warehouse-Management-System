<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\StockMovementResource;
use App\Models\StockMovement;
use App\Support\ApiResponse;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * The global, append-only stock ledger — every receipt, issue, sale, transfer
 * and correction, across every part, in one searchable feed.
 */
class MovementController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $perPage = min((int) $request->integer('per_page', config('wms.per_page')), config('wms.max_per_page'));
        $search = $request->string('search')->toString();

        $filtered = fn () => StockMovement::query()
            ->when($request->filled('part'), fn (Builder $q) => $q->where('part_id', $request->integer('part')))
            ->between($request->string('from')->toString() ?: null, $request->string('to')->toString() ?: null)
            ->when($search !== '', fn (Builder $q) => $q->whereHas('part', function (Builder $p) use ($search) {
                $like = '%'.$search.'%';
                $p->where('name', 'like', $like)
                    ->orWhere('part_number', 'like', $like)
                    ->orWhereHas('qrCode', fn (Builder $qr) => $qr->where('code', 'like', $like));
            })->orWhere('reference_no', 'like', '%'.$search.'%'));

        $rows = $filtered()
            ->ofType($request->filled('type') ? $request->string('type')->toString() : null)
            ->with(['part:id,name,part_number', 'part.qrCode:id,part_id,code', 'warehouse:id,name', 'location', 'user:id,name'])
            ->orderByDesc('created_at')
            ->paginate($perPage);

        // Type-tab counts and the units-in/out summary, computed over the same
        // filters minus the type tab itself — one lean aggregate query rather
        // than one round trip per tab.
        $summary = $filtered()
            ->selectRaw('type, SUM(CASE WHEN quantity > 0 THEN quantity ELSE 0 END) as inbound, SUM(CASE WHEN quantity < 0 THEN -quantity ELSE 0 END) as outbound, COUNT(*) as total')
            ->groupBy('type')
            ->get();

        $typeCounts = ['all' => 0, 'SALE' => 0, 'STOCK_IN' => 0, 'STOCK_OUT' => 0, 'ADJUSTMENT' => 0, 'RETURN' => 0, 'TRANSFER' => 0];
        $unitsIn = 0;
        $unitsOut = 0;

        foreach ($summary as $row) {
            $typeCounts[$row->type] = (int) $row->total;
            $typeCounts['all'] += (int) $row->total;
            $unitsIn += (int) $row->inbound;
            $unitsOut += (int) $row->outbound;
        }

        return ApiResponse::paginated(StockMovementResource::collection($rows), 'Stock movements retrieved successfully.', [
            'units_in' => $unitsIn,
            'units_out' => $unitsOut,
            'type_counts' => $typeCounts,
        ]);
    }
}
