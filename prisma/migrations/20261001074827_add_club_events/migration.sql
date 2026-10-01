-- CreateEnum
CREATE TYPE "ClubEventStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "ClubEventResultStatus" AS ENUM ('FINISHED', 'DNF', 'DNS');

-- CreateTable
CREATE TABLE "club_events" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "eventDate" TIMESTAMP(3) NOT NULL,
    "distance" TEXT,
    "status" "ClubEventStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "club_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "club_event_results" (
    "id" TEXT NOT NULL,
    "clubEventId" TEXT NOT NULL,
    "clubMemberId" TEXT NOT NULL,
    "finishTimeSeconds" INTEGER,
    "status" "ClubEventResultStatus" NOT NULL DEFAULT 'FINISHED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "club_event_results_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "club_events_organisationId_idx" ON "club_events"("organisationId");

-- CreateIndex
CREATE INDEX "club_event_results_clubEventId_idx" ON "club_event_results"("clubEventId");

-- CreateIndex
CREATE UNIQUE INDEX "club_event_results_clubEventId_clubMemberId_key" ON "club_event_results"("clubEventId", "clubMemberId");

-- AddForeignKey
ALTER TABLE "club_events" ADD CONSTRAINT "club_events_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "club_event_results" ADD CONSTRAINT "club_event_results_clubEventId_fkey" FOREIGN KEY ("clubEventId") REFERENCES "club_events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "club_event_results" ADD CONSTRAINT "club_event_results_clubMemberId_fkey" FOREIGN KEY ("clubMemberId") REFERENCES "club_members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

