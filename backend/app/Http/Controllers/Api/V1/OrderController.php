<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Orders\CreateOrderRequest;
use App\Http\Requests\Orders\UpdateOrderPaymentRequest;
use App\Http\Resources\SalesOrderResource;
use App\Models\SalesOrder;
use App\Services\OrderService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class OrderController extends Controller
{
    public function __construct(private readonly OrderService $orders) {}

    public function index(Request $request): JsonResponse
    {
        $perPage = min((int) $request->integer('per_page', config('wms.per_page')), config('wms.max_per_page'));

        $filtered = fn () => SalesOrder::query()
            ->search($request->string('search')->toString())
            ->when($request->filled('from'), fn ($q) => $q->where('ordered_at', '>=', $request->string('from').' 00:00:00'))
            ->when($request->filled('to'), fn ($q) => $q->where('ordered_at', '<=', $request->string('to').' 23:59:59'));

        $rows = $filtered()
            ->when($request->filled('payment_status'), fn ($q) => $q->where('payment_status', $request->string('payment_status')))
            ->withCount('items')
            ->with('cashier:id,name')
            ->orderByDesc('ordered_at')
            ->paginate($perPage);

        $summary = $filtered()->selectRaw('payment_status, COUNT(*) as total, SUM(total) as booked, SUM(total - paid_amount) as outstanding')
            ->groupBy('payment_status')
            ->get();

        $counts = ['all' => 0, 'PAID' => 0, 'PENDING' => 0, 'PARTIALLY_PAID' => 0, 'CANCELLED' => 0];
        $bookedValue = 0.0;
        $outstanding = 0.0;

        foreach ($summary as $row) {
            $counts[$row->payment_status] = (int) $row->total;
            $counts['all'] += (int) $row->total;
            $bookedValue += (float) $row->booked;
            if ($row->payment_status !== SalesOrder::CANCELLED) {
                $outstanding += (float) $row->outstanding;
            }
        }

        return ApiResponse::paginated(SalesOrderResource::collection($rows), 'Orders retrieved successfully.', [
            'status_counts' => $counts,
            'booked_value' => round($bookedValue, 2),
            'outstanding' => round($outstanding, 2),
        ]);
    }

    public function store(CreateOrderRequest $request): JsonResponse
    {
        $data = $request->validated();

        $order = $this->orders->create(
            $data['items'],
            $data['customer_name'] ?? '',
            $data['customer_phone'] ?? null,
            (float) ($data['discount'] ?? 0),
            $data['payment_status'],
            $data['payment_mode'],
            (float) ($data['paid_amount'] ?? 0),
        );

        return ApiResponse::created(new SalesOrderResource($order), "Order {$order->order_no} completed successfully.");
    }

    public function show(SalesOrder $order): JsonResponse
    {
        $order->load(['cashier:id,name', 'dispatchedBy:id,name', 'items.part' => fn ($q) => $q->withStock()]);

        return ApiResponse::success(new SalesOrderResource($order), 'Order retrieved successfully.');
    }

    public function updatePayment(UpdateOrderPaymentRequest $request, SalesOrder $order): JsonResponse
    {
        $data = $request->validated();
        $order = $this->orders->updatePayment($order, $data['payment_status'], isset($data['paid_amount']) ? (float) $data['paid_amount'] : null);

        return ApiResponse::success(new SalesOrderResource($order), 'Payment updated successfully.');
    }

    public function cancel(Request $request, SalesOrder $order): JsonResponse
    {
        $request->validate(['reason' => ['nullable', 'string', 'max:255']]);

        $order = $this->orders->cancel($order, $request->string('reason')->toString() ?: null);

        return ApiResponse::success(new SalesOrderResource($order), "Order {$order->order_no} cancelled. Units have been returned to stock.");
    }

    public function dispatch(SalesOrder $order): JsonResponse
    {
        $order = $this->orders->dispatch($order);

        return ApiResponse::success(new SalesOrderResource($order), "Order {$order->order_no} dispatched.");
    }
}
