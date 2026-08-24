window.khataNav = { module: "transactions", active: "transactions.html" };

let filters = { q: "", category_type: "", date_from: "", date_to: "" };
let debounceTimer = null;

const rowsEl = document.getElementById("rows");
const countEl = document.getElementById("count");

document.getElementById("search").addEventListener("input", (e) => {
  filters.q = e.target.value.trim();
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(load, 300);
});
document.getElementById("f-type").addEventListener("change", (e) => {
  filters.category_type = e.target.value;
  load();
});
document.getElementById("f-from").addEventListener("change", (e) => {
  filters.date_from = e.target.value;
  load();
});
document.getElementById("f-to").addEventListener("change", (e) => {
  filters.date_to = e.target.value;
  load();
});
document.getElementById("clear-filters").addEventListener("click", () => {
  filters = { q: "", category_type: "", date_from: "", date_to: "" };
  document.getElementById("search").value = "";
  document.getElementById("f-type").value = "";
  document.getElementById("f-from").value = "";
  document.getElementById("f-to").value = "";
  load();
});

function renderRows(transactions) {
  countEl.textContent = `${transactions.length} transaction${transactions.length === 1 ? "" : "s"}`;
  if (!transactions.length) {
    rowsEl.innerHTML = `<tr><td colspan="6" class="empty">No transactions match these filters.</td></tr>`;
    return;
  }
  rowsEl.innerHTML = transactions
    .map((t) => {
      const date = new Date(t.occurred_on).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
      return `
      <tr>
        <td class="mono">${date}</td>
        <td>${escapeHtml(t.description || "—")}</td>
        <td><span class="dot" style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${seriesColor(t.category_color)};margin-right:6px;"></span>${escapeHtml(t.category_name)}</td>
        <td>${t.category_type}</td>
        <td class="amt">${money(t.amount)}</td>
        <td><span class="pill ${t.is_paid ? "good" : "warn"}">${t.is_paid ? "Paid" : "Unpaid"}</span></td>
      </tr>`;
    })
    .join("");
}

async function load() {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.category_type) params.set("category_type", filters.category_type);
  if (filters.date_from) params.set("date_from", filters.date_from);
  if (filters.date_to) params.set("date_to", filters.date_to);
  const transactions = await api(`/api/transactions?${params.toString()}`);
  renderRows(transactions);
}

window.khataInit = load;
khataBoot();
