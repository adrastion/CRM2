-- Public site settings on SuperAdminSettings
ALTER TABLE "super_admin_settings" ADD COLUMN IF NOT EXISTS "mobileDownloadTabEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "super_admin_settings" ADD COLUMN IF NOT EXISTS "mobilePublicApkEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "super_admin_settings" ADD COLUMN IF NOT EXISTS "mobileRustoreUrl" TEXT;
ALTER TABLE "super_admin_settings" ADD COLUMN IF NOT EXISTS "mobileIosInstructionEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "super_admin_settings" ADD COLUMN IF NOT EXISTS "mobileIosInstructionText" TEXT;
ALTER TABLE "super_admin_settings" ADD COLUMN IF NOT EXISTS "socialLinksJson" TEXT NOT NULL DEFAULT '[]';

-- Public flag on platform news
ALTER TABLE "platform_changelog_entries" ADD COLUMN IF NOT EXISTS "isPublicOnSite" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS "platform_changelog_entries_isPublicOnSite_publishedAt_idx"
  ON "platform_changelog_entries"("isPublicOnSite", "publishedAt");

-- Vacancy enums + tables
DO $$ BEGIN
  CREATE TYPE "VacancyRoleType" AS ENUM ('MARKETER', 'DESIGNER', 'PROMOTER', 'OTHER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "VacancyApplicationStatus" AS ENUM ('NEW', 'READ', 'ARCHIVED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "SiteFeedbackStatus" AS ENUM ('NEW', 'READ', 'ARCHIVED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "vacancies" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "roleType" "VacancyRoleType" NOT NULL,
  "description" TEXT NOT NULL,
  "requirements" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "vacancies_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "vacancies_slug_key" ON "vacancies"("slug");
CREATE INDEX IF NOT EXISTS "vacancies_isActive_sortOrder_idx" ON "vacancies"("isActive", "sortOrder");

CREATE TABLE IF NOT EXISTS "vacancy_applications" (
  "id" TEXT NOT NULL,
  "vacancyId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "contacts" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "status" "VacancyApplicationStatus" NOT NULL DEFAULT 'NEW',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "vacancy_applications_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "vacancy_applications_status_createdAt_idx"
  ON "vacancy_applications"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "vacancy_applications_vacancyId_createdAt_idx"
  ON "vacancy_applications"("vacancyId", "createdAt");

ALTER TABLE "vacancy_applications"
  DROP CONSTRAINT IF EXISTS "vacancy_applications_vacancyId_fkey";
ALTER TABLE "vacancy_applications"
  ADD CONSTRAINT "vacancy_applications_vacancyId_fkey"
  FOREIGN KEY ("vacancyId") REFERENCES "vacancies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "site_feedback" (
  "id" TEXT NOT NULL,
  "name" TEXT,
  "contact" TEXT,
  "body" TEXT NOT NULL,
  "status" "SiteFeedbackStatus" NOT NULL DEFAULT 'NEW',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "site_feedback_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "site_feedback_status_createdAt_idx"
  ON "site_feedback"("status", "createdAt");
