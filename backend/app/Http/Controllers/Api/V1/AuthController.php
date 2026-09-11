<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\ForgotPasswordRequest;
use App\Http\Requests\Auth\LoginRequest;
use App\Http\Requests\Auth\ResetPasswordRequest;
use App\Http\Resources\UserResource;
use App\Models\User;
use App\Services\AuditLogger;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Password;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function __construct(
        private readonly AuditLogger $audit,
    ) {}

    /**
     * Establish a session. Sanctum's stateful middleware turns this into an
     * httpOnly cookie, so no token is ever handed to JavaScript.
     */
    public function login(LoginRequest $request): JsonResponse
    {
        $credentials = $request->validated();
        $remember = (bool) ($credentials['remember'] ?? false);

        if (! Auth::attempt(
            ['email' => $credentials['email'], 'password' => $credentials['password']],
            $remember,
        )) {
            // Deliberately identical for unknown email and wrong password —
            // the pair must not be distinguishable to an attacker.
            throw ValidationException::withMessages([
                'email' => 'These credentials do not match our records.',
            ]);
        }

        $user = Auth::user();

        if (! $user->is_active) {
            Auth::logout();

            throw ValidationException::withMessages([
                'email' => 'This account has been deactivated. Contact your administrator.',
            ]);
        }

        // The Security portal is one session system with a narrower door: the
        // same credentials and cookie, but only yard-gate accounts get in.
        if (($credentials['portal'] ?? null) === LoginRequest::PORTAL_SECURITY && ! $user->hasPermission('view_yard_stock')) {
            Auth::logout();

            throw ValidationException::withMessages([
                'email' => 'This account does not have Security access. Use the main warehouse sign-in instead.',
            ]);
        }

        $request->session()->regenerate();

        $user->forceFill(['last_login_at' => now()])->save();

        $this->audit->log('auth.login', $user, [], [], "{$user->name} signed in");

        return ApiResponse::success(
            new UserResource($user->load('role.permissions')),
            'Signed in successfully.',
        );
    }

    public function logout(Request $request): JsonResponse
    {
        $user = $request->user();

        if ($user !== null) {
            $this->audit->log('auth.logout', $user, [], [], "{$user->name} signed out");
        }

        Auth::guard('web')->logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return ApiResponse::success(null, 'Signed out successfully.');
    }

    public function me(Request $request): JsonResponse
    {
        return ApiResponse::success(
            new UserResource($request->user()->load('role.permissions')),
            'Current user retrieved successfully.',
        );
    }

    /**
     * Always answers the same way whether or not the address is known — an
     * attacker must not be able to use this endpoint to enumerate accounts.
     * `MAIL_MAILER=log` in development writes the reset link to the log
     * instead of sending real mail.
     */
    public function forgotPassword(ForgotPasswordRequest $request): JsonResponse
    {
        $status = Password::sendResetLink($request->only('email'));

        if ($status === Password::RESET_LINK_SENT) {
            $this->audit->log('auth.password_reset_requested', User::where('email', $request->input('email'))->first(),
                [], [], 'Password reset link requested');
        }

        return ApiResponse::success(null, 'If that email address is registered, a reset link has been sent.');
    }

    public function resetPassword(ResetPasswordRequest $request): JsonResponse
    {
        $status = Password::reset(
            $request->only('email', 'password', 'password_confirmation', 'token'),
            function (User $user, string $password) {
                $user->forceFill(['password' => $password])->save();
                $this->audit->log('auth.password_reset', $user, [], [], "{$user->name} reset their password");
            },
        );

        if ($status !== Password::PASSWORD_RESET) {
            throw ValidationException::withMessages([
                'email' => 'That reset link is invalid or has expired. Request a new one.',
            ]);
        }

        return ApiResponse::success(null, 'Your password has been reset. Sign in with your new password.');
    }
}
