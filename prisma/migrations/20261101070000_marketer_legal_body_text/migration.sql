-- AlterTable
ALTER TABLE "marketer_legal_documents" ADD COLUMN "bodyText" TEXT;
ALTER TABLE "marketer_legal_documents" ALTER COLUMN "storagePath" DROP NOT NULL;
ALTER TABLE "marketer_legal_documents" ALTER COLUMN "size" SET DEFAULT 0;
