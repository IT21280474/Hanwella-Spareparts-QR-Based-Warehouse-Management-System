<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\NotificationResource;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

/**
 * A user's own notification inbox — never another user's. Every query here
 * starts from `Auth::user()->notifications()`, not the bare model, so there
 * is no route param to leak someone else's alert by guessing an id.
 */
class NotificationController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = Auth::user();
        $perPage = min((int) $request->integer('per_page', 20), 50);

        $notifications = $user->notifications()->paginate($perPage);

        return ApiResponse::paginated(
            NotificationResource::collection($notifications),
            'Notifications retrieved successfully.',
            ['unread_count' => $user->unreadNotifications()->count()],
        );
    }

    public function read(Request $request, string $notification): JsonResponse
    {
        $record = Auth::user()->notifications()->whereKey($notification)->firstOrFail();
        $record->markAsRead();

        return ApiResponse::success(new NotificationResource($record->fresh()), 'Notification marked as read.');
    }

    public function readAll(): JsonResponse
    {
        Auth::user()->unreadNotifications->markAsRead();

        return ApiResponse::success(null, 'All notifications marked as read.');
    }
}
