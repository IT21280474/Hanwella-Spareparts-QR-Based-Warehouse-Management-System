/**
 * Every TanStack Query key in one place, so an invalidation after a mutation
 * cannot miss a cache entry because two files spelled the key differently.
 */
export const queryKeys = {
  dashboard: () => ['dashboard'],
  securityDashboard: () => ['dashboard', 'security'],

  parts: {
    all: () => ['parts'],
    list: (params) => ['parts', 'list', params],
    detail: (id) => ['parts', 'detail', String(id)],
    movements: (id, params) => ['parts', 'movements', String(id), params],
  },

  inventory: {
    all: () => ['inventory'],
    list: (params) => ['inventory', 'list', params],
  },

  movements: {
    all: () => ['movements'],
    list: (params) => ['movements', 'list', params],
  },

  orders: {
    all: () => ['orders'],
    list: (params) => ['orders', 'list', params],
    detail: (id) => ['orders', 'detail', String(id)],
  },

  qr: {
    labels: (params) => ['qr', 'labels', params],
    code: (code) => ['qr', 'code', code],
    recentScans: () => ['qr', 'recent-scans'],
  },

  reference: {
    categories: (params) => ['categories', params],
    suppliers: (params) => ['suppliers', params],
    warehouses: (params) => ['warehouses', params],
    locations: (params) => ['locations', params],
  },

  users: {
    all: () => ['users'],
    list: (params) => ['users', 'list', params],
    detail: (id) => ['users', 'detail', String(id)],
    roles: () => ['roles'],
  },

  auditLogs: (params) => ['audit-logs', params],

  imports: {
    detail: (id) => ['imports', String(id)],
  },

  reports: (type, params) => ['reports', type, params],

  settings: () => ['settings'],

  notifications: (params) => ['notifications', params],
};
