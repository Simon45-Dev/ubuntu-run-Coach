# Ubuntu Run API

Backend foundation for the Ubuntu Run coaching platform: API, relational data
model, and auth/RBAC. This is the first build slice - see
`docs/data-retention-policy.md` for the retention approach, and the original
product planning document for the full roadmap. Workouts, training plans,
groups, messaging, notifications, analytics, AI, and billing are deliberately
out of scope for this slice (their tables exist in the schema, but no API).

## Prerequisites

- Node.js (see `.nvmrc`)
- A running PostgreSQL 16 instance - `docker-compose.yml` provides one if you
  have Docker; otherwise point `DATABASE_URL` at any Postgres 16 instance.

## Quick start

```bash
npm install
cp .env.example .env
# edit .env: generate real secrets, and confirm DATABASE_URL if not using
# docker-compose (see .env.example for the data-residency note on this)

docker compose up -d        # if using the bundled Postgres
npx prisma migrate dev
npm run seed                # synthetic dev data only, see prisma/seed.ts
npm run dev
```

API is served under `/api/v1`. Swagger UI is at `http://localhost:3000/docs`.

Seeded accounts (password `DevPassword123!` for all):
- `admin@ubunturun.dev` (PLATFORM_ADMIN)
- `coach@ubunturun.dev` (COACH)
- `athlete1@ubunturun.dev`, `athlete2@ubunturun.dev`, `athlete3@ubunturun.dev` (ATHLETE, on the seeded coach's roster)

## Running tests

Unit tests have no external dependencies:

```bash
npm run test
```

E2E tests require a live Postgres reachable at `DATABASE_URL` (the
docker-compose instance works). They run each spec file against real
migrations, so run migrations first:

```bash
docker compose up -d
npx prisma migrate deploy
npm run test:e2e
```

Start with `test/e2e/rbac-isolation.e2e-spec.ts` if you're checking that a
schema or guard change hasn't broken data isolation - it's the highest-risk
area in this slice (see its file header for why).

## What's deliberately not here yet

- No frontend (web coach dashboard / athlete mobile app).
- No Workout/TrainingPlan/Group/Message/Notification/CheckIn/RaceGoal API -
  tables exist in `prisma/schema.prisma` so later slices don't need a
  migration to add them, but no controller/service yet.
- No billing/payment processing - `Subscription` is a data holder only.
- No confirmed hosting/data-residency decision - see `.env.example` and
  `docs/data-retention-policy.md`. Confirm this before loading any real
  personal information.
