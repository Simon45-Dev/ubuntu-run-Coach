// Fills in required env vars for e2e runs when not already set (e.g. by CI),
// so `npm run test:e2e` works locally against the docker-compose Postgres
// with just a `.env` present. Requires a live Postgres reachable at
// DATABASE_URL - see README "Running tests".
//
// DATABASE_URL is a deliberate exception to the ??= pattern below: every
// spec's afterEach calls cleanDatabase(), which deletes every row in every
// table. A local `.env`'s DATABASE_URL normally points at the everyday dev
// database (see .env.example), so leaving this as ??= would silently wipe
// real dev/demo data on every local `npm run test:e2e` run - which is
// exactly what happened once already. This always points at a dedicated
// ubuntu_run_test database instead, unconditionally - matching CI's own
// Postgres service (.github/workflows/ci.yml), which is a fresh container
// per run and was never at risk. Create it once locally with
// `createdb -U ubuntu_run ubuntu_run_test` (or via psql), then
// `DATABASE_URL=postgresql://ubuntu_run:ubuntu_run@localhost:5432/ubuntu_run_test npx prisma migrate deploy`.
process.env.DATABASE_URL = 'postgresql://ubuntu_run:ubuntu_run@localhost:5432/ubuntu_run_test';

process.env.NODE_ENV ??= 'test';
process.env.CORS_ORIGIN ??= 'http://localhost:5173';
process.env.JWT_ACCESS_SECRET ??= 'test-access-secret-please-change';
process.env.JWT_ACCESS_TTL ??= '15m';
process.env.JWT_REFRESH_SECRET ??= 'test-refresh-secret-please-change';
process.env.JWT_REFRESH_TTL ??= '30d';
process.env.MFA_ENCRYPTION_KEY ??= 'test-mfa-encryption-key-please-change';

jest.setTimeout(30000);
