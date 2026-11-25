import { Controller, Get } from '@nestjs/common';
import { RequirePermissions } from '../access-control/decorators';
import { PlansService } from './plans.service';

@Controller('platform/modules')
export class PlatformModulesController {
  constructor(private readonly plans: PlansService) {}

  /** Catálogo de solo lectura: módulos que se pueden incluir en un plan. */
  @Get()
  @RequirePermissions('plans:read')
  assignable() { return this.plans.listAssignableModules(); }
}