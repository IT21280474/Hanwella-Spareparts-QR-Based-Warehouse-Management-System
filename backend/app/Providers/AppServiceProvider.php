<?php

namespace App\Providers;

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // Applied to the whole `api` middleware group (see bootstrap/app.php) —
        // a floor against a runaway client or a compromised session, not a
        // limit any legitimate counter-sale/scan workflow should ever brush
        // against. Keyed by user where authenticated so one busy staff member
        // never throttles anyone else on the same NAT/IP.
        RateLimiter::for('api', function (Request $request) {
            return Limit::perMinute(180)->by($request->user()?->id ?: $request->ip());
        });
    }
}
