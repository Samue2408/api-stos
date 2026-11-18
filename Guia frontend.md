# Guía para el desarrollador frontend

Autenticación, contextos, roles y permisos del sistema multitenant

*Backend NestJS + PostgreSQL · Frontend Angular · Versión 1*

## 1. Resumen en 60 segundos

- El sistema es **multitenant**: varias empresas (tenants) comparten la misma aplicación y base de datos, con los datos aislados entre sí.
- Un usuario inicia sesión con email y contraseña y trabaja siempre dentro de **un contexto**: `platform` (panel de plataforma) o `tenant` (una empresa concreta). Si tiene varios, debe elegir uno.
- Lo que un usuario puede ver y hacer sale de **dos cosas combinadas**: su **rol** (qué permisos tiene) y el **plan** de su empresa (qué módulos contrató).
- El frontend **no calcula nada**. Llama a `GET /api/me/access`, recibe la lista final de permisos y módulos, y con eso arma menú, rutas y botones.
- **El backend es la única autoridad.** Ocultar un botón es una comodidad de UX; la seguridad real la aplica cada endpoint respondiendo 401 o 403.
- Roles, permisos y módulos **se definen en el código del backend**. El frontend nunca los crea ni los edita: solo los consume.

## 2. Modelo de datos (lo que necesitas entender)

| Concepto | Qué es | Quién lo define | Dónde se gestiona |
| --- | --- | --- | --- |
| Usuario | Persona con email y contraseña. Puede pertenecer a varias empresas. | Alta por admin | Panel del tenant |
| Tenant | Empresa cliente. Tiene un plan asignado. | Plataforma | Panel de plataforma |
| Plan | Paquete comercial: límites y módulos incluidos. | Plataforma | Panel de plataforma (sin desplegar código) |
| Módulo | Área funcional (Ventas, Inventario, etc.). | Desarrolladores, en código | Solo lectura |
| Permiso | Acción atómica con formato `recurso:accion`. | Desarrolladores, en código | Solo lectura |
| Rol | Conjunto **fijo** de permisos. | Desarrolladores, en código | Solo lectura; se **asigna** a usuarios |
| Membresía | Relación usuario–tenant con un rol. Un rol por usuario en cada tenant. | Admin del tenant | Panel del tenant |

### 2.1 Tipos de permiso

Hay dos tipos y no deben mezclarse:

| Tipo | Formato | Para qué sirve | Ejemplo |
| --- | --- | --- | --- |
| Acceso a módulo | `<modulo>:access` | **Decide si el módulo aparece** en el menú y si se puede entrar a sus rutas. | `sales:access`, `inventory:access` |
| Acción | `<recurso>:<accion>` | Decide si se puede ejecutar una operación o ver un botón dentro de una pantalla. | `invoices:create`, `stock:update` |

Un permiso de acción puede ser usado por varios módulos. Por ejemplo `products:read` lo necesitan Ventas e Inventario, pero **no hace aparecer ningún módulo**: eso lo decide solo el permiso `:access`.

### 2.2 Módulos núcleo y módulos de plan

- **Módulos de plan** (`sales`, `inventory`, y los que vengan): tienen permiso `:access`. Solo se ven si el plan del tenant los incluye **y** el rol del usuario tiene ese `:access`.
- **Módulos núcleo** (`users`, `settings`): están disponibles para todo tenant y **no tienen** `:access`. Los protegen únicamente sus permisos de acción (`users:read`, `settings:update`, etc.).
- **Módulo contenedor** (`catalog`): solo agrupa permisos compartidos (`products:read`...). No es una pantalla ni un ítem del menú.
- **Módulo de plataforma** (`platform`): solo existe en el contexto `platform`.

### 2.3 Scope

Cada permiso y cada rol tiene scope `platform` o `tenant`. Un rol de tenant jamás tiene permisos de plataforma. En la práctica: lo que recibas en `/me/access` ya viene filtrado por el contexto activo.

### 2.4 Roles predefinidos (versión actual)

| Rol (`code`) | Scope | Permisos |
| --- | --- | --- |
| `super_admin` | platform | Todos los de plataforma |
| `platform_support` | platform | `platform:access`, `tenants:read`, `plans:read` |
| `tenant_admin` | tenant | Todos los de tenant (los `:access` dependen del plan) |
| `seller` | tenant | `sales:access`, `products:read`, `invoices:read`, `invoices:create` |
| `warehouse` | tenant | `inventory:access`, `products:read`, `stock:read`, `stock:update` |

Los tenants **no pueden crear ni editar roles**. Solo eligen uno de esta lista al asignar un usuario. Si un cliente necesita algo distinto, es una decisión de producto: se crea un rol nuevo en el backend para todos.

### 2.5 Catálogo actual de permisos

| Módulo | Permisos |
| --- | --- |
| `platform` | `platform:access`, `tenants:read`, `tenants:manage`, `plans:read`, `plans:manage`, `platform-admins:manage` |
| `users` (núcleo) | `users:read`, `users:create`, `users:update`, `users:assign-role` |
| `settings` (núcleo) | `settings:read`, `settings:update` |
| `catalog` (contenedor) | `products:read`, `products:create`, `products:update` |
| `sales` | `sales:access`, `invoices:read`, `invoices:create`, `invoices:cancel` |
| `inventory` | `inventory:access`, `stock:read`, `stock:update` |

Este catálogo crece con cada módulo nuevo. La fuente de verdad es el backend; pídele al equipo backend la lista actualizada o consúltala en el repositorio (`access-control/catalog/`).

### 2.6 La regla de visibilidad

> **Permiso efectivo = permisos del rol ∩ módulos del plan del tenant**

1. El backend toma los permisos del rol del usuario.
2. Los permisos de tipo `:access` solo se conservan si el plan del tenant incluye ese módulo.
3. Los permisos de acción se conservan siempre que el rol los tenga.
4. El resultado es lo que devuelve `/me/access`.

Ejemplo con el plan `starter` (incluye Ventas, **no** Inventario): un `warehouse` tiene en su rol `inventory:access`, pero `/me/access` **no se lo devuelve** porque el plan no incluye Inventario. Para el frontend es indiferente: si el permiso no viene en la lista, no existe.

## 3. Contextos de sesión

Cada token se emite para **un solo contexto**:

| Contexto (`ctx`) | Significado | Qué puede hacer |
| --- | --- | --- |
| `none` | Login hecho, aún no eligió contexto | Solo `select-context`, `refresh`, `logout` y `/me/access` |
| `platform` | Operando como administrador de plataforma | Endpoints de plataforma |
| `tenant` | Operando dentro de una empresa concreta | Endpoints de esa empresa |

Puntos clave:

- Un mismo usuario puede tener varios contextos (por ejemplo, admin de plataforma y además miembro de uno o más tenants).
- El `tenantId` **sale únicamente del token**. El frontend **nunca** envía el tenant en el body ni en la URL para indicar «en qué empresa trabajo»; para cambiar de empresa se cambia de contexto y se obtiene un token nuevo.
- Si el usuario tiene un solo contexto, el backend lo selecciona automáticamente en el login.

## 4. Flujos

### 4.1 Inicio de sesión

1. El usuario envía email y contraseña: `POST /api/auth/login`.
2. El backend valida y responde con `accessToken`, `refreshToken`, `mustChangePassword`, `contexts` y `active`.
3. **Si `active` viene con valor** (el usuario tiene un solo contexto): ya hay una sesión operativa. Ve al paso 5.
4. **Si `active` es `null`** (varios contextos): mostrar la pantalla «¿Con qué cuenta quieres entrar?» con la lista `contexts`, y llamar a `POST /api/auth/select-context` con la opción elegida. La respuesta trae tokens nuevos que **reemplazan** a los anteriores.
5. Con el token operativo, llamar a `GET /api/me/access` y guardar `permissions` y `modules` en el store.
6. Navegar al destino según el contexto (panel de plataforma o dashboard del tenant).

Respuesta del login:

```json
{
  'accessToken': 'eyJ...',
  'refreshToken': 'q8s...',
  'mustChangePassword': false,
  'contexts': [
    { 'type': 'platform' },
    { 'type': 'tenant', 'tenantId': 'uuid', 'name': 'Empresa Demo', 'slug': 'demo' }
  ],
  'active': null
}
```

> Importante: `select-context` **no vuelve a devolver** la lista de contextos. El frontend debe **conservar `contexts`** del login para poder ofrecer «cambiar de empresa» después. Si prefieres no guardarlo, se puede pedir al backend un endpoint `GET /me/contexts`.

### 4.2 Cambio de contexto (cambiar de empresa)

1. El usuario elige otro contexto en el selector.
2. `POST /api/auth/select-context` con `{ 'type': 'tenant', 'tenantId': '...' }` o `{ 'type': 'platform' }`.
3. Reemplazar `accessToken` y `refreshToken`. La sesión anterior queda revocada.
4. **Vaciar el store de acceso y cualquier dato en caché de la empresa anterior**, volver a llamar a `/me/access` y navegar al inicio del nuevo contexto.

### 4.3 Renovación del token (refresh)

- El `accessToken` dura **15 minutos**. El `refreshToken` dura 30 días.
- Cuando una petición responde **401**: llamar **una sola vez** a `POST /api/auth/refresh` con `{ 'refreshToken': '...' }`, guardar los dos tokens nuevos y **reintentar** la petición original.
- Si el refresh también falla (401): limpiar todo y mandar al login.
- **El refresh token es de un solo uso y rota en cada renovación.** Si dos peticiones intentan renovar a la vez con el mismo token, la segunda falla y el backend interpreta que el token fue robado: **cierra todas las sesiones del usuario**. Por eso la renovación debe hacerse en «vuelo único»: si ya hay una renovación en curso, las demás peticiones esperan su resultado en vez de lanzar otra.
- Revisa el caso de varias pestañas abiertas: comparten el mismo refresh token. Lo más simple es sincronizar el estado de sesión entre pestañas (por ejemplo con `BroadcastChannel`) o aceptar que una pestaña pueda forzar un nuevo login.

### 4.4 Cierre de sesión

`POST /api/auth/logout` (responde 204). Después borrar tokens y el store de acceso en el cliente y navegar al login. Aunque el servidor invalida la capacidad de renovar, el access token ya emitido sigue siendo técnicamente válido hasta 15 minutos; por eso el borrado local es obligatorio.

### 4.5 Contraseña temporal

Si `mustChangePassword` es `true`, el frontend debe llevar al usuario a la pantalla de cambio de contraseña antes de dejarlo usar la app. *El endpoint para cambiarla aún no está construido (ver sección 9).*

## 5. Endpoints disponibles hoy

Prefijo común: `/api`. Autenticación mediante `Authorization: Bearer <accessToken>`.

| Método | Ruta | Auth | Body | Respuesta |
| --- | --- | --- | --- | --- |
| POST | `/auth/login` | Pública (máx. 5/min) | `{ email, password }` | `{ accessToken, refreshToken, mustChangePassword, contexts, active }` |
| POST | `/auth/refresh` | Pública (máx. 20/min) | `{ refreshToken }` | `{ accessToken, refreshToken }` |
| POST | `/auth/select-context` | Sesión válida | `{ type: 'platform' }` o `{ type: 'tenant', tenantId }` | `{ accessToken, refreshToken }` |
| POST | `/auth/logout` | Sesión válida | — | 204 |
| GET | `/me/access` | Sesión válida | — | `{ ctx, tenantId, permissions[], modules[] }` |

Respuesta de `/me/access` (ejemplo de un vendedor):

```json
{
  'ctx': 'tenant',
  'tenantId': 'uuid',
  'permissions': ['sales:access', 'products:read', 'invoices:read', 'invoices:create'],
  'modules': ['sales']
}
```

`modules` contiene los módulos incluidos en el **plan** del tenant (información útil, por ejemplo, para mostrar un candado «no incluido en tu plan»). `permissions` es la lista que decide lo que se muestra.

## 6. Manejo de errores

| Código | Cuándo ocurre | Qué hace el frontend |
| --- | --- | --- |
| 400 | Datos inválidos (validación del DTO) | Mostrar errores en el formulario |
| 401 | Token ausente, vencido o inválido; credenciales incorrectas; refresh inválido | En login: «credenciales inválidas». En cualquier otra petición: intentar refresh una vez; si falla, ir al login |
| 403 `Debes seleccionar un contexto` | Token con `ctx = none` | Llevar a la pantalla de selección de contexto |
| 403 `Sin acceso vigente en este contexto` | Membresía o rol desactivado, empresa suspendida | Refrescar `/me/access`; si persiste, mensaje de acceso revocado y volver al login o selector |
| 403 `Módulo no incluido en el plan` | El plan no incluye el módulo | Mensaje «Esta función no está incluida en tu plan» |
| 403 `Permisos insuficientes` | El rol no tiene el permiso | Mensaje «No tienes permiso para esta acción» y refrescar `/me/access` (puede haber cambiado) |
| 403 `Endpoint sin política de acceso` | Error de desarrollo en backend | Reportarlo al equipo backend |
| 429 | Demasiados intentos (límite de peticiones) | Mostrar mensaje y esperar |

La denegación es **por defecto**: cualquier endpoint sin política explícita responde 403.

**Frecuencia de actualización.** El backend guarda los permisos efectivos en caché hasta 60 segundos. Si un admin cambia el rol de un usuario o el plan de una empresa, el cambio puede tardar hasta ese tiempo en reflejarse. Vuelve a pedir `/me/access`: al iniciar la app, tras cada cambio de contexto y después de un 403 por permisos.

## 7. Cómo construirlo en Angular

### 7.1 Almacenamiento de tokens

- `accessToken`: **en memoria** (una variable o signal del servicio de auth).
- `refreshToken`: en `localStorage` mientras se desarrolla. Para producción se migrará a cookie `HttpOnly; Secure; SameSite`, y el cambio será solo en el `AuthController` y en tu servicio de auth, sin afectar al resto.
- Al recargar la página: si hay refresh token guardado, renovar sesión y volver a pedir `/me/access` antes de renderizar rutas protegidas (por ejemplo con `provideAppInitializer`).
- Puedes decodificar el JWT para leer `ctx` y `tid` y mejorar la UX, pero **nunca tomes decisiones de seguridad** con eso: el backend valida todo.

### 7.2 Store de acceso

```ts
@Injectable({ providedIn: 'root' })
export class AccessStore {
  private http = inject(HttpClient);
  private state = signal<Access | null>(null);

  readonly ctx = computed(() => this.state()?.ctx ?? 'none');
  readonly modules = computed(() => this.state()?.modules ?? []);

  has = (p: string) => this.state()?.permissions.includes(p) ?? false;
  hasAll = (ps: string[]) => ps.every((p) => this.has(p));
  hasAny = (ps: string[]) => ps.some((p) => this.has(p));

  load() {
    return this.http.get<Access>('/api/me/access').pipe(tap((a) => this.state.set(a)));
  }
  clear() { this.state.set(null); }
}
```

### 7.3 Interceptor

```ts
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  if (req.url.includes('/auth/login') || req.url.includes('/auth/refresh')) return next(req);

  const withToken = (r: HttpRequest<unknown>) =>
    r.clone({ setHeaders: { Authorization: 'Bearer ' + auth.accessToken() } });

  return next(withToken(req)).pipe(
    catchError((err) => {
      if (err.status !== 401) return throwError(() => err);
      // refreshOnce(): una sola renovación en vuelo; las demás peticiones esperan su resultado
      return auth.refreshOnce().pipe(
        switchMap(() => next(withToken(req))),
        catchError((e) => { auth.logoutLocal(); return throwError(() => e); }),
      );
    }),
  );
};
```

`refreshOnce()` debe guardar el observable de la renovación en curso (con `shareReplay(1)`) y limpiarlo cuando termine.

### 7.4 Rutas y menú desde una sola fuente

Cada ruta declara qué necesita. El menú se genera leyendo esas mismas rutas, así que menú y protección no pueden desincronizarse.

```ts
export const routes: Routes = [
  {
    path: 'ventas',
    canActivate: [accessGuard],
    data: { permissions: ['sales:access'], menu: { label: 'Ventas', icon: 'receipt' } },
    loadChildren: () => import('./sales/sales.routes'),
  },
  {
    path: 'inventario',
    canActivate: [accessGuard],
    data: { permissions: ['inventory:access'], menu: { label: 'Inventario', icon: 'inventory' } },
    loadChildren: () => import('./inventory/inventory.routes'),
  },
  {
    // pantalla compartida: la ve quien tenga Ventas O Inventario, y además products:read
    path: 'productos',
    canActivate: [accessGuard],
    data: { permissions: ['products:read'], anyOf: ['sales:access', 'inventory:access'] },
    loadComponent: () => import('./catalog/products.component'),
  },
  {
    // módulo núcleo: sin :access, lo protege su permiso de acción
    path: 'usuarios',
    canActivate: [accessGuard],
    data: { permissions: ['users:read'], menu: { label: 'Usuarios', icon: 'group' } },
    loadChildren: () => import('./users/users.routes'),
  },
];
```

```ts
export const accessGuard: CanActivateFn = (route) => {
  const store = inject(AccessStore);
  const all: string[] = route.data['permissions'] ?? [];
  const any: string[] = route.data['anyOf'] ?? [];
  const ok = store.hasAll(all) && (!any.length || store.hasAny(any));
  return ok || inject(Router).parseUrl('/forbidden');
};
```

El menú lateral filtra las rutas que tengan `data.menu` con la misma lógica del guard.

### 7.5 Elementos dentro de una pantalla

```html
<button *hasPermission="'invoices:create'">Nueva factura</button>
```

Implementa `hasPermission` como directiva estructural que consulte `AccessStore.has()`. Para casos donde baste uno de varios permisos, acepta un arreglo con semántica «any».

### 7.6 Rutas separadas por contexto

Se recomienda separar el área de plataforma (`/plataforma/...`) del área del tenant (`/app/...`). Tras el login o el cambio de contexto, redirige según `ctx`. Un usuario en contexto `tenant` que entre a una ruta de plataforma recibirá 403 del backend aunque conozca la URL.

## 8. Qué administra el frontend

### Panel de plataforma (contexto `platform`)

- Gestión de tenants (alta con administrador inicial, suspensión).
- Gestión de planes y **asignación de módulos a cada plan** (`plan_modules`). Es el único punto donde el negocio decide qué módulo ve cada cliente sin desplegar código.
- Gestión de administradores de plataforma.
- Catálogo de módulos, permisos y roles en **solo lectura** (útil para consultar qué incluye cada rol).

### Panel del tenant (contexto `tenant`)

- Gestión de usuarios: invitar, activar/desactivar y **asignar un rol predefinido** con un `select`.
- Configuración del tenant (zona horaria, moneda, colores, logo).
- **No existe** una matriz de permisos ni creación de roles.

> Estos endpoints de gestión **todavía no están construidos** (ver sección 9). Mientras tanto se puede desarrollar contra mocks siguiendo los contratos que se acuerden con backend.

## 9. Estado actual y pendientes

| Tema | Estado |
| --- | --- |
| Login, refresh, selección de contexto, logout | Listo |
| `/me/access` (permisos y módulos efectivos) | Listo |
| CRUD de tenants, planes y `plan_modules` | Pendiente |
| Gestión de usuarios del tenant y asignación de rol | Pendiente |
| Listado de roles asignables (`GET /roles`) | Pendiente |
| Cambio obligatorio de contraseña y OTP | Pendiente (el login ya devuelve `mustChangePassword`) |
| `GET /me/contexts` | Opcional, a pedir si se necesita |

Limitaciones conocidas: logout no corta de inmediato el access token vigente (hasta 15 min); el refresh token viaja en el body durante el desarrollo; la caché de permisos puede tardar hasta 60 s en reflejar cambios.

## 10. Reglas de oro para el frontend

**Sí:**

- Decidir visibilidad **solo** con la lista `permissions` de `/me/access`.
- Usar `:access` para el menú y las rutas de módulos, y permisos de acción para botones y acciones.
- Volver a pedir `/me/access` al iniciar, al cambiar de contexto y tras un 403 de permisos.
- Limpiar todo el estado y la caché de datos al cambiar de empresa o cerrar sesión.
- Mostrar mensajes distintos según el motivo del 403.

**No:**

- No hardcodear roles en el frontend (`if (rol === 'admin')`). Siempre permisos.
- No enviar `tenantId` para elegir empresa; el tenant viene del token.
- No asumir que ocultar un botón protege algo.
- No renovar tokens en paralelo con el mismo refresh token.
- No mostrar un módulo solo porque aparezca en `modules`: debe tener también el permiso `:access`.
- No guardar el access token en `localStorage`.

## 11. Qué ocurre cuando se crea un módulo nuevo

1. **Backend (código):** se declara el módulo con su permiso `:access` y sus permisos de acción, se agrega a los roles correspondientes y se protegen los endpoints.
2. **Despliegue:** el backend sincroniza automáticamente módulos, permisos y roles en la base de datos.
3. **Frontend (código):** se agrega la ruta con `data.permissions: ['<modulo>:access']` y su entrada de menú.
4. **Plataforma (panel):** el equipo comercial agrega el módulo a los planes que corresponda. Hasta ese momento **nadie lo ve**, aunque su rol lo incluya.

Esto permite desplegar un módulo «apagado», probarlo con un tenant de pruebas y lanzarlo comercialmente sin un nuevo despliegue.

## 12. Usuarios de prueba (solo desarrollo)

Contraseña de todos: `Dev12345!`. Plan `starter`: incluye Ventas, **no** Inventario.

| Email | Contextos | Rol |
| --- | --- | --- |
| `admin@platform.local` | platform + tenant demo | `super_admin` y `tenant_admin` |
| `admin@demo.local` | tenant demo | `tenant_admin` |
| `seller@demo.local` | tenant demo | `seller` |
| `warehouse@demo.local` | tenant demo | `warehouse` |

Casos útiles para probar la UI:

- `admin@platform.local` obliga a mostrar el selector de contexto (`active: null`).
- `warehouse@demo.local` no verá Inventario aunque su rol lo incluya, porque el plan no lo contiene.
- `seller@demo.local` ve Ventas y puede abrir la pantalla compartida de productos.

## 13. Glosario

- **Tenant:** empresa cliente de la plataforma.
- **Contexto:** el «sombrero» con el que opera una sesión: plataforma o una empresa concreta.
- **Plan:** paquete comercial que define los módulos y límites de un tenant.
- **Permiso efectivo:** resultado de combinar el rol con el plan; es lo que devuelve `/me/access`.
- **Módulo núcleo:** módulo disponible para todo tenant, sin permiso `:access`.
- **Scope:** ámbito de un rol o permiso (`platform` o `tenant`).
