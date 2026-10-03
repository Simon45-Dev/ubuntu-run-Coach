-- DropForeignKey
ALTER TABLE "training_plan_templates" DROP CONSTRAINT "training_plan_templates_coachId_fkey";

-- AlterTable
ALTER TABLE "training_plan_templates" ADD COLUMN     "isGlobal" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "organisationId" DROP NOT NULL,
ALTER COLUMN "coachId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "training_plan_templates" ADD CONSTRAINT "training_plan_templates_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "coaches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
