-- CreateTable
CREATE TABLE IF NOT EXISTS "trainer_notification_settings" (
    "id" TEXT NOT NULL,
    "trainerId" TEXT NOT NULL,
    "allTrainingsTime" INTEGER,
    "allTrainingsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "reminderBeforeMinutes" INTEGER,
    "reminderEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trainer_notification_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "trainer_notification_settings_trainerId_key" ON "trainer_notification_settings"("trainerId");

-- AddForeignKey
ALTER TABLE "trainer_notification_settings" ADD CONSTRAINT "trainer_notification_settings_trainerId_fkey" FOREIGN KEY ("trainerId") REFERENCES "trainers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

