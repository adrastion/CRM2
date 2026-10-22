-- AlterTable
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "profileMeta" TEXT;

-- AlterTable
ALTER TABLE "trainers" ADD COLUMN IF NOT EXISTS "hireDate" TIMESTAMP(3);
