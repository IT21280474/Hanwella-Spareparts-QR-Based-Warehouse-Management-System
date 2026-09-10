<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\RoleResource;
use App\Models\Role;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;

/** Read-only: the role catalogue is fixed by {@see \Database\Seeders\RolePermissionSeeder}. */
class RoleController extends Controller
{
    public function index(): JsonResponse
    {
        $roles = Role::with('permissions')->orderBy('id')->get();

        return ApiResponse::success(RoleResource::collection($roles), 'Roles retrieved successfully.');
    }
}
