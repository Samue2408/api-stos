import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1794848853737 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
                CREATE EXTENSION IF NOT EXISTS "pgcrypto";
                CREATE EXTENSION IF NOT EXISTS "citext";

                CREATE TYPE permission_type AS ENUM ('module_access', 'action');
                CREATE TYPE scope_type      AS ENUM ('platform', 'tenant');
                CREATE TYPE user_status     AS ENUM ('active', 'inactive', 'blocked');
                CREATE TYPE tenant_status   AS ENUM ('active', 'suspended', 'cancelled');
                CREATE TYPE membership_status AS ENUM ('active', 'invited', 'inactive');

                -- ========== Identidad ==========
                CREATE TABLE users (
                id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                email                citext UNIQUE NOT NULL,
                password_hash        text NOT NULL,
                first_name           varchar(120) NOT NULL,
                last_name            varchar(120) NOT NULL,
                status               user_status NOT NULL DEFAULT 'active',
                must_change_password boolean NOT NULL DEFAULT false,
                created_at           timestamptz NOT NULL DEFAULT now(),
                updated_at           timestamptz NOT NULL DEFAULT now()
                );

                CREATE TABLE user_otps (
                id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                otp_hash   text NOT NULL,
                attempts   smallint NOT NULL DEFAULT 0,
                created_at timestamptz NOT NULL DEFAULT now(),
                expires_at timestamptz NOT NULL,
                is_used    boolean NOT NULL DEFAULT false
                );

                CREATE TABLE refresh_tokens (
                id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                tenant_id   uuid,                         -- tenant activo de la sesión
                token_hash  text NOT NULL UNIQUE,
                expires_at  timestamptz NOT NULL,
                revoked_at  timestamptz,
                created_at  timestamptz NOT NULL DEFAULT now()
                );

                -- ========== Catálogo (sincronizado desde código) ==========
                CREATE TABLE modules (
                id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                code        varchar(60) UNIQUE NOT NULL,
                name        varchar(120) NOT NULL,
                description text,
                parent_id   uuid REFERENCES modules(id),
                is_active   boolean NOT NULL DEFAULT true,
                created_at  timestamptz NOT NULL DEFAULT now(),
                updated_at  timestamptz NOT NULL DEFAULT now()
                );

                CREATE TABLE permissions (
                id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                module_id   uuid NOT NULL REFERENCES modules(id),
                code        varchar(100) UNIQUE NOT NULL,
                name        varchar(120) NOT NULL,
                description text,
                type        permission_type NOT NULL DEFAULT 'action',
                scope       scope_type NOT NULL DEFAULT 'tenant',
                is_active   boolean NOT NULL DEFAULT true,
                created_at  timestamptz NOT NULL DEFAULT now()
                );

                CREATE TABLE roles (
                id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                code        varchar(50) UNIQUE NOT NULL,
                name        varchar(120) NOT NULL,
                scope       scope_type NOT NULL,
                description text,
                is_active   boolean NOT NULL DEFAULT true,
                created_at  timestamptz NOT NULL DEFAULT now(),
                UNIQUE (id, scope)                         -- necesario para la FK compuesta
                );

                CREATE TABLE role_permissions (
                role_id       uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
                permission_id uuid NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
                PRIMARY KEY (role_id, permission_id)
                );

                -- ========== Planes (administrados desde el panel de plataforma) ==========
                CREATE TABLE plans (
                id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                code                varchar(50) UNIQUE NOT NULL,
                name                varchar(120) NOT NULL,
                max_users           int NOT NULL,
                max_projects        int NOT NULL,
                storage_limit_bytes bigint NOT NULL,
                is_active           boolean NOT NULL DEFAULT true,
                created_at          timestamptz NOT NULL DEFAULT now(),
                updated_at          timestamptz NOT NULL DEFAULT now()
                );

                CREATE TABLE plan_modules (
                plan_id       uuid NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
                module_id     uuid NOT NULL REFERENCES modules(id),
                configuration jsonb NOT NULL DEFAULT '{}',   -- límites por módulo
                PRIMARY KEY (plan_id, module_id)
                );

                -- ========== Tenants ==========
                CREATE TABLE tenants (
                id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                name       varchar(200) NOT NULL,
                slug       varchar(100) UNIQUE NOT NULL,
                status     tenant_status NOT NULL DEFAULT 'active',
                plan_id    uuid NOT NULL REFERENCES plans(id),
                created_at timestamptz NOT NULL DEFAULT now(),
                updated_at timestamptz NOT NULL DEFAULT now()
                );

                CREATE TABLE tenant_settings (
                id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                tenant_id             uuid UNIQUE NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
                timezone              varchar(80) NOT NULL DEFAULT 'America/Bogota',
                locale                varchar(20) NOT NULL DEFAULT 'es-CO',
                currency              char(3) NOT NULL DEFAULT 'COP',
                date_format           varchar(30) NOT NULL DEFAULT 'DD/MM/YYYY',
                logo_url              text,
                primary_color         varchar(7),
                secondary_color       varchar(7),
                accent_color          varchar(7),
                notification_settings jsonb NOT NULL DEFAULT '{}',
                retention_days        int,
                created_at            timestamptz NOT NULL DEFAULT now(),
                updated_at            timestamptz NOT NULL DEFAULT now()
                );

                -- ========== Membresías (con scope de rol garantizado por la BD) ==========
                CREATE TABLE tenant_users (
                id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                tenant_id  uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
                user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                role_id    uuid NOT NULL,
                role_scope scope_type NOT NULL DEFAULT 'tenant' CHECK (role_scope = 'tenant'),
                status     membership_status NOT NULL DEFAULT 'active',
                created_at timestamptz NOT NULL DEFAULT now(),
                updated_at timestamptz NOT NULL DEFAULT now(),
                UNIQUE (tenant_id, user_id),
                FOREIGN KEY (role_id, role_scope) REFERENCES roles (id, scope)
                );

                CREATE TABLE platform_admins (
                user_id    uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
                role_id    uuid NOT NULL,
                role_scope scope_type NOT NULL DEFAULT 'platform' CHECK (role_scope = 'platform'),
                created_at timestamptz NOT NULL DEFAULT now(),
                FOREIGN KEY (role_id, role_scope) REFERENCES roles (id, scope)
                );

                -- ========== Auditoría ==========
                CREATE TABLE audit_log (
                id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                tenant_id   uuid,
                actor_id    uuid REFERENCES users(id),
                action      varchar(100) NOT NULL,       -- 'user.role_changed', 'plan.module_added'
                entity_type varchar(60),
                entity_id   uuid,
                metadata    jsonb NOT NULL DEFAULT '{}',
                ip          inet,
                created_at  timestamptz NOT NULL DEFAULT now()
                );

                -- ========== Índices ==========
                CREATE INDEX ix_tenant_users_user   ON tenant_users (user_id);
                CREATE INDEX ix_permissions_module  ON permissions (module_id);
                CREATE INDEX ix_user_otps_user      ON user_otps (user_id, expires_at);
                CREATE INDEX ix_refresh_user        ON refresh_tokens (user_id) WHERE revoked_at IS NULL;
                CREATE INDEX ix_audit_tenant_date   ON audit_log (tenant_id, created_at DESC);
            `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE IF EXISTS
        audit_log, platform_admins, tenant_users, tenant_settings, tenants,
        plan_modules, plans, role_permissions, roles, permissions, modules,
        refresh_tokens, user_otps, users
      CASCADE;
      DROP TYPE IF EXISTS
        membership_status, tenant_status, user_status, scope_type, permission_type;
    `);
  }
}
