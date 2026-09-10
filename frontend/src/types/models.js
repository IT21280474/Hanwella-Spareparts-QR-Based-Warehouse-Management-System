/**
 * Data contracts.
 *
 * The frontend reads exactly these fields and nothing else — if the API stops
 * sending one, the break shows up here first. Each typedef mirrors one Laravel
 * API Resource; the pairing is documented in `docs/api/`.
 *
 * This file intentionally exports no runtime values.
 */

/**
 * @typedef {Object} User
 * @property {number} id
 * @property {string} name
 * @property {string} email
 * @property {string} initials
 * @property {boolean} is_active
 * @property {string|null} last_login_at   ISO 8601
 * @property {string|null} created_at
 * @property {{slug: string, name: string}} [role]
 * @property {string[]} [permissions]
 */

/**
 * @typedef {Object} NamedRef
 * @property {number} id
 * @property {string} name
 */

/**
 * @typedef {Object} Part
 * @property {number} id
 * @property {string} part_number
 * @property {string} sku
 * @property {string} name
 * @property {string} description
 * @property {string|null} qr_code            e.g. "SJL-00001"
 * @property {NamedRef|null} category
 * @property {NamedRef|null} supplier
 * @property {string|null} vehicle_make
 * @property {string|null} vehicle_model
 * @property {string} unit
 * @property {number} selling_price
 * @property {number} cost_price
 * @property {number} min_stock
 * @property {number} quantity                on hand across every bin
 * @property {string|null} bin                primary bin code
 * @property {'ACTIVE'|'DISCONTINUED'} status
 * @property {number} [sold_90d]
 * @property {number} [stock_value]
 * @property {string} created_at
 * @property {string} updated_at
 */

/**
 * @typedef {Object} StockMovement
 * @property {number} id
 * @property {'STOCK_IN'|'STOCK_OUT'|'ADJUSTMENT'|'TRANSFER'|'RETURN'|'SALE'} type
 * @property {number} quantity                signed
 * @property {number} quantity_before
 * @property {number} quantity_after
 * @property {string|null} reference_no
 * @property {string|null} reason
 * @property {NamedRef|null} part
 * @property {string|null} part_number
 * @property {string|null} qr_code
 * @property {NamedRef|null} warehouse
 * @property {string|null} location
 * @property {NamedRef|null} user
 * @property {string} created_at
 */

/**
 * @typedef {Object} InventoryAdjustment
 * @property {number} id
 * @property {'STOCK_RECEIVED'|'MANUAL_ADJUSTMENT'|'SALE_CORRECTION'|'DAMAGE_WRITE_OFF'} adjustment_type
 * @property {number} quantity_before
 * @property {number} adjustment
 * @property {number} quantity_after
 * @property {string|null} reason
 * @property {string|null} note
 * @property {NamedRef|null} user
 * @property {string} created_at
 */

/**
 * @typedef {Object} SalesOrderItem
 * @property {number} id
 * @property {number|null} part_id
 * @property {string} part_name        snapshot at time of sale
 * @property {string} part_number      snapshot
 * @property {string|null} qr_code     snapshot
 * @property {number} unit_price       snapshot
 * @property {number} quantity
 * @property {number} line_total
 * @property {number|null} [part_quantity_now]
 */

/**
 * @typedef {Object} SalesOrder
 * @property {number} id
 * @property {string} order_no
 * @property {string} customer_name
 * @property {string|null} customer_phone
 * @property {number} subtotal
 * @property {number} discount
 * @property {number} total
 * @property {number} paid_amount
 * @property {number} outstanding
 * @property {'PAID'|'PENDING'|'PARTIALLY_PAID'|'CANCELLED'} payment_status
 * @property {'CASH'|'CARD'|'BANK_TRANSFER'|'CREDIT'} payment_mode
 * @property {string} status
 * @property {NamedRef|null} cashier
 * @property {string} ordered_at
 * @property {SalesOrderItem[]} [items]
 */

/**
 * @typedef {Object} QrLabel
 * @property {string} code
 * @property {number} sequence
 * @property {boolean} assigned
 * @property {string|null} part_name
 * @property {string|null} part_number
 * @property {string|null} bin
 */

/**
 * @typedef {Object} DashboardSummary
 * @property {{parts: number, units_on_hand: number, stock_value: number,
 *   low_stock: number, out_of_stock: number, orders_today: number,
 *   sales_today: number, pending_payments: number,
 *   pending_orders: number, parts_added_this_month: number}} kpis
 * @property {{date: string, total: number, orders: number}[]} sales_trend
 * @property {{status: string, amount: number, orders: number}[]} payment_split
 * @property {{part_id: number, name: string, units: number}[]} top_parts
 * @property {Part[]} watchlist
 * @property {SalesOrder[]} recent_orders
 * @property {{level: string, text: string, meta: string, link: string|null}[]} alerts
 */

/**
 * @typedef {Object} ImportBatch
 * @property {number} id
 * @property {string} filename
 * @property {'VALIDATING'|'VALIDATED'|'IMPORTING'|'COMPLETED'|'FAILED'} status
 * @property {number} total_rows
 * @property {number} valid_rows
 * @property {number} created_count
 * @property {number} updated_count
 * @property {number} duplicate_count
 * @property {number} rejected_count
 * @property {{row: number, part_number: string, name: string, quantity: string,
 *   price: string, outcome: string, tone: string}[]} [preview]
 * @property {{rows: string, message: string}[]} [errors]
 */

/**
 * @typedef {Object} PageMeta
 * @property {number} current_page
 * @property {number} per_page
 * @property {number} total
 * @property {number} last_page
 * @property {number|null} from
 * @property {number|null} to
 */

export {};
