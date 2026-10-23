-- Speed up active-membership lookups by client and expiry sweeps
CREATE INDEX IF NOT EXISTS "client_memberships_tenantId_clientId_isActive_idx"
  ON "client_memberships"("tenantId", "clientId", "isActive");

CREATE INDEX IF NOT EXISTS "client_memberships_tenantId_isActive_endDate_idx"
  ON "client_memberships"("tenantId", "isActive", "endDate");
