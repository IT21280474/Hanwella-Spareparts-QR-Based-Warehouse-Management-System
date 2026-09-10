# System Architecture — Hanwella Spareparts WMS

Scope decision (confirmed): **superset** — every screen in the visual reference, plus the
goods-movement WMS modules from the brief. QR label spec: reconstructed from the reference
`qrSheet` screen (see `phase-1-reference-analysis.md` §7).

## 4. Architecture plan

### Stack

| Layer | Choice | Note |
|---|---|---|
| Backend | Laravel 12, PHP 8.5 | verified locally |
| Database | MySQL 8.0 | running on :3306 |
| Auth | Sanctum **SPA cookie** session | httpOnly cookie, CSRF-protected — no token in JS |
| Frontend | React 18 + Vite | |
| Server state | TanStack Query | |
| Forms | React Hook Form + Zod | |
| HTTP | Axios (`withCredentials`) | central client + interceptors |
| Client state | Zustand (UI shell, cart) + Context (auth) | server data never duplicated into Zustand |
| Styling | Hand-authored CSS with design tokens | no UI framework |
| Tests | Pest (backend), Vitest + RTL (frontend) | |

**Why cookie sessions over bearer tokens:** the reference is a shared-terminal warehouse
app. An httpOnly cookie cannot be exfiltrated by XSS, gives real CSRF protection, and
survives reload without hand-rolled refresh logic. Requires frontend and API to share a
registrable domain — documented in deployment.

### Backend layering

```
Route  ->  Middleware (auth:sanctum, permission:*, throttle)
       ->  Controller        thin: delegate + return Resource
       ->  FormRequest       validation + authorize()
       ->  Service           business logic, DB transactions, row locks
       ->  Model / Query     Eloquent, scopes for search & filter
       ->  API Resource      response shaping
```

**Update, as built:** a dedicated Repository layer was planned for inventory search and
reporting but turned out unnecessary in practice — Eloquent query scopes on the models
(e.g. `Part::search()`, `::stockStatus()`, `::withStock()`) handle both cleanly at the same
altitude as every other Service. There is no `app/Repositories/` directory; Services talk
to Eloquent directly everywhere, which is the simpler outcome the brief's warning against
"unnecessary abstraction" argues for.

### Cross-cutting

- **Envelope** — one `ApiResponse` helper + `Handler` overrides produce the exact
  `{success, message, data, meta}` / `{success, message, errors}` shapes. Stack traces
  never leave the server when `APP_DEBUG=false`.
- **RBAC** — hand-rolled: `roles`, `permissions`, `permission_role`, `users.role_id`
  (one role per user, matching the reference). **Update, as built:** every one of the 68
  routes is gated by a single `permission:<slug>` middleware (`EnsurePermission`) backed by
  `User::hasPermission()` — no record-level rule ever needed a per-model Policy class, so
  `app/Policies/` does not exist. This is a deliberate choice, not a gap: one centralized
  enforcement point is easier to audit than 15+ policy classes for a permission model that
  is role-level, not per-record.
- **Concurrency** — every quantity change runs inside `DB::transaction` with
  `lockForUpdate()` on the `inventory` row. Stock is re-read *after* the lock, so the
  A-removes-7 / B-removes-5 race resolves correctly: the second transaction sees 3 and
  fails validation rather than writing -2. A DB-level `CHECK (quantity >= 0)` is the
  backstop.
- **Immutability** — `stock_movements` is append-only: no update or delete route, no
  `updated_at`. Corrections are new compensating rows.
- **Audit** — `AuditLogger` service called explicitly from services (not a blind model
  observer, so we log intent rather than noise). Passwords and tokens are stripped from
  `old_values`/`new_values` by an attribute blacklist.

## 5. Database ER structure

### Identity & access

- **users** — `id, name, email` uq, `password`, `role_id`→roles, `is_active`,
  `last_login_at`, timestamps, softDeletes
- **roles** — `id, slug` uq, `name, description` · ADMIN, MANAGER, WAREHOUSE_STAFF, VIEWER
- **permissions** — `id, slug` uq, `name, group`
- **permission_role** — `permission_id, role_id` (composite PK)

### Catalog

- **categories** — `id, name` uq, `code` uq(3), `description, is_active`, timestamps, softDeletes
- **suppliers** — `id, name, contact_person, phone, email, address, notes, is_active`, timestamps, softDeletes
- **vehicle_makes** — `id, name` uq, `code` uq(3) — the `TOY` in `BRK-TOY-4821`
- **vehicle_models** — `id, make_id`→makes, `name`, uq(`make_id`,`name`)
- **parts** — `id, part_number` uq, `sku` uq, `name, description`, `category_id`→categories,
  `supplier_id`→suppliers nullable, `vehicle_model_id`→vehicle_models nullable, `unit`,
  `selling_price, cost_price` decimal(12,2), `min_stock`, `status`, `created_by`→users,
  timestamps, softDeletes
  - indexes: `part_number`, `sku`, `name`, `category_id`, `status`

### Locations

- **warehouses** — `id, name, code` uq, `address, is_active`, timestamps
- **locations** — `id, warehouse_id`→warehouses, `parent_id`→locations *(self, nullable)*,
  `type` enum(ZONE,RACK,SHELF,BIN), `name, code, full_path`, `is_active`, timestamps
  - uq(`warehouse_id`,`code`); adjacency list gives Warehouse→Zone→Rack→Shelf→Bin in one
    table. `full_path` is a denormalised cache for display and search only.

### QR

- **qr_codes** — `id, code` uq (`SJL-00001`), `sequence` uq unsigned, `part_id` uq→parts,
  `status` enum(ACTIVE,VOID), `generated_by`→users, `generated_at, printed_at, print_count`
  - one QR identity per **part type**, per the reference. `code` and `sequence` both carry
    unique constraints; generation is server-side inside a transaction.

### Stock

- **inventory** — `id, part_id`→parts, `warehouse_id`→warehouses, `location_id`→locations
  nullable, `quantity` unsigned, `reserved_quantity` unsigned, timestamps
  - uq(`part_id`,`warehouse_id`,`location_id`), `CHECK (quantity >= 0)`
  - a part's on-hand total is `SUM(quantity)` across its rows
- **stock_movements** — `id, part_id, inventory_id, warehouse_id, location_id,
  from_location_id, to_location_id, type` enum(STOCK_IN,STOCK_OUT,ADJUSTMENT,TRANSFER,
  RETURN,SALE), `quantity` signed, `quantity_before, quantity_after`, `reference_type,
  reference_id, reference_no, reason, user_id`, `created_at` only
  - indexes: (`part_id`,`created_at`), (`type`,`created_at`), (`reference_type`,`reference_id`)
- **inventory_adjustments** — `id, part_id, inventory_id, adjustment_type`
  enum(STOCK_RECEIVED,MANUAL_ADJUSTMENT,SALE_CORRECTION,DAMAGE_WRITE_OFF),
  `quantity_before, adjustment, quantity_after, reason, note, user_id`, `created_at`
  - the reference's four adjustment types, preserved verbatim

### Sales (reference POS)

- **sales_orders** — `id, order_no` uq (`SO-2026-1421`), `customer_name, customer_phone`,
  `subtotal, discount, total, paid_amount` decimal(12,2), `payment_status`
  enum(PAID,PENDING,PARTIALLY_PAID,CANCELLED), `payment_mode` enum(CASH,CARD,BANK_TRANSFER,
  CREDIT), `status`, `cashier_id`→users, `ordered_at`, timestamps
- **sales_order_items** — `id, sales_order_id`→cascade, `part_id`, plus **snapshots**
  (`qr_code, part_number, part_name, unit_price`) so a historical bill never mutates when
  the part is later renamed or repriced, `quantity, line_total`

### System

- **import_batches** — `id, user_id, filename, total_rows, valid_rows, created_count,
  updated_count, duplicate_count, rejected_count, status, error_report_path`, timestamps
- **audit_logs** — `id, user_id` nullable, `action, entity_type, entity_id`,
  `old_values` json, `new_values` json, `ip_address, user_agent`, `created_at`
  - indexes: (`entity_type`,`entity_id`), (`user_id`,`created_at`), (`action`)
- **settings** — `id, key` uq, `value` json, `group`
- Laravel defaults: `sessions`, `cache`, `jobs`, `notifications`, `personal_access_tokens`

## 6. API endpoint map

All under `/api/v1`, all JSON, all behind `auth:sanctum` except the auth group.
List endpoints accept `?search=&page=&per_page=&sort=&direction=` plus their own filters.

```
POST   /auth/login                      guest, throttle:6,1
POST   /auth/logout
GET    /auth/me
POST   /auth/forgot-password            throttle:3,1
POST   /auth/reset-password

GET    /dashboard                                       view_dashboard

GET    /parts                     ?category=&status=&supplier=
POST   /parts                                           create_inventory
GET    /parts/{part}
PUT    /parts/{part}                                    update_inventory
DELETE /parts/{part}                                    delete_inventory
GET    /parts/{part}/movements

GET    /inventory                 ?search=&category=&status=&warehouse=&location=
GET    /inventory/{part}
POST   /inventory/transfer                              update_inventory

POST   /qr/generate                                     print_labels
POST   /qr/scan                   {code}                scan_qr
GET    /qr/labels                 ?from=&count=&layout= print_labels
GET    /qr/{code}

POST   /stock/in                                        create_stock_in
POST   /stock/out                                       create_stock_out
POST   /stock/adjust                                    update_inventory

GET    /movements                 ?type=&part=&from=&to= view_transactions

GET    /orders                    ?payment_status=&search=
POST   /orders                                          create_stock_out
GET    /orders/{order}
PATCH  /orders/{order}/payment
POST   /orders/{order}/cancel

RES    /categories                                      manage_settings on write
RES    /suppliers                                       manage_settings on write
RES    /warehouses
RES    /locations                 ?warehouse=&parent=&type=
RES    /users                                           manage_users

POST   /imports                   multipart               create_inventory
GET    /imports/{batch}
POST   /imports/{batch}/confirm
GET    /imports/template

GET    /reports/sales|inventory|payments|low-stock      view_reports
GET    /reports/{type}/export     ?format=csv            export_reports

GET    /audit-logs                ?user=&action=&entity= manage_users
GET    /settings                  |  PUT /settings       manage_settings
```

`RES` = full resource (index, store, show, update, destroy).

Status codes: 200 ok · 201 created · 204 deleted · 401 unauthenticated · 403 forbidden ·
404 missing · 409 stock conflict · 422 validation · 429 throttled · 500 unexpected.

## 7. Folder structure

Frontend and backend are fully independent — separate installs, separate `.env`, no shared
build. Structure follows the brief, with these concrete additions:

```
backend/app/
  Http/Controllers/Api/V1/     one controller per module
  Http/Requests/               one FormRequest per write action
  Http/Resources/              PartResource (also serves inventory listings), ...
  Http/Middleware/             EnsurePermission
  Services/                    StockService, QrService, OrderService,
                               ImportService, ReportService, AuditLogger
  Models/  Support/ApiResponse.php

frontend/src/
  components/ui/               Button Input Select Badge Card Table Modal Toast Skeleton
  components/{inventory,qr,pos,dashboard,...}/
  layouts/AppLayout Sidebar Header AuthLayout PrintLayout
  pages/                       one folder per route
  services/api/                axios client + one module per API area
  hooks/                       useAuth usePermission useDebounce use<Module>Query
  store/                       uiStore cartStore
  styles/tokens.css            the design system from Phase 1 §2
```

## 8. Implementation phases

| # | Phase | Contents |
|---|---|---|
| 1 | Reference analysis | **done** |
| 2 | Architecture + DB design | **this document** |
| 3 | Laravel foundation | install, config, envelope, exception handler, base migrations |
| 4 | Auth + RBAC | Sanctum, roles, permissions, `permission:` middleware, seeders |
| 5 | Design system + shell | tokens.css, UI primitives, sidebar/header, routing, auth guard |
| 6 | Dashboard + parts + inventory | list/detail/create/edit, search, filter, sort, paginate |
| 7 | QR | generation, uniqueness, scan resolve, scanner screen, A4 label sheets |
| 8 | Stock ops | stock in, stock out, adjustments, transfers, POS + orders + bill |
| 9 | Movements, audit, reports | feed, audit log viewer, 4 reports, CSV export, Excel import |
| 10 | Hardening | tests, security pass, performance, docs, README |

Each phase ends with: build clean, no console errors, no failing API calls, responsive
check, permission check, duplication refactor — then proceed.
