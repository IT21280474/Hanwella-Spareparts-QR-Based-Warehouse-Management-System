<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Users\UserRequest;
use App\Http\Resources\UserResource;
use App\Models\Role;
use App\Models\User;
use App\Services\AuditLogger;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class UserController extends Controller
{
    public function __construct(private readonly AuditLogger $audit) {}

    public function index(Request $request): JsonResponse
    {
        $perPage = min((int) $request->integer('per_page', config('wms.per_page')), config('wms.max_per_page'));
        $state = $request->string('state')->toString();

        $users = User::query()
            ->with('role')
            ->when($request->filled('search'), fn ($q) => $q->where(function ($q) use ($request) {
                $like = '%'.$request->string('search').'%';
                $q->where('name', 'like', $like)->orWhere('email', 'like', $like);
            }))
            ->when($state === 'active', fn ($q) => $q->where('is_active', true))
            ->when($state === 'inactive', fn ($q) => $q->where('is_active', false))
            ->when($request->filled('role'), fn ($q) => $q->whereHas('role', fn ($r) => $r->where('slug', $request->string('role'))))
            ->orderBy($this->sortColumn($request), $request->string('direction', 'asc')->toString() === 'desc' ? 'desc' : 'asc')
            ->paginate($perPage);

        return ApiResponse::paginated(UserResource::collection($users), 'Users retrieved successfully.');
    }

    public function store(UserRequest $request): JsonResponse
    {
        $data = $request->validated();
        $roleId = Role::where('slug', $data['role'])->value('id');

        $user = User::create([
            'name' => $data['name'],
            'email' => $data['email'],
            'password' => $data['password'],
            'role_id' => $roleId,
            'is_active' => true,
            'email_verified_at' => now(),
        ]);

        $this->audit->log('user.create', $user, [], ['name' => $user->name, 'email' => $user->email, 'role' => $data['role']],
            "Account created for {$user->name}");

        return ApiResponse::created(new UserResource($user->load('role')), 'Account created successfully.');
    }

    public function show(User $user): JsonResponse
    {
        return ApiResponse::success(new UserResource($user->load('role.permissions')), 'User retrieved successfully.');
    }

    public function update(UserRequest $request, User $user): JsonResponse
    {
        $before = ['name' => $user->name, 'email' => $user->email, 'role_id' => $user->role_id];
        $data = $request->validated();

        $user->name = $data['name'];
        $user->email = $data['email'];
        $user->role_id = Role::where('slug', $data['role'])->value('id');

        if (! empty($data['password'])) {
            $user->password = $data['password'];
        }

        $user->save();

        $this->audit->log('user.update', $user, $before, ['name' => $user->name, 'email' => $user->email, 'role_id' => $user->role_id],
            "Account updated for {$user->name}");

        return ApiResponse::success(new UserResource($user->load('role')), 'Account updated successfully.');
    }

    /** Deactivation, never deletion — every movement, adjustment and order this person made must keep pointing at a real account. */
    public function setStatus(Request $request, User $user): JsonResponse
    {
        $request->validate(['is_active' => ['required', 'boolean']]);

        if ($user->id === $request->user()->id && ! $request->boolean('is_active')) {
            return ApiResponse::error('You cannot deactivate your own account.', 422);
        }

        $before = $user->is_active;
        $user->is_active = $request->boolean('is_active');
        $user->save();

        $this->audit->log(
            $user->is_active ? 'user.activate' : 'user.deactivate',
            $user,
            ['is_active' => $before],
            ['is_active' => $user->is_active],
            ($user->is_active ? 'Reactivated' : 'Deactivated')." account for {$user->name}",
        );

        return ApiResponse::success(new UserResource($user->load('role')), $user->is_active ? 'Account reactivated.' : 'Account deactivated.');
    }

    private function sortColumn(Request $request): string
    {
        $sort = $request->string('sort', 'name')->toString();

        return in_array($sort, ['name', 'email', 'last_login_at', 'created_at'], true) ? $sort : 'name';
    }
}
