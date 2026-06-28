export enum ESocketEmit {
  PERMISSIONS_UPDATED = 'permissions:updated',
}

export enum ESocketReason {
  USER_ROLES_UPDATED = 'user_roles_updated',
  USER_ACTIVITY_STATUS_UPDATED = 'user_activity_status_updated',
  USER_DELETED = 'user_deleted',
  ROLE_PERMISSIONS_UPDATED = 'role_permissions_updated',
  ROLE_ASSIGNMENTS_UPDATED = 'role_assignments_updated',
}
