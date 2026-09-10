<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\AuditLogResource;
use App\Models\AuditLog;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** Read-only trail. No update or destroy route exists — a log that can be corrected is not a log. */
class AuditLogController extends Controller
{
    /**
     * Verb suffixes belonging to each coarse group the frontend filters by.
     * Mirrors {@see AuditLogResource::GROUPS} — kept as a matching pair
     * rather than a shared constant, since one reads a stored value and the
     * other builds a WHERE clause from it.
     */
    private const VERBS_BY_GROUP = [
        'created' => ['create', 'generate'],
        'updated' => ['update', 'payment', 'activate'],
        'deleted' => ['delete', 'deactivate', 'cancel'],
        'stock' => ['in', 'out', 'adjust', 'transfer'],
        'auth' => ['login', 'logout'],
    ];

    public function index(Request $request): JsonResponse
    {
        $perPage = min((int) $request->integer('per_page', config('wms.per_page')), config('wms.max_per_page'));
        $group = $request->string('action')->toString();

        $logs = AuditLog::query()
            ->with('user.role')
            ->when($request->filled('search'), fn ($q) => $q->where(function ($q) use ($request) {
                $like = '%'.$request->string('search').'%';
                $q->where('description', 'like', $like)
                    ->orWhere('entity_type', 'like', $like)
                    ->orWhereHas('user', fn ($u) => $u->where('name', 'like', $like));
            }))
            ->when(isset(self::VERBS_BY_GROUP[$group]), fn ($q) => $q->where(function ($q) use ($group) {
                foreach (self::VERBS_BY_GROUP[$group] as $verb) {
                    $q->orWhere('action', 'like', "%.{$verb}");
                }
            }))
            ->when($request->filled('from'), fn ($q) => $q->where('created_at', '>=', $request->string('from').' 00:00:00'))
            ->when($request->filled('to'), fn ($q) => $q->where('created_at', '<=', $request->string('to').' 23:59:59'))
            ->orderByDesc('created_at')
            ->paginate($perPage);

        return ApiResponse::paginated(AuditLogResource::collection($logs), 'Audit log retrieved successfully.');
    }
}
