<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Security\DispatchOrderRequest;
use App\Http\Requests\Security\SecurityListRequest;
use App\Http\Resources\DispatchResource;
use App\Http\Resources\YardOrderResource;
use App\Models\Dispatch;
use App\Models\SalesOrder;
use App\Services\DispatchService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;

/**
 * Releasing orders from the yard, and the history of every release.
 *
 * History is read-only by design: there is no update or delete route for a
 * dispatch record, for Security or anyone else.
 */
class DispatchController extends Controller
{
    public function __construct(private readonly DispatchService $dispatches) {}

    public function index(SecurityListRequest $request): JsonResponse
    {
        $data = $request->validated();

        $rows = Dispatch::query()
            ->search($data['search'] ?? null)
            ->when($data['from'] ?? null, fn ($q, $from) => $q->where('dispatched_at', '>=', $from.' 00:00:00'))
            ->when($data['to'] ?? null, fn ($q, $to) => $q->where('dispatched_at', '<=', $to.' 23:59:59'))
            ->orderByDesc('dispatched_at')
            ->orderByDesc('id')
            ->paginate($request->perPage());

        return ApiResponse::paginated(DispatchResource::collection($rows), 'Dispatch history retrieved successfully.');
    }

    public function store(DispatchOrderRequest $request, SalesOrder $order): JsonResponse
    {
        $dispatch = $this->dispatches->dispatch($order, $request->validated('notes'));

        $order->refresh()->load([
            'items' => fn ($q) => $q->orderBy('id'),
            'items.part:id,unit',
            'dispatchRecord',
        ]);

        return ApiResponse::created([
            'dispatch' => new DispatchResource($dispatch),
            'order' => new YardOrderResource($order),
        ], "Order {$order->order_no} dispatched ({$dispatch->dispatch_no}).");
    }
}
