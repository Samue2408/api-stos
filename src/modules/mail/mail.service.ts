import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, Transporter } from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: Transporter | null;
  private readonly from: string;
  private readonly appName: string;

  constructor(config: ConfigService) {
    this.from = config.getOrThrow<string>('MAIL_FROM');
    this.appName = config.getOrThrow<string>('APP_NAME');

    if (config.get<string>('MAIL_DRIVER') === 'smtp') {
      const port = config.getOrThrow<number>('SMTP_PORT');
      this.transporter = createTransport({
        host: config.getOrThrow<string>('SMTP_HOST'),
        port,
        secure: port === 465,
        auth: { user: config.getOrThrow<string>('SMTP_USER'), pass: config.getOrThrow<string>('SMTP_PASSWORD') },
      });
    } else {
      this.transporter = null;
    }
  }

  sendPasswordResetCode(to: string, name: string, code: string, ttlMinutes: number) {
    return this.send(
      to,
      `Tu código de verificación de ${this.appName}`,
      `Hola ${name},\n\n` +
        `Tu código para restablecer la contraseña de ${this.appName} es:\n\n    ${code}\n\n` +
        `Vence en ${ttlMinutes} minutos y solo sirve una vez. ` +
        `Si no lo solicitaste, ignora este mensaje: tu contraseña no cambiará.\n` +
        `Nunca compartas este código con nadie.`,
    );
  }

  sendPasswordChanged(to: string, name: string) {
    const when = new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' });
    return this.send(
      to,
      `Tu contraseña de ${this.appName} fue cambiada`,
      `Hola ${name},\n\nTu contraseña se cambió el ${when}. ` +
        `Cerramos todas tus sesiones abiertas.\n\n` +
        `Si no fuiste tú, contacta de inmediato al administrador de tu cuenta.`,
    );
  }

  private async send(to: string, subject: string, text: string) {
    if (!this.transporter) {
      this.logger.warn(`[MAIL:console] Para: ${to} | ${subject}\n${text}`);
      return;
    }
    await this.transporter.sendMail({ from: this.from, to, subject, text });
  }
}