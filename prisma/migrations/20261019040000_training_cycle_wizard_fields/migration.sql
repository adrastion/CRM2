-- AlterTable
ALTER TABLE "training_cycles" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "training_cycles" ADD COLUMN IF NOT EXISTS "frequency" TEXT NOT NULL DEFAULT 'WEEKLY';
ALTER TABLE "training_cycles" ADD COLUMN IF NOT EXISTS "quantity" INTEGER;
