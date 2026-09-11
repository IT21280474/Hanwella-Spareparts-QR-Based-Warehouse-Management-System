import { lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout, AuthLayout } from '@/layouts';
import { PERMISSIONS } from '@/constants/permissions';
import { GuestRoute, HomeRedirect, ProtectedRoute } from './ProtectedRoute';

/**
 * Route table.
 *
 * Every page is a lazy chunk, so a warehouse terminal downloads the scanner
 * screen only when someone opens it. Each protected branch declares the
 * permission its pages need; the API re-checks the same permission.
 */
const LoginPage = lazy(() => import('@/pages/auth/LoginPage'));
const ForgotPasswordPage = lazy(() => import('@/pages/auth/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('@/pages/auth/ResetPasswordPage'));

const DashboardPage = lazy(() => import('@/pages/dashboard/DashboardPage'));
const InventoryListPage = lazy(() => import('@/pages/inventory/InventoryListPage'));
const PartDetailPage = lazy(() => import('@/pages/inventory/PartDetailPage'));
const PartFormPage = lazy(() => import('@/pages/inventory/PartFormPage'));
const MovementsPage = lazy(() => import('@/pages/movements/MovementsPage'));
const StockInPage = lazy(() => import('@/pages/stock/StockInPage'));
const StockOutPage = lazy(() => import('@/pages/stock/StockOutPage'));
const ScannerPage = lazy(() => import('@/pages/scanner/ScannerPage'));
const NewSalePage = lazy(() => import('@/pages/sales/NewSalePage'));
const OrderSuccessPage = lazy(() => import('@/pages/sales/OrderSuccessPage'));
const OrdersPage = lazy(() => import('@/pages/orders/OrdersPage'));
const OrderDetailPage = lazy(() => import('@/pages/orders/OrderDetailPage'));
const BillPage = lazy(() => import('@/pages/orders/BillPage'));
const QrGeneratePage = lazy(() => import('@/pages/qr/QrGeneratePage'));
const QrSheetPage = lazy(() => import('@/pages/qr/QrSheetPage'));
const ImportPage = lazy(() => import('@/pages/imports/ImportPage'));
const ReportsPage = lazy(() => import('@/pages/reports/ReportsPage'));
const UsersPage = lazy(() => import('@/pages/admin/UsersPage'));
const AuditLogPage = lazy(() => import('@/pages/admin/AuditLogPage'));
const SettingsPage = lazy(() => import('@/pages/settings/SettingsPage'));

const SecurityLoginPage = lazy(() => import('@/pages/security/SecurityLoginPage'));
const SecurityDashboardPage = lazy(() => import('@/pages/security/SecurityDashboardPage'));
const YardStockPage = lazy(() => import('@/pages/security/YardStockPage'));
const DispatchHistoryPage = lazy(() => import('@/pages/security/DispatchHistoryPage'));
const OrderVerificationPage = lazy(() => import('@/pages/security/OrderVerificationPage'));

const ForbiddenPage = lazy(() => import('@/pages/errors/ForbiddenPage'));
const NotFoundPage = lazy(() => import('@/pages/errors/NotFoundPage'));

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<GuestRoute />}>
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
        </Route>
        <Route element={<AuthLayout variant="security" />}>
          <Route path="/security/login" element={<SecurityLoginPage />} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route index element={<HomeRedirect />} />

          <Route element={<ProtectedRoute permission={PERMISSIONS.VIEW_DASHBOARD} />}>
            <Route path="/dashboard" element={<DashboardPage />} />
          </Route>

          <Route element={<ProtectedRoute permission={PERMISSIONS.VIEW_INVENTORY} />}>
            <Route path="/inventory" element={<InventoryListPage />} />
            <Route path="/inventory/:id" element={<PartDetailPage />} />
          </Route>

          <Route element={<ProtectedRoute permission={PERMISSIONS.CREATE_INVENTORY} />}>
            <Route path="/inventory/new" element={<PartFormPage mode="create" />} />
          </Route>

          <Route element={<ProtectedRoute permission={PERMISSIONS.UPDATE_INVENTORY} />}>
            <Route path="/inventory/:id/edit" element={<PartFormPage mode="edit" />} />
          </Route>

          <Route element={<ProtectedRoute permission={PERMISSIONS.VIEW_TRANSACTIONS} />}>
            <Route path="/movements" element={<MovementsPage />} />
            <Route path="/orders" element={<OrdersPage />} />
            <Route path="/orders/:id" element={<OrderDetailPage />} />
            <Route path="/orders/:id/bill" element={<BillPage />} />
          </Route>

          <Route element={<ProtectedRoute permission={PERMISSIONS.CREATE_STOCK_IN} />}>
            <Route path="/stock/in" element={<StockInPage />} />
          </Route>

          <Route element={<ProtectedRoute permission={PERMISSIONS.CREATE_STOCK_OUT} />}>
            <Route path="/stock/out" element={<StockOutPage />} />
            <Route path="/sales/new" element={<NewSalePage />} />
            <Route path="/sales/:id/complete" element={<OrderSuccessPage />} />
          </Route>

          <Route element={<ProtectedRoute permission={PERMISSIONS.SCAN_QR} />}>
            <Route path="/scan" element={<ScannerPage />} />
          </Route>

          <Route element={<ProtectedRoute permission={PERMISSIONS.PRINT_LABELS} />}>
            <Route path="/qr-labels" element={<QrGeneratePage />} />
            <Route path="/qr-labels/sheet" element={<QrSheetPage />} />
          </Route>

          <Route element={<ProtectedRoute permission={PERMISSIONS.CREATE_INVENTORY} />}>
            <Route path="/imports" element={<ImportPage />} />
          </Route>

          <Route element={<ProtectedRoute permission={PERMISSIONS.VIEW_REPORTS} />}>
            <Route path="/reports" element={<ReportsPage />} />
          </Route>

          <Route element={<ProtectedRoute permission={PERMISSIONS.MANAGE_USERS} />}>
            <Route path="/users" element={<UsersPage />} />
            <Route path="/audit-logs" element={<AuditLogPage />} />
          </Route>

          <Route element={<ProtectedRoute permission={PERMISSIONS.MANAGE_SETTINGS} />}>
            <Route path="/settings" element={<SettingsPage />} />
          </Route>

          {/* The yard gate. The API re-checks view_yard_stock / dispatch_orders on every call. */}
          <Route element={<ProtectedRoute permission={PERMISSIONS.VIEW_YARD_STOCK} />}>
            <Route path="/security" element={<Navigate to="/security/dashboard" replace />} />
            <Route path="/security/dashboard" element={<SecurityDashboardPage />} />
            <Route path="/security/yard-stock" element={<YardStockPage />} />
            <Route path="/security/dispatch-history" element={<DispatchHistoryPage />} />
            <Route path="/security/orders/:id" element={<OrderVerificationPage />} />
          </Route>

          <Route path="/403" element={<ForbiddenPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
    </Routes>
  );
}
