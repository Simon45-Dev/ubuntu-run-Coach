import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import { AppModule } from '../../../src/app.module';
import { PrismaService } from '../../../src/database/prisma.service';
import { HttpExceptionFilter } from '../../../src/common/filters/http-exception.filter';

export async function createTestApp(): Promise<{ app: INestApplication; prisma: PrismaService }> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();

  const app = moduleRef.createNestApplication();
  app.use(cookieParser());
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  await app.init();

  const prisma = app.get(PrismaService);
  return { app, prisma };
}

/**
 * Deletes all rows across every table, in FK-safe order, between tests.
 * Deliberately a hand-maintained list rather than a dynamic introspection -
 * a new model is a compile error here (TypeScript catches the missing
 * delegate) rather than a silently-skipped table in test cleanup.
 */
export async function cleanDatabase(prisma: PrismaService): Promise<void> {
  await prisma.auditLog.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.message.deleteMany();
  await prisma.checkIn.deleteMany();
  await prisma.consent.deleteMany();
  await prisma.raceGoal.deleteMany();
  await prisma.coachNote.deleteMany();
  await prisma.workoutResult.deleteMany();
  await prisma.workout.deleteMany();
  await prisma.groupMembership.deleteMany();
  await prisma.trainingPlan.deleteMany();
  await prisma.templateWorkout.deleteMany();
  await prisma.trainingPlanTemplate.deleteMany();
  await prisma.group.deleteMany();
  await prisma.personalBest.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.athlete.deleteMany();
  await prisma.coach.deleteMany();
  await prisma.subscription.deleteMany();
  await prisma.user.deleteMany();
  await prisma.organisation.deleteMany();
}
