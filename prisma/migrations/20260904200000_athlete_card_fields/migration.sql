-- AlterTable: clients — athlete profile fields
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "discipline" TEXT;
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "weightCategory" TEXT;
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "athleteStatus" TEXT NOT NULL DEFAULT 'active';

-- AlterTable: parents — relation metadata
ALTER TABLE "parents" ADD COLUMN IF NOT EXISTS "relationType" TEXT;
ALTER TABLE "parents" ADD COLUMN IF NOT EXISTS "isPrimaryContact" BOOLEAN NOT NULL DEFAULT false;
