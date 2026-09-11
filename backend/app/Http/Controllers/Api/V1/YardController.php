<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Security\SecurityListRequest;
use App\Http\Requests\Security\YardOrderSearchRequest;
use App\Http\Resources\DispatchResource;
use App\Http\Resources\YardOrderResource;
use App\Models\Dispatch;
use App\Models\SalesOrder;
use App\Models\SalesOrderItem;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Carbon;

/**
 * The yard gate's read side: what is waiting to leave, and finding one order.
 *
 * Yard stock is never a stored list — every call derives it from
 * {@see SalesOrder::scopeReadyForDispatch()}, so an order appears the moment
 * its final payment is recorded and disappears the moment it is dispatched.
 */
class YardController extends Controller
{
    private const RECENT_DISPATCHES_LIMIT = 5;

    public function dashboard(): JsonResponse
    {
        $today = Carbon::today();

        $unitsInYard = (int) SalesOrderItem::query()
            ->whereIn('sales_order_id', SalesOrder::readyForDispatch()->select('id'))
            ->sum('quantity');

        $recent = Dispatch::query()
            ->orderByDesc('dispatched_at')
            ->orderByDesc('id')
            ->limit(self::RECENT_DISPATCHES_LIMIT)
            ->get();

        return ApiResponse::success([
            'kpis' => [
                'ready_for_dispatch' => SalesOrder::readyForDispatch()->count(),
                'dispatched_today' => Dispatch::where('dispatched_at', '>=', $today)->count(),
                'units_in_yard' => $unitsInYard,
                // Paid before today and still waiting — what a gate shift
                // inherited from the one before it.
                'pending_from_earlier' => SalesOrder::readyForDispatch()->where('paid_at', '<', $today)->count(),
                'ready_value' => round((float) SalesOrder::readyForDispatch()->sum('total'), 2),
                'oldest_paid_at' => optional(SalesOrder::readyForDispatch()->min('paid_at'), fn ($value) => Carbon::parse($value)->toIso8601String()),
            ],
            'recent_dispatches' => DispatchResource::collection($recent),
        ], 'Security dashboard retrieved successfully.');
    }

    public function index(SecurityListRequest $request): JsonResponse
    {
        $data = $request->validated();
        $term = trim((string) ($data['search'] ?? ''));

        $rows = SalesOrder::readyForDispatch()
            ->when($term !== '', fn ($q) => $q->where(function ($q) use ($term) {
                $like = '%'.$term.'%';
                $q->where('order_no', 'like', $like)
                    ->orWhere('customer_name', 'like', $like)
                    ->orWhere('customer_phone', 'like', $like);
            }))
            ->when($data['from'] ?? null, fn ($q, $from) => $q->where('paid_at', '>=', $from.' 00:00:00'))
            ->when($data['to'] ?? null, fn ($q, $to) => $q->where('paid_at', '<=', $to.' 23:59:59'))
            ->withCount('items')
            ->withSum('items', 'quantity')
            // Oldest paid first: the customer who has waited longest is served first.
            ->orderBy('paid_at')
            ->orderBy('id')
            ->paginate($request->perPage());

        return ApiResponse::paginated(YardOrderResource::collection($rows), 'Yard stock retrieved successfully.');
    }

    /**
     * Exact lookup by order number — the gate's primary action.
     *
     * An unpaid or cancelled order answers with the reason only, never its
     * contents. A dispatched order is shown, flagged ineligible, so the gate
     * can see when it left and who released it.
     */
    public function search(YardOrderSearchRequest $request): JsonResponse
    {
        $orderNo = $request->validated('order_no');
        $order = SalesOrder::where('order_no', $orderNo)->first();

        if ($order === null) {
            return ApiResponse::error("No order found with number {$orderNo}. Check the number on the customer's bill and try again.", 404);
        }

        $reason = $order->dispatchBlocker();

        if ($reason !== null && ! $order->isDispatched()) {
            return ApiResponse::error($reason, 409);
        }

        return ApiResponse::success(
            new YardOrderResource($this->loadForGate($order)),
            $reason ?? 'Order verified — ready for dispatch.',
            ['eligible' => $reason === null, 'reason' => $reason],
        );
    }

    /** Only orders in the yard, or already released from it, are visible here. */
    public function show(SalesOrder $order): JsonResponse
    {
        if ($order->yardStatus() === SalesOrder::YARD_NOT_ELIGIBLE) {
            return ApiResponse::error('The requested resource was not found.', 404);
        }

        return ApiResponse::success(new YardOrderResource($this->loadForGate($order)), 'Order retrieved successfully.');
    }

    private function loadForGate(SalesOrder $order): SalesOrder
    {
        return $order->load([
            'items' => fn ($q) => $q->orderBy('id'),
            'items.part:id,unit',
            'dispatchRecord',
        ]);
    }
}
