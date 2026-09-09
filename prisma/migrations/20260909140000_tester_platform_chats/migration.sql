-- CreateTable testers
CREATE TABLE "testers" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLogin" TIMESTAMP(3),
    "linkedUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "testers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "testers_email_key" ON "testers"("email");
CREATE UNIQUE INDEX "testers_linkedUserId_key" ON "testers"("linkedUserId");
ALTER TABLE "testers" ADD CONSTRAINT "testers_linkedUserId_fkey" FOREIGN KEY ("linkedUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Changelog
CREATE TABLE "platform_changelog_entries" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "platform_changelog_entries_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "platform_changelog_entries_createdAt_idx" ON "platform_changelog_entries"("createdAt");
ALTER TABLE "platform_changelog_entries" ADD CONSTRAINT "platform_changelog_entries_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "super_admins"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Chat enum values
ALTER TYPE "ChatThreadType" ADD VALUE 'PLATFORM_TESTERS';
ALTER TYPE "ChatThreadType" ADD VALUE 'SUPER_ADMINS';

-- Migrate trainers thread keys to include tenantId before dropping composite unique
UPDATE "chat_threads"
SET "threadKey" = 'trainers:' || "tenantId"
WHERE "type" = 'TRAINERS' AND "threadKey" = 'trainers' AND "tenantId" IS NOT NULL;

-- Drop old unique, make tenantId nullable, add global unique on threadKey
DROP INDEX IF EXISTS "chat_threads_tenantId_threadKey_key";

ALTER TABLE "chat_threads" ALTER COLUMN "tenantId" DROP NOT NULL;
ALTER TABLE "chat_messages" ALTER COLUMN "tenantId" DROP NOT NULL;

ALTER TABLE "chat_messages" ADD COLUMN IF NOT EXISTS "authorSuperAdminId" TEXT;
ALTER TABLE "chat_messages" ADD COLUMN IF NOT EXISTS "authorTesterId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "chat_threads_threadKey_key" ON "chat_threads"("threadKey");
CREATE INDEX IF NOT EXISTS "chat_threads_type_idx" ON "chat_threads"("type");
