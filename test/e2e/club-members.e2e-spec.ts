import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../../src/database/prisma.service';
import { createTestApp, cleanDatabase } from './utils/test-app';
import { createPlatformAdmin, loginAs, registerCoach } from './utils/fixtures';

const MEMBER_INPUT = {
  firstName: 'Sipho',
  lastName: 'Dlamini',
  email: 'sipho@example.test',
  phone: '0821234567',
  nextOfKinName: 'Thandi Dlamini',
  nextOfKinPhone: '0839876543',
  nextOfKinRelationship: 'Spouse',
};

describe('Club Members (e2e)', () => {
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

  it('a coach creates a club member with no login, and it appears on the org list', async () => {
    const coach = await registerCoach(app);

    const createRes = await request(app.getHttpServer())
      .post(`/api/v1/organisations/${coach.organisationId}/club-members`)
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .send(MEMBER_INPUT)
      .expect(201);
    expect(createRes.body.membershipNumber).toBe('0001');
    expect(createRes.body.user).toBeNull();

    const listRes = await request(app.getHttpServer())
      .get(`/api/v1/organisations/${coach.organisationId}/club-members`)
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .expect(200);
    expect(listRes.body).toHaveLength(1);
    expect(listRes.body[0].id).toBe(createRes.body.id);
  });

  it('membership numbers are sequential per organisation, and a second organisation starts independently at 0001', async () => {
    const coachA = await registerCoach(app);
    const coachB = await registerCoach(app);

    const first = await request(app.getHttpServer())
      .post(`/api/v1/organisations/${coachA.organisationId}/club-members`)
      .set('Authorization', `Bearer ${coachA.accessToken}`)
      .send({ ...MEMBER_INPUT, email: 'first@example.test' })
      .expect(201);
    const second = await request(app.getHttpServer())
      .post(`/api/v1/organisations/${coachA.organisationId}/club-members`)
      .set('Authorization', `Bearer ${coachA.accessToken}`)
      .send({ ...MEMBER_INPUT, email: 'second@example.test' })
      .expect(201);
    expect(first.body.membershipNumber).toBe('0001');
    expect(second.body.membershipNumber).toBe('0002');

    const otherOrgFirst = await request(app.getHttpServer())
      .post(`/api/v1/organisations/${coachB.organisationId}/club-members`)
      .set('Authorization', `Bearer ${coachB.accessToken}`)
      .send({ ...MEMBER_INPUT, email: 'other-org@example.test' })
      .expect(201);
    expect(otherOrgFirst.body.membershipNumber).toBe('0001');
  });

  it('a coach can invite a member, who then accepts and can view/update their own profile', async () => {
    const coach = await registerCoach(app);
    const createRes = await request(app.getHttpServer())
      .post(`/api/v1/organisations/${coach.organisationId}/club-members`)
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .send(MEMBER_INPUT)
      .expect(201);
    const memberId = createRes.body.id as string;

    const inviteRes = await request(app.getHttpServer())
      .post(`/api/v1/club-members/${memberId}/invite`)
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .expect(201);
    const token = inviteRes.body.inviteToken as string;

    const acceptRes = await request(app.getHttpServer())
      .post('/api/v1/auth/accept-invite')
      .send({ token, password: 'MemberPassword123!' })
      .expect(200);
    const memberToken = acceptRes.body.accessToken as string;

    const meRes = await request(app.getHttpServer())
      .get(`/api/v1/club-members/${memberId}`)
      .set('Authorization', `Bearer ${memberToken}`)
      .expect(200);
    expect(meRes.body.firstName).toBe('Sipho');

    const updateRes = await request(app.getHttpServer())
      .patch(`/api/v1/club-members/${memberId}`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ address: '123 Main Road, Johannesburg' })
      .expect(200);
    expect(updateRes.body.address).toBe('123 Main Road, Johannesburg');

    // Self-service cannot touch join/expiry/renewal dates - coach/admin only.
    await request(app.getHttpServer())
      .patch(`/api/v1/club-members/${memberId}`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ membershipExpiryDate: '2099-01-01' })
      .expect(403);
    await request(app.getHttpServer())
      .patch(`/api/v1/club-members/${memberId}`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ joinDate: '2020-01-01' })
      .expect(403);

    const coachUpdateRes = await request(app.getHttpServer())
      .patch(`/api/v1/club-members/${memberId}`)
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .send({ membershipExpiryDate: '2027-01-01', lastRenewalDate: '2026-01-01' })
      .expect(200);
    expect(coachUpdateRes.body.membershipExpiryDate).toContain('2027-01-01');
    expect(coachUpdateRes.body.lastRenewalDate).toContain('2026-01-01');
  });

  it('idNumber and joinDate round-trip on create', async () => {
    const coach = await registerCoach(app);
    const createRes = await request(app.getHttpServer())
      .post(`/api/v1/organisations/${coach.organisationId}/club-members`)
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .send({ ...MEMBER_INPUT, idNumber: '9001015800089', joinDate: '2019-06-15' })
      .expect(201);
    expect(createRes.body.idNumber).toBe('9001015800089');
    expect(createRes.body.joinDate).toContain('2019-06-15');
  });

  it('a coach from a different organisation gets 404, not the member data', async () => {
    const coachA = await registerCoach(app);
    const coachB = await registerCoach(app);
    const createRes = await request(app.getHttpServer())
      .post(`/api/v1/organisations/${coachA.organisationId}/club-members`)
      .set('Authorization', `Bearer ${coachA.accessToken}`)
      .send(MEMBER_INPUT)
      .expect(201);

    await request(app.getHttpServer())
      .get(`/api/v1/club-members/${createRes.body.id}`)
      .set('Authorization', `Bearer ${coachB.accessToken}`)
      .expect(404);

    await request(app.getHttpServer())
      .get(`/api/v1/organisations/${coachA.organisationId}/club-members`)
      .set('Authorization', `Bearer ${coachB.accessToken}`)
      .expect(403);
  });

  it('PLATFORM_ADMIN can see club members across every organisation', async () => {
    const coach = await registerCoach(app);
    const createRes = await request(app.getHttpServer())
      .post(`/api/v1/organisations/${coach.organisationId}/club-members`)
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .send(MEMBER_INPUT)
      .expect(201);

    const admin = await createPlatformAdmin(prisma);
    const adminToken = await loginAs(app, admin.email, admin.password);

    await request(app.getHttpServer())
      .get(`/api/v1/club-members/${createRes.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
  });

  it('soft-deletes a club member, and it disappears from the org list', async () => {
    const coach = await registerCoach(app);
    const createRes = await request(app.getHttpServer())
      .post(`/api/v1/organisations/${coach.organisationId}/club-members`)
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .send(MEMBER_INPUT)
      .expect(201);

    await request(app.getHttpServer())
      .delete(`/api/v1/club-members/${createRes.body.id}`)
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .expect(200);

    const listRes = await request(app.getHttpServer())
      .get(`/api/v1/organisations/${coach.organisationId}/club-members`)
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .expect(200);
    expect(listRes.body).toHaveLength(0);
  });

  it('validates required fields on creation', async () => {
    const coach = await registerCoach(app);
    await request(app.getHttpServer())
      .post(`/api/v1/organisations/${coach.organisationId}/club-members`)
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .send({ firstName: 'Incomplete' })
      .expect(400);
  });

  it('imports club members from a CSV file', async () => {
    const coach = await registerCoach(app);
    const csv =
      'firstName,lastName,email,idNumber\n' +
      'John,Smith,john.smith@example.test,1234567890123\n' +
      'Jane,Doe,jane.doe@example.test,';

    const res = await request(app.getHttpServer())
      .post(`/api/v1/organisations/${coach.organisationId}/club-members/import`)
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .attach('file', Buffer.from(csv), 'members.csv')
      .expect(201);
    expect(res.body).toHaveLength(2);
    expect(res.body.map((m: { membershipNumber: string }) => m.membershipNumber)).toEqual([
      '0001',
      '0002',
    ]);
    expect(res.body[0].idNumber).toBe('1234567890123');
  });

  it('rejects a CSV import with invalid rows, importing nothing', async () => {
    const coach = await registerCoach(app);
    const csv = 'firstName,lastName,email\n,Smith,bad-email';

    const res = await request(app.getHttpServer())
      .post(`/api/v1/organisations/${coach.organisationId}/club-members/import`)
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .attach('file', Buffer.from(csv), 'members.csv')
      .expect(400);
    expect(res.body.errors.length).toBeGreaterThan(0);

    const listRes = await request(app.getHttpServer())
      .get(`/api/v1/organisations/${coach.organisationId}/club-members`)
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .expect(200);
    expect(listRes.body).toHaveLength(0);
  });

  it('a coach from a different organisation cannot import into another club', async () => {
    const coachA = await registerCoach(app);
    const coachB = await registerCoach(app);
    const csv = 'firstName,lastName,email\nJohn,Smith,john.smith@example.test';

    await request(app.getHttpServer())
      .post(`/api/v1/organisations/${coachA.organisationId}/club-members/import`)
      .set('Authorization', `Bearer ${coachB.accessToken}`)
      .attach('file', Buffer.from(csv), 'members.csv')
      .expect(403);
  });

  it('sends an expiry reminder once, skips an already-reminded member, and renewing re-arms it', async () => {
    const coach = await registerCoach(app);
    const createRes = await request(app.getHttpServer())
      .post(`/api/v1/organisations/${coach.organisationId}/club-members`)
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .send(MEMBER_INPUT)
      .expect(201);
    const memberId = createRes.body.id as string;

    await request(app.getHttpServer())
      .patch(`/api/v1/club-members/${memberId}`)
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .send({ membershipExpiryDate: '2020-01-01' })
      .expect(200);

    await request(app.getHttpServer())
      .post('/api/v1/club-members/send-expiry-reminders')
      .set('x-cron-secret', 'wrong-secret')
      .expect(401);

    const firstRun = await request(app.getHttpServer())
      .post('/api/v1/club-members/send-expiry-reminders')
      .set('x-cron-secret', 'dev-cron-secret')
      .expect(201);
    expect(firstRun.body.sent).toBe(1);

    const afterFirstRun = await request(app.getHttpServer())
      .get(`/api/v1/club-members/${memberId}`)
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .expect(200);
    expect(afterFirstRun.body.lastReminderSentAt).not.toBeNull();

    const secondRun = await request(app.getHttpServer())
      .post('/api/v1/club-members/send-expiry-reminders')
      .set('x-cron-secret', 'dev-cron-secret')
      .expect(201);
    expect(secondRun.body.sent).toBe(0);

    await request(app.getHttpServer())
      .patch(`/api/v1/club-members/${memberId}`)
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .send({ membershipExpiryDate: '2020-06-01' })
      .expect(200);
    const afterRenewal = await request(app.getHttpServer())
      .get(`/api/v1/club-members/${memberId}`)
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .expect(200);
    expect(afterRenewal.body.lastReminderSentAt).toBeNull();
  });

  it('a coach records a payment, the member can view but not create one, and the coach can delete it', async () => {
    const coach = await registerCoach(app);
    const createRes = await request(app.getHttpServer())
      .post(`/api/v1/organisations/${coach.organisationId}/club-members`)
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .send(MEMBER_INPUT)
      .expect(201);
    const memberId = createRes.body.id as string;

    const paymentRes = await request(app.getHttpServer())
      .post(`/api/v1/club-members/${memberId}/payments`)
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .send({ amount: 500, method: 'CASH', paidAt: '2026-01-15', note: 'Annual fee' })
      .expect(201);
    expect(String(paymentRes.body.amount)).toContain('500');
    const paymentId = paymentRes.body.id as string;

    const listRes = await request(app.getHttpServer())
      .get(`/api/v1/club-members/${memberId}/payments`)
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .expect(200);
    expect(listRes.body).toHaveLength(1);

    const inviteRes = await request(app.getHttpServer())
      .post(`/api/v1/club-members/${memberId}/invite`)
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .expect(201);
    const acceptRes = await request(app.getHttpServer())
      .post('/api/v1/auth/accept-invite')
      .send({ token: inviteRes.body.inviteToken, password: 'MemberPassword123!' })
      .expect(200);
    const memberToken = acceptRes.body.accessToken as string;

    await request(app.getHttpServer())
      .get(`/api/v1/club-members/${memberId}/payments`)
      .set('Authorization', `Bearer ${memberToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .post(`/api/v1/club-members/${memberId}/payments`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ amount: 100, method: 'CASH', paidAt: '2026-02-01' })
      .expect(403);

    await request(app.getHttpServer())
      .delete(`/api/v1/club-member-payments/${paymentId}`)
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .expect(200);

    const afterDelete = await request(app.getHttpServer())
      .get(`/api/v1/club-members/${memberId}/payments`)
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .expect(200);
    expect(afterDelete.body).toHaveLength(0);
  });

  it("reports member counts by status and this month's payment total, but not to a self-service member", async () => {
    const coach = await registerCoach(app);

    const active = await request(app.getHttpServer())
      .post(`/api/v1/organisations/${coach.organisationId}/club-members`)
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .send({ ...MEMBER_INPUT, email: 'active@example.test' })
      .expect(201);
    // membershipExpiryDate isn't settable on create (coach/admin-only field,
    // not part of CreateClubMemberDto) - set it via update instead.
    await request(app.getHttpServer())
      .patch(`/api/v1/club-members/${active.body.id}`)
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .send({ membershipExpiryDate: '2099-01-01' })
      .expect(200);

    const expiringSoon = await request(app.getHttpServer())
      .post(`/api/v1/organisations/${coach.organisationId}/club-members`)
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .send({ ...MEMBER_INPUT, email: 'expiring@example.test' })
      .expect(201);
    await request(app.getHttpServer())
      .patch(`/api/v1/club-members/${expiringSoon.body.id}`)
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .send({
        membershipExpiryDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000)
          .toISOString()
          .slice(0, 10),
      })
      .expect(200);

    const expired = await request(app.getHttpServer())
      .post(`/api/v1/organisations/${coach.organisationId}/club-members`)
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .send({ ...MEMBER_INPUT, email: 'expired@example.test' })
      .expect(201);
    await request(app.getHttpServer())
      .patch(`/api/v1/club-members/${expired.body.id}`)
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .send({ membershipExpiryDate: '2020-01-01' })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/api/v1/club-members/${active.body.id}/payments`)
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .send({ amount: 150, method: 'EFT', paidAt: new Date().toISOString() })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/club-members/${expired.body.id}/payments`)
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .send({ amount: 50, method: 'CASH', paidAt: new Date().toISOString() })
      .expect(201);
    // A payment from last year shouldn't count towards this month's total.
    await request(app.getHttpServer())
      .post(`/api/v1/club-members/${active.body.id}/payments`)
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .send({ amount: 999, method: 'CASH', paidAt: '2020-01-01' })
      .expect(201);

    const statsRes = await request(app.getHttpServer())
      .get(`/api/v1/organisations/${coach.organisationId}/club-members/stats`)
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .expect(200);
    expect(statsRes.body.totalMembers).toBe(3);
    expect(statsRes.body.expiringSoonCount).toBe(1);
    expect(statsRes.body.expiredCount).toBe(1);
    expect(Number(statsRes.body.paymentsThisMonthTotal)).toBe(200);

    // A self-service club member gets 403 - aggregate org figures aren't
    // for them, even for their own club.
    const inviteRes = await request(app.getHttpServer())
      .post(`/api/v1/club-members/${active.body.id}/invite`)
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .expect(201);
    const acceptRes = await request(app.getHttpServer())
      .post('/api/v1/auth/accept-invite')
      .send({ token: inviteRes.body.inviteToken, password: 'MemberPassword123!' })
      .expect(200);
    await request(app.getHttpServer())
      .get(`/api/v1/organisations/${coach.organisationId}/club-members/stats`)
      .set('Authorization', `Bearer ${acceptRes.body.accessToken}`)
      .expect(403);
  });
});
