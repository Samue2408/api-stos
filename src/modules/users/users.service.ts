import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserEntity } from './entities/user.entity';
import { PlatformAdminEntity } from './entities/platform-admin.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(UserEntity) private readonly users: Repository<UserEntity>,
    @InjectRepository(PlatformAdminEntity) private readonly admins: Repository<PlatformAdminEntity>,
  ) {}

  findByEmail(email: string) {
    return this.users.findOne({ where: { email } }); // citext: sin distinguir mayúsculas
  }

  findById(id: string) {
    return this.users.findOne({ where: { id } });
  }

  async isPlatformAdmin(userId: string): Promise<boolean> {
    return (await this.admins.count({ where: { userId } })) > 0;
  }
}