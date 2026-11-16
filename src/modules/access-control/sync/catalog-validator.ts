// sync/catalog-validator.ts
import { CATALOG } from '../catalog';
import { AnyModuleDef, ScopeType } from '../define-module';
import { ROLES, RoleDef } from '../roles.definition';

export function assertCatalogIsValid(): void {
  const errors: string[] = [];
  const moduleCodes = new Set<string>();
  const permissionScope = new Map<string, ScopeType>();

  for (const m of CATALOG as readonly AnyModuleDef[]) {
    if (moduleCodes.has(m.code)) errors.push(`Módulo duplicado: ${m.code}`);
    moduleCodes.add(m.code);

    const access = m.permissions.filter((p) => p.type === 'module_access');
    if (access.length > 1) {
      errors.push(`El módulo ${m.code} tiene más de un permiso module_access`);
    }
    if (access.length === 1 && access[0].code !== `${m.code}:access`) {
      errors.push(`El permiso de acceso de ${m.code} debe llamarse "${m.code}:access"`);
    }
    if (m.scope === 'platform' && access.length > 1) {
      errors.push(`El módulo de plataforma ${m.code} no debería tener varios accesos`);
    }

    for (const p of m.permissions) {
      if (permissionScope.has(p.code)) errors.push(`Permiso duplicado: ${p.code}`);
      permissionScope.set(p.code, m.scope);
    }
  }

  for (const m of CATALOG as readonly AnyModuleDef[]) {
    if (m.parent && !moduleCodes.has(m.parent)) {
      errors.push(`El módulo ${m.code} apunta a un padre inexistente: ${m.parent}`);
    }
  }

  const roleCodes = new Set<string>();
  for (const r of ROLES as readonly RoleDef[]) {
    if (roleCodes.has(r.code)) errors.push(`Rol duplicado: ${r.code}`);
    roleCodes.add(r.code);
    if (r.permissions === '*') continue;
    for (const code of r.permissions) {
      const scope = permissionScope.get(code);
      if (!scope) errors.push(`El rol ${r.code} usa un permiso inexistente: ${code}`);
      else if (scope !== r.scope) {
        errors.push(`El rol ${r.code} (${r.scope}) incluye el permiso ${code} de scope ${scope}`);
      }
    }
  }

  if (errors.length) throw new Error(`Catálogo inválido:\n - ${errors.join('\n - ')}`);
}

/* Es una función pura, sin BD. 
Detecta errores de definición antes de tocar la base y 
se puede probar con un test unitario. 

La última regla es la que cubre el hueco que dejamos en la BD: 
un rol tenant nunca puede recibir un permiso platform.
*/