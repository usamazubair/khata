window.khataNavActive = "index.html";

let dashMonth = currentMonth();

document.getElementById("prev-month").addEventListener("click", () => {
  dashMonth = shiftMonth(dashMonth, -1);
  loadDashboard();
});
document.getElementById("next-month").addEventListener("click", () => {
  dashMonth = shiftMonth(dashMonth, 1);
  loadDashboard();
});

function renderStatGrid(data) {
  const tiles = [
    { label: "Total expense", value: money(data.total_expense) },
    { label: "Total saved", value: money(data.total_saved), good: true },
    { label: "Total categories", value: data.total_categories },
    { label: "Total transactions", value: data.total_transactions },
  ];
  document.getElementById("stat-grid").innerHTML = tiles
    .map((t) => `<div class="stat-tile"><div class="label-sm">${t.label}</div><div class="value${t.good ? " good" : ""}">${t.value}</div></div>`)
    .join("");
}

function renderCategoryBars(byCategory) {
  const el = document.getElementById("category-bars");
  if (!byCategory.length) {
    el.innerHTML = '<p class="empty">No spending yet this month.</p>';
    return;
  }
  const max = Math.max(...byCategory.map((c) => c.total));
  el.innerHTML = byCategory
    .map((c) => {
      const color = seriesColor(c.color);
      return `
        <div class="bar-row">
          <span class="dot" style="background:${color}"></span>
          <span class="name">${escapeHtml(c.name)}</span>
          <span class="track"><span class="fill" style="width:${(c.total / max) * 100}%;background:${color}"></span></span>
          <span class="amt">${money(c.total)}</span>
        </div>`;
    })
    .join("");
}

function renderRecent(recent) {
  const el = document.getElementById("recent-list");
  if (!recent.length) {
    el.innerHTML = '<p class="empty">No transactions yet.</p>';
    return;
  }
  el.innerHTML = recent
    .map((t) => {
      const color = seriesColor(t.category_color);
      const date = new Date(t.occurred_on).toLocaleDateString(undefined, { month: "short", day: "numeric" });
      return `
        <div class="list-row">
          <span class="dot" style="background:${color}"></span>
          <span class="txt"><div class="main">${escapeHtml(t.description || t.category_name)}</div><div class="sub">${date} · ${escapeHtml(t.category_name)}${t.is_paid ? "" : " · Unpaid"}</div></span>
          <span class="amt">${money(t.amount)}</span>
        </div>`;
    })
    .join("");
}

function renderArchives(archives) {
  const el = document.getElementById("archive-list");
  if (!archives.length) {
    el.innerHTML = '<p class="empty">No earlier months yet.</p>';
    return;
  }
  el.innerHTML = archives
    .map(
      (a) => `
        <div class="list-row">
          <span class="txt"><div class="main">${monthLabel(a.month)}</div><div class="sub">${a.count} entries</div></span>
          <span class="amt">${money(a.total)}</span>
        </div>`
    )
    .join("");
}

function renderBudgets(budgets) {
  const el = document.getElementById("budget-list");
  if (!budgets.length) {
    el.innerHTML = '<p class="empty">No budgets yet — add one from the Budgets page.</p>';
    return;
  }
  el.innerHTML = budgets
    .map((b) => {
      const pct = b.price > 0 ? Math.min(100, Math.round((b.spent / b.price) * 100)) : 0;
      const pillClass = b.remaining < 0 ? "bad" : pct >= 85 ? "warn" : "good";
      const barColor = b.remaining < 0 ? "var(--critical)" : pct >= 85 ? "var(--warning)" : "var(--accent-2-fill)";
      return `
        <div class="progress-card">
          <div class="top-row">
            <span class="name"><span class="dot" style="width:9px;height:9px;border-radius:50%;display:inline-block;background:${seriesColor(b.category_color)}"></span>${escapeHtml(b.name)}</span>
            <span class="amt">${money(b.spent)} / ${money(b.price)}</span>
          </div>
          <div class="progress-track" style="margin-top:8px;"><div class="progress-fill" style="width:${pct}%;background:${barColor}"></div></div>
          <div class="bottom-row">
            <span>${escapeHtml(b.category_name)}</span>
            <span class="pill ${pillClass}">${b.remaining < 0 ? money(-b.remaining) + " over" : money(b.remaining) + " left"}</span>
          </div>
        </div>`;
    })
    .join("");
}

function renderGoals(goals) {
  const el = document.getElementById("goal-list");
  if (!goals.length) {
    el.innerHTML = '<p class="empty">No goals yet — add one from the Goals page.</p>';
    return;
  }
  el.innerHTML = goals
    .map((g) => {
      const pct = g.price > 0 ? Math.min(100, Math.round((g.saved / g.price) * 100)) : 0;
      return `
        <div class="progress-card">
          <div class="top-row">
            <span class="name"><span class="dot" style="width:9px;height:9px;border-radius:50%;display:inline-block;background:${seriesColor(g.category_color)}"></span>${escapeHtml(g.name)}</span>
            <span class="amt">${money(g.saved)} / ${money(g.price)}</span>
          </div>
          <div class="progress-track" style="margin-top:8px;"><div class="progress-fill" style="width:${pct}%;background:var(--accent-2-fill)"></div></div>
          <div class="bottom-row">
            <span>${g.target_date ? "Target: " + monthLabel(g.target_date.slice(0, 7)) : escapeHtml(g.category_name)}</span>
            <span class="pill ${g.remaining <= 0 ? "good" : ""}">${g.remaining <= 0 ? "Funded" : money(g.remaining) + " left"}</span>
          </div>
        </div>`;
    })
    .join("");
}

async function loadDashboard() {
  const data = await api(`/api/summary?month=${dashMonth}`);
  document.getElementById("month-label").textContent = monthLabel(dashMonth);
  document.getElementById("total-spent").textContent = money(data.total_expense);
  renderStatGrid(data);
  renderCategoryBars(data.by_category);
  renderRecent(data.recent);
  renderArchives(data.archives);
  renderBudgets(data.budgets);
  renderGoals(data.goals);
}

window.khataInit = loadDashboard;
khataBoot();
