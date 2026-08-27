// One-off seed script for the 3-Week Hybrid Physique Program: creates any
// missing exercise categories/exercises (matched by name, so re-running is
// safe) and the 13 workout plans (a rotation of 3 per weekday for
// Monday/Tuesday/Thursday/Friday, one fixed plan for Saturday), each with
// its exercises linked in order. Talks to the real API, not the database
// directly, so it goes through the same validation and slug generation
// the app itself uses.
//
// Usage:
//   BASE=https://your-app.onrender.com EMAIL=you@example.com PASSWORD=yourpassword \
//     node scripts/seed-hybrid-program.mjs
// (omit BASE/EMAIL/PASSWORD to run against a local dev server at
// http://localhost:4000 with the .env's ADMIN_EMAIL/ADMIN_PASSWORD)
import "dotenv/config";
import { CATEGORIES, EXERCISES, PLANS } from "./hybrid-program-data.mjs";

const BASE = process.env.BASE || "http://localhost:4000";
const EMAIL = process.env.EMAIL || process.env.ADMIN_EMAIL;
const PASSWORD = process.env.PASSWORD || process.env.ADMIN_PASSWORD;

if (!EMAIL || !PASSWORD) {
  console.error("Set EMAIL and PASSWORD (or ADMIN_EMAIL/ADMIN_PASSWORD in .env) before running this.");
  process.exit(1);
}

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

  // 1. Categories (idempotent: reuse if a category with this name already exists).
  const existingCats = await api("GET", "/api/exercise-categories");
  const catByName = new Map(existingCats.map((c) => [c.name, c]));
  for (const c of CATEGORIES) {
    if (catByName.has(c.name)) continue;
    const created = await api("POST", "/api/exercise-categories", { name: c.name, color: c.color });
    catByName.set(c.name, created);
    console.log("created category:", c.name);
  }

  // 2. Exercises (idempotent: reuse if an exercise with this name already exists).
  // No `active` filter -- that param means "only active"/"only inactive", not
  // "all"; omitting it entirely is what returns every exercise regardless.
  const existingExs = await api("GET", "/api/exercises");
  const exByName = new Map(existingExs.map((e) => [e.name, e]));
  for (const [name, catName] of Object.entries(EXERCISES)) {
    if (exByName.has(name)) continue;
    const cat = catByName.get(catName);
    const created = await api("POST", "/api/exercises", { name, category_id: cat.id });
    exByName.set(name, created);
    console.log("created exercise:", name);
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
