-- DropIndex
DROP INDEX "workout_results_workoutId_key";

-- CreateIndex
CREATE INDEX "workout_results_workoutId_idx" ON "workout_results"("workoutId");

-- CreateIndex
CREATE UNIQUE INDEX "workout_results_workoutId_athleteId_key" ON "workout_results"("workoutId", "athleteId");
