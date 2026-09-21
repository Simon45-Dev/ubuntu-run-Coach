// Fills in required env vars for e2e runs when not already set (e.g. by CI),
// so `npm run test:e2e` works locally against the docker-compose Postgres
// with just a `.env` present. Requires a live Postgres reachable at
// DATABASE_URL - see README "Running tests".
process.env.NODE_ENV ??= 'test';
process.env.CORS_ORIGIN ??= 'http://localhost:5173';
process.env.JWT_ACCESS_SECRET ??= 'test-access-secret-please-change';
process.env.JWT_ACCESS_TTL ??= '15m';
process.env.JWT_REFRESH_SECRET ??= 'test-refresh-secret-please-change';
process.env.JWT_REFRESH_TTL ??= '30d';
process.env.MFA_ENCRYPTION_KEY ??= 'test-mfa-encryption-key-please-change';

jest.setTimeout(30000);
