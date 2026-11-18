```
src/
  main.ts
  app.module.ts
  config/                 # configuración validada (env)
  common/                 # decoradores, filtros, interceptores compartidos
  modules/
    auth/                 # login, OTP, JWT, refresh, selección de tenant
    users/
    tenants/              # tenants + tenant_settings + tenant_users
    plans/                # plans + plan_modules
    access-control/
      catalog/            # *.module-def.ts (fuente de verdad)
      roles.definition.ts
      sync/catalog-sync.service.ts
      guards/             # PermissionsGuard, ModuleGuard
      decorators/         # @RequirePermissions, @RequireModule
      access.service.ts   # calcula permisos efectivos (rol ∩ plan) + caché
    audit/
  database/
    migrations/
    data-source.ts
```