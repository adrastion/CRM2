-- AlterTable
ALTER TABLE "trainers" ADD COLUMN IF NOT EXISTS "coachCategory" TEXT;
ALTER TABLE "trainers" ADD COLUMN IF NOT EXISTS "judgeCategory" TEXT;
ALTER TABLE "trainers" ADD COLUMN IF NOT EXISTS "achievements" TEXT;

-- CreateTable
CREATE TABLE IF NOT EXISTS "trainer_documents" (
    "id" TEXT NOT NULL,
    "trainerId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'OTHER',
    "title" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trainer_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "trainer_documents_trainerId_createdAt_idx" ON "trainer_documents"("trainerId", "createdAt");
CREATE INDEX IF NOT EXISTS "trainer_documents_tenantId_idx" ON "trainer_documents"("tenantId");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "trainer_documents" ADD CONSTRAINT "trainer_documents_trainerId_fkey"
    FOREIGN KEY ("trainerId") REFERENCES "trainers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "trainer_documents" ADD CONSTRAINT "trainer_documents_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "trainer_documents" ADD CONSTRAINT "trainer_documents_uploadedById_fkey"
    FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
