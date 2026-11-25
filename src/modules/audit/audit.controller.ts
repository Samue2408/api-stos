import { Controller, Get, Query } from '@nestjs/common';
import { RequirePermissions } from '../access-control/decorators';
import { AuditService } from './audit.service';
import { AuditQueryDto } from './dto';

@Controller('platform/audit')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  @RequirePermissions('audit:read')
  list(@Query() q: AuditQueryDto) {
    return this.audit.list(q);
  }
}