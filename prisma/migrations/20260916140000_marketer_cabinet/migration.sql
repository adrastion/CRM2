-- Marketer cabinet: leads, tasks, publications, docs, commission ledger, chats

CREATE TABLE IF NOT EXISTS "marketer_leads" (
    "id" TEXT NOT NULL,
    "marketerId" TEXT NOT NULL,
    "displayCode" TEXT NOT NULL,
    "contactName" TEXT,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "notes" TEXT,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "convertedTenantId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "marketer_leads_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "marketer_leads_marketerId_displayCode_key" ON "marketer_leads"("marketerId", "displayCode");
CREATE INDEX IF NOT EXISTS "marketer_leads_marketerId_status_idx" ON "marketer_leads"("marketerId", "status");
CREATE INDEX IF NOT EXISTS "marketer_leads_convertedTenantId_idx" ON "marketer_leads"("convertedTenantId");

CREATE TABLE IF NOT EXISTS "marketer_tasks" (
    "id" TEXT NOT NULL,
    "marketerId" TEXT NOT NULL,
    "leadId" TEXT,
    "tenantId" TEXT,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "dueAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "kind" TEXT NOT NULL DEFAULT 'TASK',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "marketer_tasks_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "marketer_tasks_marketerId_dueAt_idx" ON "marketer_tasks"("marketerId", "dueAt");
CREATE INDEX IF NOT EXISTS "marketer_tasks_marketerId_status_idx" ON "marketer_tasks"("marketerId", "status");
CREATE INDEX IF NOT EXISTS "marketer_tasks_leadId_idx" ON "marketer_tasks"("leadId");
CREATE INDEX IF NOT EXISTS "marketer_tasks_tenantId_idx" ON "marketer_tasks"("tenantId");

CREATE TABLE IF NOT EXISTS "platform_publications" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "imageUrl" TEXT,
    "fileUrl" TEXT,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdBySuperAdminId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "platform_publications_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "platform_publications_isActive_publishedAt_idx" ON "platform_publications"("isActive", "publishedAt");

CREATE TABLE IF NOT EXISTS "marketer_closing_docs" (
    "id" TEXT NOT NULL,
    "marketerId" TEXT,
    "title" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "periodLabel" TEXT,
    "uploadedBySuperAdminId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "marketer_closing_docs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "marketer_closing_docs_marketerId_createdAt_idx" ON "marketer_closing_docs"("marketerId", "createdAt");

CREATE TABLE IF NOT EXISTS "marketer_commission_ledger" (
    "id" TEXT NOT NULL,
    "marketerId" TEXT NOT NULL,
    "tenantId" TEXT,
    "kind" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "externalKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "marketer_commission_ledger_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "marketer_commission_ledger_marketerId_externalKey_key" ON "marketer_commission_ledger"("marketerId", "externalKey");
CREATE INDEX IF NOT EXISTS "marketer_commission_ledger_marketerId_occurredAt_idx" ON "marketer_commission_ledger"("marketerId", "occurredAt");
CREATE INDEX IF NOT EXISTS "marketer_commission_ledger_tenantId_idx" ON "marketer_commission_ledger"("tenantId");

CREATE TABLE IF NOT EXISTS "marketer_chat_threads" (
    "id" TEXT NOT NULL,
    "marketerId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "marketer_chat_threads_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "marketer_chat_threads_marketerId_channel_key" ON "marketer_chat_threads"("marketerId", "channel");
CREATE INDEX IF NOT EXISTS "marketer_chat_threads_channel_status_idx" ON "marketer_chat_threads"("channel", "status");

CREATE TABLE IF NOT EXISTS "marketer_chat_messages" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "authorType" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "authorMarketerId" TEXT,
    "authorStaffId" TEXT,
    "authorSuperAdminId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "marketer_chat_messages_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "marketer_chat_messages_threadId_createdAt_idx" ON "marketer_chat_messages"("threadId", "createdAt");

DO $$ BEGIN
  ALTER TABLE "marketer_leads" ADD CONSTRAINT "marketer_leads_marketerId_fkey"
    FOREIGN KEY ("marketerId") REFERENCES "marketers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "marketer_tasks" ADD CONSTRAINT "marketer_tasks_marketerId_fkey"
    FOREIGN KEY ("marketerId") REFERENCES "marketers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "marketer_tasks" ADD CONSTRAINT "marketer_tasks_leadId_fkey"
    FOREIGN KEY ("leadId") REFERENCES "marketer_leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "platform_publications" ADD CONSTRAINT "platform_publications_createdBySuperAdminId_fkey"
    FOREIGN KEY ("createdBySuperAdminId") REFERENCES "super_admins"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "marketer_closing_docs" ADD CONSTRAINT "marketer_closing_docs_marketerId_fkey"
    FOREIGN KEY ("marketerId") REFERENCES "marketers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "marketer_closing_docs" ADD CONSTRAINT "marketer_closing_docs_uploadedBySuperAdminId_fkey"
    FOREIGN KEY ("uploadedBySuperAdminId") REFERENCES "super_admins"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "marketer_commission_ledger" ADD CONSTRAINT "marketer_commission_ledger_marketerId_fkey"
    FOREIGN KEY ("marketerId") REFERENCES "marketers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "marketer_chat_threads" ADD CONSTRAINT "marketer_chat_threads_marketerId_fkey"
    FOREIGN KEY ("marketerId") REFERENCES "marketers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "marketer_chat_messages" ADD CONSTRAINT "marketer_chat_messages_threadId_fkey"
    FOREIGN KEY ("threadId") REFERENCES "marketer_chat_threads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
