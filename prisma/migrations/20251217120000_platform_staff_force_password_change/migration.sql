-- Platform staff: принудительная смена пароля при первом входе

ALTER TABLE "platform_staff_users" ADD COLUMN IF NOT EXISTS "mustChangePassword" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "platform_staff_users" ADD COLUMN IF NOT EXISTS "passwordChangedAt" TIMESTAMP(3);

