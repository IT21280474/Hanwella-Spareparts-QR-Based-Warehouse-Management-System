/**
 * The permission vocabulary, mirroring `App\Models\Permission::CATALOGUE`.
 *
 * These drive which controls the UI renders. They are a usability layer only —
 * every protected endpoint is authorised again on the server, so hiding a
 * button here never stands in for an authorisation check.
 */
export const PERMISSIONS = {
  VIEW_DASHBOARD: 'view_dashboard',

  VIEW_INVENTORY: 'view_inventory',
  CREATE_INVENTORY: 'create_inventory',
  UPDATE_INVENTORY: 'update_inventory',
  DELETE_INVENTORY: 'delete_inventory',

  SCAN_QR: 'scan_qr',
  PRINT_LABELS: 'print_labels',

  VIEW_TRANSACTIONS: 'view_transactions',
  CREATE_STOCK_IN: 'create_stock_in',
  CREATE_STOCK_OUT: 'create_stock_out',
  DISPATCH_ORDERS: 'dispatch_orders',

  VIEW_REPORTS: 'view_reports',
  EXPORT_REPORTS: 'export_reports',

  MANAGE_USERS: 'manage_users',
  MANAGE_SETTINGS: 'manage_settings',
};

export const ROLES = {
  ADMIN: 'ADMIN',
  MANAGER: 'MANAGER',
  WAREHOUSE_STAFF: 'WAREHOUSE_STAFF',
  SALES_PERSON: 'SALES_PERSON',
  SECURITY: 'SECURITY',
  VIEWER: 'VIEWER',
};

/**
 * Where a signed-in user lands, in priority order. Not every role can see the
 * dashboard (e.g. SECURITY only has `view_transactions` + `dispatch_orders`) —
 * without this, a role whose first permission isn't VIEW_DASHBOARD gets sent
 * to a page it's then immediately 403'd out of, which looks like a broken login.
 */
const HOME_ROUTE_PRIORITY = [
  [PERMISSIONS.VIEW_DASHBOARD, '/dashboard'],
  [PERMISSIONS.DISPATCH_ORDERS, '/security'],
  [PERMISSIONS.VIEW_TRANSACTIONS, '/orders'],
  [PERMISSIONS.VIEW_INVENTORY, '/inventory'],
  [PERMISSIONS.SCAN_QR, '/scan'],
  [PERMISSIONS.VIEW_REPORTS, '/reports'],
  [PERMISSIONS.MANAGE_USERS, '/users'],
  [PERMISSIONS.MANAGE_SETTINGS, '/settings'],
];

export function homeRouteFor(can) {
  const match = HOME_ROUTE_PRIORITY.find(([permission]) => can(permission));
  return match ? match[1] : '/403';
}
