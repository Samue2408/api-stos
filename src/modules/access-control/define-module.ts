export type PermissionType = 'module_access' | 'action';
export type ScopeType = 'platform' | 'tenant';

export interface PermissionDef<P extends string> {
  readonly code: P;
  readonly name: string;
  readonly description?: string;
  readonly type: PermissionType;
}

export interface ModuleDef<M extends string, P extends string> {
  readonly code: M;
  readonly name: string;
  readonly description?: string;
  readonly parent?: string;
  /** Todos los permisos del módulo heredan este scope. */
  readonly scope: ScopeType;
  readonly permissions: readonly PermissionDef<P>[];
}

export type AnyModuleDef = ModuleDef<string, string>;

// `const` hace que TS conserve los códigos literales ('sales:access') en vez de `string`
export function defineModule<const M extends string, const P extends string>(
  def: ModuleDef<M, P>,
): ModuleDef<M, P> {
  return def;
}