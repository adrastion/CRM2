-- CreateTable
CREATE TABLE "exercises" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "exercises_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "exercise_media" (
    "id" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "exercise_media_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "workout_templates" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "workout_templates_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "workout_template_items" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "durationSec" INTEGER,
    "sets" INTEGER,
    "reps" INTEGER,
    "notes" TEXT,
    CONSTRAINT "workout_template_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "training_cycles" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "title" TEXT,
    "dateFrom" TIMESTAMP(3) NOT NULL,
    "dateTo" TIMESTAMP(3) NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "training_cycles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "training_cycle_groups" (
    "id" TEXT NOT NULL,
    "cycleId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    CONSTRAINT "training_cycle_groups_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "training_session_plans" (
    "id" TEXT NOT NULL,
    "trainingId" TEXT NOT NULL,
    "cycleId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "training_session_plans_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "training_session_plan_items" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "section" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "durationSec" INTEGER,
    "sets" INTEGER,
    "reps" INTEGER,
    "notes" TEXT,
    CONSTRAINT "training_session_plan_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "exercises_tenantId_title_idx" ON "exercises"("tenantId", "title");
CREATE INDEX "exercise_media_exerciseId_sortOrder_idx" ON "exercise_media"("exerciseId", "sortOrder");
CREATE INDEX "workout_templates_tenantId_kind_idx" ON "workout_templates"("tenantId", "kind");
CREATE INDEX "workout_template_items_templateId_sortOrder_idx" ON "workout_template_items"("templateId", "sortOrder");
CREATE INDEX "training_cycles_tenantId_dateFrom_dateTo_idx" ON "training_cycles"("tenantId", "dateFrom", "dateTo");
CREATE UNIQUE INDEX "training_cycle_groups_cycleId_groupId_key" ON "training_cycle_groups"("cycleId", "groupId");
CREATE INDEX "training_cycle_groups_groupId_idx" ON "training_cycle_groups"("groupId");
CREATE UNIQUE INDEX "training_session_plans_trainingId_key" ON "training_session_plans"("trainingId");
CREATE INDEX "training_session_plans_cycleId_idx" ON "training_session_plans"("cycleId");
CREATE INDEX "training_session_plan_items_planId_section_sortOrder_idx" ON "training_session_plan_items"("planId", "section", "sortOrder");

ALTER TABLE "exercises" ADD CONSTRAINT "exercises_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "exercises" ADD CONSTRAINT "exercises_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "exercise_media" ADD CONSTRAINT "exercise_media_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "exercises"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "workout_templates" ADD CONSTRAINT "workout_templates_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "workout_templates" ADD CONSTRAINT "workout_templates_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "workout_template_items" ADD CONSTRAINT "workout_template_items_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "workout_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "workout_template_items" ADD CONSTRAINT "workout_template_items_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "exercises"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "training_cycles" ADD CONSTRAINT "training_cycles_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "training_cycles" ADD CONSTRAINT "training_cycles_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "training_cycle_groups" ADD CONSTRAINT "training_cycle_groups_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "training_cycles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "training_cycle_groups" ADD CONSTRAINT "training_cycle_groups_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "training_session_plans" ADD CONSTRAINT "training_session_plans_trainingId_fkey" FOREIGN KEY ("trainingId") REFERENCES "trainings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "training_session_plans" ADD CONSTRAINT "training_session_plans_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "training_cycles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "training_session_plan_items" ADD CONSTRAINT "training_session_plan_items_planId_fkey" FOREIGN KEY ("planId") REFERENCES "training_session_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "training_session_plan_items" ADD CONSTRAINT "training_session_plan_items_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "exercises"("id") ON DELETE CASCADE ON UPDATE CASCADE;
