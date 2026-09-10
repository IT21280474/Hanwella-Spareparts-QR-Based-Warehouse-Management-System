# Hanwella Spareparts QR-Based Warehouse Management System

A QR-driven warehouse and counter-sales system for Hanwella Spareparts Warehouse. Every
spare part carries a unique, sequential QR identity (`SJL-00001` … `SJL-01000`, matching the
printed label sheet the warehouse already uses). Staff scan a part to look it up, bill it on
a sales order, receive it into stock, or adjust a count — every one of those actions writes
to a single append-only stock ledger, so inventory, sales and audit history can never drift
apart.

## 1. What this is

The system is a deliberate **hybrid** of two things that are usually built separately:

- A **goods-movement WMS** — stock in / stock out / transfer / adjustment, a location
  hierarchy (warehouse → zone → rack → shelf → bin), and an audit log.
- A **counter-sales POS** — scan a part's QR code to add it to a sale, take payment
  (paid / pending / partially paid), print a bill.

Both sides go through the same `StockService` and land in the same `stock_movements`
ledger, so "how many units are on hand" always has exactly one answer, whether the last
change was a delivery, a sale, a transfer, or a correction.

## 2. Architecture

```
frontend/   React 18 + Vite SPA — talks to the API over HTTPS/JSON
backend/    Laravel 12 API — Sanctum SPA-cookie auth, MySQL 8
docs/       architecture, API reference, ER diagram, deployment guide
```

Frontend and backend are independent applications with their own dependencies and `.env`
files. Nothing is shared at build time; they only talk over HTTP.

```
Request → Route (auth:sanctum, permission:<slug>)
        → Controller           thin — delegates, returns a Resource
        → Form Request         validates & authorizes the payload
        → Service              business rules, DB transactions, row locks
        → Model / Eloquent     query scopes for search, filter, stock status
        → API Resource         shapes the JSON response
```

**Authentication** is a Sanctum SPA session: the browser holds an httpOnly, CSRF-protected
cookie, never a bearer token in JavaScript. Frontend and API must share a registrable
domain for the cookie to be accepted (`localhost` in development — see [Environment
variables](#5-environment-variables)).

**Authorization** is enforced once, server-side, for every one of the 68 API routes, via a
single `permission:<slug>` route middleware (`backend/app/Http/Middleware/EnsurePermission.php`)
backed by `User::hasPermission()`. This is a deliberate alternative to per-model Laravel
Policy classes: one central enforcement point that every route passes through, rather than
68 individual authorization checks that could individually be forgotten. The frontend also
hides controls a user cannot use, but that is presentation only — the server checks again on
every request regardless of what the browser sent.

**Concurrency**: every stock-quantity change runs inside a DB transaction with
`lockForUpdate()` on the affected inventory row, and the database itself enforces
`CHECK (quantity >= 0)`. Two staff issuing stock against the same part at the same moment
cannot drive it negative.

Full write-up: [`docs/architecture/system-architecture.md`](docs/architecture/system-architecture.md)
and [`docs/architecture/phase-1-reference-analysis.md`](docs/architecture/phase-1-reference-analysis.md)
(how the original UI reference was analyzed, and the design tokens it uses).

## 3. Technology stack

| Layer | Choice |
|---|---|
| Backend | Laravel 12, PHP 8.2+, Laravel Sanctum 4 |
| Database | MySQL 8 |
| Backend tests | Pest 3 |
| Frontend | React 18, Vite 6 |
| Routing | React Router 6 |
| Server state | TanStack Query 5 |
| Client state | Zustand (UI/cart), React Context (auth) |
| Forms | React Hook Form + Zod |
| HTTP client | Axios (centralized instance, `frontend/src/services/apiClient.js`) |
| Icons | lucide-react |
| QR | `qrcode-generator` (issue/print), `qr-scanner` (camera scan) |
| Frontend tests | Vitest + React Testing Library |

## 4. Folder structure

```
backend/
  app/Http/Controllers/Api/V1/   one controller per resource
  app/Http/Requests/             one Form Request per write action, grouped by domain
  app/Http/Resources/            API response shaping
  app/Http/Middleware/           EnsurePermission (RBAC enforcement)
  app/Services/                  StockService, QrService, OrderService, ImportService,
                                  ReportService, AuditLogger — business logic lives here
  app/Models/
  database/migrations/           14 migrations, chronological, no gaps
  database/seeders/               role/permission matrix, dev users, catalog, parts
  routes/api.php                  all 68 routes, versioned under /api/v1
  tests/Feature/

frontend/
  src/pages/                     one folder per screen (dashboard, inventory, qr, sales, ...)
  src/components/                ui/ layout/ dashboard/ inventory/ parts/ common/
  src/services/api/               one module per backend resource + apiClient.js (axios)
  src/routes/                     centralized route table + ProtectedRoute
  src/store/, src/context/        Zustand stores, auth context
  src/hooks/queries/               TanStack Query hooks per resource

docs/
  architecture/    phase-1 reference analysis, system architecture, ER + API map
  api/             endpoint-by-endpoint API reference
  database/        ER diagram (Mermaid) + table reference
  deployment/       production deployment guide
```

## 5. Environment variables

Neither `.env` file is committed. Copy the `.example` file and fill it in.

**`backend/.env`** (copy from `backend/.env.example`):

| Variable | Purpose |
|---|---|
| `APP_NAME`, `APP_ENV`, `APP_KEY`, `APP_DEBUG`, `APP_URL` | Standard Laravel bootstrap. Run `php artisan key:generate` to fill `APP_KEY`. |
| `DB_CONNECTION`, `DB_HOST`, `DB_PORT`, `DB_DATABASE`, `DB_USERNAME`, `DB_PASSWORD` | MySQL connection. |
| `SESSION_DRIVER`, `SESSION_DOMAIN`, `SESSION_SAME_SITE` | Sanctum session cookie. `SESSION_DOMAIN` must be a domain the frontend's origin is a subdomain of (or match it exactly). |
| `SANCTUM_STATEFUL_DOMAINS` | Comma-separated origins allowed to receive the session cookie — must include the frontend's host:port. |
| `FRONTEND_URL` | Used for CORS / redirect targets. |
| `WMS_QR_PREFIX`, `WMS_QR_PAD` | QR identifier format — default `SJL` + 5 digits (`SJL-00001`). Change only before any codes are printed; existing codes never change. |
| `WMS_CURRENCY`, `WMS_COMPANY_NAME`, `WMS_COMPANY_ADDRESS`, `WMS_COMPANY_CONTACT`, `WMS_COMPANY_REG_NO` | Shown on printed bills and labels. |
| `DEV_SEED_PASSWORD` | Password assigned to every seeded dev account (see §9). **Development only — never set in production.** Falls back to `password` if unset. |

**`frontend/.env`** (copy from `frontend/.env.example`):

| Variable | Purpose |
|---|---|
| `VITE_API_URL` | Base URL of the Laravel API. Local dev: `/` — Vite's dev server proxies `/api` and `/sanctum` to the backend (`vite.config.js`), so the browser never makes a cross-origin request at all. Production: the real API origin, e.g. `https://api.hanwellaspares.lk`. |
| `VITE_CURRENCY` | Displayed alongside every monetary amount. |

## 6. Installation

Prerequisites: PHP 8.2+, Composer, Node 18+, MySQL 8.

### Backend

```bash
cd backend
composer install
cp .env.example .env
php artisan key:generate

# create the database first (matching DB_DATABASE in .env), then:
php artisan migrate
php artisan db:seed
```

### Frontend

```bash
cd frontend
npm install
cp .env.example .env
```

## 7. Running locally

Two terminals — the backend and frontend are separate dev servers:

```bash
# terminal 1
cd backend && php artisan serve      # http://localhost:8000

# terminal 2
cd frontend && npm run dev           # http://localhost:5173
```

The default `.env.example` values (`SANCTUM_STATEFUL_DOMAINS`, `VITE_API_URL`) already match
this `localhost:8000` / `localhost:5173` pairing.

> `backend/package.json` also defines a Vite `dev`/`build` script — that is unused
> boilerplate left over from Laravel's default asset pipeline (Tailwind + `laravel-vite-plugin`
> for Blade views). This project has no Blade views; ignore it. The real frontend is the
> separate Vite app in `frontend/`, run as shown above.

## 8. Testing

**Backend** — Pest, against a dedicated `_test` database (never the dev database):

```bash
cd backend
# one-time: create the test database, matching phpunit.xml's DB_DATABASE
mysql -u root -p -e "CREATE DATABASE hanwella_wms_test"

php artisan test
# or: composer test
```

**Frontend** — Vitest + React Testing Library:

```bash
cd frontend
npm run test        # single run
npm run test:watch  # watch mode
```

## 9. Default development credentials

Seeded by `database/seeders/UserSeeder.php`, one account per role. **Development only — do
not use these in production; deactivate or replace them before go-live.**

| Name | Email | Role |
|---|---|---|
| Sadeeka Perera | `sadeeka@hanwellaspares.lk` | Admin — full access, including users, settings, audit log |
| Ruwan Perera | `ruwan@hanwellaspares.lk` | Manager — operations + reporting/exports |
| Kasun Adikari | `kasun@hanwellaspares.lk` | Warehouse staff — scanning, stock movements, counter sales |
| Nimali Silva | `nimali@hanwellaspares.lk` | Viewer — read-only |

Password for all four: the value of `DEV_SEED_PASSWORD` in `backend/.env`, or `password` if
that variable is left unset.

## 10. QR workflow

- **Format**: `<prefix>-<padded sequence>` — default `SJL-00001` … `SJL-01000`, configured by
  `WMS_QR_PREFIX` / `WMS_QR_PAD` (`backend/config/wms.php`). This matches the physical label
  sheet already in use at the warehouse (`SJL_inventory_QR_labels_A4.pdf`).
- **One QR identity per part type**, not per physical unit — a part's QR code covers every
  unit of that part across every bin in every warehouse. `qr_codes.code`, `.sequence` and
  `.part_id` all carry database unique constraints; the sequence is only ever assigned
  server-side (`QrService`), never accepted from the client.
- **Issuing**: a new part is assigned a QR identity automatically on creation
  (`POST /parts`); `POST /qr/generate` backfills identities for any part missing one.
- **Scanning**: `POST /qr/scan` resolves a code to its part and current stock. The scanned
  string is never trusted as anything more than a lookup key — every field on the response
  comes from the database.
- **Printing**: `GET /qr/labels?from=&count=&layout=` returns a page of labels (assigned or
  not — an unclaimed sequence number is still a valid, printable label) for a print-ready A4
  sheet. Three layouts are offered (4×10 / 40 per sheet, 3×8 / 24, 5×13 / 65); batches over 80
  labels prompt for confirmation, and the hard limit is 200 per run.

## 11. Build & deployment

```bash
# frontend production build
cd frontend && npm run build     # outputs static assets to frontend/dist/

# backend production install
cd backend && composer install --no-dev --optimize-autoloader
```

Full production deployment guide (CORS/Sanctum cross-origin configuration, HTTPS
requirement, migration/backup steps): [`docs/deployment/README.md`](docs/deployment/README.md).

## 12. API overview

All endpoints are versioned under `/api/v1`, JSON in and out, behind the standard envelope:

```json
// success
{ "success": true, "message": "...", "data": {}, "meta": {} }
// validation error (422)
{ "success": false, "message": "Validation failed.", "errors": { "field": ["..."] } }
// any other error
{ "success": false, "message": "..." }
```

Every route except `auth/login`, `auth/forgot-password`, `auth/reset-password` and
`imports/template` requires an authenticated Sanctum session; most also require a specific
permission, enforced server-side regardless of what the UI shows.

Full endpoint-by-endpoint reference, grouped by resource: [`docs/api/README.md`](docs/api/README.md).
Database reference and ER diagram: [`docs/database/er-diagram.md`](docs/database/er-diagram.md).

## 13. Troubleshooting

| Symptom | Likely cause |
|---|---|
| Login succeeds but the very next request returns 401 | `SANCTUM_STATEFUL_DOMAINS` (backend) doesn't include the frontend's `host:port`, or `VITE_API_URL` (frontend) doesn't match how the backend is actually being reached. Both must agree on a shared registrable domain. |
| `419` on every POST/PUT/PATCH/DELETE | The CSRF cookie wasn't primed before the first mutating request. The frontend's `apiClient` does this automatically (`ensureCsrfCookie()`) — if you're hitting the API directly (curl/Postman), call `GET /sanctum/csrf-cookie` first and send the `XSRF-TOKEN` cookie back as the `X-XSRF-TOKEN` header. |
| Migration fails with a duplicate database error | The `hanwella_wms` (or your configured `DB_DATABASE`) database must exist and be empty before the first `php artisan migrate`. |
| Backend tests fail to connect / wrong data appears | Tests run against `hanwella_wms_test` (see `backend/phpunit.xml`), a **separate** database from your dev database — create it once, and never point `DB_DATABASE` at it for normal development. |
| A part can't be deleted | By design: a part with any stock on hand, or a category with parts assigned, refuses deletion (`409`) rather than leaving stock movements pointing at a part that no longer exists. Adjust stock to zero (or reassign the category) first. |
| `419 CSRF token mismatch` in the browser, especially if curl/Postman work fine | In local dev the frontend talks to the API through Vite's proxy (`VITE_API_URL=/`, see `vite.config.js`) precisely to avoid this class of bug — check `VITE_API_URL` is actually `/` (not an absolute `http://localhost:8000`, which reintroduces a cross-origin request and its cookie/SameSite edge cases) and that you restarted `npm run dev` after any `.env`/`vite.config.js` change (Vite does not hot-reload either). Also try a hard refresh / clear cookies for `localhost:5173` once, to drop any cookie set before a config fix. |
| CORS error in the browser console | Only relevant if something is bypassing the dev proxy (e.g. a direct call to `http://localhost:8000`) or in production. `backend/config/cors.php` must list the frontend's exact origin in `allowed_origins` and set `supports_credentials => true` (driven by `FRONTEND_URL`). curl doesn't enforce CORS, so this class of bug only shows up in a real browser. |
| Login works from curl but not from the browser, with no other symptom | Two or more `php artisan serve` and/or `npm run dev` processes are bound to the same port (Windows allows this silently, and other sessions on this machine may start their own). `netstat -ano \| findstr :8000` (or `:5173`) and kill every stray one, then start exactly one of each. |

---

Built for Hanwella Spareparts Warehouse by eSupport Technology (Pvt) Ltd.
