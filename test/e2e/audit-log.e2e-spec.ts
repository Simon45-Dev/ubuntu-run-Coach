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

describe('Audit log (e2e)', () => {
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

  it('suspending a user writes exactly one correct AuditLog row', async () => {
    const coach = await registerCoach(app);
    const admin = await createPlatformAdmin(prisma);
    const adminToken = await loginAs(app, admin.email, admin.password);

    await request(app.getHttpServer())
      .patch(`/api/v1/users/${coach.userId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'SUSPENDED' })
      .expect(200);

    const entries = await prisma.auditLog.findMany({
      where: { action: 'USER_STATUS_CHANGED', targetEntityId: coach.userId },
    });
    expect(entries).toHaveLength(1);
    expect(entries[0].actorUserId).not.toBeNull();
  });

  it('deleting an athlete writes exactly one correct AuditLog row', async () => {
    const coach = await registerCoach(app);
    const athlete = await createAthleteForCoach(app, coach.accessToken, coach.coachId);

    await request(app.getHttpServer())
      .delete(`/api/v1/athletes/${athlete.id}`)
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .expect(200);

    const entries = await prisma.auditLog.findMany({
      where: { action: 'ATHLETE_DELETED', targetEntityId: athlete.id },
    });
    expect(entries).toHaveLength(1);
  });

  it('a failed request does not produce an audit log entry', async () => {
    const coach = await registerCoach(app);
    const athlete = await createAthleteForCoach(app, coach.accessToken, coach.coachId);
    const otherCoach = await registerCoach(app);

    await request(app.getHttpServer())
      .delete(`/api/v1/athletes/${athlete.id}`)
      .set('Authorization', `Bearer ${otherCoach.accessToken}`)
      .expect(404);

    const entries = await prisma.auditLog.findMany({
      where: { action: 'ATHLETE_DELETED', targetEntityId: athlete.id },
    });
    expect(entries).toHaveLength(0);
  });

  it('PLATFORM_ADMIN can list audit log entries with the actor name resolved', async () => {
    const coach = await registerCoach(app);
    const admin = await createPlatformAdmin(prisma);
    const adminToken = await loginAs(app, admin.email, admin.password);

    await request(app.getHttpServer())
      .patch(`/api/v1/users/${coach.userId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'SUSPENDED' })
      .expect(200);

    const res = await request(app.getHttpServer())
      .get('/api/v1/audit-logs')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const entry = res.body.items.find(
      (i: { action: string; targetEntityId: string }) =>
        i.action === 'USER_STATUS_CHANGED' && i.targetEntityId === coach.userId,
    );
    expect(entry).toBeDefined();
    expect(entry.actorName).toBe('Test Admin');
    expect(entry.actorEmail).toBe(admin.email);
  });

  it('a non-admin cannot list audit log entries', async () => {
    const coach = await registerCoach(app);
    await request(app.getHttpServer())
      .get('/api/v1/audit-logs')
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .expect(403);
  });

  it('exposes no route to update or delete an AuditLog row', async () => {
    const admin = await createPlatformAdmin(prisma);
    const adminToken = await loginAs(app, admin.email, admin.password);
    const entry = await prisma.auditLog.create({
      data: { action: 'TEST_ACTION', targetEntityType: 'test', targetEntityId: 'test-1' },
    });

    await request(app.getHttpServer())
      .patch(`/api/v1/audit-logs/${entry.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(404);

    await request(app.getHttpServer())
      .delete(`/api/v1/audit-logs/${entry.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(404);
  });
});
