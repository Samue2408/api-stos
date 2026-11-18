import { Controller, Get, Post } from '@nestjs/common';
import type { AuthUser } from '../common/auth/auth-user';
import { CurrentUser } from '../common/auth/decorators';
import { RequireModule, RequirePermissions } from '../modules/access-control/decorators';

@Controller('demo')
export class DemoController {
  @Get('invoices')
  @RequireModule('sales')
  @RequirePermissions('invoices:read')
  invoices(@CurrentUser() u: AuthUser) {
    return { tenantId: u.tenantId, items: [] };
  }

  @Post('invoices')
  @RequireModule('sales')
  @RequirePermissions('invoices:create')
  createInvoice() {
    return { created: true };
  }

  @Get('stock')
  @RequireModule('inventory')
  @RequirePermissions('stock:read')
  stock() {
    return { items: [] };
  }

  @Get('products') // compartido: sirve a ventas O inventario
  @RequireModule('sales', 'inventory')
  @RequirePermissions('products:read')
  products() {
    return { items: [] };
  }

  @Get('platform/tenants')
  @RequirePermissions('tenants:read')
  tenants() {
    return { scope: 'platform' };
  }

  @Get('sin-politica') // sin decoradores: debe dar 403
  noPolicy() {
    return 'no deberías ver esto';
  }
}