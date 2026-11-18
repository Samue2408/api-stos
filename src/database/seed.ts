import dataSource from './data-source';
import * as argon2 from 'argon2';

const DEV_PASSWORD = 'Dev12345!';

async function main() {
  if (process.env.NODE_ENV === 'production') throw new Error('El seed no corre en producción');
  await dataSource.initialize();

  await dataSource.transaction(async (tx) => {
    const one = async (sql: string, params: unknown[]) => {
      const rows = await tx.query(sql, params);
      if (!rows[0]) throw new Error(`Sin resultado: ${sql}`);
      return rows[0].id as string;
    };
    const roleId = (code: string) => one('SELECT id FROM roles WHERE code = $1', [code]);
    const moduleId = (code: string) => one('SELECT id FROM modules WHERE code = $1', [code]);

    // Plan "starter": incluye Ventas, NO Inventario
    const planId = await one(
      `INSERT INTO plans (code, name, max_users, max_projects, storage_limit_bytes)
       VALUES ('starter', 'Starter', 10, 5, 1073741824)
       ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
      [],
    );
    await tx.query(
      `INSERT INTO plan_modules (plan_id, module_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [planId, await moduleId('sales')],
    );

    const tenantId = await one(
      `INSERT INTO tenants (name, slug, plan_id) VALUES ('Empresa Demo', 'demo', $1)
       ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
      [planId],
    );
    await tx.query(
      `INSERT INTO tenant_settings (tenant_id) VALUES ($1) ON CONFLICT DO NOTHING`,
      [tenantId],
    );

    const hash = await argon2.hash(DEV_PASSWORD);
    const user = (email: string, first: string) =>
      one(
        `INSERT INTO users (email, password_hash, first_name, last_name)
         VALUES ($1, $2, $3, 'Demo')
         ON CONFLICT (email) DO UPDATE SET first_name = EXCLUDED.first_name RETURNING id`,
        [email, hash, first],
      );
    const member = async (userId: string, role: string) =>
      tx.query(
        `INSERT INTO tenant_users (tenant_id, user_id, role_id) VALUES ($1, $2, $3)
         ON CONFLICT (tenant_id, user_id) DO UPDATE SET role_id = EXCLUDED.role_id`,
        [tenantId, userId, await roleId(role)],
      );

    // Admin de plataforma que además es admin del tenant demo (2 contextos)
    const superId = await user('admin@platform.local', 'Super');
    await tx.query(
      `INSERT INTO platform_admins (user_id, role_id) VALUES ($1, $2)
       ON CONFLICT (user_id) DO UPDATE SET role_id = EXCLUDED.role_id`,
      [superId, await roleId('super_admin')],
    );
    await member(superId, 'tenant_admin');

    await member(await user('admin@demo.local', 'Admin'), 'tenant_admin');
    await member(await user('seller@demo.local', 'Vendedor'), 'seller');
    await member(await user('warehouse@demo.local', 'Bodeguero'), 'warehouse');
  });

  console.log(`Seed listo. Contraseña de todos: ${DEV_PASSWORD}`);
  await dataSource.destroy();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});