// One-off seed script for the 4-Day Physique Plan (Week 1 power/strength/
// growth, Week 2 athletic conditioning): removes the previous 2-Week
// Alternating program's plans (by name, if present) and creates any
// missing exercise categories/exercises plus the 8 real workout plans (a
// rotation of 2 per weekday for Monday/Tuesday/Thursday/Friday), each with
// its exercises linked in order. Talks to the real API, not the database
// directly, so it goes through the same validation and slug generation the
// app itself uses, and is idempotent throughout -- safe to re-run.
//
// Unlike the previous program, this run also backfills media (and notes)
// onto exercises that already existed from an earlier seed -- many exercise
// names are shared between the two programs (same movement, same library
// row), and this is the first program with real demo images to offer. An
// exercise only gets a field filled in if it's currently empty/unset, so a
// photo or note you added yourself through the app is never overwritten.
//
// A previous run may have deactivated (rather than deleted) an old plan
// that already had generated sessions -- if so, this run also clears any
// of its sessions dated today or later, so a plan you're replacing stops
// showing in Overview/"this week" even though it couldn't be deleted
// outright. Anything strictly in the past is left alone as real history.
//
// Usage:
//   BASE=https://your-app.onrender.com EMAIL=you@example.com PASSWORD=yourpassword \
//     node scripts/seed-four-day-physique.mjs
// (omit BASE/EMAIL/PASSWORD to run against a local dev server at
// http://localhost:4000 with the .env's ADMIN_EMAIL/ADMIN_PASSWORD)
import "dotenv/config";
import { CATEGORIES, EXERCISES, PLANS } from "./four-day-physique-data.mjs";

const BASE = process.env.BASE || "http://localhost:4000";
const EMAIL = process.env.EMAIL || process.env.ADMIN_EMAIL;
const PASSWORD = process.env.PASSWORD || process.env.ADMIN_PASSWORD;

if (!EMAIL || !PASSWORD) {
  console.error("Set EMAIL and PASSWORD (or ADMIN_EMAIL/ADMIN_PASSWORD in .env) before running this.");
  process.exit(1);
}

// The previous (2-Week Alternating) program's plan names, so this script
// can remove them even if seed-two-week-alternating.mjs was never run in
// this environment -- deleting a name that doesn't exist here is a no-op.
// "Rest Day" appears twice in that program (two different weekdays) --
// listing it once is enough, since removal matches by name across all
// weekdays.
const OLD_PLAN_NAMES = [
  "Chest, Back, Shoulders, Forearms (Week 1)", "Upper Body Supersets (Week 2)",
  "Arms, Legs, Abs (Week 1)", "Run Intervals, Single-Leg Work, Core (Week 2)",
  "Chest, Back, Shoulders, Abs (Week 1)", "Rest Day",
  "Arms, Legs, Forearms (Week 1)", "Full Body Density Circuit (Week 2)",
  "Pull, Arms and Core (Week 2)",
];

async function main() {
  const loginRes = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  const { token } = await loginRes.json();
  if (!token) throw new Error("login failed: " + JSON.stringify(await loginRes.text()));
  const AUTH = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  async function api(method, path, body) {
    const res = await fetch(`${BASE}${path}`, { method, headers: AUTH, body: body ? JSON.stringify(body) : undefined });
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch { data = text; }
    if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}: ${JSON.stringify(data)}`);
    return data;
  }

  // 0. Remove the old program's plans, if present. See seed-two-week-
  // alternating.mjs for the reasoning -- same delete-or-deactivate-and-
  // clear-stale-sessions approach.
  const today = new Date().toISOString().slice(0, 10);
  const plansBeforeRemoval = await api("GET", "/api/workout-plans");
  for (const name of OLD_PLAN_NAMES) {
    for (const p of plansBeforeRemoval.filter((x) => x.name === name)) {
      let deleted = true;
      try {
        await api("DELETE", `/api/workout-plans/${p.id}`);
        console.log("removed old plan:", name);
      } catch (e) {
        deleted = false;
        await api("PUT", `/api/workout-plans/${p.id}`, { active: false });
        console.log("old plan has generated sessions, deactivated instead of deleted:", name);
      }
      if (!deleted) {
        const upcoming = await api("GET", `/api/workouts/sessions?date_from=${today}`);
        for (const s of upcoming.filter((x) => x.plan_id === p.id)) {
          await api("DELETE", `/api/workouts/sessions/${s.id}`);
          console.log("  cleared its stale session on", s.occurred_on, "(not yet past, so not real history)");
        }
      }
    }
  }

  // 1. Categories (idempotent: reuse if a category with this name already exists).
  const existingCats = await api("GET", "/api/exercise-categories");
  const catByName = new Map(existingCats.map((c) => [c.name, c]));
  for (const c of CATEGORIES) {
    if (catByName.has(c.name)) continue;
    const created = await api("POST", "/api/exercise-categories", { name: c.name, color: c.color });
    catByName.set(c.name, created);
    console.log("created category:", c.name);
  }

  // 2. Exercises (idempotent: reuse if an exercise with this name already
  // exists -- but also backfill notes/media onto a reused row if it's
  // currently empty, since several names here already exist from the
  // previous program and this is the first program with real media).
  // No `active` filter -- that param means "only active"/"only inactive",
  // not "all"; omitting it entirely is what returns every exercise.
  const existingExs = await api("GET", "/api/exercises");
  const exByName = new Map(existingExs.map((e) => [e.name, e]));
  for (const [name, [catName, notes, media]] of Object.entries(EXERCISES)) {
    const [media_url, media_type] = media || [null, null];
    const existing = exByName.get(name);
    if (!existing) {
      const cat = catByName.get(catName);
      const created = await api("POST", "/api/exercises", { name, category_id: cat.id, notes: notes || "", media_url, media_type });
      exByName.set(name, created);
      console.log("created exercise:", name, media_url ? "(with media)" : "");
      continue;
    }
    const patch = {};
    if (!existing.notes && notes) patch.notes = notes;
    if (!existing.media_url && media_url) {
      patch.media_url = media_url;
      patch.media_type = media_type;
    }
    if (Object.keys(patch).length) {
      const updated = await api("PUT", `/api/exercises/${existing.id}`, patch);
      exByName.set(name, updated);
      console.log("backfilled existing exercise:", name, Object.keys(patch).join(", "));
    } else {
      console.log("reusing existing exercise:", name);
    }
  }

  // 3. Plans, in array order so weekday rotation groups get the right
  // sort_order (POST appends to the end of that weekday's group).
  const existingPlans = await api("GET", "/api/workout-plans");
  const planByNameAndDow = new Map(existingPlans.map((p) => [`${p.name}|${p.day_of_week}`, p]));
  for (const plan of PLANS) {
    const key = `${plan.name}|${plan.dow}`;
    let created = planByNameAndDow.get(key);
    if (!created) {
      created = await api("POST", "/api/workout-plans", { name: plan.name, day_of_week: plan.dow });
      console.log("created plan:", plan.name, "(dow", plan.dow + ")");
    } else {
      console.log("reusing existing plan:", plan.name);
    }
    const exerciseIds = plan.exercises.map((n) => {
      const ex = exByName.get(n);
      if (!ex) throw new Error(`exercise not found after creation: ${n}`);
      return ex.id;
    });
    await api("PUT", `/api/workout-plans/${created.id}/exercises`, { exercise_ids: exerciseIds });
    console.log("  linked", exerciseIds.length, "exercises");
  }

  console.log("\nDone. Categories:", catByName.size, "Exercises:", exByName.size, "Plans:", PLANS.length);
}

main().catch((e) => {
  console.error("FAILED:", e.message);
  process.exit(1);
});
