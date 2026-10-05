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
  CustomersDelete: 'customers.delete',

  ProductsRead: 'products.read',
  ProductsCreate: 'products.create',
  ProductsUpdate: 'products.update',
  ProductsDelete: 'products.delete',

  CategoriesRead: 'categories.read',
  CategoriesCreate: 'categories.create',
  CategoriesUpdate: 'categories.update',
  CategoriesDelete: 'categories.delete',

  BrandsRead: 'brands.read',
  BrandsCreate: 'brands.create',
  BrandsUpdate: 'brands.update',
  BrandsDelete: 'brands.delete',

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
  RolesAssign: 'roles.assign',

  SettingsRead: 'settings.read',
  SettingsUpdate: 'settings.update',

  EmailTemplatesRead: 'email_templates.read',
  EmailTemplatesUpdate: 'email_templates.update',
  EmailTemplatesPreview: 'email_templates.preview',
  EmailTemplatesSendTest: 'email_templates.send_test',

  ReportsRead: 'reports.read',

  FilesUpload: 'files.upload',
  FilesRead: 'files.read',
  FilesDelete: 'files.delete',
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
  PermissionCode.EmailTemplatesUpdate,
  PermissionCode.EmailTemplatesSendTest,
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
      PermissionCode.CategoriesRead,
      PermissionCode.BrandsRead,
      PermissionCode.FilesUpload,
      PermissionCode.FilesRead,
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
      PermissionCode.CategoriesRead,
      PermissionCode.BrandsRead,
      PermissionCode.ReportsRead,
      PermissionCode.FilesRead,
    ],
  },
] as const;
