# API Reference

Base URL: `{VITE_API_URL}/api/v1` (e.g. `http://localhost:8000/api/v1` in development).

Source of truth: `backend/routes/api.php` (74 routes). This document groups them by
resource; every method/URL/permission pair below is read directly from that file.

## Conventions

**Auth.** Every route except the four marked *public* below requires an authenticated
Sanctum session (a `laravel_session` cookie obtained via `POST /auth/login`, after first
priming CSRF with `GET /sanctum/csrf-cookie`). No bearer token exists in this app.

**Permissions.** Most authenticated routes additionally require one specific permission
slug, checked server-side by the `permission:<slug>` middleware
(`app/Http/Middleware/EnsurePermission.php`) — listed per route below. A route listing two
slugs separated by a comma (only `GET /qr/{code}`) accepts *either* one. Permission slugs
are fixed by `database/seeders/RolePermissionSeeder.php`:

| Group | Slugs |
|---|---|
| Dashboard | `view_dashboard` |
| Inventory | `view_inventory`, `create_inventory`, `update_inventory`, `delete_inventory` |
| QR | `scan_qr`, `print_labels` |
| Stock | `view_transactions`, `create_stock_in`, `create_stock_out` |
| Reports | `view_reports`, `export_reports` |
| Administration | `manage_users`, `manage_settings` |

The **ADMIN** role holds every permission. **MANAGER**, **WAREHOUSE_STAFF** and **VIEWER**
hold the subsets defined in that seeder (see the root README §9, or `RoleController`'s
`GET /roles` at runtime).

**Response envelope.** Every endpoint returns one of these three shapes
(`app/Support/ApiResponse.php`):

```jsonc
// success — 200/201
{ "success": true, "message": "Inventory retrieved successfully.", "data": { /* ... */ } }

// success, paginated — meta carries Laravel's paginator fields plus any endpoint-specific summary
{
  "success": true,
  "message": "Parts retrieved successfully.",
  "data": [ /* array of rows */ ],
  "meta": {
    "current_page": 1, "per_page": 10, "total": 42, "last_page": 5, "from": 1, "to": 10
    /* + endpoint-specific keys, e.g. status_counts, units_on_hand */
  }
}

// validation error — 422
{ "success": false, "message": "Validation failed.", "errors": { "email": ["..."] } }

// any other error — 400/401/403/404/409/429/500
{ "success": false, "message": "You do not have permission to perform this action." }
```

Stack traces are never included; unhandled exceptions return a generic 500 message when
`APP_DEBUG=false`.

**List query parameters.** Every index endpoint accepts `per_page` (capped at
`wms.max_per_page`, default `wms.per_page` = 10) and most accept `search`, `sort`,
`direction=asc|desc`, plus the resource-specific filters noted below. Filters are always
applied server-side — the frontend never fetches a full table to filter it in the browser.

---

## Auth

| Method | URL | Auth | Body |
|---|---|---|---|
| POST | `/auth/login` | *public*, `guest`, throttled 6/min | `email`, `password`, `remember?`, `portal?` (`security`) |
| POST | `/auth/forgot-password` | *public*, `guest`, throttled 3/min | `email` |
| POST | `/auth/reset-password` | *public*, `guest`, throttled 3/min | `token`, `email`, `password` (confirmed, min 8) |
| POST | `/auth/logout` | session | — |
| GET | `/auth/me` | session | — |

- `login` returns the same validation error for an unknown email and a wrong password (no
  account enumeration), regenerates the session, and rejects a deactivated account (`422`)
  even with correct credentials.
- `login` / `me` response `data`: a `UserResource` — `id, name, email, initials, is_active,
  last_login_at, created_at, role: {slug, name}, permissions: [slug, ...]`. The password
  hash is never present in any response.
- `forgot-password` always returns the same message whether or not the email is registered.
- `portal: "security"` is sent by the Security sign-in screen. It is the same login and the
  same session cookie, but an account without `view_yard_stock` is signed straight back out
  with a `422` on `email`: "This account does not have Security access…".

## Dashboard

| Method | URL | Permission |
|---|---|---|
| GET | `/dashboard` | `view_dashboard` |

One call returns everything the dashboard renders — KPIs, a 14-day sales trend, the
payment-status split, top 5 parts by units sold (last 30 days), a low/out-of-stock
watchlist, the 6 most recent orders, and a computed alerts list — so the screen can never
show figures fetched a few seconds apart against a catalogue that changed in between.

## Parts (catalogue)

| Method | URL | Permission | Notes |
|---|---|---|---|
| GET | `/parts` | `view_inventory` | `?search=&category=&supplier=&status=&sort=name\|selling_price\|updated_at\|created_at&direction=` |
| POST | `/parts` | `create_inventory` | see body below; multipart if `image` is attached |
| GET | `/parts/{part}` | `view_inventory` | includes 90-day sold count |
| PUT | `/parts/{part}` | `update_inventory` | plain JSON only — PHP cannot parse a multipart body on PUT |
| POST | `/parts/{part}` | `update_inventory` | same as PUT, with `_method=PUT` spoofed in the body — **required** when the update includes `image` or `remove_image`, since only POST bodies are ever parsed as multipart |
| DELETE | `/parts/{part}` | `delete_inventory` | `409` if any stock remains on hand |
| GET | `/parts/{part}/movements` | `view_inventory` | paginated per-part stock ledger |

Body (`PartRequest`): `name` (required), `part_number` (required, unique), `sku` (optional,
unique, defaults to `part_number`), `description`, `image` (optional file — JPEG/PNG/WebP,
max 4MB, `multipart/form-data` only), `remove_image` (optional boolean, update only — clears
the photo without a replacement), `category_id` (required, must exist), `supplier_id`,
`vehicle_model_id`, `unit`, `selling_price` (required, ≥0), `cost_price`, `min_stock`,
`status` (`ACTIVE`|`ARCHIVED`), and on **create only**: `quantity` (required, ≥0 — opening
stock), `warehouse_id`, `location_id`.

Creating a part auto-assigns it a QR identity and, if `quantity` > 0, records an opening
`STOCK_IN` movement — both inside the same transaction as the part insert. An uploaded
image is stored on the `public` disk (`storage/app/public/parts/…`, served via
`/storage/…`) outside that transaction, since file I/O isn't transactional; replacing or
removing a photo deletes the previous file.

`PartResource` shape: `id, part_number, sku, name, description, image_url, qr_code,
category: {id,name}, supplier: {id,name}, vehicle_make_id, vehicle_model_id, vehicle_make,
vehicle_model, unit, selling_price, cost_price, min_stock, quantity, bin, stock_value,
status, sold_90d, created_at, updated_at`. `image_url` is `null` when no photo is set.

## Inventory (stock-aware listing)

| Method | URL | Permission | Notes |
|---|---|---|---|
| GET | `/inventory` | `view_inventory` | `?search=&category=&supplier=&status=all\|in\|low\|out&sort=name\|selling_price\|quantity\|updated_at` |
| GET | `/inventory/{part}` | `view_inventory` | |
| POST | `/inventory/transfer` | `update_inventory` | move stock between locations |

`GET /inventory` is `GET /parts` joined with live stock — every part regardless of
ACTIVE/ARCHIVED status stays listed until its stock reaches zero (status is a badge, not a
listing filter). `meta` additionally carries `units_on_hand`, `needs_attention`, and
`status_counts: {all, in, low, out}` for the status tabs.

`POST /inventory/transfer` body (`TransferRequest`): `part_id`, `quantity` (≥1),
`from_location_id`, `to_location_id` (must differ), `reason?`.

## QR

| Method | URL | Permission | Notes |
|---|---|---|---|
| POST | `/qr/generate` | `print_labels` | `part_id?` — omit to backfill every part missing an identity (max 500/call) |
| POST | `/qr/scan` | `scan_qr` | body: `code` (required) |
| GET | `/qr/labels` | `print_labels` | `?from=&count=&layout=` — see below |
| POST | `/qr/labels/printed` | `print_labels` | body: `codes: [string, ...]` — marks labels printed |
| GET | `/qr/{code}` | `view_inventory` **or** `scan_qr` | resolves a code path param instead of a body |

`qr/scan` and `qr/{code}` both return a `404` (`"No spare part is linked to that code."`,
not a validation error) for an unrecognized code — the scanned/typed string is never
trusted as anything beyond a lookup key; the database is the sole authority on whether it
exists. On success, `data` is a full `PartResource` with live `quantity`.

`GET /qr/labels?from=1&count=40`: returns `count` consecutive label payloads starting at
sequence `from` (max `count` = `wms.qr.max_batch`, 200), whether or not each sequence number
is currently assigned to a part — an unclaimed identity is still a printable label. Each
label: `{code, sequence, assigned, part_name, part_number, bin}`.

## Stock operations

| Method | URL | Permission | Notes |
|---|---|---|---|
| POST | `/stock/in` | `create_stock_in` | receive stock |
| POST | `/stock/out` | `create_stock_out` | issue stock outside a sale |
| POST | `/stock/adjust` | `update_inventory` | counted correction |

`stock/in` and `stock/out` share a body shape (`StockMoveRequest`): `part_id`, `quantity`
(≥1), `warehouse_id?`, `location_id?`, `reference_no?`, `note?`. Both run inside a DB
transaction with `lockForUpdate()` on the inventory row; `stock/out` returns `409` if it
would drive quantity negative.

`stock/adjust` body (`AdjustStockRequest`): `part_id`, `adjustment_type` (one of
`STOCK_RECEIVED`, `MANUAL_ADJUSTMENT`, `SALE_CORRECTION`, `DAMAGE_WRITE_OFF`), `quantity`
(≥1), `note?`. Every adjustment records `quantity_before`, the signed `adjustment`, and
`quantity_after` — a count is never silently overwritten.

Response for all three: the created `StockMovementResource` / `InventoryAdjustmentResource`.

## Movements (global ledger)

| Method | URL | Permission |
|---|---|---|
| GET | `/movements` | `view_transactions` |

`?search=&part=&type=STOCK_IN\|STOCK_OUT\|ADJUSTMENT\|TRANSFER\|RETURN\|SALE&from=&to=`.
Search matches part name, part number, QR code, or the movement's `reference_no`. `meta`
adds `units_in`, `units_out`, and `type_counts` (including an `all` key) computed over the
same filters minus the type tab, for the type-tab counts.

`StockMovementResource`: `id, type, quantity` (signed), `quantity_before, quantity_after,
reference_no, reason, part: {id,name}, part_number, qr_code, warehouse: {id,name},
location` (full path string), `user: {id,name}, created_at`.

## Orders (POS)

| Method | URL | Permission | Notes |
|---|---|---|---|
| GET | `/orders` | `view_transactions` | `?search=&payment_status=&from=&to=` |
| POST | `/orders` | `create_stock_out` | create + bill a sale |
| GET | `/orders/{order}` | `view_transactions` | includes line items |
| PATCH | `/orders/{order}/payment` | `create_stock_out` | change payment status/amount |
| POST | `/orders/{order}/cancel` | `create_stock_out` | reverses stock, `reason?` |

`POST /orders` body (`CreateOrderRequest`): `customer_name?`, `customer_phone?`,
`discount?`, `payment_status` (required: `PAID`|`PENDING`|`PARTIALLY_PAID`),
`payment_mode` (required: `CASH`|`CARD`|`BANK_TRANSFER`|`CREDIT`), `paid_amount?`,
`items` (required, ≥1 entry) — each `{part_id, quantity}`. Stock is deducted per line inside
one transaction; insufficient stock on any line rolls back the whole order (`409`).

Cancelling an order returns every line's quantity to stock via a compensating movement — it
never deletes or edits the original sale rows.

Once Security has dispatched an order its goods have left the building, so `payment` and
`cancel` on a dispatched order are refused with `409`. A `PARTIALLY_PAID` update whose
`paid_amount` covers the whole total is stored as `PAID`. `SalesOrderResource` also carries
`paid_at` (when it became fully paid), `yard_status`, `dispatched_at` and `dispatched_by`.

`SalesOrderResource`: `id, order_no, customer_name, customer_phone, subtotal, discount,
total, paid_amount, outstanding, payment_status, payment_mode, status, items_count, cashier:
{id,name}, ordered_at, items: [SalesOrderItemResource]`. Line items are point-in-time
**snapshots** (`part_name`, `part_number`, `qr_code`, `unit_price` copied at sale time) — a
printed bill reads identically even if the part is later renamed, repriced, or deleted.

## Security — yard stock & dispatch

| Method | URL | Permission | Notes |
|---|---|---|---|
| GET | `/security/dashboard` | `view_yard_stock` | KPIs + the 5 most recent dispatches |
| GET | `/security/yard-stock` | `view_yard_stock` | `?search=&from=&to=` (paid date), paginated, oldest paid first |
| GET | `/security/orders/search` | `view_yard_stock` | `?order_no=` exact match, case/whitespace-insensitive |
| GET | `/security/orders/{order}` | `view_yard_stock` | yard or dispatched orders only, else `404` |
| POST | `/security/orders/{order}/dispatch` | `dispatch_orders`, throttled 30/min | body: `notes?` (max 255) — nothing else is read |
| GET | `/security/dispatch-history` | `view_yard_stock` | `?search=&from=&to=` (dispatch date), newest first |

**Yard eligibility** is computed on the server on every request — never stored, never taken
from the client: `payment_status = PAID` **and** `paid_amount >= total` (DECIMAL, exact),
`status = COMPLETED` (not cancelled), and `dispatched_at IS NULL`. The rule lives once in
`SalesOrder::dispatchBlocker()` with its SQL twin `SalesOrder::scopeReadyForDispatch()`.

`search` answers `404` for an unknown number, `409` with the reason for an unpaid or
cancelled order (and no order data), and `200` for an eligible order. It also answers `200`
for an already-dispatched one, with `meta: {eligible: false, reason}` so the gate can see who
released it and when.

`dispatch` re-checks every rule under `SELECT … FOR UPDATE`, claims the order with a
conditional `UPDATE … WHERE dispatched_at IS NULL`, and writes a `dispatches` row that is
`UNIQUE` per order. Refusals are `409`: *"This order cannot be dispatched because full
payment has not been completed."*, *"Cancelled orders cannot be dispatched."*, *"This order
has already been dispatched."* Every dispatch writes an `order.dispatch` audit entry.
Dispatch records have no update or delete route.

`YardOrderResource`: `id, order_no, bill_no, customer_name, customer_phone, ordered_at,
paid_at, items_count, total_quantity, total, paid_amount, balance, payment_status,
is_fully_paid, yard_status, dispatch_status, items: [{part_name, part_number, qr_code,
quantity, unit}], dispatch?`. It carries no unit prices, discount, payment mode or cashier.
`DispatchResource`: `id, dispatch_no (DSP-000042), order_id, order_no, customer_*,
items_count, total_quantity, total, paid_amount, payment_status_at_dispatch, status,
dispatched_by: {id, name}, dispatched_at, notes`.

## Reference data — Categories, Suppliers, Warehouses, Locations

All four follow the same full-resource shape (`index/store/show/update/destroy`), reads
gated by `view_inventory`, writes gated by `manage_settings`:

| Method | URL | Permission |
|---|---|---|
| GET | `/categories`, `/suppliers`, `/warehouses`, `/locations` | `view_inventory` |
| GET | `/categories/{id}`, `/suppliers/{id}`, `/warehouses/{id}`, `/locations/{id}` | `view_inventory` |
| POST / PUT / DELETE | same paths | `manage_settings` |

- **Categories** (`CategoryRequest`): `name` (unique), `code` (3 letters, unique, upper-cased
  automatically), `description?`, `is_active?`. Delete refuses (`409`) while any part is
  assigned to the category.
- **Suppliers** (`SupplierRequest`): `name` (unique), `contact_person?`, `phone?`, `email?`,
  `address?`, `notes?`, `is_active?`.
- **Warehouses** (`WarehouseRequest`): `name`, `code` (unique, upper-cased), `address?`,
  `is_active?`.
- **Locations** (`LocationRequest`): `warehouse_id`, `parent_id?`, `type`
  (`ZONE`|`RACK`|`SHELF`|`BIN`), `name`, `code` (unique per warehouse), `is_active?`. Server
  validates the hierarchy: a `ZONE` must have no parent; every other type must sit directly
  under the correct parent type (e.g. a `BIN` must have a `SHELF` parent) — enforced in
  `withValidator()`, not just documented.

Also, read-only, under `view_inventory`:

| Method | URL |
|---|---|
| GET | `/vehicle-makes` |
| GET | `/vehicle-models?make=<id>` |

Fixture data (seeded, not staff-editable) used for the part-fitment fields.

## Users & roles

| Method | URL | Permission | Notes |
|---|---|---|---|
| GET | `/roles` | `manage_users` | read-only; fixed by the seeder |
| GET | `/users` | `manage_users` | `?search=&state=active\|inactive&role=&sort=name\|email\|last_login_at\|created_at` |
| POST | `/users` | `manage_users` | |
| GET | `/users/{user}` | `manage_users` | |
| PUT | `/users/{user}` | `manage_users` | |
| PATCH | `/users/{user}/status` | `manage_users` | activate/deactivate |

`UserRequest`: `name`, `email` (unique), `role` (a role **slug**, must exist), `password`
(required on create, optional on update, min 8). Users are never permanently deleted —
every stock movement, adjustment, and order they created must keep pointing at a real
account — only deactivated (`is_active: false`), and `PATCH .../status` refuses to let a
user deactivate their own account (`422`).

## Audit log

| Method | URL | Permission |
|---|---|---|
| GET | `/audit-logs` | `manage_users` |

`?search=&action=created\|updated\|deleted\|stock\|auth&from=&to=`. Read-only — no update or
delete route exists for this endpoint by design; a log that can be edited is not a log.
`AuditLogResource`: `id, action, action_group, subject_type, subject_label, description,
ip_address, user: {id,name,role}, created_at`. Sensitive fields (passwords, tokens) are
stripped before a row is ever written, not just before it's returned.

## Bulk import

| Method | URL | Permission | Notes |
|---|---|---|---|
| GET | `/imports/template` | *public* | downloads the CSV template |
| POST | `/imports` | `create_inventory` | multipart `file` (CSV/TXT, max 10 MB) |
| GET | `/imports/{batch}` | `create_inventory` | batch status + preview |
| POST | `/imports/{batch}/confirm` | `create_inventory` | commits the batch |
| GET | `/imports/{batch}/errors` | `create_inventory` | downloads a CSV of rejected rows |
| POST | `/imports/photos` | `create_inventory` | multipart `file` (.zip, max 25MB) — see below |

Upload validates and previews a batch (new / update / error per row) without writing
anything; `confirm` is a separate, explicit step that actually creates/updates parts. Note:
the endpoint currently accepts CSV (or a `.csv`-saved export of the Excel template), not a
native `.xlsx` binary — full `.xlsx` parsing is a known follow-up (would add a
PhpSpreadsheet dependency) and is called out as such in `ImportController`.

**Bulk photos** (`POST /imports/photos`) is a separate, single-step operation — unlike the
CSV flow above, there is no preview/confirm: a photo carries none of the risk a bad price
or stock count does, so it applies immediately. Each file inside the uploaded `.zip` is
matched by filename (minus extension) against `part_number`, then `sku`, case-insensitive;
directory entries and `__MACOSX/` metadata are silently skipped. Response `data`:
`matched` (int), `unmatched` (list of filenames with no matching part), `rejected` (list of
`{file, reason}` — wrong content type, or a file over the 8MB per-entry cap). A part whose
old photo is shared with other parts (e.g. a category placeholder — see
`docs/architecture/phase-1-reference-analysis.md`) never has that file deleted from disk
while any other part still references it.

## Reports

| Method | URL | Permission |
|---|---|---|
| GET | `/reports/{type}` | `view_reports` |
| GET | `/reports/{type}/export` | `export_reports` |

`{type}` is one of `sales`, `inventory`, `payments`, `low-stock`. Both accept `?from=&to=`
(date range). `export` streams a CSV of the same rows the `show` endpoint returns, using
each report's own column set — never regenerated from scratch on the frontend.

## Settings

| Method | URL | Permission |
|---|---|---|
| GET | `/settings` | `manage_settings` |
| PUT | `/settings` | `manage_settings` |

Settings are stored as flat `group.key` rows (so a new setting never needs a migration) but
read/written here as the nested document the settings screen edits: `company: {name,
address, contact, registration_no}`, `inventory: {default_warehouse_id, default_min_stock,
currency}`, `qr: {prefix, padding, default_layout}`, `notifications: {low_stock,
out_of_stock, daily_summary, email}`. Every update is captured in the audit log with a full
before/after snapshot.
