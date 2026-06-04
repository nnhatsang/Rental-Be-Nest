export const PermissionCode = {
  OrdersRead: 'orders.read',
  OrdersCreate: 'orders.create',
  OrdersUpdate: 'orders.update',
  OrdersUpdateStatus: 'orders.update_status',
  OrdersCancel: 'orders.cancel',
  OrdersRecordPayment: 'orders.record_payment',
  OrdersRefund: 'orders.refund',

  CustomersRead: 'customers.read',
  CustomersCreate: 'customers.create',
  CustomersUpdate: 'customers.update',

  ProductsRead: 'products.read',
  ProductsCreate: 'products.create',
  ProductsUpdate: 'products.update',
  ProductsDelete: 'products.delete',

  AssetsRead: 'assets.read',
  AssetsCreate: 'assets.create',
  AssetsUpdate: 'assets.update',
  AssetsDelete: 'assets.delete',

  UsersRead: 'users.read',
  UsersCreate: 'users.create',
  UsersUpdate: 'users.update',
  UsersDelete: 'users.delete',

  RolesRead: 'roles.read',
  RolesCreate: 'roles.create',
  RolesUpdate: 'roles.update',
  RolesDelete: 'roles.delete',

  ReportsRead: 'reports.read',
} as const;

export type PermissionCode = (typeof PermissionCode)[keyof typeof PermissionCode];

export const RoleCode = {
  Admin: 'ADMIN',
  Manager: 'MANAGER',
  Staff: 'STAFF',
  Viewer: 'VIEWER',
} as const;

export type RoleCode = (typeof RoleCode)[keyof typeof RoleCode];

export const PERMISSION_CODES = Object.values(PermissionCode);

const MANAGER_EXCLUDED_PERMISSIONS: ReadonlySet<PermissionCode> = new Set([
  PermissionCode.UsersCreate,
  PermissionCode.UsersUpdate,
  PermissionCode.UsersDelete,
  PermissionCode.RolesCreate,
  PermissionCode.RolesUpdate,
  PermissionCode.RolesDelete,
]);

export const ROLE_SEEDS = [
  {
    code: RoleCode.Admin,
    name: 'Administrator',
    description: 'Full system access',
    permissions: [...PERMISSION_CODES],
  },
  {
    code: RoleCode.Manager,
    name: 'Manager',
    description: 'Manage rental operations and reports',
    permissions: PERMISSION_CODES.filter((permission) => !MANAGER_EXCLUDED_PERMISSIONS.has(permission)),
  },
  {
    code: RoleCode.Staff,
    name: 'Staff',
    description: 'Operate customers, products, orders, and payments',
    permissions: [
      PermissionCode.OrdersRead,
      PermissionCode.OrdersCreate,
      PermissionCode.OrdersUpdate,
      PermissionCode.OrdersUpdateStatus,
      PermissionCode.OrdersRecordPayment,
      PermissionCode.CustomersRead,
      PermissionCode.CustomersCreate,
      PermissionCode.CustomersUpdate,
      PermissionCode.ProductsRead,
      PermissionCode.AssetsRead,
    ],
  },
  {
    code: RoleCode.Viewer,
    name: 'Viewer',
    description: 'Read-only admin access',
    permissions: [
      PermissionCode.OrdersRead,
      PermissionCode.CustomersRead,
      PermissionCode.ProductsRead,
      PermissionCode.AssetsRead,
      PermissionCode.ReportsRead,
    ],
  },
] as const;
