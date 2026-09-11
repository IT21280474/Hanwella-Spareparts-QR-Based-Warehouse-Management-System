<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Response headers a security scan (OWASP ZAP) checks for on every response.
 *
 * This app is a pure JSON API — it never renders HTML for a browser to embed,
 * script, or style — so the policy here is deliberately maximally strict
 * rather than tuned for a document response, unlike the frontend SPA's own
 * headers (see `frontend/public/.htaccess`), which do need to allow its
 * actual scripts/styles/fonts/images.
 */
class SecurityHeaders
{
    public function handle(Request $request, Closure $next): Response
    {
        return self::apply($next($request), $request);
    }

    /**
     * Shared with `bootstrap/app.php`'s exception render closure — an
     * exception thrown inside the pipeline (a 403, a 422, an unhandled 500)
     * propagates straight past this middleware's own `$next($request)` call
     * without ever reaching the code below, since Laravel's exception
     * handling wraps the *entire* pipeline, not each middleware individually.
     * Both places call this so every response carries these headers, not
     * only the successful ones.
     */
    public static function apply(Response $response, Request $request): Response
    {
        $response->headers->set('X-Content-Type-Options', 'nosniff');
        $response->headers->set('X-Frame-Options', 'DENY');
        $response->headers->set('Referrer-Policy', 'strict-origin-when-cross-origin');

        // A JSON API response is never meant to be cached by a shared/
        // intermediary cache — every endpoint here is either authenticated
        // business data or an auth flow, and ZAP's "Retrieved from Cache" /
        // "Re-examine Cache-control Directives" findings are exactly this:
        // nothing should tell an intermediary it's safe to reuse a response
        // for a different visitor.
        $response->headers->set('Cache-Control', 'no-store, private, must-revalidate');

        // HSTS only makes sense to claim over an actual HTTPS connection —
        // sending it over plain HTTP (i.e. local dev) is a lie the browser
        // would otherwise start enforcing regardless.
        if ($request->isSecure()) {
            $response->headers->set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
        }

        // A pure API has no legitimate reason to load or execute anything —
        // this is deliberately far stricter than the SPA's own CSP.
        $response->headers->set('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");

        // Laravel/PHP does not add this itself unless php.ini's `expose_php`
        // is on — remove it defensively either way rather than depending on
        // hosting-level php.ini access. Must happen before the response is
        // sent (Kernel::terminate() runs after — too late).
        header_remove('X-Powered-By');

        return $response;
    }
}
