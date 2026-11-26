import { MigrationInterface, QueryRunner } from 'typeorm';

export class OtpPurpose1795657854084 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE user_otps ADD COLUMN purpose varchar(30) NOT NULL DEFAULT 'password_reset'`,
    );
    await queryRunner.query(
      `CREATE INDEX ix_user_otps_lookup ON user_otps (user_id, purpose, created_at DESC)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS ix_user_otps_lookup`);
    await queryRunner.query(`ALTER TABLE user_otps DROP COLUMN purpose`);
  }
}
