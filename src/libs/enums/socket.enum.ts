export enum ESocketEmit {
  PERMISSIONS_UPDATED = 'permissions:updated',
  AVAILABILITY_CHANGED = 'availability:changed',
}

export enum EAvailabilityChangeReason {
  ORDER_CONFIRMED = 'ORDER_CONFIRMED',
  ORDER_CANCELLED = 'ORDER_CANCELLED',
  ORDER_UPDATED = 'ORDER_UPDATED',
  ASSET_CREATED = 'ASSET_CREATED',
  ASSET_UPDATED = 'ASSET_UPDATED',
  ASSET_DELETED = 'ASSET_DELETED',
  PRODUCT_UPDATED = 'PRODUCT_UPDATED',
}

export enum ESocketReason {
  USER_ROLES_UPDATED = 'user_roles_updated',
  USER_ACTIVITY_STATUS_UPDATED = 'user_activity_status_updated',
  USER_DELETED = 'user_deleted',
  ROLE_PERMISSIONS_UPDATED = 'role_permissions_updated',
  ROLE_ASSIGNMENTS_UPDATED = 'role_assignments_updated',
}
