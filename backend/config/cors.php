<?php

return [

    'paths' => ['api/*', 'sanctum/csrf-cookie'],

    'allowed_methods' => ['*'],

    // The SPA's origin(s), kept in lockstep with SANCTUM_STATEFUL_DOMAINS.
    // This must be an explicit list, never '*': the frontend authenticates
    // with a credentialed (cookie) request, and browsers refuse to accept
    // "Access-Control-Allow-Origin: *" on any request sent with credentials.
    //
    // The 127.0.0.1:5173 dev convenience only ever gets added outside
    // production — a security scan of the live API has no reason to see a
    // raw loopback:port origin in its CORS policy, and there's no cost to
    // keeping production's list to exactly what it needs.
    //
    // `env()` directly, not `app()->environment()`: config files load via
    // LoadConfiguration, early enough in the boot sequence that the `app()`
    // helper's container isn't reliably the real Application instance yet —
    // calling it here breaks *every* request and artisan command with a
    // "Target class [env] does not exist" error, since the fallback
    // Container it returns has no bindings at all. `env()` reads straight
    // from the already-loaded .env, which is safe this early.
    'allowed_origins' => array_values(array_unique(array_filter([
        env('FRONTEND_URL', 'http://localhost:5173'),
        env('APP_ENV') === 'production' ? null : 'http://127.0.0.1:5173',
    ]))),

    'allowed_origins_patterns' => [],

    'allowed_headers' => ['*'],

    'exposed_headers' => [],

    'max_age' => 0,

    // Required: auth is an httpOnly Sanctum session cookie (see
    // frontend/src/services/apiClient.js), not a bearer token.
    'supports_credentials' => true,

];
