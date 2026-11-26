import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtSignOptions } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from '../users/users.module';
import { TenantsModule } from '../tenants/tenants.module';
import { RefreshTokenEntity } from './entities/refresh-token.entity';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { PasswordController } from './password.controller';
import { MailModule } from '../mail/mail.module';
import { AuditModule } from '../audit/audit.module';
import { PasswordService } from './password.service';
import { CleanupService } from './cleanup.service';

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (c: ConfigService) => ({
        secret: c.getOrThrow<string>('JWT_ACCESS_SECRET'),
        signOptions: {
          algorithm: 'HS256',
          expiresIn: c.getOrThrow<string>('JWT_ACCESS_TTL') as JwtSignOptions['expiresIn'],
        },
      }),
    }),
    TypeOrmModule.forFeature([RefreshTokenEntity]),
    UsersModule,
    TenantsModule,
    MailModule,
    AuditModule
  ],
  controllers: [AuthController, PasswordController],
  providers: [AuthService, JwtStrategy, PasswordService, CleanupService],
})
export class AuthModule {}