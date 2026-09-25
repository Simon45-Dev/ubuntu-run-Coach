-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'CLUB_ADMIN';

-- CreateTable
CREATE TABLE "club_admins" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "club_admins_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "club_admins_userId_key" ON "club_admins"("userId");

-- CreateIndex
CREATE INDEX "club_admins_organisationId_idx" ON "club_admins"("organisationId");

-- AddForeignKey
ALTER TABLE "club_admins" ADD CONSTRAINT "club_admins_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "club_admins" ADD CONSTRAINT "club_admins_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

