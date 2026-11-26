import {
  BadRequestException, Injectable, Logger, UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import { createHmac, randomInt, timingSafeEqual } from 'crypto';
import { DataSource } from 'typeorm';
import { AuthUser } from '../../common/auth/auth-user';
import { AuditService } from '../audit/audit.service';
import { MailService } from '../mail/mail.service';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';
import { ChangePasswordDto, ResetPasswordDto } from './password.dto';
import { assertPasswordPolicy, checkPasswordPolicy } from './password-policy';

const MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_SECONDS = 60;
const MAX_CODES_PER_HOUR = 5;

const safeEqualHex = (a: string, b: string) => {
  const x = Buffer.from(a, 'hex');
  const y = Buffer.from(b, 'hex');
  return x.length === y.length && timingSafeEqual(x, y);
};

@Injectable()
export class PasswordService {
  private readonly logger = new Logger(PasswordService.name);
  private readonly secret: string;
  private readonly ttlMinutes: number;

  constructor(
    private readonly dataSource: DataSource,
    private readonly users: UsersService,
    private readonly auth: AuthService,
    private readonly mail: MailService,
    private readonly audit: AuditService,
    config: ConfigService,
  ) {
    this.secret = config.getOrThrow<string>('OTP_SECRET');
    this.ttlMinutes = config.getOrThrow<number>('OTP_TTL_MINUTES');
  }

  // ---------- Cambio con sesión (obligatorio o voluntario) ----------

  async change(user: AuthUser, dto: ChangePasswordDto, ip: string | null) {
    const row = await this.users.findById(user.userId);
    if (!row || row.status !== 'active') throw new UnauthorizedException();

    // 400 y no 401: un 401 haría que el cliente intente renovar el token
    if (!(await argon2.verify(row.passwordHash, dto.currentPassword))) {
      throw new BadRequestException({ message: 'La contraseña actual no es correcta', code: 'INVALID_CURRENT_PASSWORD' });
    }

    const errors = checkPasswordPolicy(dto.newPassword, row.email);
    if (await argon2.verify(row.passwordHash, dto.newPassword)) errors.push('same_as_current');
    assertPasswordPolicy(errors);

    const hash = await argon2.hash(dto.newPassword);
    await this.dataSource.transaction(async (tx) => {
      await this.users.setPassword(row.id, hash, tx);       // también limpia must_change_password
      await this.auth.revokeAllSessions(row.id, tx);
      await this.audit.log(
        {
          action: 'user.password_changed', actorId: row.id, tenantId: user.tenantId,
          entityType: 'user', entityId: row.id, ip,
          metadata: { wasForced: user.mustChangePassword },
        },
        tx,
      );
    });

    this.notifyChanged(row.email, row.firstName);
    // Sesión nueva en el mismo contexto, ya sin la marca de cambio pendiente
    return this.auth.issueSession(row.id, user.ctx, user.tenantId, false);
  }

  // ---------- Recuperación con código ----------

  /** Responde siempre lo mismo y trabaja en segundo plano: sin enumeración por contenido ni por tiempos. */
  forgot(email: string) {
    void this.issueResetCode(email.trim()).catch((e) =>
      this.logger.error(`No se pudo emitir el código de recuperación: ${e instanceof Error ? e.message : e}`),
    );
    return { message: 'Si el correo está registrado, recibirás un código de verificación.' };
  }

  async reset(dto: ResetPasswordDto, ip: string | null) {
    const invalid = () => new BadRequestException({ message: 'Código inválido o vencido', code: 'INVALID_CODE' });

    // La política va primero y no depende de si el usuario existe: no filtra nada y no gasta el intento
    assertPasswordPolicy(checkPasswordPolicy(dto.newPassword, dto.email));

    const user = await this.users.findByEmail(dto.email.trim());
    if (!user || user.status !== 'active') throw invalid();

    const [otp] = await this.dataSource.query(
      `SELECT id, otp_hash AS "otpHash" FROM user_otps
        WHERE user_id = $1 AND purpose = 'password_reset' AND is_used = false AND expires_at > now()
        ORDER BY created_at DESC LIMIT 1`,
      [user.id],
    );
    if (!otp) throw invalid();

    // Se consume un intento de forma atómica ANTES de comparar
    const [{ n }] = await this.dataSource.query(
      `WITH u AS (
         UPDATE user_otps SET attempts = attempts + 1
          WHERE id = $1 AND is_used = false AND attempts < $2 RETURNING 1
       ) SELECT count(*)::int AS n FROM u`,
      [otp.id, MAX_ATTEMPTS],
    );
    if (!n) throw invalid();

    if (!safeEqualHex(otp.otpHash, this.hashCode(user.id, dto.code))) throw invalid();

    const hash = await argon2.hash(dto.newPassword);
    await this.dataSource.transaction(async (tx) => {
      // Reclamo atómico: si dos peticiones llegan con el código correcto, solo una pasa
      const [{ n: claimed }] = await tx.query(
        `WITH c AS (UPDATE user_otps SET is_used = true WHERE id = $1 AND is_used = false RETURNING 1)
         SELECT count(*)::int AS n FROM c`,
        [otp.id],
      );
      if (!claimed) throw invalid();

      await this.users.setPassword(user.id, hash, tx);
      await this.auth.revokeAllSessions(user.id, tx);
      await this.audit.log(
        { action: 'user.password_reset', actorId: user.id, entityType: 'user', entityId: user.id, ip },
        tx,
      );
    });

    this.notifyChanged(user.email, user.firstName);
    return { message: 'Contraseña actualizada. Inicia sesión con la nueva contraseña.' };
  }

  // ---------- internos ----------

  private async issueResetCode(email: string): Promise<void> {
    const user = await this.users.findByEmail(email);
    if (!user || user.status !== 'active') return;

    const code = await this.dataSource.transaction(async (tx) => {
      // Serializa las solicitudes simultáneas del mismo usuario
      await tx.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [`otp:${user.id}`]);

      const [recent] = await tx.query(
        `SELECT count(*) FILTER (WHERE created_at > now() - interval '1 hour')::int AS hour,
                count(*) FILTER (WHERE created_at > now() - interval '1 second' * $2::int)::int AS cooldown
           FROM user_otps WHERE user_id = $1 AND purpose = 'password_reset'`,
        [user.id, RESEND_COOLDOWN_SECONDS],
      );
      if (recent.cooldown > 0 || recent.hour >= MAX_CODES_PER_HOUR) return null;

      const generated = randomInt(0, 1_000_000).toString().padStart(6, '0');
      await tx.query(
        `UPDATE user_otps SET is_used = true
          WHERE user_id = $1 AND purpose = 'password_reset' AND is_used = false`,
        [user.id],
      );
      await tx.query(
        `INSERT INTO user_otps (user_id, otp_hash, purpose, expires_at)
         VALUES ($1, $2, 'password_reset', now() + interval '1 minute' * $3::int)`,
        [user.id, this.hashCode(user.id, generated), this.ttlMinutes],
      );
      return generated;
    });

    if (code) await this.mail.sendPasswordResetCode(user.email, user.firstName, code, this.ttlMinutes);
  }

  private hashCode(userId: string, code: string): string {
    return createHmac('sha256', this.secret).update(`${userId}:${code}`).digest('hex');
  }

  private notifyChanged(email: string, firstName: string) {
    void this.mail.sendPasswordChanged(email, firstName).catch((e) =>
      this.logger.error(`No se pudo notificar el cambio de contraseña: ${e instanceof Error ? e.message : e}`),
    );
  }
}