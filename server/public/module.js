window.khataNav = { module: "generic" };

const slug = new URLSearchParams(location.search).get("slug");

async function load() {
  const modules = await api("/api/modules");
  const mod = modules.find((m) => m.slug === slug);

  if (!mod) {
    document.getElementById("module-title").textContent = "Module not found";
    document.getElementById("module-kicker").textContent = "";
    return;
  }

  document.title = `Khata — ${mod.name}`;
  document.getElementById("module-title").textContent = mod.name;
  document.getElementById("module-kicker").textContent = mod.description || "Module";
  document.getElementById("module-icon").textContent = mod.icon;

  const navName = document.getElementById("nav-module-name");
  if (navName) navName.textContent = `${mod.icon} ${mod.name}`;
}

window.khataInit = load;
khataBoot();
