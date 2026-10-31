-- AlterTable PlatformStaffUser
ALTER TABLE "platform_staff_users" ADD COLUMN "lastSeenAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "platform_staff_users_role_isActive_lastSeenAt_idx" ON "platform_staff_users"("role", "isActive", "lastSeenAt");

-- AlterTable SuperAdminSettings
ALTER TABLE "super_admin_settings" ADD COLUMN "supportAutoReplyEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "super_admin_settings" ADD COLUMN "supportAutoReplyBody" TEXT;
ALTER TABLE "super_admin_settings" ADD COLUMN "supportOnlineMinutes" INTEGER NOT NULL DEFAULT 10;

-- AlterTable SupportPromo
ALTER TABLE "support_promos" ADD COLUMN "accountScope" TEXT NOT NULL DEFAULT 'ALL';
ALTER TABLE "support_promos" ADD COLUMN "newAccountDays" INTEGER NOT NULL DEFAULT 30;
ALTER TABLE "support_promos" ADD COLUMN "autoReplyEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "support_promos" ADD COLUMN "autoReplyBody" TEXT;
