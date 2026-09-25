-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'CLUB_MEMBER';

-- AlterTable
ALTER TABLE "organisations" ADD COLUMN     "nextMembershipNumber" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "club_members" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "userId" TEXT,
    "membershipNumber" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "dateOfBirth" TIMESTAMP(3),
    "address" TEXT,
    "nextOfKinName" TEXT,
    "nextOfKinPhone" TEXT,
    "nextOfKinRelationship" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "club_members_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "club_members_userId_key" ON "club_members"("userId");

-- CreateIndex
CREATE INDEX "club_members_organisationId_idx" ON "club_members"("organisationId");

-- CreateIndex
CREATE UNIQUE INDEX "club_members_organisationId_membershipNumber_key" ON "club_members"("organisationId", "membershipNumber");

-- AddForeignKey
ALTER TABLE "club_members" ADD CONSTRAINT "club_members_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "club_members" ADD CONSTRAINT "club_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

