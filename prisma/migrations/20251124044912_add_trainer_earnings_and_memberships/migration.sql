-- AlterTable
ALTER TABLE "groups" ADD COLUMN     "trainingPrice" DECIMAL(65,30);

-- AlterTable
ALTER TABLE "memberships" ADD COLUMN     "visits" INTEGER,
ALTER COLUMN "duration" DROP NOT NULL;

-- CreateTable
CREATE TABLE "client_memberships" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" TIMESTAMP(3),
    "visitsUsed" INTEGER NOT NULL DEFAULT 0,
    "visitsTotal" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "client_memberships_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "client_memberships" ADD CONSTRAINT "client_memberships_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_memberships" ADD CONSTRAINT "client_memberships_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_memberships" ADD CONSTRAINT "client_memberships_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
