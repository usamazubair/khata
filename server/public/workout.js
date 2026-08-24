window.khataNav = { module: "workout", active: "workout.html" };

// Weight figures are kg, not currency — money() would print "Rs".
function kg(n) {
  const num = Number(n) || 0;
  return num.toLocaleString(undefined, { maximumFractionDigits: num % 1 ? 1 : 0 }) + " kg";
}

function sessionDate(iso) {
  return new Date(iso).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

function renderStats(data) {
  const { this_week, last_week, totals } = data;
  const delta = this_week.volume - last_week.volume;
  const deltaLabel =
    last_week.volume > 0
      ? `${delta >= 0 ? "▲" : "▼"} ${kg(Math.abs(delta))} vs last week`
      : "No sessions last week";

  document.getElementById("stat-grid").innerHTML = [
    { label: "Sessions this week", value: this_week.sessions },
    { label: "Volume this week", value: kg(this_week.volume), sub: deltaLabel },
    { label: "Reps this week", value: this_week.reps },
    { label: "Total sessions", value: totals.total_sessions, sub: `${totals.active_exercises} active exercises` },
  ]
    .map(
      (t) => `
      <div class="stat-tile">
        <div class="label-sm">${t.label}</div>
        <div class="value">${t.value}</div>
        ${t.sub ? `<div class="meta">${escapeHtml(t.sub)}</div>` : ""}
      </div>`
    )
    .join("");
}

function renderExerciseBars(rows) {
  const el = document.getElementById("exercise-bars");
  if (!rows.length) {
    el.innerHTML = `<p class="empty">Nothing logged this week yet.</p>`;
    return;
  }
  const max = Math.max(...rows.map((r) => r.volume));
  el.innerHTML = rows
    .map(
      (r) => `
      <div class="bar-row">
        <span class="name">${escapeHtml(r.name)}</span>
        <span class="track"><span class="fill" style="width:${max ? (r.volume / max) * 100 : 0}%;background:var(--accent-2-fill)"></span></span>
        <span class="amt">${kg(r.volume)}</span>
      </div>`
    )
    .join("");
}

function renderRecent(rows) {
  const el = document.getElementById("recent-list");
  if (!rows.length) {
    el.innerHTML = `<p class="empty">No sessions yet — start one from the Sessions page.</p>`;
    return;
  }
  el.innerHTML = rows
    .map(
      (s) => `
      <a class="list-row" href="session.html?id=${s.id}" style="text-decoration:none;color:inherit;">
        <span class="txt">
          <div class="main">${escapeHtml(s.name || "Workout")}</div>
          <div class="sub">${sessionDate(s.occurred_on)} · ${s.set_count} set${s.set_count === 1 ? "" : "s"}</div>
        </span>
        <span class="amt">${kg(s.volume)}</span>
      </a>`
    )
    .join("");
}

async function load() {
  const data = await api("/api/workouts/summary");
  renderStats(data);
  renderExerciseBars(data.top_exercises);
  renderRecent(data.recent);
}

window.khataInit = load;
khataBoot();
