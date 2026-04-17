import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCoreTables1000000000000 implements MigrationInterface {
  name = 'CreateCoreTables1000000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── hotels ─────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE hotels (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name            VARCHAR(200) NOT NULL,
        slug            VARCHAR(100) NOT NULL UNIQUE,
        address_line1   VARCHAR(300),
        city            VARCHAR(100),
        country_code    VARCHAR(3)  NOT NULL DEFAULT 'IDN',
        timezone        VARCHAR(50) NOT NULL DEFAULT 'Asia/Jakarta',
        currency_code   VARCHAR(3)  NOT NULL DEFAULT 'IDR',
        tax_id          VARCHAR(30),
        settings        JSONB,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // ── departments & sub_departments ──────────────────────
    await queryRunner.query(`
      CREATE TABLE departments (
        id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        hotel_id      UUID NOT NULL REFERENCES hotels(id),
        code          VARCHAR(20) NOT NULL,
        name          VARCHAR(100) NOT NULL,
        type          VARCHAR(30) NOT NULL DEFAULT 'ROOMS',
        is_active     BOOLEAN NOT NULL DEFAULT true,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE sub_departments (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        hotel_id        UUID NOT NULL REFERENCES hotels(id),
        department_id   UUID NOT NULL REFERENCES departments(id),
        code            VARCHAR(20) NOT NULL,
        name            VARCHAR(100) NOT NULL,
        is_active       BOOLEAN NOT NULL DEFAULT true,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // ── companies ──────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE companies (
        id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        hotel_id          UUID NOT NULL REFERENCES hotels(id),
        name              VARCHAR(200) NOT NULL,
        code              VARCHAR(30),
        company_type      VARCHAR(30) NOT NULL DEFAULT 'CORPORATE',
        credit_limit      DECIMAL(15,2) NOT NULL DEFAULT 0,
        commission_rate   DECIMAL(5,2)  NOT NULL DEFAULT 0,
        billing_address   TEXT,
        tax_id            VARCHAR(30),
        is_active         BOOLEAN NOT NULL DEFAULT true,
        created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // ── tax_configs ────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE tax_configs (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        hotel_id    UUID NOT NULL REFERENCES hotels(id),
        name        VARCHAR(100) NOT NULL,
        code        VARCHAR(20)  NOT NULL,
        rate        DECIMAL(5,2) NOT NULL DEFAULT 0,
        type        VARCHAR(20)  NOT NULL DEFAULT 'PERCENTAGE',
        compound    BOOLEAN NOT NULL DEFAULT false,
        is_active   BOOLEAN NOT NULL DEFAULT true,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // ── users ──────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE users (
        id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        hotel_id      UUID NOT NULL REFERENCES hotels(id),
        email         VARCHAR(200) NOT NULL,
        password_hash VARCHAR(200) NOT NULL,
        full_name     VARCHAR(200) NOT NULL,
        role          VARCHAR(30)  NOT NULL DEFAULT 'FRONT_DESK',
        is_active     BOOLEAN NOT NULL DEFAULT true,
        last_login_at TIMESTAMPTZ,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(hotel_id, email)
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS users`);
    await queryRunner.query(`DROP TABLE IF EXISTS tax_configs`);
    await queryRunner.query(`DROP TABLE IF EXISTS companies`);
    await queryRunner.query(`DROP TABLE IF EXISTS sub_departments`);
    await queryRunner.query(`DROP TABLE IF EXISTS departments`);
    await queryRunner.query(`DROP TABLE IF EXISTS hotels`);
  }
}
