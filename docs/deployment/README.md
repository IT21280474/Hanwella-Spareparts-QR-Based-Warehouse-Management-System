# Deployment Guide

The backend (Laravel API) and frontend (React SPA) are independent applications and are
deployed separately — the frontend ships as static files, the backend runs as a normal PHP
application. The business proposal this project is built from specifies generic "Cloud
Hosting," not a named provider, so this guide covers the platform-agnostic steps: any host
that can run PHP 8.2+/MySQL 8 and serve static files works.

## 1. The one thing that must be right: cross-origin cookie auth

This app authenticates with a Sanctum **SPA session cookie** — not a bearer token
(`frontend/src/services/apiClient.js` sends `withCredentials: true` and relies on an
httpOnly cookie; nothing is stored in `localStorage`). That makes three settings the actual
crux of a working deployment, more than any other step here:

1. **Frontend and API must share a registrable domain.** E.g. `app.hanwellaspares.lk`
   (frontend) and `api.hanwellaspares.lk` (backend) share `hanwellaspares.lk` and work; two
   unrelated domains do not — the cookie will simply never arrive.
2. **`backend/.env`**:
   - `SESSION_DOMAIN=.hanwellaspares.lk` (leading dot — shared across subdomains)
   - `SANCTUM_STATEFUL_DOMAINS=app.hanwellaspares.lk` (the frontend's host, no scheme)
   - `SESSION_SAME_SITE=lax` (or `none` if frontend and API are on genuinely different
     eTLD+1 domains — which additionally requires `SESSION_SECURE_COOKIE=true` and HTTPS
     everywhere, since `SameSite=None` cookies are rejected by browsers over plain HTTP)
3. **`frontend/.env`**: `VITE_API_URL` pointing at the real API origin, baked in at build
   time (`npm run build` — Vite inlines `VITE_*` vars into the built JS, so this must be set
   *before* building, not adjusted afterward).

**HTTPS is required**, not optional, in any real deployment: the CSRF cookie
(`XSRF-TOKEN`) and the session cookie both need `Secure` in a cross-site or subdomain
context, and browsers increasingly refuse third-party cookies over plain HTTP regardless.

**CORS**: `backend/config/cors.php` exists and sets `supports_credentials => true` with an
explicit `allowed_origins` list (never `'*'` — browsers reject a wildcard origin on any
request sent with credentials, which is every request this app makes). It reads
`FRONTEND_URL` from `.env`, so a production deploy just needs that variable set to the
real frontend origin (e.g. `https://app.hanwellaspares.lk`) **before** `config:cache` runs
— it also hardcodes `http://127.0.0.1:5173` as a permanent second allowed origin, which is
a harmless local-dev convenience (nothing in production ever requests from it) rather than
something that needs removing per environment.

This was found and fixed live: the missing file meant every credentialed request from a
real browser failed as an opaque "cannot reach the server" network error (curl-based
testing never caught it, because curl doesn't enforce CORS — only browsers do).

## 2. Backend

```bash
cd backend
composer install --no-dev --optimize-autoloader

cp .env.example .env          # then edit for production values — see §1 and the root README §5
php artisan key:generate

php artisan migrate --force   # --force skips the "are you sure, this is production" prompt
php artisan db:seed --class=RolePermissionSeeder   # roles/permissions are fixed reference data, safe to always seed
# Do NOT run the full db:seed (UserSeeder, PartSeeder, ...) against production —
# those create the development fixture accounts and sample parts (see root README §9).
# Create real admin accounts individually, e.g. via `php artisan tinker` or a dedicated
# artisan command, once one exists.

php artisan storage:link      # only needed if/when file uploads are stored on local disk
php artisan config:cache
php artisan route:cache
php artisan event:cache
```

Production `.env` essentials beyond what local dev needs:

- `APP_ENV=production`, `APP_DEBUG=false` (never `true` in production — the exception
  handler in `bootstrap/app.php` only suppresses stack traces when this is `false`)
- `LOG_LEVEL=error` or `warning` (not `debug`)
- A real `DB_PASSWORD` — the `.env.example` ships blank/weak defaults for local dev only
- `MAIL_MAILER` set to a real transport — it's `log` in `.env.example`, which is fine for
  dev (password-reset links land in the log file) but means no email is ever actually sent
  until this is changed
- Queue worker: `QUEUE_CONNECTION=database` by default; run `php artisan queue:work` under
  a process supervisor (systemd, Supervisor, or the host's equivalent) if anything is
  queued — check before assuming nothing needs one, as this can change as the app grows

Point the web server (Nginx/Apache/etc.) document root at `backend/public/`, same as any
Laravel app.

## 3. Frontend

```bash
cd frontend
# .env must be correct BEFORE this step — VITE_API_URL is compiled into the output, not read at runtime
npm install
npm run build
```

`npm run build` outputs static files to `frontend/dist/`. Upload that directory's contents
to a static host, or serve it directly with Nginx/Apache. Because this is a client-side
routed SPA (React Router), the web server must rewrite unknown paths back to
`index.html` — e.g. in Nginx:

```nginx
location / {
    try_files $uri /index.html;
}
```

Without that rewrite, refreshing the browser on any route other than `/` returns a 404 from
the web server before React Router ever gets a chance to handle it.

## 4. Database backup & rollback

- **Backup before every deploy that runs a migration**:
  ```bash
  mysqldump -u <user> -p <database> > backup-$(date +%Y%m%d-%H%M%S).sql
  ```
- **Rollback a bad migration**: `php artisan migrate:rollback` reverses the most recent
  batch. This is safe for schema-only changes; it is **not** a substitute for the `mysqldump`
  backup above if the migration also touched data, since a rollback only undoes what that
  migration's own `down()` method reverses.
- **Restore from backup**: `mysql -u <user> -p <database> < backup-<timestamp>.sql`.
- The append-only tables (`stock_movements`, `audit_logs`) are, by design, never edited in
  place — restoring from an older backup after a bad deploy loses genuine transactions that
  happened since, so treat that as a last resort, not a routine rollback step.

## 5. Post-deploy checklist

- [ ] `php artisan migrate:status` shows every migration `Ran`
- [ ] `GET /api/v1/auth/me` (unauthenticated) returns `401` in the standard envelope, not a
      framework error page — confirms the exception handler and CORS are both wired
- [ ] Sign in from the actual deployed frontend origin (not `localhost`) and confirm the
      *next* request after login stays authenticated — this is the step that fails first if
      `SESSION_DOMAIN`/`SANCTUM_STATEFUL_DOMAINS`/`VITE_API_URL` disagree (see §1)
- [ ] Refresh the browser on a non-root route (e.g. `/inventory`) and confirm it doesn't 404
      (see the SPA rewrite rule in §3)
- [ ] Deactivate or delete the seeded development accounts (root README §9) once real admin
      accounts exist
- [ ] Confirm `APP_DEBUG=false` and that a deliberately-broken request (e.g. a malformed
      JSON body) returns the generic `"An unexpected error occurred."` message, not a stack
      trace
