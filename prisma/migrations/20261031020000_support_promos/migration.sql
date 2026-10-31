-- CreateTable
CREATE TABLE "support_promos" (
    "id" TEXT NOT NULL,
    "key" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "badgeLabel" TEXT,
    "buttonLabel" TEXT NOT NULL,
    "ticketKind" TEXT NOT NULL DEFAULT 'GENERAL',
    "ticketSubject" TEXT,
    "defaultMessage" TEXT,
    "audience" TEXT NOT NULL DEFAULT 'school',
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "support_promos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "support_promos_key_key" ON "support_promos"("key");

-- CreateIndex
CREATE INDEX "support_promos_isActive_audience_sortOrder_idx" ON "support_promos"("isActive", "audience", "sortOrder");

-- Seed default «Быстрая настройка» (выключена; включается в SA → Поддержка → Акции)
INSERT INTO "support_promos" (
  "id", "key", "title", "description", "badgeLabel", "buttonLabel",
  "ticketKind", "ticketSubject", "defaultMessage", "audience", "isActive", "sortOrder", "createdAt", "updatedAt"
) VALUES (
  'seed_quick_setup_promo',
  'quick_setup',
  'Быстрая настройка',
  'Наш специалист поможет быстро настроить систему под вашу школу: сотрудники, группы, расписание и список учеников.',
  'Только в рамках акции',
  'Быстрая настройка',
  'QUICK_SETUP',
  'Быстрая настройка',
  'Заявка на быструю настройку системы под школу: сотрудники, группы, расписание и список учеников.',
  'school',
  false,
  10,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);
