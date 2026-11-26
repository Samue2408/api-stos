import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DataSource } from 'typeorm';

@Injectable()
export class CleanupService {
  private readonly logger = new Logger(CleanupService.name);
  constructor(private readonly dataSource: DataSource) {}

  @Cron('0 3 * * *')
  async purge() {
    await this.dataSource.query(`DELETE FROM user_otps WHERE expires_at < now() - interval '1 day'`);
    // Los revocados se conservan 30 días para detectar reutilización de tokens robados
    await this.dataSource.query(
      `DELETE FROM refresh_tokens
        WHERE expires_at < now() - interval '30 days' OR revoked_at < now() - interval '30 days'`,
    );
    this.logger.log('Limpieza de OTP y sesiones antiguas completada');
  }
}