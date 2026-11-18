export type SessionContext = 'none' | 'platform' | 'tenant';

export interface AuthUser {
  userId: string;
  ctx: SessionContext;
  tenantId: string | null;
  sessionId: string;
}

export interface JwtPayload {
  sub: string;
  ctx: SessionContext;
  tid?: string;
  sid: string;
}