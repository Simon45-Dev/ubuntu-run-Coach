-- DropForeignKey
ALTER TABLE "workout_results" DROP CONSTRAINT "workout_results_workoutId_fkey";

-- AlterTable
ALTER TABLE "workout_results" ALTER COLUMN "workoutId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "workout_results" ADD CONSTRAINT "workout_results_workoutId_fkey" FOREIGN KEY ("workoutId") REFERENCES "workouts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
