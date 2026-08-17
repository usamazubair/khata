# Khata

A personal expense tracker: a phone app to log expenses, a small API, Postgres
storage, and a read-only web dashboard. Everything below runs on free tiers —
$0, no credit card charged.

```
mobile/   Expo app (React Native) — Home, Add, Transactions, Insights, More
server/   Node/Express API + Postgres schema + the read-only web dashboard
```

## How the pieces fit together

Your phone talks to the API over HTTPS with a shared secret (`x-api-key`
header). The API is the only thing that talks to Postgres. The web dashboard
is served by that same API and is password-gated with the same secret.

```
Khata app (Expo Go, your phone only)
     │  HTTPS + x-api-key
     ▼
API service (Node/Express, free Render web service)
     │  SQL over TLS
     ▼
PostgreSQL (free Neon project)
```

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

`server/.env` already points `DATABASE_URL` at this local database and sets
a dev `API_KEY`. Sanity-check it:
```bash
curl -H "x-api-key: dev-local-only-key-change-later" http://localhost:4000/api/summary
```

The web dashboard is at **http://localhost:4000** — password is the
`API_KEY` value above.

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
   - `API_KEY` → make up a long random string (this is your phone-app secret
     *and* your dashboard password — keep it safe)
6. Deploy. Render gives you a URL like `https://khata-xxxx.onrender.com`.

Free tier note: the service sleeps after ~15 minutes of no traffic, so the
first request after a while takes ~30–50 seconds to wake up. Normal for
personal use — later requests are instant.

Your dashboard is now live at that Render URL, password-gated with `API_KEY`.

## 4. Run the phone app (Expo Go — no build, no App Store, $0)

1. Install **Expo Go** from the App Store / Play Store (free).
2. On your computer:
   ```bash
   cd ~/khata-app/mobile
   npx expo start
   ```
3. Scan the QR code with your phone (Camera app on iOS, Expo Go's scanner on
   Android). The app opens inside Expo Go — nothing installed to your home
   screen, nothing submitted anywhere.
4. In the app: **More → Settings** → enter your Render URL and the `API_KEY`
   you set in step 3 → Save.
5. You're in. Add an expense from the **Add** tab and watch it show up on
   Home, Transactions, and the web dashboard.

Since this is Expo Go (not a custom dev build), there's no EAS build step and
no build minutes to spend — genuinely free, and it never touches an app
store.

---

## Notes

- All 5 tables — `transactions`, `categories`, `fixed_expenses`, `budgets`,
  `goals` — are real Postgres tables. The Home dashboard and Archives are
  just filtered *views* over `transactions`, computed on request.
- Tapping a **Fixed bill** that isn't paid yet logs it as a real transaction
  for the current month (`POST /api/fixed-expenses/:id/confirm`).
- The web dashboard is read-only by design — add/edit only from the phone.
- To reset local test data: `psql "$DATABASE_URL" -c "TRUNCATE transactions, budgets, goals, fixed_expenses RESTART IDENTITY CASCADE;"` (categories are kept).
