import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserEntity } from './entities/user.entity';
import { PlatformAdminEntity } from './entities/platform-admin.entity';
import { UsersService } from './users.service';

@Module({
  imports: [TypeOrmModule.forFeature([UserEntity, PlatformAdminEntity])],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}