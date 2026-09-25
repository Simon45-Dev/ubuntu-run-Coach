# Deployment: pilot stack on Vercel + Render + Neon + Backblaze B2 + Brevo

This is both a record of the systems this pilot actually runs on and a
step-by-step runbook for setting it up again (a second environment, or from
scratch if it's ever rebuilt). A $0/month stack, chosen because no card should
be needed anywhere for the pilot/testing phase.

## Systems in use

| System | Role | Live URL / identifier |
|---|---|---|
| **GitHub** | Source control | `Simon45-Dev/ubuntu-run-Coach` (private repo) |
| **Vercel** | Frontend hosting (static build of `web/`) | `https://ubuntu-run-coach.vercel.app` |
| **Render** | Backend hosting (NestJS API), free web service | `https://ubuntu-run-coach.onrender.com` |
| **Neon** | Postgres database | Connection string held in Render's `DATABASE_URL` env var |
| **Backblaze B2** | Avatar/profile-picture storage, private bucket | Bucket `ubuntu-run-avatars`; credentials in Render's `S3_*` env vars |
| **Brevo** | Transactional email (invites, password resets), via HTTP API not SMTP | API key in Render's `BREVO_API_KEY` env var |

None of these services have a payment method on file. Every credential above
lives only in Render's Environment tab (or the relevant provider's own
dashboard) - never committed to the repo. `.env.example` documents every
variable name but no real values.

**Admin login**: `run.ubuntu1@gmail.com` (the only `PLATFORM_ADMIN` account;
see step 5 for how it was created, since there's no self-registration route
for that role).

## Trade-offs accepted for the pilot

- **Render's free web service sleeps** after 15 minutes of no traffic and
  takes roughly a minute to wake up on the next request. Upgrade to a paid
  Render instance before any real launch where that cold start matters.
- **Email sender address**: invites currently show as
  `Ubuntu Run <...@brevosend.com>` rather than a branded domain, because the
  verified sender is a Gmail address (a "freemail" domain Brevo can't
  authenticate SPF/DKIM for) and Brevo substitutes its own relay domain to
  preserve deliverability. Fixing this needs a real domain, verified in
  Brevo with DKIM/SPF/DMARC DNS records - **deliberately deferred until real
  launch**, not done for the pilot.
- **No CI workflow active**: `.github/workflows/ci.yml` exists locally but
  isn't pushed - the git credential used for the first push lacked GitHub's
  `workflow` OAuth scope, which is required to push any file under
  `.github/workflows/`. See "Gotchas" below to re-add it.

## 1. Database - Neon

1. Create a Neon project (or reuse an existing empty one - if the account
   provisions Neon through Vercel's integration, do this from Vercel's
   Storage tab rather than Neon's own dashboard, which won't offer a "New
   project" button in that case).
2. Copy the **pooled** connection string it gives you - this is `DATABASE_URL`.

## 2. File storage - Backblaze B2

1. Sign up at [backblaze.com/b2](https://www.backblaze.com/cloud-storage) - no
   card required for a **private** bucket (a public bucket needs payment
   history or a one-time fee - stick to private).
2. Create a bucket (e.g. `ubuntu-run-avatars`), set **Files in Bucket are:**
   to **Private**.
3. Under **App Keys**, create a new Application Key scoped to that bucket
   (Read & Write). This gives a `keyID` (→ `S3_ACCESS_KEY_ID`) and an
   `applicationKey` (→ `S3_SECRET_ACCESS_KEY`), shown once - copy both
   immediately.
4. On the bucket's detail page, note its **Endpoint**
   (e.g. `s3.us-east-005.backblazeb2.com` - prefix with `https://` for
   `S3_ENDPOINT`) and region (e.g. `us-east-005`, for `S3_REGION`). The
   bucket name itself is `S3_BUCKET`.

Avatars are never served directly from the bucket - the backend fetches them
with its own credentials and streams them back via `GET /avatars/:filename`
(`src/modules/users/avatars.controller.ts`), so the bucket stays private.

## 3. Backend - Render

1. New Web Service, pointed at the GitHub repo, root directory left blank
   (the repo root, **not** `web/` - that's the frontend).
2. Build command: `npm ci --include=dev && npx prisma generate && npm run build`
   (`--include=dev` matters: `NODE_ENV=production` is set below, and `npm ci`
   otherwise skips devDependencies under that env var - which is where
   `@nestjs/cli` lives, so the build fails with `nest: not found` without it.)
3. Start command: `npx prisma migrate deploy && npm run start:prod`
4. Instance type: **Free**.
5. Environment variables - every one listed in `.env.example`:
   - `NODE_ENV=production`
   - `PORT` - Render sets this automatically, leave it alone
   - `CORS_ORIGIN` - the exact Vercel URL the frontend is served from
   - `DATABASE_URL` - from step 1
   - `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `MFA_ENCRYPTION_KEY` - generate
     fresh values with `openssl rand -hex 32` each, never reuse the dev ones
   - `JWT_ACCESS_TTL=15m`, `JWT_REFRESH_TTL=30d`
   - `BREVO_API_KEY` / `EMAIL_FROM_ADDRESS` / `EMAIL_FROM_NAME` - optional;
     leave `BREVO_API_KEY` unset to have emails log to Render's service logs
     instead of sending. **Must be Brevo's HTTP API key, not SMTP
     credentials** - see "Gotchas" below for why. `EMAIL_FROM_ADDRESS` must be
     a bare email (no `"Name <email>"` wrapper); the name is the separate
     `EMAIL_FROM_NAME` field.
   - `S3_*` (five vars) - from step 2
   - `CRON_SECRET` - optional, only needed for club membership expiry
     reminders; see section 7. Generate with `openssl rand -hex 32`, same as
     the JWT secrets.

## 4. Frontend - Vercel

1. Import `web/` specifically as the project root (not the repo root - use
   the "Edit" option on Root Directory during import if it defaults wrong).
2. Environment variable: `VITE_API_BASE_URL=https://<render-app>.onrender.com/api/v1`
3. Deploy.

`web/vercel.json` (already in the repo) rewrites every path to `/index.html` -
without it, any direct link to a client-side route (an invite email link, a
password reset link, or just refreshing a page other than `/`) 404s, since
Vercel only serves files matching an exact static path by default and this is
a single-page app whose routing happens in the browser.

## 5. Bootstrap the first admin account

`PLATFORM_ADMIN` has no self-registration route by design (only coach
self-signup is exposed via `/auth/register`). Run this once, from a local
machine pointed at the production database:

```
DATABASE_URL="<neon connection string>" npm run create-admin -- you@example.com "a-strong-password" "Your Name"
```

## 6. Smoke test

- Log in as the admin account; confirm `/admin` loads real (initially mostly
  zeroed) totals.
- Register a coach through the normal sign-up flow.
- Invite an athlete; confirm the invite email actually arrives (check spam -
  see the freemail sender trade-off above).
- Upload a profile picture as the coach; confirm it renders and its URL is
  `/api/v1/avatars/<uuid>...`, not `/uploads/...`.
- Log out, log back in, and leave the tab open past 15 minutes idle, then
  perform an action - confirms the session survives the cross-domain refresh
  cookie (`sameSite: 'none'` in production, `src/modules/auth/auth.controller.ts`).
- Check the app on an actual phone, not just desktop browser width.

## 7. Expiry reminders (club membership)

Club members with a `membershipExpiryDate` get a one-time reminder email once
their membership is `EXPIRING_SOON` (within 30 days) or `EXPIRED`
(`src/modules/club-members/club-membership-status.util.ts`). This relies on
two things running together:

- An in-process `@Cron('0 8 * * *')` job (`ClubMembersService.handleExpiryReminderCron`)
  that fires at 08:00 server time **if the Render instance happens to be
  awake at that moment**.
- `POST /club-members/send-expiry-reminders` - the same logic exposed as a
  plain HTTP endpoint, protected by a shared secret header (`x-cron-secret`,
  checked against the `CRON_SECRET` env var) instead of a user JWT, since an
  external pinger can't hold a 15-minute-lived login session. It 401s if
  `CRON_SECRET` is unset or the header doesn't match.

**Render's free web service sleeps after 15 minutes idle and cannot wake
itself for an internal timer** - the in-process cron alone will silently miss
its 08:00 firing on any day the service is asleep at the time. The external
ping is what actually guarantees delivery, and it also happens to wake a
sleeping instance. Set `CRON_SECRET` in Render (see section 3), then point an
external scheduler at it daily, for example:

- **cron-job.org** (free, no code) - create a job hitting
  `POST https://<render-app>.onrender.com/api/v1/club-members/send-expiry-reminders`
  with header `x-cron-secret: <the same value>`, once a day.
- **A scheduled GitHub Actions workflow** in this repo, e.g.:
  ```yaml
  on:
    schedule:
      - cron: '0 8 * * *'
  jobs:
    ping:
      runs-on: ubuntu-latest
      steps:
        - run: |
            curl -sf -X POST \
              -H "x-cron-secret: ${{ secrets.CRON_SECRET }}" \
              https://<render-app>.onrender.com/api/v1/club-members/send-expiry-reminders
  ```
  (store the secret in the repo's Actions secrets, not the workflow file).

Renewing a member (setting a new `membershipExpiryDate` via the app) clears
their `lastReminderSentAt`, so they're eligible for a fresh reminder next time
they approach expiry rather than being silently skipped forever after the
first one.

**Deferred for the pilot**: neither external-ping option above has actually
been set up yet - do this before relying on reminders in practice.

## Gotchas hit during setup (and how to avoid repeating them)

- **`npm ci` failing with `nest: not found`** - `NODE_ENV=production` makes
  plain `npm ci` skip devDependencies. Fixed by adding `--include=dev` to the
  Render build command (already reflected above).
- **SMTP always timing out (`Error: Connection timeout`)** - Render's free
  web service blocks all outbound traffic to SMTP ports 25/465/587
  (https://render.com/changelog/free-web-services-will-no-longer-allow-outbound-traffic-to-smtp-ports).
  No SMTP provider will ever work here regardless of credentials. Fixed by
  sending through Brevo's HTTP API instead (`src/modules/email/email.service.ts`)
  - a plain HTTPS POST, which isn't blocked.
- **Vercel 404 on any direct link other than `/`** - a single-page app needs
  an explicit rewrite rule on a static host; Vercel doesn't fall back to
  `index.html` on its own. Fixed by `web/vercel.json`.
- **Sessions dropping unexpectedly in production** - the refresh-token cookie
  was hardcoded `sameSite: 'strict'`, which silently breaks once frontend and
  backend are on different domains (Vercel vs Render). Fixed by making it
  `sameSite: 'none'` in production (paired with the `Secure` flag, which was
  already conditional on `NODE_ENV`).
- **"Email already exists" when re-inviting someone after removing them** -
  removing a coach/athlete through the app is a *soft delete* (`deletedAt`
  set, row kept for audit history), but the `email` column has a hard unique
  constraint regardless of that status. To free up an email for reuse during
  testing, connect to Neon's SQL Editor and run (after checking for and
  confirming no dependent rows, e.g. training plans / check-ins / athletes
  under a coach):
  ```sql
  -- for a coach:
  DELETE FROM coaches WHERE "userId" = '<user id>';
  DELETE FROM users WHERE id = '<user id>';
  -- for an athlete:
  DELETE FROM athletes WHERE "userId" = '<user id>';
  DELETE FROM users WHERE id = '<user id>';
  ```
  This is a testing convenience only - never do this against real user data
  without a genuine deletion request, and always check for dependent rows
  first.
- **A network/antivirus TLS block can look exactly like a hosting outage** -
  one testing machine's network (or an antivirus's SSL/TLS inspection)
  silently broke HTTPS to `*.vercel.app` specifically (`ERR_SSL_VERSION_OR_CIPHER_MISMATCH`),
  while every other site worked fine, including the Render backend. Confirmed
  as local/network-specific by testing the same URL on mobile data instead.
  Worth ruling this out early if "the site is down" but curl/other devices
  say otherwise.
- **Re-adding the CI workflow** - pushing `.github/workflows/ci.yml` needs a
  git credential (personal access token) with the `workflow` OAuth scope,
  which the one used for the initial push didn't have. Generate a classic
  PAT with `repo` + `workflow` scopes, clear the cached credential (Windows
  Credential Manager → remove the `git:https://github.com` entry), then push
  again and it'll prompt for the new token.
