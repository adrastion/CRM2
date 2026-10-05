-- Additional statuses for super-admin development notes.
ALTER TYPE "DevNoteStatus" ADD VALUE IF NOT EXISTS 'AWAITING_DESIGN';
ALTER TYPE "DevNoteStatus" ADD VALUE IF NOT EXISTS 'NEEDS_DISCUSSION';
ALTER TYPE "DevNoteStatus" ADD VALUE IF NOT EXISTS 'SHELVED';