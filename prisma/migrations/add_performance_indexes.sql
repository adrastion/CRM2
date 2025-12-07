-- Добавление индексов для оптимизации производительности

-- Индексы для Client
CREATE INDEX IF NOT EXISTS "clients_tenantId_isActive_idx" ON "clients"("tenantId", "isActive");
CREATE INDEX IF NOT EXISTS "clients_tenantId_firstName_lastName_idx" ON "clients"("tenantId", "firstName", "lastName");
CREATE INDEX IF NOT EXISTS "clients_tenantId_email_idx" ON "clients"("tenantId", "email");
CREATE INDEX IF NOT EXISTS "clients_tenantId_phone_idx" ON "clients"("tenantId", "phone");
CREATE INDEX IF NOT EXISTS "clients_tenantId_createdAt_idx" ON "clients"("tenantId", "createdAt");

-- Индексы для Payment
CREATE INDEX IF NOT EXISTS "payments_tenantId_status_idx" ON "payments"("tenantId", "status");
CREATE INDEX IF NOT EXISTS "payments_tenantId_clientId_idx" ON "payments"("tenantId", "clientId");
CREATE INDEX IF NOT EXISTS "payments_tenantId_dueDate_idx" ON "payments"("tenantId", "dueDate");
CREATE INDEX IF NOT EXISTS "payments_tenantId_createdAt_idx" ON "payments"("tenantId", "createdAt");
CREATE INDEX IF NOT EXISTS "payments_tenantId_status_paidAt_idx" ON "payments"("tenantId", "status", "paidAt");

-- Индексы для Training
CREATE INDEX IF NOT EXISTS "trainings_tenantId_startTime_idx" ON "trainings"("tenantId", "startTime");
CREATE INDEX IF NOT EXISTS "trainings_tenantId_trainerId_startTime_idx" ON "trainings"("tenantId", "trainerId", "startTime");
CREATE INDEX IF NOT EXISTS "trainings_tenantId_groupId_startTime_idx" ON "trainings"("tenantId", "groupId", "startTime");
CREATE INDEX IF NOT EXISTS "trainings_trainerId_startTime_idx" ON "trainings"("trainerId", "startTime");
CREATE INDEX IF NOT EXISTS "trainings_tenantId_isCancelled_idx" ON "trainings"("tenantId", "isCancelled");

-- Индексы для Attendance
CREATE INDEX IF NOT EXISTS "attendances_tenantId_createdAt_idx" ON "attendances"("tenantId", "createdAt");
CREATE INDEX IF NOT EXISTS "attendances_tenantId_trainingId_idx" ON "attendances"("tenantId", "trainingId");
CREATE INDEX IF NOT EXISTS "attendances_tenantId_status_idx" ON "attendances"("tenantId", "status");
CREATE INDEX IF NOT EXISTS "attendances_tenantId_clientId_idx" ON "attendances"("tenantId", "clientId");

-- Индексы для Group
CREATE INDEX IF NOT EXISTS "groups_tenantId_isActive_idx" ON "groups"("tenantId", "isActive");
CREATE INDEX IF NOT EXISTS "groups_tenantId_branchId_idx" ON "groups"("tenantId", "branchId");
CREATE INDEX IF NOT EXISTS "groups_tenantId_trainerId_idx" ON "groups"("tenantId", "trainerId");

-- Индексы для GroupMembership
CREATE INDEX IF NOT EXISTS "group_memberships_clientId_isActive_idx" ON "group_memberships"("clientId", "isActive");
CREATE INDEX IF NOT EXISTS "group_memberships_groupId_isActive_idx" ON "group_memberships"("groupId", "isActive");

-- Индексы для Trainer
CREATE INDEX IF NOT EXISTS "trainers_tenantId_isActive_idx" ON "trainers"("tenantId", "isActive");
CREATE INDEX IF NOT EXISTS "trainers_tenantId_userId_idx" ON "trainers"("tenantId", "userId");

-- Индексы для Branch
CREATE INDEX IF NOT EXISTS "branches_tenantId_isActive_idx" ON "branches"("tenantId", "isActive");

-- Индексы для Transaction
CREATE INDEX IF NOT EXISTS "transactions_tenantId_type_idx" ON "transactions"("tenantId", "type");
CREATE INDEX IF NOT EXISTS "transactions_tenantId_createdAt_idx" ON "transactions"("tenantId", "createdAt");
CREATE INDEX IF NOT EXISTS "transactions_tenantId_clientId_idx" ON "transactions"("tenantId", "clientId");
CREATE INDEX IF NOT EXISTS "transactions_tenantId_trainerId_idx" ON "transactions"("tenantId", "trainerId");

