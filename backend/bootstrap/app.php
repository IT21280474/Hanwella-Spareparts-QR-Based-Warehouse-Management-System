<?php

use App\Exceptions\DispatchConflictException;
use App\Exceptions\InsufficientStockException;
use App\Http\Middleware\EnsurePermission;
use App\Support\ApiResponse;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Middleware\HandleCors;
use Illuminate\Http\Request;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Session\Middleware\StartSession;
use Illuminate\Validation\ValidationException;
use Laravel\Sanctum\Http\Middleware\EnsureFrontendRequestsAreStateful;
use Psr\Log\LogLevel;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;
use Symfony\Component\Routing\Exception\RouteNotFoundException;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        // SPA cookie auth: Sanctum promotes same-site API calls to stateful
        // session requests, which is what gives us httpOnly cookies + CSRF.
        $middleware->api(prepend: [
            EnsureFrontendRequestsAreStateful::class,
        ]);

        $middleware->api(append: [
            HandleCors::class,
        ]);

        $middleware->alias([
            'permission' => EnsurePermission::class,
        ]);

        // Session cookies must never ride along on a cross-site request.
        $middleware->trustHosts(at: static fn (): array => []);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        // A warehouse worker asking to remove more stock than is on hand is an
        // expected, routine rejection (409), not a technical failure — logging
        // it at ERROR with a full stack trace would drown real errors in noise.
        $exceptions->level(InsufficientStockException::class, LogLevel::WARNING);
        $exceptions->level(DispatchConflictException::class, LogLevel::WARNING);

        // Every API failure leaves through the same envelope. Nothing here
        // ever leaks a stack trace: the framework's debug renderer is bypassed
        // for JSON requests entirely.
        $exceptions->render(function (Throwable $e, Request $request) {
            if (! $request->expectsJson() && ! $request->is('api/*')) {
                return null;
            }

            return match (true) {
                $e instanceof ValidationException => ApiResponse::error(
                    'Validation failed.',
                    422,
                    $e->errors(),
                ),

                $e instanceof AuthenticationException,
                $e instanceof RouteNotFoundException => ApiResponse::error(
                    'Unauthenticated.',
                    401,
                ),

                $e instanceof AuthorizationException => ApiResponse::error(
                    $e->getMessage() ?: 'You do not have permission to perform this action.',
                    403,
                ),

                $e instanceof ModelNotFoundException,
                $e instanceof NotFoundHttpException => ApiResponse::error(
                    'The requested resource was not found.',
                    404,
                ),

                $e instanceof InsufficientStockException,
                $e instanceof DispatchConflictException => ApiResponse::error(
                    $e->getMessage(),
                    409,
                ),

                // Checked before the plain-RuntimeException catch below:
                // Symfony/Laravel HTTP exceptions (404, 429, ...) all extend
                // RuntimeException, and must keep their real status code
                // rather than collapse into a flat 422.
                $e instanceof HttpExceptionInterface => ApiResponse::error(
                    $e->getMessage() ?: 'Request could not be completed.',
                    $e->getStatusCode(),
                ),

                // Every *other* RuntimeException thrown across the app
                // signals a recoverable, user-facing problem with the
                // request itself (an unreadable upload, an already-applied
                // import, an exhausted retry) — never a genuine crash.
                $e instanceof RuntimeException => ApiResponse::error(
                    $e->getMessage(),
                    422,
                ),

                // Anything unmodelled: log it in full, tell the client nothing.
                default => ApiResponse::error(
                    config('app.debug')
                        ? $e->getMessage()
                        : 'An unexpected error occurred.',
                    500,
                ),
            };
        });
    })->create();
