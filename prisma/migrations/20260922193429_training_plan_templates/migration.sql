-- AlterTable
ALTER TABLE "training_plans" ADD COLUMN     "sourceTemplateId" TEXT;

-- CreateTable
CREATE TABLE "training_plan_templates" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "coachId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "goal" TEXT,
    "phase" "TrainingPlanPhase",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "training_plan_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "template_workouts" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "dayOffset" INTEGER NOT NULL,
    "type" "WorkoutType" NOT NULL,
    "distanceTargetKm" DECIMAL(65,30),
    "durationTargetSec" INTEGER,
    "paceTarget" TEXT,
    "hrZoneTarget" TEXT,
    "rpeTarget" INTEGER,
    "instructions" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "template_workouts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "training_plan_templates_coachId_idx" ON "training_plan_templates"("coachId");

-- CreateIndex
CREATE INDEX "training_plan_templates_organisationId_idx" ON "training_plan_templates"("organisationId");

-- CreateIndex
CREATE INDEX "template_workouts_templateId_idx" ON "template_workouts"("templateId");

-- AddForeignKey
ALTER TABLE "training_plans" ADD CONSTRAINT "training_plans_sourceTemplateId_fkey" FOREIGN KEY ("sourceTemplateId") REFERENCES "training_plan_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_plan_templates" ADD CONSTRAINT "training_plan_templates_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "coaches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "template_workouts" ADD CONSTRAINT "template_workouts_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "training_plan_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
