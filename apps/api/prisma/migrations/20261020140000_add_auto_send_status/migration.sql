-- AlterEnum
ALTER TYPE "Status" ADD VALUE 'AUTO_SEND';

-- AlterTable
ALTER TABLE "Company" ALTER COLUMN "status" SET DEFAULT 'AUTO_SEND';
