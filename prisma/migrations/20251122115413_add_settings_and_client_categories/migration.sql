-- AlterTable
ALTER TABLE "clients" ADD COLUMN     "categoryId" TEXT;

-- CreateTable
CREATE TABLE "client_categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "client_categories_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "client_categories" ADD CONSTRAINT "client_categories_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clients" ADD CONSTRAINT "clients_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "client_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
