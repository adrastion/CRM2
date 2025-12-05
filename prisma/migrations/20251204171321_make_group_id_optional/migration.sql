-- AlterTable: Make groupId optional in trainings table
ALTER TABLE "trainings" ALTER COLUMN "groupId" DROP NOT NULL;
