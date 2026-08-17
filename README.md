# Khata

A personal platform — your own cupboard of small apps. **Khata** (expenses,
budgets, goals, fixed bills) is module #1; more modules get added from the
dashboard. Everything runs on free tiers — $0, no credit card charged.

```
mobile/   Expo app (React Native) — login, modules, then Khata's tabs
server/   Node/Express API + Postgres schema + the web dashboard
```

## How the pieces fit together

You sign in with an email and password; the API issues a JWT that both the web
dashboard and the phone app carry on every request. The API is the only thing
that talks to Postgres.

```
Web dashboard (browser)        Khata app (your phone)
             │                        │
             └────── HTTPS + Bearer token ──────┐
                                                ▼
                        API service (Node/Express, free Render web service)
                                                │  SQL over TLS
                                                ▼
                                    PostgreSQL (free Neon project)
```

**Accounts.** Two roles: `admin` (you — sees everything, manages users and
modules) and `member` (sees only the modules ticked for them on the Users
page). Deactivating someone cuts off their existing session immediately.

**Modules.** `system` modules are hand-built pages — Khata is the only one.
`generic` modules are defined from the dashboard and will render from their
stored schema (sections → fields → records) once that layer lands.

---

## 1. Local development (already set up on this machine)

For coding and testing, the server runs against a **self-contained local
Postgres cluster** — no Docker, no sudo, isolated from your system's
Postgres install. It lives at `server/.pgdata/` (git-ignored).

Start it:
```bash
/usr/lib/postgresql/14/bin/pg_ctl -D ~/khata-app/server/.pgdata -l ~/khata-app/server/.pgdata/log.txt -o "-p 5433 -k $HOME/khata-app/server/.pgdata" start
```
Stop it:
```bash
/usr/lib/postgresql/14/bin/pg_ctl -D ~/khata-app/server/.pgdata stop
```

Run the API against it:
```bash
cd ~/khata-app/server
npm install        # first time only
npm run migrate    # applies schema.sql — safe to re-run
npm run dev         # starts on http://localhost:4000
```

`server/.env` points `DATABASE_URL` at this local database and sets
`JWT_SECRET` plus the `ADMIN_*` bootstrap values. On first start with an empty
`users` table the server creates that admin account automatically.

Applying migrations to an existing database (non-destructive — `npm run
migrate` runs `schema.sql`, which **drops and recreates** everything):
```bash
psql "$DATABASE_URL" -f src/migrations/002_active_flags.sql
psql "$DATABASE_URL" -f src/migrations/003_auth_and_modules.sql
```

Sanity-check the API:
```bash
curl -s -X POST -H "Content-Type: application/json" -d '{"email":"you@example.com","password":"yourpassword"}' http://localhost:4000/api/auth/login
```

The web dashboard is at **http://localhost:4000** — sign in with that email
and password.

**A note on this being WSL2:** a physical phone on your WiFi generally can't
reach `localhost` inside WSL2 without extra Windows-side network setup
(mirrored networking or `netsh portproxy`). Rather than fight that, use the
local server for coding/`curl` testing, and point the phone at your free
Render deployment (step 3) for real on-device testing — that works over the
internet with zero networking setup.

---

## 2. Put your real data on Neon (free Postgres)

1. Go to [neon.tech](https://neon.tech) → sign up free (no card required).
2. Create a project (any region close to you).
3. Copy the connection string it gives you — it looks like
   `postgresql://user:pass@ep-xxxx.region.aws.neon.tech/neondb?sslmode=require`.
4. Apply the schema to it:
   ```bash
   cd ~/khata-app/server
   psql "postgresql://user:pass@ep-xxxx.region.aws.neon.tech/neondb?sslmode=require" -f src/schema.sql
   ```
5. Keep that connection string — you'll paste it into Render next.

Free tier: 0.5 GB storage, project auto-suspends when idle and wakes on the
next query (a fraction of a second delay). Plenty for personal expense data.

## 3. Deploy the API + dashboard to Render (free)

1. Push this repo to GitHub (a private repo is fine).
2. Go to [render.com](https://render.com) → sign up free.
3. **New → Web Service** → connect your GitHub repo.
4. Set:
   - **Root directory**: `server`
   - **Build command**: `npm install`
   - **Start command**: `npm start`
   - **Instance type**: Free
5. Add environment variables:
   - `DATABASE_URL` → your Neon connection string from step 2
   - `JWT_SECRET` → a long random string (`openssl rand -hex 32`). Signs the
     login tokens; changing it signs everyone out.
   - `ADMIN_EMAIL` / `ADMIN_PASSWORD` → creates your admin account on first
     start. Only used while the `users` table is empty.
6. Deploy. Render gives you a URL like `https://khata-xxxx.onrender.com`.

Also apply the migrations to Neon once (schema.sql is destructive — use the
migration files against a database that already has data):
```bash
psql "$NEON_URL" -f server/src/migrations/002_active_flags.sql
psql "$NEON_URL" -f server/src/migrations/003_auth_and_modules.sql
```

Free tier note: the service sleeps after ~15 minutes of no traffic, so the
first request after a while takes ~30–50 seconds to wake up. Normal for
personal use — later requests are instant.

Sign in at that Render URL with your `ADMIN_EMAIL` / `ADMIN_PASSWORD`.

### Adding other people

**Users** in the top-right nav → add them with the `member` role and tick
which modules they should see. They sign in with the same URL (web) or enter
it on the phone app's login screen. Members never see the Users page, can't
create modules, and only see modules ticked for them.

## 4. Run the phone app

Two ways, both free:

**Expo Go** (needs your computer running):
1. Install **Expo Go** from the App Store / Play Store.
2. `cd ~/khata-app/mobile && npx expo start --tunnel`
3. Scan the QR code. Works only while that terminal is open.

**Standalone APK** (works on its own, no computer needed):
```bash
cd ~/khata-app/mobile
npx eas-cli login          # first time only
npx eas-cli build --platform android --profile preview
```
Builds in Expo's cloud (~10–15 min, 15 free Android builds/month), then gives
you a download link. Install the APK on your phone — it has the JS bundled in,
so it needs nothing running locally. Rebuild whenever the mobile code changes.

Either way: on the app's login screen enter your Render URL, email and
password. Then tap the **Khata** module card to reach the expense tabs.

---

## Notes

- Khata's tables — `transactions`, `categories`, `fixed_expenses`, `budgets`,
  `goals` — are real Postgres tables. The Overview and Archives are just
  filtered *views* over `transactions`, computed on request.
- Categories are typed (`expense` / `fixed` / `saved` / `budget`). A goal or
  budget is a name + target price + one category; its **remaining** amount is
  always derived by summing transactions in that category, never stored.
- Tapping a **Fixed transaction** that isn't logged yet records it as a real
  transaction for the current month (`POST /api/fixed-expenses/:id/confirm`).
- **Active/inactive** is the soft alternative to deleting: inactive rows stay
  on the dashboard (dimmed) but disappear from the phone app.
- Managing categories, fixed transactions, goals and budgets happens on the
  web; the phone app reads them and logs transactions.
- To reset local test data: `psql "$DATABASE_URL" -c "TRUNCATE transactions, budgets, goals, fixed_expenses RESTART IDENTITY CASCADE;"` (categories, users and modules are kept).
