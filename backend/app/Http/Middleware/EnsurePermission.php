<?php

namespace App\Http\Middleware;

use App\Support\ApiResponse;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Route-level permission gate: `->middleware('permission:create_stock_in')`.
 *
 * This is the enforcement point. The frontend also hides controls the user
 * cannot use, but that is presentation only — every protected route is checked
 * here, server-side, on every request.
 */
class EnsurePermission
{
    public function handle(Request $request, Closure $next, string ...$permissions): Response
    {
        $user = $request->user();

        if ($user === null) {
            return ApiResponse::error('Unauthenticated.', 401);
        }

        if (! $user->is_active) {
            return ApiResponse::error('This account has been deactivated.', 403);
        }

        // Any one of the listed permissions is enough.
        foreach ($permissions as $permission) {
            if ($user->hasPermission($permission)) {
                return $next($request);
            }
        }

        return ApiResponse::error('You do not have permission to perform this action.', 403);
    }
}
