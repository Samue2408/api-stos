import {
  ForbiddenException, Injectable, OnModuleInit, UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomBytes } from 'crypto';
import * as argon2 from 'argon2';
import { IsNull, Repository } from 'typeorm';
import { AuthUser, JwtPayload, SessionContext } from '../../common/auth/auth-user';
import { UsersService } from '../users/users.service';
import { TenantsService } from '../tenants/tenants.service';
import { RefreshTokenEntity } from './entities/refresh-token.entity';
import { LoginDto, SelectContextDto } from './dto';

export type ContextOption =
  | { type: 'platform' }
  | { type: 'tenant'; tenantId: string; name: string; slug: string };

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

@Injectable()
export class AuthService implements OnModuleInit {
  private dummyHash!: string;

  constructor(
    private readonly users: UsersService,
    private readonly tenants: TenantsService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    @InjectRepository(RefreshTokenEntity) private readonly sessions: Repository<RefreshTokenEntity>,
  ) {}

  async onModuleInit() {
    // Para gastar el mismo tiempo cuando el email no existe (evita enumerar usuarios por tiempos)
    this.dummyHash = await argon2.hash('dummy-password');
  }

  async login(dto: LoginDto) {
    const user = await this.users.findByEmail(dto.email);
    const valid = await argon2.verify(user?.passwordHash ?? this.dummyHash, dto.password);
    if (!user || !valid || user.status !== 'active') {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const contexts = await this.getContexts(user.id);
    if (!contexts.length) throw new ForbiddenException('El usuario no tiene accesos activos');

    // Un solo contexto: se selecciona solo. Varios: el cliente debe llamar a select-context
    const active = contexts.length === 1 ? contexts[0] : null;
    const tokens = active
      ? await this.issueSession(user.id, active.type, active.type === 'tenant' ? active.tenantId : null)
      : await this.issueSession(user.id, 'none', null);

    return { ...tokens, mustChangePassword: user.mustChangePassword, contexts, active };
  }

  async selectContext(user: AuthUser, dto: SelectContextDto) {
    if (dto.type === 'platform') {
      if (!(await this.users.isPlatformAdmin(user.userId))) throw new ForbiddenException();
    } else if (!(await this.tenants.hasActiveMembership(user.userId, dto.tenantId!))) {
      throw new ForbiddenException();
    }

    await this.revokeSession(user.sessionId);
    const tenantId = dto.type === 'tenant' ? dto.tenantId! : null;
    return this.issueSession(user.userId, dto.type, tenantId);
  }

  async refresh(rawToken: string) {
    const row = await this.sessions.findOne({ where: { tokenHash: sha256(rawToken) } });
    if (!row || row.expiresAt < new Date()) throw new UnauthorizedException();

    // Revocación atómica: si dos peticiones usan el mismo token, solo una gana
    const res = await this.sessions.update({ id: row.id, revokedAt: IsNull() }, { revokedAt: new Date() });
    if (!res.affected) {
      // Token ya usado: posible robo. Se cierran todas las sesiones del usuario.
      await this.sessions.update({ userId: row.userId, revokedAt: IsNull() }, { revokedAt: new Date() });
      throw new UnauthorizedException();
    }

    // Revalidar que el usuario y su contexto siguen vigentes
    const user = await this.users.findById(row.userId);
    if (!user || user.status !== 'active') throw new UnauthorizedException();
    if (row.context === 'platform' && !(await this.users.isPlatformAdmin(user.id))) {
      throw new UnauthorizedException();
    }
    if (row.context === 'tenant' && !(await this.tenants.hasActiveMembership(user.id, row.tenantId!))) {
      throw new UnauthorizedException();
    }

    return this.issueSession(user.id, row.context, row.tenantId);
  }

  async logout(sessionId: string) {
    await this.revokeSession(sessionId);
  }

  // ---------- internos ----------

  private async getContexts(userId: string): Promise<ContextOption[]> {
    const [isAdmin, memberships] = await Promise.all([
      this.users.isPlatformAdmin(userId),
      this.tenants.listActiveMemberships(userId),
    ]);
    return [
      ...(isAdmin ? [{ type: 'platform' } as const] : []),
      ...memberships.map((m) => ({ type: 'tenant', ...m }) as const),
    ];
  }

  private revokeSession(id: string) {
    return this.sessions.update({ id, revokedAt: IsNull() }, { revokedAt: new Date() });
  }

  private async issueSession(userId: string, context: SessionContext, tenantId: string | null) {
    const raw = randomBytes(48).toString('base64url');
    const days = this.config.getOrThrow<number>('REFRESH_TTL_DAYS');

    const session = await this.sessions.save(
      this.sessions.create({
        userId,
        tenantId,
        context,
        tokenHash: sha256(raw),
        expiresAt: new Date(Date.now() + days * 86_400_000),
      }),
    );

    const payload: JwtPayload = { sub: userId, ctx: context, tid: tenantId ?? undefined, sid: session.id };
    return { accessToken: await this.jwt.signAsync(payload), refreshToken: raw };
  }
}