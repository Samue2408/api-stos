import { MigrationInterface, QueryRunner } from "typeorm";

export class PlatformIndexes1795570621144 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE INDEX ix_tenants_plan ON tenants (plan_id)`);
        await queryRunner.query(`CREATE INDEX ix_audit_created ON audit_log (created_at DESC)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS ix_tenants_plan`);
        await queryRunner.query(`DROP INDEX IF EXISTS ix_audit_created`);
    }

}
