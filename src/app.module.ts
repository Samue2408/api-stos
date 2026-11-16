import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { validateEnv } from './config/env.validation';
import { dataSourceOptions } from './database/data-source';
import { AccessControlModule } from './modules/access-control/access-control.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    TypeOrmModule.forRoot({ ...dataSourceOptions, autoLoadEntities: true }),
    AccessControlModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
