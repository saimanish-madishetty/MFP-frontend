# Mahadeva Food Products – Stock & Sales App

## Goal
A web app to manage stock and sales for Mahadeva Food Products.
- Single user (the owner), so scaling is not a concern.
- Everything must run on free hosting tiers.
- Modules will be added one at a time. Set up the base project first, then build each module as it is described.

## Decided Tech Stack
| Layer | Technology | Hosting (free) |
|---|---|---|
| Frontend | Next.js (TypeScript) | Vercel |
| Android app | Same Next.js frontend wrapped with Capacitor → APK | Sideloaded APK (no Play Store needed) |
| Backend | NestJS (TypeScript) + Prisma ORM | Render (free web service) |
| Database | PostgreSQL | Supabase (free tier, used only as the database) |
| Keep-alive | UptimeRobot pings `/health` every 10 min | UptimeRobot (free) |

### Why these choices
- **NestJS backend instead of Supabase's auto API.** Stock and sales need real business logic: deduct stock on sale, block sales when stock is insufficient, batch and expiry tracking for food items, GST and invoices, and reports. That logic belongs in NestJS services, not SQL functions.
- **Supabase as the database.** It is Postgres with a free table editor (handy for viewing and fixing data), file storage for product images and invoice PDFs, and optional auth. Caveat: free projects pause after 7 days of no activity (restore with one click). Daily use prevents this.
- **Render free tier sleeps** after about 15 min idle, and the next request then takes 30–60 s. Fix: expose `GET /health` returning `ok` and have UptimeRobot ping it every 10 min. Render's 750 free hours/month are enough to keep one service awake 24/7.
- **Capacitor for the Android APK.** One codebase serves both the web app (Vercel) and the APK. The frontend is built as a static export bundled inside the APK, and it calls the NestJS backend over HTTPS. Capacitor plugins give native features when needed (barcode scanning with the camera, sharing invoice PDFs to WhatsApp, file save).
  - Constraints this puts on the frontend: Next.js `output: 'export'`, so no API routes, middleware, server actions or request-time server rendering. All data is fetched client-side from NestJS. Use `images.unoptimized: true`.
  - Auth uses an `Authorization: Bearer <JWT>` header, not cookies (cross-origin cookies are unreliable inside the app WebView). Store the token with Capacitor Preferences or localStorage.
  - Building the APK needs the Android SDK and a JDK, either locally (Android Studio) or in a free GitHub Actions workflow. Sign the release APK with a keystore kept safe outside the repo; losing it means future APKs can't update the installed app.
- **Avoid:** Fly.io and Railway (no real free tier anymore), and SQLite on Render or Vercel (ephemeral disk, so data is lost on redeploy).

## Planned Repo Structure
```
mahadeva/
├── frontend/   # Next.js app → deployed to Vercel
└── backend/    # NestJS + Prisma → deployed to Render
    └── prisma/schema.prisma   # DATABASE_URL points to Supabase Postgres
```

## Initial Setup Tasks (before modules)
1. Create the monorepo with `frontend/` (Next.js, TypeScript, Tailwind) and `backend/` (NestJS, TypeScript).
2. Add Prisma in the backend and connect it to Supabase Postgres through the `DATABASE_URL` env var. Use Supabase's pooled connection string for the app and the direct string for migrations (`DIRECT_URL`).
3. Add simple single-user login (e.g. a username and password stored in env vars, with the backend issuing a JWT; the frontend stores it and sends it with each request).
4. Add a `GET /health` endpoint in NestJS (unauthenticated) for UptimeRobot.
5. Enable CORS in NestJS for the Vercel frontend URL and the Capacitor app origin (`https://localhost` on Android).
6. Build a basic frontend layout: login page plus a dashboard shell with a sidebar for future modules. It must be mobile-friendly, since it is also the Android app (sidebar collapses to a drawer or bottom nav on small screens).
7. Deploy: frontend to Vercel, backend to Render, both from GitHub.
8. Add Capacitor to the frontend (`@capacitor/core`, `@capacitor/android`), configure the static export, and produce a signed release APK (via Android Studio or a GitHub Actions workflow that attaches the APK to a GitHub Release).

## Local Development
- Two repos: `MFP-frontend` (Next.js + Capacitor) and `MFP-backend` (NestJS + Prisma).
- Local database: Postgres 17 in Docker (`MFP-backend/docker-compose.yml`, `npm run db:up`), so dev matches Supabase. The machine's local MySQL is not used.
- Ports: frontend `3001`, backend `4001`, Postgres `5432`.
- Prisma 7: connection URL lives in `prisma.config.ts` (CLI) and `PrismaService` (app, via `@prisma/adapter-pg`), not in `schema.prisma`.

## Ops Notes
- Back up data weekly (`pg_dump` or CSV export to Google Drive), since these are money records.
- Free tier limits change. Verify the current limits on each provider's pricing page.

## Modules
Specs live in [docs/modules/](docs/modules/README.md) and are built one at a time, in order:
1. [Workers](docs/modules/01-workers.md): registry, daily attendance, pay calculation, settle-pay button
2. [Stock](docs/modules/02-stock.md): raw materials and supplies, purchases, day-end usage
3. [Products](docs/modules/03-products.md): internal vs public name, materials used, finished goods stock
4. [Buyers](docs/modules/04-buyers.md): contacts, ledger, payments, overdue alerts
5. [Sales](docs/modules/05-sales.md): GST invoices, PDF, WhatsApp share, public names only
