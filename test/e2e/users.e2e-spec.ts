import { existsSync } from 'fs';
import { join } from 'path';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../../src/database/prisma.service';
import { createTestApp, cleanDatabase } from './utils/test-app';
import { createPlatformAdmin, loginAs, registerCoach } from './utils/fixtures';

// Smallest possible valid 1x1 PNG.
const PNG_BUFFER = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
);

function avatarPath(avatarUrl: string): string {
  return join(process.cwd(), 'uploads', 'avatars', avatarUrl.split('/').pop()!);
}

describe('Users (e2e)', () => {
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

  it("GET /users/me returns the caller's own profile", async () => {
    const coach = await registerCoach(app, { email: 'me@example.test', name: 'Me Coach' });
    const res = await request(app.getHttpServer())
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .expect(200);
    expect(res.body.email).toBe('me@example.test');
    expect(res.body.name).toBe('Me Coach');
    expect(res.body.passwordHash).toBeUndefined();
  });

  it("PATCH /users/me updates the caller's own name", async () => {
    const coach = await registerCoach(app);
    const res = await request(app.getHttpServer())
      .patch('/api/v1/users/me')
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .send({ name: 'Updated Name' })
      .expect(200);
    expect(res.body.name).toBe('Updated Name');
  });

  it('POST /users/me/avatar uploads, replaces, and serves a profile picture', async () => {
    const coach = await registerCoach(app);

    const first = await request(app.getHttpServer())
      .post('/api/v1/users/me/avatar')
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .attach('file', PNG_BUFFER, { filename: 'avatar.png', contentType: 'image/png' })
      .expect(201);
    expect(first.body.avatarUrl).toMatch(/^\/uploads\/avatars\/.+\.png$/);
    const firstPath = avatarPath(first.body.avatarUrl);
    expect(existsSync(firstPath)).toBe(true);

    await request(app.getHttpServer()).get(first.body.avatarUrl).expect(200);

    const second = await request(app.getHttpServer())
      .post('/api/v1/users/me/avatar')
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .attach('file', PNG_BUFFER, { filename: 'avatar2.png', contentType: 'image/png' })
      .expect(201);
    expect(second.body.avatarUrl).not.toBe(first.body.avatarUrl);
    expect(existsSync(firstPath)).toBe(false);
    expect(existsSync(avatarPath(second.body.avatarUrl))).toBe(true);

    await request(app.getHttpServer())
      .delete('/api/v1/users/me/avatar')
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .expect(200)
      .expect((res) => expect(res.body.avatarUrl).toBeNull());
    expect(existsSync(avatarPath(second.body.avatarUrl))).toBe(false);
  });

  it('POST /users/me/avatar rejects a non-image file', async () => {
    const coach = await registerCoach(app);
    await request(app.getHttpServer())
      .post('/api/v1/users/me/avatar')
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .attach('file', Buffer.from('not an image'), { filename: 'notes.txt', contentType: 'text/plain' })
      .expect(415);
  });

  it('rejects invalid input on registration (bad email, short password)', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email: 'not-an-email', password: 'short', name: 'X', organisationName: 'Org' })
      .expect(400);
  });

  it('a non-admin cannot list all users', async () => {
    const coach = await registerCoach(app);
    await request(app.getHttpServer())
      .get('/api/v1/users')
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .expect(403);
  });

  it('PLATFORM_ADMIN can list, suspend, and soft-delete a user', async () => {
    const coach = await registerCoach(app);
    const admin = await createPlatformAdmin(prisma);
    const adminToken = await loginAs(app, admin.email, admin.password);

    const listRes = await request(app.getHttpServer())
      .get('/api/v1/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(listRes.body.items.length).toBeGreaterThan(0);

    await request(app.getHttpServer())
      .patch(`/api/v1/users/${coach.userId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'SUSPENDED' })
      .expect(200);

    // A suspended coach can no longer log in.
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: coach.email, password: coach.password })
      .expect(401);

    await request(app.getHttpServer())
      .delete(`/api/v1/users/${coach.userId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
  });

  it('PLATFORM_ADMIN can search users by name/email substring', async () => {
    const admin = await createPlatformAdmin(prisma);
    const adminToken = await loginAs(app, admin.email, admin.password);
    const uniqueName = `Findme-${Date.now()}`;
    const coach = await registerCoach(app, { name: uniqueName });

    const res = await request(app.getHttpServer())
      .get('/api/v1/users')
      .query({ search: uniqueName })
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(res.body.items.map((u: { id: string }) => u.id)).toEqual([coach.userId]);

    const noMatch = await request(app.getHttpServer())
      .get('/api/v1/users')
      .query({ search: `nobody-${Date.now()}` })
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(noMatch.body.items).toHaveLength(0);
  });

  it('PLATFORM_ADMIN can filter users by role', async () => {
    const admin = await createPlatformAdmin(prisma);
    const adminToken = await loginAs(app, admin.email, admin.password);
    await registerCoach(app);

    const res = await request(app.getHttpServer())
      .get('/api/v1/users')
      .query({ role: 'PLATFORM_ADMIN' })
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(res.body.items.every((u: { role: string }) => u.role === 'PLATFORM_ADMIN')).toBe(true);
    expect(res.body.items.length).toBeGreaterThan(0);
  });
});
