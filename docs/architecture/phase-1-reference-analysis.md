# Phase 1 — Reference Analysis

**Source of truth inspected:** `Hanwella Spareparts WMS (offline).html` (1.71 MB)
**QR label PDF:** not supplied — label spec reconstructed from the reference `qrSheet` screen (see §7).

## 0. How the reference was read

The HTML is not a static page. It is a self-unpacking Claude-artifact bundle: a loader
script plus a gzip+base64 manifest. Unpacking it yielded

| Artifact | Size | What it is |
|---|---|---|
| `template.html` | 294 KB | Host document: font faces, global CSS, full rendered DOM |
| `app-source.jsx` | 60.6 KB / 1,084 lines | **The actual application source** — all state, logic and derived view-models |
| 22 x `.woff2` | — | IBM Plex Sans + IBM Plex Mono (400/500/600/700) |

So the design was not guessed from screenshots: every screen, colour, rule and label
below is read directly from the reference source.

Runtime notes read from source: React 18.3.1 UMD, a `qrcode` generator producing an SVG
data-URI (`cellSize:4, margin:2`, error-correction level **M**), deterministic LCG mock
data (seed `20260907`), fixed "today" of 2026-09-07 15:40.

## 1. UI analysis

### 1.1 Shell

- **Login** — full-height 2-column split, `minmax(0,1.05fr) / minmax(0,1fr)`.
  Left panel `#14161A` dark, 56px padding: `SJL` logo tile (36px, `#A6E635`, radius 8),
  brand line, eyebrow `QR WAREHOUSE MANAGEMENT` (12px/600/.14em, lime), 44px display
  headline "Scan a part. Bill it. Stock updates itself.", three lime-dotted feature
  bullets, footer credit. Right panel white, form capped at 380px.
  States: `login` -> `forgot` -> `sent` (success check in a 48px `#E6F4F1` disc).
  Role picker is a 2-up segmented control (Admin / Sales staff) rendered as an absolute
  filled overlay on the active button. Sign-in shows an inline lime spinner.
- **Sidebar** — 232px, `#14161A`, sticky, full viewport height, `width .16s` transition.
  60px brand header with a 30px `SJL` tile, then a scrolling `<nav>` at 14px/10px padding
  and 2px item gaps. Items are 38px tall, radius 7, idle `#C4C9D0`. The **active state is
  two absolutely-positioned layers**: a `rgba(166,230,53,.13)` fill and a 2.5px lime rail
  inset 9px from top and bottom. Group captions are 10px/600/.13em `#5C636D`.
- **Nav groups** — `OVERVIEW` (Dashboard, New sale, Scan QR) · `INVENTORY` (All spare
  parts, Add spare part, Stock movement) · `SALES` (Orders) · `QR & BULK` (Generate QR
  labels, Excel bulk upload, Reports, Settings). "New sale" carries a lime pill cart
  badge.
- **Header** — 60px, white, sticky, `z-index:40`, 1px `#E3E6EA` bottom rule, 20px
  horizontal padding, `data-noprint`. Holds the sidebar toggle (32px outlined square),
  breadcrumb + page title, global search with a live dropdown (max 6 part hits, closes on
  Escape), a notification bell with alert count, and the user cluster.
- **Main** — `flex:1; min-width:0; padding:22px 24px 40px`, `data-print-root`.
- **Toasts** — bottom stack, 3.6 s auto-dismiss, `ok` = lime `#A6E635`/`#1A2200`,
  `err` = `#B42318`/white, mark check or bang.
- **Modals** — 5 distinct: adjust stock, clear cart, cancel order, delete part, large-batch
  confirm. Backdrop shadow `0 24px 60px rgba(20,22,26,.3)`. Escape closes.

### 1.2 The 17 screen states

`login` `dashboard` `inventory` `product` `form` `pos` `scan` `orders` `order` `bill`
`qrGen` `qrSheet` `excel` `reports` `settings` `success` `stockHistory`

- **Dashboard** — 7 KPI tiles (Spare parts, Units on hand, Low stock, Out of stock,
  Today's orders, Today's sales, Pending payments), each with value, sub-label and a
  tinted trend chip. Then a 14-day sales bar trend (max bar 140px, today in `#4D7C0F`,
  rest `#D7DCE0`, hover tip), a payment-split stacked bar, top-5 parts by units sold with
  proportional bars, a low/out-of-stock watchlist, a recent-order activity feed, and an
  alert list.
- **Inventory** — status tabs with counts (All / In stock / Low / Out), category select,
  search across name + part-no + QR + SKU + category, sortable columns
  (name, price, stock, updated — arrow indicator, click toggles direction), pagination
  (windowed 5 page buttons, Previous/Next), a summary count line, an empty state with a
  "clear filters" action, and per-row quick actions (add-to-order, adjust stock, open) as
  29px outlined icon buttons. Row density is prop-driven (`comfortable` 8px / `compact` 5px).
- **Product detail** — QR block with the code image, stock gauge bar coloured by status,
  price/cost/margin/value tiles, supplier + bin, created/updated dates, 90-day sold count,
  and a per-part stock-movement table. Actions: edit, adjust, add to order, print QR, delete.
- **Add/Edit part** — validated form (name, part no, price, opening stock required),
  inline red messages and `#B42318` borders, live "next QR identity" preview panel.
- **POS / New sale** — searchable part picker (max 7 hits), recent-scan strip, cart lines
  with plus/minus/quantity/remove and an "n left after sale" hint, quantity capped at stock,
  customer name/phone, discount, payment status segmented control (Paid / Pending /
  Partially paid), payment mode select, totals, checkout.
- **Scanner** — four states: `idle`, `scanning`, `found`, `notfound`. Camera viewport with
  an animated sweep line (`sc-line`, +/-42px), torch toggle, manual code entry fallback,
  result card with quantity stepper and "add to order", out-of-stock block.
- **Orders / order detail / bill** — payment-status tabs with counts, search, per-order
  totals and outstanding amount; detail adds a 4-step timeline and mark-paid / mark-pending
  / cancel; **bill** is a print-ready 794px paper with a company block.
- **QR generate -> sheet** — from/count inputs, layout select, computed range and sheet
  count, unknown-identity warning, 8-label preview, batch confirm over 80, then the A4 sheet.
- **Excel bulk upload** — 6-step wizard (Upload -> Validate -> Preview -> Resolve errors ->
  Confirm -> Complete) with a summary tile row, a preview table marking New/Update/error
  rows, a grouped error list, template + error-report downloads.
- **Reports** — 4 tabs (Sales, Inventory, Payments, Low stock); each supplies its own 4
  KPIs, its own 5 columns, its own rows and a footnote. Export action.
- **Settings** — 4 tabs (Warehouse, QR & numbering, Users, Notifications) with a user table.
- **Stock movement** — global feed filtered by type (All / Sale / Stock received / Manual
  adjustment / Damage-write-off).

### 1.3 States present in the reference

Loading (sign-in spinner, upload spinner, scanning), empty (inventory, orders, movement,
recent scans, search), error (field validation, not-found scan, rejected import rows),
confirmation (5 modals), success (order complete, import complete, reset-link sent).
Focus rings are `2px solid #4D7C0F` offset 1px. Icon buttons carry `title` + `aria-label`.

## 2. Design-system summary

### Colour

| Token | Value | Role |
|---|---|---|
| `--ink` | `#14161A` | Primary text, sidebar, dark buttons |
| `--ink-2` | `#3A4048` | Secondary text, icon-button glyphs |
| `--muted` | `#6E7681` | Meta text, table headers |
| `--muted-2` | `#9AA1AB` | Placeholders, faint meta |
| `--line` | `#E3E6EA` | Card + table borders, header rule |
| `--line-2` | `#DCE0E5` | Input borders |
| `--surface` | `#FFFFFF` | Cards |
| `--bg` | `#F6F7F8` | App background |
| `--bg-2` | `#FAFBFB` | Table header fill |
| `--bg-3` | `#F1F3F4` / `#EEF0F2` | Hover, neutral chips, grid gaps |
| `--brand` | `#A6E635` | Lime accent — logo, active rail, badges, ok toast |
| `--brand-ink` | `#1A2200` | Text on lime |
| `--link` | `#4D7C0F` | Links, focus ring, today's bar |
| `--link-hover` | `#3F6212` | Link hover |

Status pairs (fg / bg): in-stock `#0F766E`/`#E6F4F1` · low `#B45309`/`#FDF3E3` ·
out & cancelled `#B42318`/`#FDECEA` · info & partially-paid `#1D4ED8`/`#E8EDFD` ·
neutral `#3A4048`/`#F1F3F4`.

### Type

`IBM Plex Sans` for UI, `IBM Plex Mono` for every machine identifier (QR code, part
number, SKU, bin). Scale actually used: 8, 10, 10.5, 11, 11.5, 12, 12.5, 13, 13.5, 14,
15, 15.5, 16, 17, 19, 20, 22, 26, 44 px. Weights 400/500/600/700. Display sizes carry
negative tracking (`-.02em`/`-.03em`); eyebrows and table headers carry positive
tracking (`.06em`–`.14em`). Note the deliberate half-pixel steps — 12.5px and 13.5px are
among the most common sizes in the app and must be preserved.

### Space, radius, elevation

4px base step. Radii: 2 (label cells), 4–5 (chips), **6 (inputs/buttons)**, 7 (nav items,
icon buttons), **9 (cards)**, 10–11 (pills), 50% (dots/avatars).
Shadows: `0 1px 2px rgba(20,22,26,.09)` raised control · `0 2px 14px rgba(20,22,26,.07)`
paper · `0 12px 28px rgba(20,22,26,.13)` popover · `0 24px 60px rgba(20,22,26,.3)` modal.
Controls: input/select 42px (36–38px compact), primary button 44px, table icon button 29px.
Card surface: `#fff` + 1px `#E3E6EA` + radius 9 + 16–20px padding.
Table header cell: sticky, `#FAFBFB`, 9px/14px padding, 10.5px/600/.09em `#6E7681`.

### Motion

`sc-line` scanner sweep · `sc-pop` modal/success entry (.18s) · `sc-slide` toast entry ·
`sc-shim` skeleton shimmer · `sc-spin` spinner (.7s linear).

### Responsive + print

Everything already uses `repeat(auto-fit, minmax(...,1fr))` (128–220px floors) and
`minmax(0,1fr)` guards — the grid system is intrinsic, not breakpoint-driven. Print CSS is
first-class: `[data-noprint]` hides chrome, `[data-print-root]` becomes the page,
`[data-paper]` drops shadow/margin/border.

## 3. Application / module list

Reference-derived: Auth · Dashboard · Parts & Inventory · Stock adjustments · Stock
movements · QR generation & label sheets · QR scanning · POS / sales orders · Order detail
& printable bill · Excel bulk import · Reports (4) · Settings (4) · Users.

## 7. QR specification (reconstructed from `qrSheet`)

- Identifier: `SJL-` + zero-padded 5-digit sequence -> `SJL-00001` ... `SJL-01000`.
- **One QR identity per spare-part type**, not per physical unit. The reference part
  description states it outright: "one QR identity covers the full part type across all
  warehouse bins." The sequence is bound to the part's own id.
- Encoding: error-correction level **M**, `cellSize:4`, `margin:2`, rendered as SVG.
- Sheet: 794px-wide A4 paper (= 210mm at 96dpi), 38px/34px padding, header line
  "Hanwella Spareparts Warehouse · QR inventory labels" + range in mono + date, then a
  `repeat(4,1fr)` grid at 6px gap.
- Label cell: 1px solid `#14161A`, radius 2px, 6px padding, `break-inside:avoid`;
  48x48px QR at left; right column = code (mono 10.5px/700), part number (mono 8px
  `#3A4048`), part name (8px `#6E7681`, 2-line clamp).
- 4 x 10 = **40 labels per A4 sheet** (default). Alternates offered: 3 x 8 (24) and
  5 x 13 (65). Batches over 80 labels prompt for confirmation. Max 200 per run.
- Saving a PDF is delegated to the browser print dialog.

## 9. Open decisions — resolved

1. **The QR-label PDF was never supplied.** *(Resolved.)* `SJL_inventory_QR_labels_A4.pdf`
   was subsequently supplied and reviewed — 1,000 sequential labels, `SJL-00001` through
   `SJL-01000`, one QR per identifier. It confirms the reconstruction above exactly: no
   change to the spec in §7 was needed.
2. **The reference app and the master prompt describe partly different systems.**
   *(Resolved as a deliberate hybrid, not a conflict.)* The reference is a counter-sales POS
   built on inventory; the master prompt specifies a goods-movement WMS. The implementation
   keeps both: goods-movement operations (`stock_movements`, `inventory_adjustments`,
   `StockController` — stock in/out/transfer/adjust) and the POS side (`sales_orders`,
   `sales_order_items`, `OrderController` — scan-to-bill, payment status) are both
   implemented, and both write through the same `StockService`, which is the only place a
   quantity is ever touched. There is one stock ledger and one source of truth for "how many
   units are on hand," not two competing systems that could disagree.

Sections 4–6 and 8 (architecture, ER, API map, phases) are recorded in
`system-architecture.md`, and the fuller API/ER references now live in `docs/api/` and
`docs/database/`.
