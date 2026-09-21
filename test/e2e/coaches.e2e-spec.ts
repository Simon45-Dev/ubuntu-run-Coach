import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../../src/database/prisma.service';
import { createTestApp, cleanDatabase } from './utils/test-app';
import { createPlatformAdmin, loginAs, registerCoach } from './utils/fixtures';

describe('Coaches (e2e)', () => {
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

  it('a coach can read and update their own coach profile', async () => {
    const coach = await registerCoach(app);

    const getRes = await request(app.getHttpServer())
      .get(`/api/v1/coaches/${coach.coachId}`)
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .expect(200);
    expect(getRes.body.id).toBe(coach.coachId);

    const patchRes = await request(app.getHttpServer())
      .patch(`/api/v1/coaches/${coach.coachId}`)
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .send({ bio: 'Updated bio' })
      .expect(200);
    expect(patchRes.body.bio).toBe('Updated bio');
  });

  it("a coach cannot update another coach's profile", async () => {
    const coachA = await registerCoach(app);
    const coachB = await registerCoach(app);

    await request(app.getHttpServer())
      .patch(`/api/v1/coaches/${coachB.coachId}`)
      .set('Authorization', `Bearer ${coachA.accessToken}`)
      .send({ bio: 'Hijacked bio' })
      .expect(403);
  });

  it('PLATFORM_ADMIN can add a second coach to an existing organisation', async () => {
    const coach = await registerCoach(app);
    const admin = await createPlatformAdmin(prisma);
    const adminToken = await loginAs(app, admin.email, admin.password);

    const res = await request(app.getHttpServer())
      .post(`/api/v1/organisations/${coach.organisationId}/coaches`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        email: 'second-coach@example.test',
        password: 'TestPassword123!',
        name: 'Second Coach',
      })
      .expect(201);

    const listRes = await request(app.getHttpServer())
      .get(`/api/v1/organisations/${coach.organisationId}/coaches`)
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .expect(200);
    expect(listRes.body.map((c: { id: string }) => c.id)).toEqual(
      expect.arrayContaining([coach.coachId, res.body.id]),
    );
  });

  it('a non-admin cannot create a coach', async () => {
    const coach = await registerCoach(app);
    await request(app.getHttpServer())
      .post(`/api/v1/organisations/${coach.organisationId}/coaches`)
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .send({ email: 'x@example.test', password: 'TestPassword123!', name: 'X' })
      .expect(403);
  });
});
