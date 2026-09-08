-- Email сотрудника уникален внутри школы (несколько школ на один email)
DROP INDEX IF EXISTS "users_email_key";
CREATE UNIQUE INDEX "users_tenantId_email_key" ON "users"("tenantId", "email");
