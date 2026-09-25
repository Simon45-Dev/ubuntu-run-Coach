-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'EFT', 'CARD', 'OTHER');

-- AlterTable
ALTER TABLE "club_members" ADD COLUMN     "lastReminderSentAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "club_member_payments" (
    "id" TEXT NOT NULL,
    "clubMemberId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "recordedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "club_member_payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "club_member_payments_clubMemberId_idx" ON "club_member_payments"("clubMemberId");

-- AddForeignKey
ALTER TABLE "club_member_payments" ADD CONSTRAINT "club_member_payments_clubMemberId_fkey" FOREIGN KEY ("clubMemberId") REFERENCES "club_members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

