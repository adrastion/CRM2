-- StaffTask links to calendar items
ALTER TABLE "staff_tasks"
ADD COLUMN IF NOT EXISTS "relatedTrainingId" TEXT,
ADD COLUMN IF NOT EXISTS "relatedSchoolEventId" TEXT;

CREATE INDEX IF NOT EXISTS "staff_tasks_relatedTrainingId_idx"
ON "staff_tasks"("relatedTrainingId");

CREATE INDEX IF NOT EXISTS "staff_tasks_relatedSchoolEventId_idx"
ON "staff_tasks"("relatedSchoolEventId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'staff_tasks_relatedTrainingId_fkey'
  ) THEN
    ALTER TABLE "staff_tasks"
    ADD CONSTRAINT "staff_tasks_relatedTrainingId_fkey"
    FOREIGN KEY ("relatedTrainingId") REFERENCES "trainings"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'staff_tasks_relatedSchoolEventId_fkey'
  ) THEN
    ALTER TABLE "staff_tasks"
    ADD CONSTRAINT "staff_tasks_relatedSchoolEventId_fkey"
    FOREIGN KEY ("relatedSchoolEventId") REFERENCES "school_events"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Calendar notes
CREATE TABLE IF NOT EXISTS "calendar_notes" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "trainingId" TEXT,
  "schoolEventId" TEXT,
  "competitionId" TEXT,
  "createdByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "calendar_notes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "calendar_notes_tenantId_trainingId_idx"
ON "calendar_notes"("tenantId", "trainingId");

CREATE INDEX IF NOT EXISTS "calendar_notes_tenantId_schoolEventId_idx"
ON "calendar_notes"("tenantId", "schoolEventId");

CREATE INDEX IF NOT EXISTS "calendar_notes_tenantId_competitionId_idx"
ON "calendar_notes"("tenantId", "competitionId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'calendar_notes_tenantId_fkey'
  ) THEN
    ALTER TABLE "calendar_notes"
    ADD CONSTRAINT "calendar_notes_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'calendar_notes_createdByUserId_fkey'
  ) THEN
    ALTER TABLE "calendar_notes"
    ADD CONSTRAINT "calendar_notes_createdByUserId_fkey"
    FOREIGN KEY ("createdByUserId") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'calendar_notes_trainingId_fkey'
  ) THEN
    ALTER TABLE "calendar_notes"
    ADD CONSTRAINT "calendar_notes_trainingId_fkey"
    FOREIGN KEY ("trainingId") REFERENCES "trainings"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'calendar_notes_schoolEventId_fkey'
  ) THEN
    ALTER TABLE "calendar_notes"
    ADD CONSTRAINT "calendar_notes_schoolEventId_fkey"
    FOREIGN KEY ("schoolEventId") REFERENCES "school_events"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'calendar_notes_competitionId_fkey'
  ) THEN
    ALTER TABLE "calendar_notes"
    ADD CONSTRAINT "calendar_notes_competitionId_fkey"
    FOREIGN KEY ("competitionId") REFERENCES "competitions"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
