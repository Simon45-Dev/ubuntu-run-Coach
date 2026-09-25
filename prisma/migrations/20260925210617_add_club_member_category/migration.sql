-- CreateEnum
CREATE TYPE "MembershipCategory" AS ENUM ('JUNIOR', 'OPEN', 'GRAND_MASTER');

-- AlterTable
ALTER TABLE "club_members" ADD COLUMN     "membershipCategory" "MembershipCategory";

