/**
 * Local/dev seed data only. Every value below is synthetic - never copy real
 * personal information (from StudyTrust or anywhere else) into this file.
 */
import { PrismaClient, Role, UserStatus } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  const password = await argon2.hash('DevPassword123!');

  const admin = await prisma.user.upsert({
    where: { email: 'admin@ubunturun.dev' },
    update: {},
    create: {
      email: 'admin@ubunturun.dev',
      passwordHash: password,
      name: 'Platform Admin',
      role: Role.PLATFORM_ADMIN,
      status: UserStatus.ACTIVE,
    },
  });

  const org = await prisma.organisation.upsert({
    where: { id: 'seed-org-1' },
    update: {},
    create: { id: 'seed-org-1', name: 'Sample Running Co', type: 'SOLO' },
  });

  await prisma.subscription.upsert({
    where: { id: 'seed-sub-1' },
    update: {},
    create: {
      id: 'seed-sub-1',
      organisationId: org.id,
      planName: 'SOLO',
      status: 'TRIALING',
      startDate: new Date(),
      athleteLimit: 30,
      coachLimit: 1,
    },
  });

  const coachUser = await prisma.user.upsert({
    where: { email: 'coach@ubunturun.dev' },
    update: {},
    create: {
      email: 'coach@ubunturun.dev',
      passwordHash: password,
      name: 'Sample Coach',
      role: Role.COACH,
      status: UserStatus.ACTIVE,
    },
  });

  const coach = await prisma.coach.upsert({
    where: { userId: coachUser.id },
    update: {},
    create: {
      userId: coachUser.id,
      organisationId: org.id,
      bio: 'Sample coach bio for local development.',
      experienceYears: 5,
    },
  });

  const athleteEmails = ['athlete1@ubunturun.dev', 'athlete2@ubunturun.dev', 'athlete3@ubunturun.dev'];
  for (const email of athleteEmails) {
    const user = await prisma.user.upsert({
      where: { email },
      update: {},
      create: {
        email,
        passwordHash: password,
        name: `Sample Athlete (${email.split('@')[0]})`,
        role: Role.ATHLETE,
        status: UserStatus.ACTIVE,
      },
    });

    await prisma.athlete.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        userId: user.id,
        coachId: coach.id,
        organisationId: org.id,
        goal: '5K under 25 minutes',
        availability: { days: ['Mon', 'Wed', 'Sat'] },
      },
    });
  }

  // eslint-disable-next-line no-console
  console.log('Seed complete:', { admin: admin.email, coach: coachUser.email, athletes: athleteEmails });
}

main()
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
