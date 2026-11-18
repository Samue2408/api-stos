import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { validateEnv } from './config/env.validation';
import { dataSourceOptions } from './database/data-source';
import { AccessControlModule } from './modules/access-control/access-control.module';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { TenantsModule } from './modules/tenants/tenants.module';
import { PlansModule } from './modules/plans/plans.module';
import { AuthModule } from './modules/auth/auth.module';
import { APP_GUARD } from '@nestjs/core';
import { JwtAuthGuard } from './modules/auth/jwt-auth.guard';
import { AccessGuard } from './modules/access-control/access.guard';
import { UsersModule } from './modules/users/users.module';
import { DemoController } from './demo/demo.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    TypeOrmModule.forRoot({ ...dataSourceOptions, autoLoadEntities: true }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    AccessControlModule, UsersModule, TenantsModule, PlansModule, AuthModule,
  ],
  controllers: [DemoController], // temporal: bórralo cuando haya módulos reales
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: AccessGuard },
  ],
})
export class AppModule {}
