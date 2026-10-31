-- AlterTable
ALTER TABLE "super_admin_settings" ADD COLUMN "marketerLegalPackVersion" TEXT NOT NULL DEFAULT '2026-10-30-draft';
ALTER TABLE "super_admin_settings" ADD COLUMN "marketerLegalPackUpdatedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "marketer_legal_documents" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL DEFAULT 'application/pdf',
    "size" INTEGER NOT NULL,
    "storagePath" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "marketer_legal_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "marketer_legal_documents_key_key" ON "marketer_legal_documents"("key");

-- CreateIndex
CREATE INDEX "marketer_legal_documents_sortOrder_idx" ON "marketer_legal_documents"("sortOrder");
