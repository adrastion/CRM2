-- CreateTable (IF NOT EXISTS for idempotency if add_standards_manual.sql was run before)
CREATE TABLE IF NOT EXISTS "standards" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "unit" TEXT,
    "targetValue" DECIMAL(65,30),
    "category" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "standards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "client_standards" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "standardId" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL,
    "result" DECIMAL(65,30),
    "resultText" TEXT,
    "status" TEXT NOT NULL DEFAULT 'completed',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_standards_pkey" PRIMARY KEY ("id")
);

-- Add updatedAt if table was created by add_standards_manual.sql (which lacked it)
ALTER TABLE "client_standards" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AddForeignKey (DROP IF EXISTS so we can re-add idempotently)
ALTER TABLE "standards" DROP CONSTRAINT IF EXISTS "standards_tenantId_fkey";
ALTER TABLE "standards" ADD CONSTRAINT "standards_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "client_standards" DROP CONSTRAINT IF EXISTS "client_standards_clientId_fkey";
ALTER TABLE "client_standards" ADD CONSTRAINT "client_standards_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "client_standards" DROP CONSTRAINT IF EXISTS "client_standards_standardId_fkey";
ALTER TABLE "client_standards" ADD CONSTRAINT "client_standards_standardId_fkey" FOREIGN KEY ("standardId") REFERENCES "standards"("id") ON DELETE CASCADE ON UPDATE CASCADE;
