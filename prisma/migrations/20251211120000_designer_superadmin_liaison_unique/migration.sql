-- Один служебный чат «дизайнер ↔ супер-админы» на каждого дизайнера (не клиентская горячая линия)
CREATE UNIQUE INDEX IF NOT EXISTS "support_tickets_one_designer_superadmin_liaison_per_staff"
ON "support_tickets" ("assignedStaffId")
WHERE "channel" = 'DESIGNER_SUPERADMIN';
