-- CreateIndex
CREATE UNIQUE INDEX "check_ins_athleteId_date_key" ON "check_ins"("athleteId", "date");
