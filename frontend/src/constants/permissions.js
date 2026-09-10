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

  VIEW_REPORTS: 'view_reports',
  EXPORT_REPORTS: 'export_reports',

  MANAGE_USERS: 'manage_users',
  MANAGE_SETTINGS: 'manage_settings',
};

export const ROLES = {
  ADMIN: 'ADMIN',
  MANAGER: 'MANAGER',
  WAREHOUSE_STAFF: 'WAREHOUSE_STAFF',
  VIEWER: 'VIEWER',
};
