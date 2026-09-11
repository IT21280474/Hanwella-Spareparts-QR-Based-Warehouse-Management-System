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

1. **Frontend and API must share a registrable domain (eTLD+1).** E.g. `app.hanwellaspares.lk`
   (frontend) and `api.hanwellaspares.lk` (backend) share `hanwellaspares.lk` and work; two
   unrelated domains do not — the cookie will simply never arrive. Sibling subdomains of the
   same registrable domain are **same-site** by the SameSite cookie spec's own definition
   (which is eTLD+1-based, not exact-origin-based) — `SameSite=Lax` already covers the
   frontend calling the API with credentials; you do not need `SameSite=None` just because
   they're on different subdomains, only if they were on genuinely unrelated domains.
2. **`backend/.env`**:
   - `SESSION_DOMAIN` — leave this **unset** (host-only cookie, scoped to just the API's own
     host). Do **not** set it to a leading-dot parent domain (`.hanwellaspares.lk`) unless
     something *other than the API itself* genuinely needs to read this cookie — it doesn't,
     since it's httpOnly and only ever sent back to whichever host set it. A parent-domain
     cookie is sent to *every* subdomain of that registrable domain, which is a real,
     avoidable widening of what can see the cookie ride along on a request — and a
     meaningfully bigger deal on a shared multi-tenant domain (e.g. a hosting platform's own
     domain, or `*.eagleeyetaxi.com`-style shared infrastructure hosting more than one
     unrelated project) than on a domain dedicated to this one application. A security scan
     will flag the parent-domain version as "Loosely Scoped Cookie" — correctly.
   - `SANCTUM_STATEFUL_DOMAINS=app.hanwellaspares.lk` (the frontend's host, no scheme)
   - `SESSION_SAME_SITE=lax` (or `none` only if frontend and API are on genuinely different
     eTLD+1 domains — which additionally requires `SESSION_SECURE_COOKIE=true` and HTTPS
     everywhere, since `SameSite=None` cookies are rejected by browsers over plain HTTP)
   - `SESSION_SECURE_COOKIE=true` — always, in production. HTTPS is mandatory here (below)
     regardless, so there's no case where this should be anything but `true` once deployed.
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
— the `http://127.0.0.1:5173` dev convenience is only added outside `APP_ENV=production`,
so a production deploy's CORS policy never mentions it at all.

**A note on `config/cors.php` (or any `config/*.php` file) reading the environment:** use
`env('APP_ENV')`, never `app()->environment(...)`. Config files load very early in the boot
sequence (`LoadConfiguration`), before the `app()` helper reliably resolves to the real
`Application` instance — calling it from inside a config file breaks *every* request and
every `artisan` command with a cryptic `"Target class [env] does not exist"` error. Hit and
fixed live during this same security-remediation pass (2026-09-11) — costly enough
(`php artisan serve`, `package:discover`, and every HTTP route all failing at once) to call
out explicitly so it doesn't get reintroduced.

This CORS-file-missing issue above was found and fixed live: the missing file meant every
credentialed request from a real browser failed as an opaque "cannot reach the server"
network error (curl-based testing never caught it, because curl doesn't enforce CORS — only
browsers do).

## 1a. Security response headers (added 2026-09-11, following a ZAP scan)

An OWASP ZAP scan of the live site found missing security headers, a couple of
configuration-hygiene issues, and one genuine cookie-scope concern. All of it is now fixed
in code — nothing further to do at deploy time beyond deploying normally — but it's worth
knowing what's where:

- **Backend** (`app/Http/Middleware/SecurityHeaders.php`, applied to the whole `api`
  middleware group in `bootstrap/app.php`, plus the same logic reused in the exception
  render closure so error responses get it too): `X-Content-Type-Options: nosniff`,
  `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, a strict
  `Content-Security-Policy: default-src 'none'; frame-ancestors 'none'` (this is a pure JSON
  API — it never has a legitimate reason to load or execute anything), `Cache-Control:
  no-store, private, must-revalidate` on every response (nothing here should ever be served
  from a shared/intermediary cache), `Strict-Transport-Security` only when the request is
  actually HTTPS, and `X-Powered-By` removed. `ServerSignature Off` is set in
  `backend/public/.htaccess` too (the one Apache-only concern PHP can't control).
  `ServerTokens Prod` (trims the `Server` header itself, not just its error-page signature)
  can only be set in the main Apache config, not `.htaccess` — ask the hosting provider if
  the "Server Leaks Version Information" finding needs to be fully closed.
- **Frontend** (`frontend/public/.htaccess`): the same headers, plus a CSP tailored to what
  the SPA actually loads (see the comment above that block in the file — update it if a new
  external resource is ever added) and `Permissions-Policy: camera=(self), microphone=(),
  geolocation=()`. Google Fonts (IBM Plex Sans/Mono) are self-hosted now
  (`src/styles/fonts.css`, files in `public/fonts/`) rather than loaded from
  `fonts.googleapis.com`/`fonts.gstatic.com` — this is what closed the scan's "Subresource
  Integrity Attribute Missing" finding: Google's font CSS is generated per-browser, so a
  real SRI hash pinned to it would be fragile and could break unpredictably; removing the
  external dependency entirely is the actual fix, not a hash pinned to a moving target.
- **Cookie flags the scan will still flag, correctly, as findings — but they're required by
  this app's design, not bugs**:
  - The `XSRF-TOKEN` cookie is deliberately **not** `HttpOnly` — Sanctum's SPA CSRF pattern
    requires JavaScript to read it and echo it back as the `X-XSRF-TOKEN` header (see
    `frontend/src/services/apiClient.js`). Setting `HttpOnly` on it would break login
    entirely. The actual session cookie (`SESSION_HTTP_ONLY`) is `true` by default and
    should stay that way — that's the one that matters.
  - `SESSION_SAME_SITE=lax` (not `strict`) is required so the cookie rides along on the
    cross-subdomain requests this app's own architecture depends on (§1 above).
- **Not something to fix in code** — the scan's manual-review recommendations (SQL
  injection, XSS, authentication, authorization, CSRF, business logic) are already
  structurally addressed by this stack's defaults (Eloquent's query builder parameterizes
  every query — no raw SQL string concatenation exists anywhere in this codebase; React
  escapes all rendered output by default; every mutating route requires a Sanctum CSRF
  token; every route is gated by the `permission:<slug>` middleware, see the API docs) but
  were not re-audited line-by-line as part of this pass — treat the scan's own note that
  "automated scanners can miss business-logic vulnerabilities" as still true here.

## 2. Backend

```bash
cd backend
composer install --no-dev --optimize-autoloader

cp .env.example .env          # then edit for production values — see §1 and the root README §5
php artisan key:generate

php artisan migrate --force   # --force skips the "are you sure, this is production" prompt
php artisan db:seed --class=RolePermissionSeeder   # roles/permissions are fixed reference data, safe to always seed
# Do NOT run the full db:seed (UserSeeder, PartSeeder, ...) against production —
# those create the development fixture accounts and sample parts (see root README §9),
# every one sharing a single well-known password.

php artisan wms:create-admin  # prompts for name/email/password (or pass --name= --email= --password=)
# Creates one real ADMIN account. Every other account (Manager, Warehouse Staff, Sales
# Person, Security, Viewer) is then created normally through Users → New account, signed
# in as that admin — never by re-running UserSeeder.

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

**The PHP application server must never be directly reachable from the internet** —
only the reverse proxy (Nginx/Apache) should be. `bootstrap/app.php` trusts every proxy
(`trustProxies(at: '*')`) so `X-Forwarded-For`/`X-Forwarded-Proto` are honoured — this is
what makes `$request->ip()` (the audit log's `ip_address` column, and the per-IP
rate limit on guest routes) resolve to the real visitor rather than the proxy's own
loopback address. If that trust assumption is wrong — the app server *is* reachable
directly — an attacker can forge those headers to spoof their IP in the audit trail and
sidestep the rate limit; firewall the app server's port to only accept connections from
the proxy.

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
