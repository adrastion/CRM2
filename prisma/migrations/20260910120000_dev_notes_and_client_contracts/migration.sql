-- CreateTable
CREATE TABLE "super_admin_dev_note_attachments" (
    "id" TEXT NOT NULL,
    "noteId" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "super_admin_dev_note_attachments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "super_admin_dev_note_attachments_noteId_idx" ON "super_admin_dev_note_attachments"("noteId");

ALTER TABLE "super_admin_dev_note_attachments"
ADD CONSTRAINT "super_admin_dev_note_attachments_noteId_fkey"
FOREIGN KEY ("noteId") REFERENCES "super_admin_dev_notes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "super_admin_dev_note_attachments"
ADD CONSTRAINT "super_admin_dev_note_attachments_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "super_admins"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "client_contracts" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "signedAt" TIMESTAMP(3),
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "client_contracts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "client_contracts_clientId_createdAt_idx" ON "client_contracts"("clientId", "createdAt");
CREATE INDEX "client_contracts_tenantId_idx" ON "client_contracts"("tenantId");

ALTER TABLE "client_contracts"
ADD CONSTRAINT "client_contracts_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "client_contracts"
ADD CONSTRAINT "client_contracts_clientId_fkey"
FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "client_contracts"
ADD CONSTRAINT "client_contracts_uploadedById_fkey"
FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "client_contract_addenda" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "signedAt" TIMESTAMP(3),
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_contract_addenda_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "client_contract_addenda_contractId_createdAt_idx" ON "client_contract_addenda"("contractId", "createdAt");

ALTER TABLE "client_contract_addenda"
ADD CONSTRAINT "client_contract_addenda_contractId_fkey"
FOREIGN KEY ("contractId") REFERENCES "client_contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "client_contract_addenda"
ADD CONSTRAINT "client_contract_addenda_uploadedById_fkey"
FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
