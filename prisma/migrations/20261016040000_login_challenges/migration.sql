-- AlterTable EmailOtp: purpose comment only (login | 2fa are string values)

CREATE TABLE IF NOT EXISTS "login_security_settings" (
  "id" TEXT NOT NULL,
  "accountType" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "email2faEnabled" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "login_security_settings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "login_security_settings_accountType_accountId_key"
  ON "login_security_settings"("accountType", "accountId");

CREATE TABLE IF NOT EXISTS "login_challenges" (
  "id" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "method" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "identifier" TEXT,
  "accountsJson" TEXT NOT NULL,
  "codeHash" TEXT,
  "secretHash" TEXT,
  "rememberMe" BOOLEAN NOT NULL DEFAULT false,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "approvedAccountType" TEXT,
  "approvedAccountId" TEXT,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "usedAt" TIMESTAMP(3),
  CONSTRAINT "login_challenges_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "login_challenges_tokenHash_key" ON "login_challenges"("tokenHash");
CREATE INDEX IF NOT EXISTS "login_challenges_status_expiresAt_idx" ON "login_challenges"("status", "expiresAt");
