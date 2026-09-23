-- CreateTable
CREATE TABLE "coach_notes" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "coachId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "coach_notes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "coach_notes_athleteId_idx" ON "coach_notes"("athleteId");

-- CreateIndex
CREATE INDEX "coach_notes_coachId_idx" ON "coach_notes"("coachId");

-- AddForeignKey
ALTER TABLE "coach_notes" ADD CONSTRAINT "coach_notes_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "athletes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coach_notes" ADD CONSTRAINT "coach_notes_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "coaches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
