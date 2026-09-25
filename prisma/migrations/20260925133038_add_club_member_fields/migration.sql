-- AlterTable
ALTER TABLE "club_members" ADD COLUMN     "idNumber" TEXT,
ADD COLUMN     "joinDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "lastRenewalDate" TIMESTAMP(3),
ADD COLUMN     "membershipExpiryDate" TIMESTAMP(3);

