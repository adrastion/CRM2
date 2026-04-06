-- Запись звонка: дизайнер (staff) или автор обращения (requester JWT)
ALTER TABLE "designer_call_recordings" ADD COLUMN "uploadedByRequesterKind" TEXT;
ALTER TABLE "designer_call_recordings" ADD COLUMN "uploadedByRequesterId" TEXT;
ALTER TABLE "designer_call_recordings" ALTER COLUMN "recordedByStaffId" DROP NOT NULL;
