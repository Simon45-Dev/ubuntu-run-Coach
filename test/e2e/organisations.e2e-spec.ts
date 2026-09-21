import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../../src/database/prisma.service';
import { createTestApp, cleanDatabase } from './utils/test-app';
import { createPlatformAdmin, loginAs, registerCoach } from './utils/fixtures';

describe('Organisations (e2e)', () => {
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

  it('a coach can read and rename their own organisation', async () => {
    const coach = await registerCoach(app, { organisationName: 'Original Name' });

    const getRes = await request(app.getHttpServer())
      .get(`/api/v1/organisations/${coach.organisationId}`)
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .expect(200);
    expect(getRes.body.name).toBe('Original Name');

    const patchRes = await request(app.getHttpServer())
      .patch(`/api/v1/organisations/${coach.organisationId}`)
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .send({ name: 'Renamed Org' })
      .expect(200);
    expect(patchRes.body.name).toBe('Renamed Org');
  });

  it('rejects an empty organisation name on update', async () => {
    const coach = await registerCoach(app);
    await request(app.getHttpServer())
      .patch(`/api/v1/organisations/${coach.organisationId}`)
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .send({ name: '' })
      .expect(400);
  });

  it('only PLATFORM_ADMIN can list all organisations', async () => {
    const coach = await registerCoach(app);
    await request(app.getHttpServer())
      .get('/api/v1/organisations')
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .expect(403);

    const admin = await createPlatformAdmin(prisma);
    const adminToken = await loginAs(app, admin.email, admin.password);
    const res = await request(app.getHttpServer())
      .get('/api/v1/organisations')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(res.body.items.some((org: { id: string }) => org.id === coach.organisationId)).toBe(
      true,
    );
  });
});
