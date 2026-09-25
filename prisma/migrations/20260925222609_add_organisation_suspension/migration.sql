-- AlterTable
ALTER TABLE "organisations" ADD COLUMN     "suspendedAt" TIMESTAMP(3),
ADD COLUMN     "suspensionReason" TEXT;

