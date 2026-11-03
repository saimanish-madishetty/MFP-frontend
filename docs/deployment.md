# Deployment

How to put the app online and build the Android APK.

| Part | Host | Repo |
|---|---|---|
| Database | Supabase (Postgres) | — |
| Backend (NestJS) | Render, free web service | `MFP-backend` |
| Keep-alive | UptimeRobot pings `/health` | — |
| Web app (Next.js) | Vercel | `MFP-frontend` |
| Android app | Signed APK, installed by hand | `MFP-frontend` |

Do the steps in order: each one needs a URL from the step before.

> **No login yet.** The app has no login, so anyone who finds the backend URL can read, change or delete all data. Both GitHub repos are public, and the backend URL is visible in the web app's code. Add the planned single-user login before putting real business data online.

## 0. Before you start

- Both repos pushed to GitHub (`main` branch). Render and Vercel deploy from there.
  ```powershell
  git -C C:\MFP\MFP-backend push origin main
  git -C C:\MFP\MFP-frontend push origin main
  ```
- Accounts on Supabase, Render, Vercel and UptimeRobot. Sign in to Render and Vercel with the GitHub account that owns the repos (`saimanish-madishetty`).

## 1. Supabase (database) ✅ done

Created with the Supabase CLI on 2026-11-03:

| | |
|---|---|
| Project | `mfp` (ref `hidtxoabhfvvffsuqouv`) |
| Organization | Mahadeva Food Products (Free plan) |
| Region | Southeast Asia (Singapore), `ap-southeast-1` |
| Pooler host | `aws-0-ap-southeast-1.pooler.supabase.com` |
| Tables | All migrations applied |

The database password and both connection strings are in **`C:\Users\samadishet\.mfp-secrets\supabase.env`** (private; outside the repos). Back that file up.

- `DATABASE_URL`: transaction pooler, port **6543**, used by the running app.
- `DIRECT_URL`: session pooler, port **5432**, used for migrations.
- Both end with parameters that make the connection encrypted **and** certificate-checked against `certs/supabase-prod-ca-2021.crt` in the backend repo. Copy them exactly, including the part after `?`.
- Don't use Supabase's **Direct connection** (`db.<ref>.supabase.co`): on the free plan it's IPv6-only, which Render can't reach.

How it was done (for reference, e.g. to recreate it):
```powershell
# On the work laptop, Node-based CLIs need the Zscaler certificate:
$env:NODE_EXTRA_CA_CERTS = "$env:USERPROFILE\.certs\zscaler-root.pem"
npx supabase login
npx supabase orgs list
npx supabase projects create mfp --org-id <org-id> --region ap-southeast-1 --db-password <letters-and-numbers>
# Tables (from MFP-backend, with DIRECT_URL set to the session pooler string):
npx prisma migrate deploy
```

Note: free Supabase projects pause after 7 days without activity. The UptimeRobot check in step 3 prevents this, because `/health` queries the database.

## 2. Render (backend) ✅ done

Live at **https://mfp-backend.onrender.com** (service `mfp-backend`, Singapore, Free). `CORS_ORIGINS` = `https://mfp-frontend-omega.vercel.app,https://localhost`.


The service is defined in **`render.yaml`** in the backend repo (a Render Blueprint): Singapore region, free plan, build and start commands, `/health` check, Node 24. Only the secrets are entered by hand.

1. Sign in to Render with GitHub (`saimanish-madishetty`) and allow it access to the `MFP-backend` repo.
2. **New → Blueprint** → pick `MFP-backend` → Render reads `render.yaml` and shows the `mfp-backend` web service.
3. Fill in the three values it asks for:

   | Key | Value |
   |---|---|
   | `DATABASE_URL` | The `DATABASE_URL` line from `.mfp-secrets\supabase.env` (everything after `=`) |
   | `DIRECT_URL` | The `DIRECT_URL` line from the same file |
   | `CORS_ORIGINS` | `https://localhost` for now; add the Vercel URL after step 4 |

4. **Apply.** The first build takes a few minutes. When it's live, open `https://mfp-backend.onrender.com/health` (the exact URL is shown on the service page). Expected: `{"status":"ok","db":"up"}`.

To change a setting later, edit `render.yaml` and push; Render applies it. Don't set `PORT`; Render sets it.

Every push to `main` redeploys the backend and applies any new database migrations.

## 3. UptimeRobot (keep-alive)

1. **Add New Monitor** → type **HTTP(s)**.
2. URL: `https://<your-service>.onrender.com/health`, interval **5 minutes**.

Render's free service sleeps after about 15 minutes idle, and the first request after that takes 30–60 seconds. The monitor keeps it awake, and Render's 750 free hours a month are enough to run one service non-stop.

## 4. Vercel (web app) ✅ done

Live at **https://mfp-frontend-omega.vercel.app** (project `mfp-frontend`, team MFP, Hobby plan), connected to GitHub: every push to `main` redeploys. `NEXT_PUBLIC_API_URL` = `https://mfp-backend.onrender.com` (Production). The other generated addresses (`…-mfp9.vercel.app`, `…-git-main-…`) ask for a Vercel login; use the `-omega` one.

On the work laptop, `vercel deploy` from the terminal fails (Zscaler breaks the upload), so deploy by pushing to GitHub instead.


Build settings are in **`vercel.json`** in the frontend repo: build with `npm run build`, serve the static `out/` folder as-is (framework preset "Other", so the export fix in `fix-export-segments` is kept), and redirect `/stock` to `/stock/`.

1. Sign in to Vercel with GitHub (`saimanish-madishetty`).
2. **Add New → Project** → import `MFP-frontend`. The settings come from `vercel.json`; leave the preset as Vercel shows it.
3. Environment variable: `NEXT_PUBLIC_API_URL` = the Render URL from step 2, e.g. `https://mfp-backend.onrender.com` (no trailing slash).
4. **Deploy.** Note the site URL, e.g. `https://mfp-frontend.vercel.app`. Every push to `main` redeploys it.
5. Back in **Render → Environment**, set `CORS_ORIGINS` to:
   ```
   https://<your-app>.vercel.app,https://localhost
   ```
   Save; Render redeploys.
6. Open the Vercel URL and check that the dashboard loads data. "Can't reach the server" usually means a wrong `NEXT_PUBLIC_API_URL` or a missing `CORS_ORIGINS` entry.

`NEXT_PUBLIC_API_URL` is built into the app, so after changing it, redeploy on Vercel.

## 5. Android APK

### 5.1 Point the app at the hosted backend

Create `C:\MFP\MFP-frontend\.env.production` (git-ignored, stays on your machine):
```
NEXT_PUBLIC_API_URL=https://<your-service>.onrender.com
```

### 5.2 Build the web app into the Android project
```powershell
cd C:\MFP\MFP-frontend
npm run android:sync
```

### 5.3 Create the signing key (once only)
```powershell
keytool -genkey -v -keystore C:\Users\samadishet\mfp-release.jks -alias mfp -keyalg RSA -keysize 2048 -validity 10000
```
- Keep `mfp-release.jks` **outside the repo** and **back it up** (e.g. Google Drive), together with its passwords.
- If it's lost, new APKs can't be installed as updates over the existing app. You'd have to uninstall, which deletes the app's local data. Business data lives on the server and is safe either way.

### 5.4 Build the signed APK
1. `npm run android:open` (opens Android Studio).
2. **Build → Generate Signed App Bundle / APK → APK**.
3. Choose `mfp-release.jks`, alias `mfp`, enter the passwords → build variant **release** → **Create**.
4. The APK is at `android\app\release\app-release.apk`.

### 5.5 Install on the phone
1. Copy `app-release.apk` to the phone (USB, Google Drive or WhatsApp to yourself).
2. Tap it. Allow "Install unknown apps" for the app you opened it from, when asked.

### 5.6 Releasing an update
1. In `android\app\build.gradle`, raise `versionCode` by 1 (e.g. `1` → `2`) and set a new `versionName` (e.g. `"1.1"`).
2. Repeat 5.2 and 5.4 with the **same** keystore.
3. Install the new APK over the old one.

The web app on Vercel updates by itself on every push to `main`; the APK only changes when you build and install a new one.

## Checklist

- [ ] Both repos pushed to GitHub
- [ ] Supabase project created, two connection strings saved
- [ ] Render service live, `/health` returns `ok`
- [ ] UptimeRobot monitor on `/health`
- [ ] Vercel site live, `NEXT_PUBLIC_API_URL` set
- [ ] Vercel URL added to Render `CORS_ORIGINS`
- [ ] `.env.production` created
- [ ] Keystore created and backed up
- [ ] Signed APK built and installed
- [ ] Login added before real data goes online

## Troubleshooting

| Problem | Likely cause |
|---|---|
| Render build fails at `prisma migrate deploy` | `DIRECT_URL` wrong, still contains `[YOUR-PASSWORD]`, or uses the direct `db.….supabase.co` host instead of the session pooler |
| `/health` returns `db: down` | `DATABASE_URL` wrong, or the Supabase project is paused (restore it in Supabase) |
| Web app: "Can't reach the server" | Wrong `NEXT_PUBLIC_API_URL`, or the Vercel URL is missing from `CORS_ORIGINS` |
| APK opens but shows no data | `.env.production` missing or wrong when `android:sync` ran; rebuild |
| First load takes ~1 minute | Render was asleep; check the UptimeRobot monitor is running |
| Phone refuses to install an update | APK signed with a different keystore, or `versionCode` not raised |

## Shipping a release: `scripts/deploy-prod.ps1`

Run from `C:\MFP\MFP-frontend` in PowerShell, with the branch to ship checked out in **both** repos
(the script is kept on this computer only; `scripts/*.ps1` is git-ignored):

```powershell
.\scripts\deploy-prod.ps1            # asks "deploy" before pushing
.\scripts\deploy-prod.ps1 -Yes       # no question
.\scripts\deploy-prod.ps1 -FrontendOnly   # or -BackendOnly
```

What it does, in order (it stops at the first problem; nothing is pushed before step 4):

1. Both repos clean, and the branch contains everything on `main` (fast-forward only). Lists new commits and migrations.
2. Checks: backend type-check, tests, build; frontend type-check, lint, build.
3. Backup of the production database to `C:\MFP\backups\prod-before-deploy-<date>.sql` (Docker `pg_dump`, TLS verified).
4. Backend: `git push origin <branch>:main` → Render builds, runs `prisma migrate deploy`, restarts. Waits until `/health` shows the new commit.
5. Frontend: same push → Vercel builds. Waits until `/version.json` shows the new commit.
6. Smoke test of a few API calls and pages, then tags both repos `prod-<date>-<time>`.

The working folders don't switch branch, so git-ignored local files (`changes.md`, …) are untouched.

**Rolling back:** Render → service → Events → pick the previous deploy → *Rollback*; Vercel → Deployments → previous one → *Promote to Production*.
A rollback doesn't undo database migrations; restore the backup from step 3 only if a migration itself went wrong.
