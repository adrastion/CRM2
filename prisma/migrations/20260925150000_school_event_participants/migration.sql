-- CreateTable
CREATE TABLE "school_event_participants" (
    "id" TEXT NOT NULL,
    "schoolEventId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "school_event_participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "school_event_parents" (
    "id" TEXT NOT NULL,
    "schoolEventId" TEXT NOT NULL,
    "parentId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "school_event_parents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "school_event_trainers" (
    "id" TEXT NOT NULL,
    "schoolEventId" TEXT NOT NULL,
    "trainerId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "school_event_trainers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "school_event_participants_tenantId_schoolEventId_idx" ON "school_event_participants"("tenantId", "schoolEventId");

-- CreateIndex
CREATE UNIQUE INDEX "school_event_participants_schoolEventId_clientId_key" ON "school_event_participants"("schoolEventId", "clientId");

-- CreateIndex
CREATE INDEX "school_event_parents_tenantId_schoolEventId_idx" ON "school_event_parents"("tenantId", "schoolEventId");

-- CreateIndex
CREATE UNIQUE INDEX "school_event_parents_schoolEventId_parentId_key" ON "school_event_parents"("schoolEventId", "parentId");

-- CreateIndex
CREATE INDEX "school_event_trainers_tenantId_schoolEventId_idx" ON "school_event_trainers"("tenantId", "schoolEventId");

-- CreateIndex
CREATE UNIQUE INDEX "school_event_trainers_schoolEventId_trainerId_key" ON "school_event_trainers"("schoolEventId", "trainerId");

-- AddForeignKey
ALTER TABLE "school_event_participants" ADD CONSTRAINT "school_event_participants_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "school_event_participants" ADD CONSTRAINT "school_event_participants_schoolEventId_fkey" FOREIGN KEY ("schoolEventId") REFERENCES "school_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "school_event_participants" ADD CONSTRAINT "school_event_participants_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "school_event_parents" ADD CONSTRAINT "school_event_parents_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "parents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "school_event_parents" ADD CONSTRAINT "school_event_parents_schoolEventId_fkey" FOREIGN KEY ("schoolEventId") REFERENCES "school_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "school_event_parents" ADD CONSTRAINT "school_event_parents_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "school_event_trainers" ADD CONSTRAINT "school_event_trainers_schoolEventId_fkey" FOREIGN KEY ("schoolEventId") REFERENCES "school_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "school_event_trainers" ADD CONSTRAINT "school_event_trainers_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "school_event_trainers" ADD CONSTRAINT "school_event_trainers_trainerId_fkey" FOREIGN KEY ("trainerId") REFERENCES "trainers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
