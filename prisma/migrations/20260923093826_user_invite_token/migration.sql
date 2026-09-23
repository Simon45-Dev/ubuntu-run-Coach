-- AlterTable
ALTER TABLE "users" ADD COLUMN     "inviteTokenExpiresAt" TIMESTAMP(3),
ADD COLUMN     "inviteTokenHash" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "users_inviteTokenHash_key" ON "users"("inviteTokenHash");
