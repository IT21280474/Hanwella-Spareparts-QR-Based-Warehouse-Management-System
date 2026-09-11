import {
  ArrowDownToLine,
  ArrowLeftRight,
  ArrowUpFromLine,
  ChartColumnIncreasing,
  FileSpreadsheet,
  LayoutDashboard,
  Package,
  Plus,
  QrCode,
  ReceiptText,
  ScanLine,
  ScrollText,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Users,
} from 'lucide-react';
import { PERMISSIONS } from './permissions';

/**
 * Sidebar structure.
 *
 * `permission` hides an item the signed-in user cannot use. That is a tidiness
 * measure — the route guard and the API both check again.
 */
export const NAV_GROUPS = [
  {
    caption: 'Overview',
    items: [
      { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, permission: PERMISSIONS.VIEW_DASHBOARD },
      { to: '/security', label: 'Dispatch gate', icon: ShieldCheck, permission: PERMISSIONS.DISPATCH_ORDERS },
      {
        to: '/sales/new',
        label: 'New sale',
        icon: ShoppingCart,
        permission: PERMISSIONS.CREATE_STOCK_OUT,
        badge: 'cart',
      },
      { to: '/scan', label: 'Scan QR', icon: ScanLine, permission: PERMISSIONS.SCAN_QR },
    ],
  },
  {
    caption: 'Inventory',
    items: [
      { to: '/inventory', label: 'All spare parts', icon: Package, permission: PERMISSIONS.VIEW_INVENTORY, end: true },
      { to: '/inventory/new', label: 'Add spare part', icon: Plus, permission: PERMISSIONS.CREATE_INVENTORY },
      { to: '/stock/in', label: 'Stock in', icon: ArrowDownToLine, permission: PERMISSIONS.CREATE_STOCK_IN },
      { to: '/stock/out', label: 'Stock out', icon: ArrowUpFromLine, permission: PERMISSIONS.CREATE_STOCK_OUT },
      { to: '/movements', label: 'Stock movement', icon: ArrowLeftRight, permission: PERMISSIONS.VIEW_TRANSACTIONS },
    ],
  },
  {
    caption: 'Sales',
    items: [{ to: '/orders', label: 'Orders', icon: ReceiptText, permission: PERMISSIONS.VIEW_TRANSACTIONS }],
  },
  {
    caption: 'QR & bulk',
    items: [
      { to: '/qr-labels', label: 'Generate QR labels', icon: QrCode, permission: PERMISSIONS.PRINT_LABELS },
      { to: '/imports', label: 'Excel bulk upload', icon: FileSpreadsheet, permission: PERMISSIONS.CREATE_INVENTORY },
      { to: '/reports', label: 'Reports', icon: ChartColumnIncreasing, permission: PERMISSIONS.VIEW_REPORTS },
    ],
  },
  {
    caption: 'Administration',
    items: [
      { to: '/users', label: 'Users', icon: Users, permission: PERMISSIONS.MANAGE_USERS },
      { to: '/audit-logs', label: 'Audit log', icon: ScrollText, permission: PERMISSIONS.MANAGE_USERS },
      { to: '/settings', label: 'Settings', icon: Settings, permission: PERMISSIONS.MANAGE_SETTINGS },
    ],
  },
];

/**
 * Breadcrumb and page title per route, keyed by the most specific match.
 * The header reads this so titles stay consistent with the sidebar.
 */
export const ROUTE_TITLES = [
  { match: /^\/dashboard/, crumb: 'Overview', title: 'Warehouse dashboard' },
  { match: /^\/security/, crumb: 'Overview', title: 'Dispatch gate' },
  { match: /^\/inventory\/new/, crumb: 'Inventory', title: 'Add spare part' },
  { match: /^\/inventory\/\d+\/edit/, crumb: 'Inventory', title: 'Edit spare part' },
  { match: /^\/inventory\/\d+/, crumb: 'Inventory · Spare part', title: 'Spare part' },
  { match: /^\/inventory/, crumb: 'Inventory', title: 'All spare parts' },
  { match: /^\/movements/, crumb: 'Inventory', title: 'Stock movement' },
  { match: /^\/stock\/in/, crumb: 'Inventory', title: 'Stock in' },
  { match: /^\/stock\/out/, crumb: 'Inventory', title: 'Stock out' },
  { match: /^\/sales\/new/, crumb: 'Sales', title: 'New sale' },
  { match: /^\/orders\/\d+\/bill/, crumb: 'Sales · Orders', title: 'Customer bill' },
  { match: /^\/orders\/\d+/, crumb: 'Sales · Orders', title: 'Order' },
  { match: /^\/orders/, crumb: 'Sales', title: 'Orders' },
  { match: /^\/scan/, crumb: 'QR', title: 'Scan a part' },
  { match: /^\/qr-labels\/sheet/, crumb: 'QR · Generate', title: 'Label sheet preview' },
  { match: /^\/qr-labels/, crumb: 'QR', title: 'Generate QR labels' },
  { match: /^\/imports/, crumb: 'Bulk operations', title: 'Excel upload' },
  { match: /^\/reports/, crumb: 'Reports', title: 'Reports' },
  { match: /^\/users/, crumb: 'Administration', title: 'Users' },
  { match: /^\/audit-logs/, crumb: 'Administration', title: 'Audit log' },
  { match: /^\/settings/, crumb: 'Settings', title: 'System settings' },
];

export function titleForPath(pathname) {
  return ROUTE_TITLES.find((entry) => entry.match.test(pathname)) || { crumb: '', title: '' };
}
