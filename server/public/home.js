window.khataNav = { home: true };

const gridEl = document.getElementById("module-grid");

async function load() {
  const modules = await api("/api/modules");
  const visible = modules.filter((m) => m.active || currentUser?.role === "admin");

  if (!visible.length) {
    gridEl.innerHTML = `<p class="empty">No modules have been enabled for you yet.</p>`;
    return;
  }

  gridEl.innerHTML = visible
    .map(
      (m) => `
      <a class="module-card${m.active ? "" : " inactive-card"}" href="${m.home_page}">
        <span class="module-icon">${escapeHtml(m.icon)}</span>
        <span class="module-name">${escapeHtml(m.name)}</span>
        <span class="module-desc">${escapeHtml(m.description || "")}</span>
        ${m.active ? "" : `<span class="pill" style="margin-top:8px;">Disabled</span>`}
      </a>`
    )
    .join("");
}

window.khataInit = load;
khataBoot();
