export type TenantStatus = 'active' | 'suspended' | 'cancelled';

/** 3-63 caracteres, minúsculas, números y guiones; sin guion al inicio ni al final. */
export const SLUG_REGEX = /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/;

export const RESERVED_SLUGS = new Set([
  'admin', 'api', 'app', 'www', 'platform', 'login', 'auth', 'static', 'assets', 'support', 'status',
]);

export const STATUS_TRANSITIONS: Record<TenantStatus, readonly TenantStatus[]> = {
  active: ['suspended', 'cancelled'],
  suspended: ['active', 'cancelled'],
  cancelled: [], // terminal
};