import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../../src/database/prisma.service';
import { createTestApp, cleanDatabase } from './utils/test-app';
import {
  createAthleteForCoach,
  createPlatformAdmin,
  loginAs,
  registerCoach,
} from './utils/fixtures';

describe('Platform Stats (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
  });

  afterEach(async () => {
    await cleanDatabase(prisma);
  });

  afterAll(async () => {
    await app.close();
  });

  it('a non-admin cannot fetch platform stats', async () => {
    const coach = await registerCoach(app);
    await request(app.getHttpServer())
      .get('/api/v1/platform-stats')
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .expect(403);
  });

  it('PLATFORM_ADMIN sees real totals that reflect seeded data', async () => {
    const admin = await createPlatformAdmin(prisma);
    const adminToken = await loginAs(app, admin.email, admin.password);

    const before = await request(app.getHttpServer())
      .get('/api/v1/platform-stats')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(before.body.totals.organisations).toBe(0);
    expect(before.body.totals.coaches).toBe(0);
    expect(before.body.totals.athletes).toBe(0);
    expect(before.body.totals.clubMembers).toBe(0);
    expect(before.body.totals.usersByStatus.ACTIVE).toBe(1); // the admin itself
    expect(before.body.weeklySignups).toHaveLength(8);
    expect(before.body.recentOrganisations).toEqual([]);

    const coach = await registerCoach(app, { organisationName: 'Stats Test Org' });
    await createAthleteForCoach(app, coach.accessToken, coach.coachId);
    await request(app.getHttpServer())
      .post(`/api/v1/organisations/${coach.organisationId}/club-members`)
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .send({ firstName: 'Test', lastName: 'Member', email: 'stats-member@example.test' })
      .expect(201);

    const after = await request(app.getHttpServer())
      .get('/api/v1/platform-stats')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(after.body.totals.organisations).toBe(1);
    expect(after.body.totals.coaches).toBe(1);
    expect(after.body.totals.athletes).toBe(1);
    expect(after.body.totals.clubMembers).toBe(1);
    // createAthleteForCoach accepts the invite internally, so all three
    // users (admin, coach, athlete) are ACTIVE by the time this resolves.
    expect(after.body.totals.usersByStatus.ACTIVE).toBe(3);
    expect(after.body.totals.usersByStatus.INVITED).toBe(0);
    expect(after.body.recentOrganisations).toHaveLength(1);
    expect(after.body.recentOrganisations[0].name).toBe('Stats Test Org');

    const currentWeekUsers = after.body.weeklySignups.at(-1).users;
    const currentWeekOrgs = after.body.weeklySignups.at(-1).organisations;
    expect(currentWeekUsers).toBeGreaterThanOrEqual(2);
    expect(currentWeekOrgs).toBeGreaterThanOrEqual(1);
  });
});
