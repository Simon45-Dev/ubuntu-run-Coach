# Deploying a pilot: Vercel + Render + Neon + Backblaze B2

A $0/month stack suitable for a pilot or testing phase, with no card on file
anywhere. Frontend on Vercel, backend on Render's free web service, database
on Neon's free Postgres, avatar uploads on Backblaze B2's free tier (Render's
free web service has no persistent disk, so avatars need object storage
rather than local disk - see `src/modules/users/avatar-storage.service.ts`).

The B2 bucket is kept **private** - Backblaze requires payment history (or a
one-time fee) to make a bucket public, but a private bucket needs neither.
Avatars are instead served through our own backend at `GET /avatars/:filename`
(`src/modules/users/avatars.controller.ts`), which fetches the object from B2
using the account's own credentials and streams it back - the bucket itself
is never exposed publicly.

Trade-off to accept knowingly: Render's free web service sleeps after 15
minutes of no traffic and takes roughly a minute to wake up on the next
request. Fine for a pilot; upgrade to a paid Render instance before any real
launch where that cold start matters.

## 1. Database - Neon

1. Create a Neon project (or reuse an existing empty one - if your account
   provisions Neon through Vercel's integration, do this from Vercel's
   Storage tab rather than Neon's own dashboard).
2. Copy the pooled connection string it gives you - this is your `DATABASE_URL`.

## 2. File storage - Backblaze B2

1. Sign up at [backblaze.com/b2](https://www.backblaze.com/cloud-storage) - no
   card required for a private bucket.
2. Create a bucket (e.g. `ubuntu-run-avatars`), set **Files in Bucket are:**
   to **Private**.
3. Under **App Keys**, create a new Application Key scoped to that bucket
   (Read & Write). This gives you a `keyID` (→ `S3_ACCESS_KEY_ID`) and an
   `applicationKey` (→ `S3_SECRET_ACCESS_KEY`), shown once - copy both
   immediately.
4. On the bucket's detail page, note its **Endpoint**
   (e.g. `s3.us-west-004.backblazeb2.com` - prefix it with `https://` for
   `S3_ENDPOINT`) and region (e.g. `us-west-004`, for `S3_REGION`). The
   bucket name itself is `S3_BUCKET`.

## 3. Backend - Render

1. New Web Service, pointed at this repo, root directory `/` (the repo root,
   not `web/`).
2. Build command: `npm ci --include=dev && npx prisma generate && npm run build`
   (`--include=dev` matters here: `NODE_ENV=production` is set below, and
   `npm ci` otherwise skips devDependencies under that env var - which is
   where `@nestjs/cli` lives, so the build fails with `nest: not found`
   without this flag.)
3. Start command: `npx prisma migrate deploy && npm run start:prod`
4. Environment variables - every one listed in `.env.example`:
   - `NODE_ENV=production`
   - `PORT` - Render sets this automatically, leave it be
   - `CORS_ORIGIN` - the exact Vercel URL the frontend will be served from
   - `DATABASE_URL` - from step 1
   - `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `MFA_ENCRYPTION_KEY` - generate
     fresh values with `openssl rand -hex 32` each, never reuse the dev ones
   - `JWT_ACCESS_TTL=15m`, `JWT_REFRESH_TTL=30d` (or your own choice)
   - `BREVO_API_KEY`/`EMAIL_FROM_ADDRESS`/`EMAIL_FROM_NAME` - optional; leave
     `BREVO_API_KEY` unset to have invite and password-reset emails log to the
     Render service logs instead of sending. **Must be Brevo's HTTP API key,
     not SMTP credentials** - Render's free web service blocks all outbound
     SMTP ports (25/465/587), so raw SMTP will always time out here regardless
     of provider or credentials; a plain HTTPS POST to Brevo's API is
     unaffected. Get the API key from Brevo's dashboard under
     **SMTP & API → API Keys** (a different credential than the SMTP key).
   - `S3_*` (five vars) - from step 2

## 4. Frontend - Vercel

1. Import `web/` as the project root (not the repo root).
2. Environment variable: `VITE_API_BASE_URL=https://<your-render-app>.onrender.com/api/v1`
3. Deploy.

`web/vercel.json` (already in the repo) rewrites every path to `/index.html` -
without it, any direct link to a client-side route (an invite email link, a
password reset link, or just refreshing a page other than `/`) 404s, since
Vercel only serves files matching an exact static path by default and this
is a single-page app whose routing happens in the browser.

## 5. Bootstrap the first admin account

`PLATFORM_ADMIN` has no self-registration route by design (only coach
self-signup is exposed via `/auth/register`). Run this once, from your own
machine, pointed at the production database:

```
DATABASE_URL="<your neon connection string>" npm run create-admin -- you@example.com "a-strong-password" "Your Name"
```

## 6. Smoke test

- Log in as the admin account just created; confirm the dashboard at `/admin` loads real (zeroed) totals.
- Register a coach through the normal sign-up flow.
- Invite an athlete; confirm the invite email arrives (or check Render logs if `BREVO_API_KEY` is unset).
- Upload a profile picture as the coach; confirm it renders and its URL is `/api/v1/avatars/<uuid>...`, not `/uploads/...`.
- Log out, log back in, and leave the tab open past 15 minutes idle, then perform an action - confirms the session survives the cross-domain refresh cookie (`sameSite: 'none'` in production).
