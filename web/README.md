# Ubuntu Run - Coach Web Dashboard

React + TypeScript + Vite SPA covering login, athlete roster/profile, training-plan and workout
building with a calendar view, workout results, and coach-athlete messaging. Talks to the
NestJS API in the parent `Ubuntu Run/` repo.

## Running locally

1. Start the backend first (from the repo root): `npm run dev` (listens on `http://localhost:3000`).
2. `cp .env.example .env` if you need to point at a non-default API URL.
3. `npm install`
4. `npm run dev` - Vite dev server on `http://localhost:5173`, matching the backend's default
   `CORS_ORIGIN`.

## Scripts

- `npm run dev` - start the Vite dev server
- `npm run build` - type-check and produce a production build in `dist/`
- `npm run test` - run the Vitest suite
- `npm run lint` - run oxlint

## Notes

- Authentication: the access token is kept in memory only (never `localStorage`); the refresh
  token is an httpOnly cookie set by the backend. See `src/auth/AuthProvider.tsx` and
  `src/api/client.ts`.
- Branding: colours, type, and the status system come from the Ubuntu Run Brand Guidelines and
  live as design tokens in `src/index.css`. The sidebar/login logo is the brand PNG in
  `src/assets/logo.png`; the browser tab icon is a placeholder Navy monogram
  (`public/favicon.svg`) until a dedicated icon-only asset is available.
- The platform admin console isn't built yet - an admin who logs in lands on a placeholder page.
  Coach and athlete flows cover everything the backend currently exposes.
