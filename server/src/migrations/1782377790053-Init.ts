import { MigrationInterface, QueryRunner } from "typeorm";

export class Init1782377790053 implements MigrationInterface {
    name = 'Init1782377790053'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // uuid_generate_v4() (used by the uuid primary keys below) lives in uuid-ossp
        await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
        await queryRunner.query(`CREATE TABLE "entitlements" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "ownerId" uuid NOT NULL, "tier" text NOT NULL DEFAULT 'free', "sourceOrderId" text, "status" text NOT NULL DEFAULT 'active', "source" text, "plan" text, "productId" text, "transactionRef" text, "expiresAt" TIMESTAMP, "grantedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_6a45cb6f5747d49365a879bffde" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "uq_entitlement_txn" ON "entitlements" ("transactionRef") WHERE "transactionRef" IS NOT NULL`);
        await queryRunner.query(`CREATE TABLE "warranty_claims" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "deviceId" uuid NOT NULL, "type" character varying NOT NULL, "description" text, "status" text NOT NULL DEFAULT 'submitted', "reference" character varying NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_10984f957c4bc90ec2b9170214e" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "devices" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "ownerId" uuid NOT NULL, "serial" character varying NOT NULL, "nickname" text, "model" text, "warrantyStatus" text NOT NULL DEFAULT 'active', "warrantyMonths" integer NOT NULL DEFAULT '24', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_b1514758245c12daf43486dd1f0" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "uq_device_serial" ON "devices" ("serial") `);
        await queryRunner.query(`CREATE TABLE "session_logs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "ownerId" uuid NOT NULL, "deviceId" text, "contentId" text, "startedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_c207b11fec303a8c7f04cab22c9" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "owners" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "email" character varying NOT NULL, "passwordHash" character varying NOT NULL, "name" character varying NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_df4ef717018c5dc7bd3f4ab0de5" UNIQUE ("email"), CONSTRAINT "PK_42838282f2e6b216301a70b02d6" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "content_items" ("id" character varying NOT NULL, "type" text NOT NULL, "title" character varying NOT NULL, "subtitle" text, "duration" text, "audioKey" text, "coverKey" text, "locked" boolean NOT NULL DEFAULT false, "newThisMonth" boolean NOT NULL DEFAULT false, "programId" text, CONSTRAINT "PK_9c6bf4f28851752cee186915e39" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "programs" ("id" character varying NOT NULL, "title" character varying NOT NULL, "subtitle" text, "avatar" text, "weeks" integer NOT NULL DEFAULT '1', "coverKey" text, "locked" boolean NOT NULL DEFAULT false, "steps" text, CONSTRAINT "PK_d43c664bcaafc0e8a06dfd34e05" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "profiles" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "ownerId" uuid NOT NULL, "name" character varying NOT NULL, "type" text NOT NULL DEFAULT 'adult', "isPrimary" boolean NOT NULL DEFAULT false, "ageBand" text, "anonymous" boolean NOT NULL DEFAULT true, "prefs" text, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_8e520eb4da7dc01d0e190447c8e" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "uq_profile_primary" ON "profiles" ("ownerId") WHERE "isPrimary" = true`);
        await queryRunner.query(`CREATE TABLE "saved_mixes" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "profileId" character varying NOT NULL, "name" character varying NOT NULL, "sounds" text NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_8c230821ec067b69c55cd186b4b" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "community_posts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "ownerId" text, "handle" character varying NOT NULL DEFAULT 'A CalmCarry parent', "text" text NOT NULL, "status" text NOT NULL DEFAULT 'pending', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_af0c0b33e03b933e3e48119f2e3" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "push_tokens" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "ownerId" character varying NOT NULL, "token" character varying NOT NULL, "platform" text NOT NULL DEFAULT 'ios', "enabled" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_869b4a9ba2c9e030aafc4b7dc7a" UNIQUE ("token"), CONSTRAINT "PK_32734e87f299c29ca3878861f4f" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "analytics_events" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" text NOT NULL, "anonId" text, "props" text, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_5d643d67a09b55653e98616f421" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "idx_event_name_at" ON "analytics_events" ("name", "createdAt") `);
        await queryRunner.query(`CREATE TABLE "caregiver_links" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "householdOwnerId" character varying NOT NULL, "caregiverOwnerId" character varying NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_7dc743a6b5a44550a0bb916244e" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "uq_caregiver_owner" ON "caregiver_links" ("caregiverOwnerId") `);
        await queryRunner.query(`CREATE TABLE "caregiver_invites" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "code" character varying NOT NULL, "householdOwnerId" character varying NOT NULL, "expiresAt" TIMESTAMP, "redeemedByOwnerId" text, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_f7015bfc1e58c70fc12925ffe90" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "uq_caregiver_invite_code" ON "caregiver_invites" ("code") `);
        await queryRunner.query(`ALTER TABLE "entitlements" ADD CONSTRAINT "FK_b450fd8cc89b8a5d84b64308b92" FOREIGN KEY ("ownerId") REFERENCES "owners"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "warranty_claims" ADD CONSTRAINT "FK_e32ad80178c8541fbc8d1856237" FOREIGN KEY ("deviceId") REFERENCES "devices"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "devices" ADD CONSTRAINT "FK_968904d168816becbe1012dabcf" FOREIGN KEY ("ownerId") REFERENCES "owners"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "session_logs" ADD CONSTRAINT "FK_a34e45f72acd31ddbbf6b2fab3b" FOREIGN KEY ("ownerId") REFERENCES "owners"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "profiles" ADD CONSTRAINT "FK_c37303d3b952614569fcb8e12a7" FOREIGN KEY ("ownerId") REFERENCES "owners"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "profiles" DROP CONSTRAINT "FK_c37303d3b952614569fcb8e12a7"`);
        await queryRunner.query(`ALTER TABLE "session_logs" DROP CONSTRAINT "FK_a34e45f72acd31ddbbf6b2fab3b"`);
        await queryRunner.query(`ALTER TABLE "devices" DROP CONSTRAINT "FK_968904d168816becbe1012dabcf"`);
        await queryRunner.query(`ALTER TABLE "warranty_claims" DROP CONSTRAINT "FK_e32ad80178c8541fbc8d1856237"`);
        await queryRunner.query(`ALTER TABLE "entitlements" DROP CONSTRAINT "FK_b450fd8cc89b8a5d84b64308b92"`);
        await queryRunner.query(`DROP INDEX "public"."uq_caregiver_invite_code"`);
        await queryRunner.query(`DROP TABLE "caregiver_invites"`);
        await queryRunner.query(`DROP INDEX "public"."uq_caregiver_owner"`);
        await queryRunner.query(`DROP TABLE "caregiver_links"`);
        await queryRunner.query(`DROP INDEX "public"."idx_event_name_at"`);
        await queryRunner.query(`DROP TABLE "analytics_events"`);
        await queryRunner.query(`DROP TABLE "push_tokens"`);
        await queryRunner.query(`DROP TABLE "community_posts"`);
        await queryRunner.query(`DROP TABLE "saved_mixes"`);
        await queryRunner.query(`DROP INDEX "public"."uq_profile_primary"`);
        await queryRunner.query(`DROP TABLE "profiles"`);
        await queryRunner.query(`DROP TABLE "programs"`);
        await queryRunner.query(`DROP TABLE "content_items"`);
        await queryRunner.query(`DROP TABLE "owners"`);
        await queryRunner.query(`DROP TABLE "session_logs"`);
        await queryRunner.query(`DROP INDEX "public"."uq_device_serial"`);
        await queryRunner.query(`DROP TABLE "devices"`);
        await queryRunner.query(`DROP TABLE "warranty_claims"`);
        await queryRunner.query(`DROP INDEX "public"."uq_entitlement_txn"`);
        await queryRunner.query(`DROP TABLE "entitlements"`);
    }

}
