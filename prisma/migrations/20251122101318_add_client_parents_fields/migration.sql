-- AlterTable
ALTER TABLE "clients" ADD COLUMN     "birthCertificateNumber" TEXT,
ADD COLUMN     "medicalCertificateNumber" TEXT,
ADD COLUMN     "schoolOrKindergarten" TEXT;

-- CreateTable
CREATE TABLE "parents" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "workplace" TEXT,
    "workplaceContact" TEXT,
    "clientId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "parents_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "parents" ADD CONSTRAINT "parents_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parents" ADD CONSTRAINT "parents_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
