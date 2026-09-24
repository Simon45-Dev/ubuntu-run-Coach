# Deploying a pilot: Vercel + Render + Neon + Cloudflare R2

A $0/month stack suitable for a pilot or testing phase. Frontend on Vercel,
backend on Render's free web service, database on Neon's free Postgres,
avatar uploads on Cloudflare R2's free tier (Render's free web service has no
persistent disk, so avatars need object storage rather than local disk - see
`src/modules/users/avatar-storage.service.ts`).

Trade-off to accept knowingly: Render's free web service sleeps after 15
minutes of no traffic and takes roughly a minute to wake up on the next
request. Fine for a pilot; upgrade to a paid Render instance before any real
launch where that cold start matters.

## 1. Database - Neon

1. Create a Neon project.
2. Copy the pooled connection string it gives you - this is your `DATABASE_URL`.

## 2. File storage - Cloudflare R2

1. Create an R2 bucket (e.g. `ubuntu-run-avatars`).
2. In the bucket's settings, enable the public "r2.dev" development URL (or
   attach a custom domain if you have one) - this becomes `R2_PUBLIC_URL`.
3. Create an R2 API token scoped to Object Read & Write on that bucket. This
   gives you `R2_ACCESS_KEY_ID` and `R2_SECRET_ACCESS_KEY`.
4. Your Cloudflare account ID (visible on the R2 overview page) is
   `R2_ACCOUNT_ID`. The bucket name is `R2_BUCKET`.

## 3. Backend - Render

1. New Web Service, pointed at this repo, root directory `/` (the repo root,
   not `web/`).
2. Build command: `npm ci && npx prisma generate && npm run build`
3. Start command: `npx prisma migrate deploy && npm run start:prod`
4. Environment variables - every one listed in `.env.example`:
   - `NODE_ENV=production`
   - `PORT` - Render sets this automatically, leave it be
   - `CORS_ORIGIN` - the exact Vercel URL the frontend will be served from
   - `DATABASE_URL` - from step 1
   - `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `MFA_ENCRYPTION_KEY` - generate
     fresh values with `openssl rand -hex 32` each, never reuse the dev ones
   - `JWT_ACCESS_TTL=15m`, `JWT_REFRESH_TTL=30d` (or your own choice)
   - `SMTP_*`/`EMAIL_FROM_ADDRESS` - optional; leave unset to have invite and
     password-reset emails log to the Render service logs instead of sending
   - `R2_*` (five vars) - from step 2

## 4. Frontend - Vercel

1. Import `web/` as the project root (not the repo root).
2. Environment variable: `VITE_API_BASE_URL=https://<your-render-app>.onrender.com/api/v1`
3. Deploy.

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
- Invite an athlete; confirm the invite email arrives (or check Render logs if `SMTP_HOST` is unset).
- Upload a profile picture as the coach; confirm it renders and its URL points at your R2 public URL, not `/uploads/...`.
- Log out, log back in, and leave the tab open past 15 minutes idle, then perform an action - confirms the session survives the cross-domain refresh cookie (`sameSite: 'none'` in production).
