import { MigrationInterface, QueryRunner } from 'typeorm';

export class RefreshTokenContext1794962851106 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            ALTER TABLE refresh_tokens
        ADD COLUMN context varchar(10) NOT NULL DEFAULT 'none'
        CHECK (context IN ('none','platform','tenant'));
            `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE refresh_tokens DROP COLUMN context;`);
  }
}
