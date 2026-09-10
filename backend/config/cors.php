<?php

return [

    'paths' => ['api/*', 'sanctum/csrf-cookie'],

    'allowed_methods' => ['*'],

    // The SPA's origin(s), kept in lockstep with SANCTUM_STATEFUL_DOMAINS.
    // This must be an explicit list, never '*': the frontend authenticates
    // with a credentialed (cookie) request, and browsers refuse to accept
    // "Access-Control-Allow-Origin: *" on any request sent with credentials.
    'allowed_origins' => array_values(array_unique(array_filter([
        env('FRONTEND_URL', 'http://localhost:5173'),
        'http://127.0.0.1:5173',
    ]))),

    'allowed_origins_patterns' => [],

    'allowed_headers' => ['*'],

    'exposed_headers' => [],

    'max_age' => 0,

    // Required: auth is an httpOnly Sanctum session cookie (see
    // frontend/src/services/apiClient.js), not a bearer token.
    'supports_credentials' => true,

];
