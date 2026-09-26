import { clearToken, request, setToken, ApiError } from "./api.js";

const state = {
  token: localStorage.getItem("stocksense_token"),
  user: null,
  data: null,
  page: "dashboard",
  search: "",
  modal: null,
  filters: { type: "", status: "", warehouse: "", category: "" },
  productCategory: "",
  productSearch: "",
  mobileNav: false,
};

const app = document.querySelector("#app");
const escapeHtml = (value = "") => String(value).replace(/[&<>"']/g, c => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
}[c]));
const number = (value, digits = 0) => new Intl.NumberFormat("en-US", {
  maximumFractionDigits: digits, minimumFractionDigits: digits && value % 1 ? 1 : 0,
}).format(Number(value) || 0);
const currency = value => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value || 0);
const initials = name => (name || "SS").split(/\s+/).slice(0, 2).map(part => part[0]).join("").toUpperCase();
const titleCase = value => value ? value[0].toUpperCase() + value.slice(1) : "";
const icons = {
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/>',
  box: '<path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 8 9 5 9-5"/><path d="M3 8v8l9 5 9-5V8M12 13v8"/>',
  arrowDown: '<path d="M12 4v16m-7-7 7 7 7-7"/>',
  arrowUp: '<path d="M12 20V4m7 7-7-7-7 7"/>',
  move: '<path d="M7 7h14m0 0-4-4m4 4-4 4M17 17H3m0 0 4 4m-4-4 4-4"/>',
  sliders: '<path d="M4 21v-7m0-4V3m8 18v-9m0-4V3m8 18v-5m0-4V3M2 14h4m4-6h4m4 8h4"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  warehouse: '<path d="m3 9 9-6 9 6v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9Z"/><path d="M9 21v-8h6v8M3 9h18"/>',
  user: '<path d="M20 21a8 8 0 0 0-16 0"/><circle cx="12" cy="8" r="4"/>',
  settings: '<path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z"/><path d="m19.4 15 .1.1 1.4 1.1-1.4 2.4-1.7-.7-.2.1a8 8 0 0 1-1.4.8l-.2.1-.3 1.8h-2.8l-.3-1.8-.2-.1a8 8 0 0 1-1.4-.8l-.2-.1-1.7.7-1.4-2.4 1.4-1.1.1-.2a8 8 0 0 1 0-1.6l-.1-.2-1.4-1.1 1.4-2.4 1.7.7.2-.1a8 8 0 0 1 1.4-.8l.2-.1.3-1.8h2.8l.3 1.8.2.1a8 8 0 0 1 1.4.8l.2.1 1.7-.7 1.4 2.4-1.4 1.1-.1.2a8 8 0 0 1 0 1.6Z"/>',
  plus: '<path d="M12 5v14m-7-7h14"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
  bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9m-8 12a2 2 0 0 0 4 0"/>',
  chevron: '<path d="m9 18 6-6-6-6"/>',
  down: '<path d="m7 10 5 5 5-5"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  close: '<path d="m18 6-12 12M6 6l12 12"/>',
  alert: '<path d="m10.3 3.9-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3.1l-8-14a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4m0 4h.01"/>',
  logout: '<path d="M10 17l5-5-5-5m5 5H3"/><path d="M12 3h7a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-7"/>',
  package: '<path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z"/><path d="m12 12 8-4.5M12 12v9m0-9L4 7.5M8 5l8 4.5"/>',
  filter: '<path d="M4 7h16M7 12h10m-7 5h4"/>',
};
const icon = (name, size = 18) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.box}</svg>`;
const badge = (status) => `<span class="status status-${escapeHtml(status)}"><i></i>${escapeHtml(titleCase(status))}</span>`;
const fmtDate = date => {
  if (!date) return "—";
  const normalized = date.includes("T")
    ? `${date}${date.endsWith("Z") ? "" : "Z"}`
    : date.includes(" ")
      ? `${date.replace(" ", "T")}Z`
      : `${date}T00:00:00`;
  return new Date(normalized).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};
const locationLabel = op => [op.source_warehouse, op.source_location].filter(Boolean).join(" · ") || [op.destination_warehouse, op.destination_location].filter(Boolean).join(" · ") || "—";

function toast(message, type = "success") {
  const region = document.querySelector("#toast-region");
  if (!region) return;
  const element = document.createElement("div");
  element.className = `toast toast-${type}`;
  element.innerHTML = `${icon(type === "error" ? "alert" : "check", 17)}<span>${escapeHtml(message)}</span>`;
  region.append(element);
  setTimeout(() => element.remove(), 4000);
}

async function call(path, options) {
  try {
    return await request(path, options);
  } catch (error) {
    if (error instanceof ApiError && error.status === 401 && state.token) {
      signOut(false);
    }
    throw error;
  }
}

async function refresh() {
  state.data = await call("/bootstrap");
  state.user = state.data.user;
  render();
}

async function start() {
  if (state.token) {
    try {
      await refresh();
      return;
    } catch (error) {
      clearToken();
      state.token = null;
      if (!(error instanceof ApiError) || error.status !== 401) toast(error.message, "error");
    }
  }
  renderAuth();
}

function render() {
  if (!state.data) return renderAuth();
  const pages = {
    dashboard: renderDashboard,
    products: renderProducts,
    receipts: () => renderOperations("receipt"),
    deliveries: () => renderOperations("delivery"),
    transfers: () => renderOperations("internal"),
    adjustments: () => renderOperations("adjustment"),
    history: renderHistory,
    warehouses: renderWarehouses,
    profile: renderProfile,
  };
  const page = pages[state.page] || renderDashboard;
  const titles = {
    dashboard: ["Overview", "Here’s what’s happening across your inventory today."],
    products: ["Products", "Manage your catalog, stock levels, and reorder points."],
    receipts: ["Receipts", "Keep incoming stock moving from dock to shelf."],
    deliveries: ["Delivery orders", "Pick, pack, and ship orders with confidence."],
    transfers: ["Internal transfers", "Move stock between warehouses and locations."],
    adjustments: ["Inventory adjustments", "Reconcile system quantities with physical counts."],
    history: ["Stock ledger", "A complete, traceable history of every stock movement."],
    warehouses: ["Warehouses", "Manage the places where your inventory lives."],
    profile: ["My profile", "Manage your account and personal details."],
  };
  const [title, subtitle] = titles[state.page] || titles.dashboard;
  app.innerHTML = `
    <div class="app-shell ${state.mobileNav ? "nav-open" : ""}">
      <aside class="sidebar">
        <a class="brand" href="#" data-page="dashboard">
          <span class="brand-mark">${icon("box", 20)}</span>
          <span class="brand-name">stock<span>sense</span><small>INVENTORY, IN SYNC.</small></span>
        </a>
        <div class="workspace-switch"><span class="workspace-icon">N</span><span><b>Northstar Studio</b><small>Free workspace</small></span>${icon("down", 14)}</div>
        <nav class="side-nav" aria-label="Main navigation">
          <span class="nav-label">WORKSPACE</span>
          ${navLink("dashboard", "Overview", "grid")}
          ${navLink("products", "Products", "box", `${state.data.kpis.product_count}`)}
          <span class="nav-label nav-gap">OPERATIONS</span>
          ${navLink("receipts", "Receipts", "arrowDown", pendingCount("receipt"))}
          ${navLink("deliveries", "Delivery orders", "arrowUp", pendingCount("delivery"))}
          ${navLink("transfers", "Internal transfers", "move", pendingCount("internal"))}
          ${navLink("adjustments", "Adjustments", "sliders")}
          ${navLink("history", "Stock ledger", "clock")}
          <span class="nav-label nav-gap">CONFIGURATION</span>
          ${navLink("warehouses", "Warehouses", "warehouse")}
        </nav>
        <div class="sidebar-bottom">
          <div class="help-card"><div class="help-icon">${icon("alert", 16)}</div><strong>Need a hand?</strong><p>Learn the basics of managing your stock.</p><a href="#help" data-action="help">Explore the guide <span>↗</span></a></div>
          <button class="profile-button" data-page="profile"><span class="avatar">${escapeHtml(initials(state.user.name))}</span><span class="profile-label"><b>${escapeHtml(state.user.name)}</b><small>Inventory manager</small></span>${icon("down", 14)}</button>
        </div>
      </aside>
      <button class="nav-scrim" aria-label="Close navigation" data-action="close-nav"></button>
      <main class="main-shell">
        <header class="topbar"><button class="icon-button mobile-menu" data-action="toggle-nav" aria-label="Open navigation">${icon("grid")}</button><div class="breadcrumb"><span>Workspace</span>${icon("chevron", 14)}<b>${escapeHtml(title)}</b></div>
          <div class="topbar-actions"><label class="global-search">${icon("search", 17)}<input id="global-search" placeholder="Search anything..." value="${escapeHtml(state.search)}" autocomplete="off"><kbd>⌘ K</kbd></label><button class="icon-button notification-button" data-action="notifications" aria-label="Notifications">${icon("bell")}<i></i></button><span class="topbar-divider"></span><button class="topbar-user" data-page="profile"><span class="avatar avatar-small">${escapeHtml(initials(state.user.name))}</span><span>${escapeHtml(state.user.name.split(" ")[0])}</span>${icon("down", 14)}</button></div>
        </header>
        <section class="page-content"><div class="page-heading"><div><div class="eyebrow">${state.page === "dashboard" ? new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric" }).format(new Date()).toUpperCase() : "STOCKSENSE / " + state.page.toUpperCase()}</div><h1>${escapeHtml(title)}${state.page === "dashboard" ? `<span class="wave">✳</span>` : ""}</h1><p>${escapeHtml(subtitle)}</p></div>${headingAction()}</div>${page()}</section>
      </main>
      ${state.modal ? renderModal() : ""}
    </div>`;
}

function pendingCount(type) {
  return state.data.operations.filter(o => o.type === type && !["done", "canceled"].includes(o.status)).length || "";
}
function navLink(page, text, iconName, count = "") {
  return `<button class="nav-item ${state.page === page ? "active" : ""}" data-page="${page}">${icon(iconName)}<span>${text}</span>${count ? `<small>${count}</small>` : ""}</button>`;
}
function headingAction() {
  const actions = {
    dashboard: `<button class="button button-quiet" data-action="export">${icon("arrowDown", 16)} Export report</button><button class="button button-primary" data-action="new-operation" data-type="receipt">${icon("plus", 17)} New operation</button>`,
    products: `<button class="button button-quiet" data-action="new-category">${icon("plus", 16)} Category</button><button class="button button-primary" data-action="new-product">${icon("plus", 17)} Add product</button>`,
    receipts: `<button class="button button-primary" data-action="new-operation" data-type="receipt">${icon("plus", 17)} Create receipt</button>`,
    deliveries: `<button class="button button-primary" data-action="new-operation" data-type="delivery">${icon("plus", 17)} New delivery</button>`,
    transfers: `<button class="button button-primary" data-action="new-operation" data-type="internal">${icon("plus", 17)} New transfer</button>`,
    adjustments: `<button class="button button-primary" data-action="new-operation" data-type="adjustment">${icon("plus", 17)} New adjustment</button>`,
    history: `<button class="button button-quiet" data-action="export">${icon("arrowDown", 16)} Export ledger</button>`,
    warehouses: `<button class="button button-primary" data-action="new-warehouse">${icon("plus", 17)} Add warehouse</button>`,
    profile: `<button class="button button-quiet" data-action="logout">${icon("logout", 16)} Sign out</button>`,
  };
  return `<div class="heading-actions">${actions[state.page] || ""}</div>`;
}

function renderDashboard() {
  const k = state.data.kpis;
  const ops = filteredOperations().slice(0, 6);
  const products = [...state.data.products]
    .filter(p => p.total_stock <= p.reorder_level)
    .sort((a, b) => a.total_stock - b.total_stock).slice(0, 4);
  return `
    <div class="kpi-grid">
      ${kpiCard("Total units in stock", number(k.products_in_stock, 1), "box", "mint", `${number(k.product_count)} active products`, "")}
      ${kpiCard("Low stock alerts", number(k.low_stock + k.out_of_stock), "alert", "amber", `${number(k.low_stock)} low · ${number(k.out_of_stock)} out of stock`, "attention")}
      ${kpiCard("Pending receipts", number(k.pending_receipts), "arrowDown", "blue", "Awaiting validation", "receipt")}
      ${kpiCard("Pending deliveries", number(k.pending_deliveries), "arrowUp", "violet", `${number(k.scheduled_transfers)} transfers scheduled`, "delivery")}
    </div>
    <div class="dashboard-grid">
      <section class="card operations-card"><div class="card-heading"><div><span class="section-kicker">YOUR WORK QUEUE</span><h2>Recent operations</h2></div><button class="text-button" data-page="receipts">View all ${icon("chevron", 15)}</button></div>
        <div class="filters-row">
          <label class="filter-control">${icon("filter", 15)}<select data-filter="type"><option value="">All types</option>${options([["receipt","Receipts"],["delivery","Delivery"],["internal","Internal"],["adjustment","Adjustments"]], state.filters.type)}</select></label>
          <label class="filter-control"><select data-filter="status"><option value="">All statuses</option>${options(["draft","waiting","ready","done","canceled"].map(x => [x, titleCase(x)]), state.filters.status)}</select></label>
          <label class="filter-control"><select data-filter="warehouse"><option value="">All warehouses</option>${options(state.data.warehouses.map(w => [w.name, w.name]), state.filters.warehouse)}</select></label>
          <label class="filter-control"><select data-filter="category"><option value="">All categories</option>${options(state.data.categories.map(c => [String(c.id), c.name]), state.filters.category)}</select></label>
        </div>
        ${operationTable(ops, true)}
        ${ops.length === 0 ? emptyState("No matching operations", "Try changing your filters, or create a new operation.") : ""}
      </section>
      <div class="dashboard-side">
        <section class="card stock-health"><div class="card-heading"><div><span class="section-kicker">STOCK HEALTH</span><h2>Needs attention</h2></div><span class="attention-count">${number(k.low_stock + k.out_of_stock)}</span></div>
          ${products.length ? `<div class="attention-list">${products.map(product => `<button class="attention-item" data-page="products"><span class="product-mini-icon ${product.total_stock === 0 ? "empty" : ""}">${icon("package", 17)}</span><span class="attention-product"><b>${escapeHtml(product.name)}</b><small>${escapeHtml(product.sku)} · ${number(product.total_stock)} ${escapeHtml(product.unit)}</small></span><span class="stock-flag ${product.total_stock === 0 ? "out" : ""}">${product.total_stock === 0 ? "Out" : "Low"}</span></button>`).join("")}</div>` : `<div class="empty-inline">${icon("check", 18)} Everything is looking healthy.</div>`}
          <button class="card-footer-link" data-page="products">View inventory ${icon("chevron", 15)}</button>
        </section>
        <section class="card movement-card"><div class="card-heading"><div><span class="section-kicker">STOCK MOVEMENT</span><h2>Latest activity</h2></div><button class="icon-button small" data-page="history" aria-label="View ledger">${icon("chevron", 17)}</button></div>
          <div class="movement-list">${state.data.ledger.slice(0, 4).map(entry => `<div class="movement-item"><span class="movement-icon movement-${entry.type}">${icon(entry.type === "receipt" ? "arrowDown" : entry.type === "delivery" ? "arrowUp" : entry.type === "internal" ? "move" : "sliders", 16)}</span><span><b>${escapeHtml(entry.product)}</b><small>${escapeHtml(entry.reference)} · ${fmtDate(entry.created_at)}</small></span><strong class="${entry.type === "receipt" || (entry.type === "adjustment" && entry.quantity > 0) ? "positive" : entry.type === "internal" || entry.quantity === 0 ? "neutral" : "negative"}">${entry.type === "internal" ? "↔" : `${entry.quantity > 0 ? "+" : ""}${number(entry.quantity, 1)}`}</strong></div>`).join("") || `<div class="empty-inline">Stock movements will show here.</div>`}</div>
        </section>
      </div>
    </div>
    <section class="card quick-actions"><div class="quick-copy"><span class="section-kicker">QUICK ACTIONS</span><h2>Keep things moving.</h2><p>Jump into your most common inventory tasks.</p></div>
      <button class="quick-action" data-action="new-operation" data-type="receipt"><span class="quick-icon quick-green">${icon("arrowDown", 19)}</span><span><b>Receive stock</b><small>Log incoming goods</small></span>${icon("chevron", 16)}</button>
      <button class="quick-action" data-action="new-operation" data-type="delivery"><span class="quick-icon quick-blue">${icon("arrowUp", 19)}</span><span><b>Fulfill an order</b><small>Prepare a delivery</small></span>${icon("chevron", 16)}</button>
      <button class="quick-action" data-action="new-operation" data-type="internal"><span class="quick-icon quick-violet">${icon("move", 19)}</span><span><b>Move inventory</b><small>Transfer between locations</small></span>${icon("chevron", 16)}</button>
    </section>`;
}

function kpiCard(label, value, iconName, tone, note, filterType) {
  return `<button class="kpi-card ${filterType === "attention" ? "kpi-attention" : ""}" ${filterType ? `data-kpi="${filterType}"` : ""}><span class="kpi-icon ${tone}">${icon(iconName, 19)}</span><span class="kpi-label">${label}</span><strong>${value}</strong><span class="kpi-note">${note}</span><span class="kpi-spark ${tone}"><i></i><i></i><i></i><i></i><i></i><i></i><i></i></span></button>`;
}
function options(pairs, selected) {
  return pairs.map(([value, label]) => `<option value="${escapeHtml(value)}" ${String(selected) === String(value) ? "selected" : ""}>${escapeHtml(label)}</option>`).join("");
}
function filteredOperations() {
  return state.data.operations.filter(op => {
    if (state.filters.type && op.type !== state.filters.type) return false;
    if (state.filters.status && op.status !== state.filters.status) return false;
    if (state.filters.warehouse && op.source_warehouse !== state.filters.warehouse && op.destination_warehouse !== state.filters.warehouse) return false;
    if (state.filters.category && !op.items.some(item => String(state.data.products.find(p => p.id === item.product_id)?.category_id) === state.filters.category)) return false;
    return true;
  });
}
function operationTable(rows, showType = false) {
  return `<div class="table-wrap"><table class="data-table"><thead><tr><th>REFERENCE</th>${showType ? "<th>TYPE</th>" : ""}<th>${showType ? "PARTNER / ITEM" : "CONTACT / ITEM"}</th><th>LOCATION</th><th>STATUS</th><th>DATE</th><th></th></tr></thead><tbody>${rows.map(op => `<tr><td><button class="reference-link" data-operation="${op.id}">${escapeHtml(op.reference)}</button></td>${showType ? `<td><span class="type-label"><span class="type-dot type-${op.type}"></span>${titleCase(op.type)}</span></td>` : ""}<td><span class="table-primary">${escapeHtml(op.partner || op.items[0]?.product_name || "—")}</span><small>${op.items.length} ${op.items.length === 1 ? "item" : "items"}</small></td><td><span class="location-cell">${icon("warehouse", 14)}${escapeHtml(locationLabel(op))}</span></td><td>${badge(op.status)}</td><td class="date-cell">${fmtDate(op.scheduled_at || op.created_at)}</td><td><button class="row-menu" data-operation="${op.id}" aria-label="Open ${escapeHtml(op.reference)}">${icon("chevron", 16)}</button></td></tr>`).join("")}</tbody></table></div>`;
}

function renderProducts() {
  const products = state.data.products.filter(p => {
    const query = state.productSearch.toLowerCase();
    return (!query || `${p.name} ${p.sku} ${p.category || ""}`.toLowerCase().includes(query)) &&
      (!state.productCategory || String(p.category_id || "") === state.productCategory);
  });
  const low = state.data.products.filter(p => p.total_stock <= p.reorder_level).length;
  return `<div class="summary-strip"><div><span class="summary-dot green"></span><span><b>${state.data.products.length}</b> products in catalog</span></div><div><span class="summary-dot amber"></span><span><b>${low}</b> products below reorder point</span></div><div><span class="summary-dot blue"></span><span><b>${state.data.warehouses.length}</b> warehouses</span></div></div>
    <section class="card product-card"><div class="product-toolbar"><label class="table-search">${icon("search", 17)}<input id="product-search" placeholder="Search by name or SKU..." value="${escapeHtml(state.productSearch)}"></label><label class="filter-control">${icon("filter", 15)}<select id="product-category"><option value="">All categories</option>${options(state.data.categories.map(c => [String(c.id), c.name]), state.productCategory)}</select></label><button class="icon-button small" data-action="refresh" aria-label="Refresh products">${icon("clock", 16)}</button></div>
    <div class="table-wrap"><table class="data-table product-table"><thead><tr><th>PRODUCT</th><th>CATEGORY</th><th>SKU</th><th>ON HAND</th><th>REORDER AT</th><th>LOCATION AVAILABILITY</th><th></th></tr></thead><tbody>${products.map(p => `<tr><td><span class="product-name-cell"><span class="product-avatar">${icon("package", 17)}</span><span><b>${escapeHtml(p.name)}</b><small>${escapeHtml(p.unit)}</small></span></span></td><td>${escapeHtml(p.category || "Uncategorized")}</td><td><code>${escapeHtml(p.sku)}</code></td><td><strong class="${p.total_stock <= p.reorder_level ? "stock-low" : "stock-good"}">${number(p.total_stock, 1)}</strong></td><td>${number(p.reorder_level, 1)} ${escapeHtml(p.unit)}</td><td><span class="availability">${p.locations.length ? p.locations.map(loc => `<span title="${escapeHtml(loc.warehouse)} · ${escapeHtml(loc.location)}">${number(loc.quantity, 1)} <small>${escapeHtml(loc.location)}</small></span>`).join("") : "No locations assigned"}</span></td><td><button class="row-menu" data-edit-product="${p.id}" aria-label="Edit ${escapeHtml(p.name)}">${icon("sliders", 16)}</button></td></tr>`).join("")}</tbody></table></div>${products.length ? `<div class="table-bottom"><span>Showing <b>${products.length}</b> of <b>${state.data.products.length}</b> products</span><span>Stock availability updates in real time</span></div>` : emptyState("No products found", "Try a different search or add a new product.")}</section>`;
}

function renderOperations(type) {
  const rows = state.data.operations.filter(op => op.type === type &&
    (!state.filters.status || op.status === state.filters.status) &&
    (!state.filters.warehouse || op.source_warehouse === state.filters.warehouse || op.destination_warehouse === state.filters.warehouse));
  return `<div class="summary-strip"><div><span class="summary-dot blue"></span><span><b>${rows.filter(o => !["done", "canceled"].includes(o.status)).length}</b> open operations</span></div><div><span class="summary-dot green"></span><span><b>${rows.filter(o => o.status === "done").length}</b> completed</span></div><div><span class="summary-dot amber"></span><span>All stock changes are recorded in the ledger</span></div></div>
    <section class="card operation-list-card"><div class="list-toolbar"><div><span class="section-kicker">ALL ${type === "internal" ? "TRANSFERS" : type === "adjustment" ? "ADJUSTMENTS" : type === "delivery" ? "DELIVERY ORDERS" : "RECEIPTS"}</span><h2>${rows.length} ${rows.length === 1 ? "operation" : "operations"}</h2></div><div class="toolbar-filters"><label class="filter-control"><select data-filter="status"><option value="">All statuses</option>${options(["draft","waiting","ready","done","canceled"].map(x => [x,titleCase(x)]), state.filters.status)}</select></label><label class="filter-control"><select data-filter="warehouse"><option value="">All warehouses</option>${options(state.data.warehouses.map(w => [w.name,w.name]), state.filters.warehouse)}</select></label></div></div>${operationTable(rows)}${rows.length === 0 ? emptyState("Nothing here yet", `Create a ${type} operation to get started.`) : ""}</section>`;
}

function renderHistory() {
  const rows = state.data.ledger;
  return `<div class="summary-strip"><div><span class="summary-dot green"></span><span><b>${rows.length}</b> stock movements</span></div><div><span class="summary-dot blue"></span><span><b>${new Set(rows.map(row => row.reference)).size}</b> validated operations</span></div><div><span class="summary-dot violet"></span><span>Every change is permanently traceable</span></div></div>
    <section class="card ledger-card"><div class="list-toolbar"><div><span class="section-kicker">MOVEMENT HISTORY</span><h2>Stock ledger</h2></div><label class="table-search">${icon("search", 17)}<input id="ledger-search" placeholder="Search product or reference..."></label></div>
    <div class="table-wrap"><table class="data-table"><thead><tr><th>REFERENCE</th><th>PRODUCT</th><th>TYPE</th><th>FROM</th><th>TO</th><th>QUANTITY</th><th>PERFORMED BY</th><th>DATE</th></tr></thead><tbody>${rows.map(row => `<tr data-ledger="${escapeHtml((row.product + " " + row.sku + " " + row.reference).toLowerCase())}"><td><button class="reference-link" data-operation="${row.operation_id}">${escapeHtml(row.reference)}</button></td><td><span class="table-primary">${escapeHtml(row.product)}</span><small>${escapeHtml(row.sku)}</small></td><td><span class="type-label"><span class="type-dot type-${row.type}"></span>${titleCase(row.type)}</span></td><td>${escapeHtml([row.from_warehouse,row.from_location].filter(Boolean).join(" · ") || "—")}</td><td>${escapeHtml([row.to_warehouse,row.to_location].filter(Boolean).join(" · ") || "—")}</td><td><strong class="${row.type === "receipt" || (row.type === "adjustment" && row.quantity > 0) ? "stock-good" : row.type === "internal" || row.quantity === 0 ? "neutral" : "stock-low"}">${row.type === "internal" ? "↔ " : row.quantity > 0 ? "+" : ""}${number(row.quantity, 1)}</strong></td><td>${escapeHtml(row.performed_by || "—")}</td><td class="date-cell">${fmtDate(row.created_at)}</td></tr>`).join("")}</tbody></table></div>${rows.length === 0 ? emptyState("No stock movements yet", "Validated operations will appear here.") : ""}</section>`;
}

function renderWarehouses() {
  return `<div class="summary-strip"><div><span class="summary-dot blue"></span><span><b>${state.data.warehouses.length}</b> active warehouses</span></div><div><span class="summary-dot green"></span><span><b>${state.data.warehouses.reduce((sum, w) => sum + w.locations.length, 0)}</b> stock locations</span></div><div><span class="summary-dot amber"></span><span>Stock is tracked at the location level</span></div></div>
    <div class="warehouse-grid">${state.data.warehouses.map((w,index) => `<section class="card warehouse-card"><div class="warehouse-card-top"><span class="warehouse-mark">${icon("warehouse", 22)}</span><span class="warehouse-index">WH-${String(index + 1).padStart(2,"0")}</span></div><h2>${escapeHtml(w.name)}</h2><span class="warehouse-code">${escapeHtml(w.code)}</span><p class="warehouse-address">${escapeHtml(w.address || "No address added")}</p><div class="location-heading"><b>Locations</b><span>${w.locations.length}</span></div><div class="location-list">${w.locations.map(l => `<div><span class="location-marker"></span><span>${escapeHtml(l.name)}</span><code>${escapeHtml(l.code)}</code></div>`).join("")}</div><div class="warehouse-footer">${icon("box", 15)} ${number(state.data.products.reduce((sum,p) => sum + p.locations.filter(l => l.location && w.locations.some(wl => wl.name === l.location)).length,0))} stocked product locations</div></section>`).join("")}
    <button class="add-warehouse-card" data-action="new-warehouse"><span>${icon("plus", 22)}</span><b>Add a warehouse</b><small>Set up another place to store stock</small></button></div>
    <section class="card category-settings"><div class="card-heading"><div><span class="section-kicker">PRODUCT ORGANIZATION</span><h2>Product categories</h2></div><button class="button button-quiet" data-action="new-category">${icon("plus", 16)} Add category</button></div><div class="category-pills">${state.data.categories.map(c => `<span class="category-pill">${escapeHtml(c.name)}<small>${state.data.products.filter(p => p.category_id === c.id).length}</small></span>`).join("")}</div></section>`;
}

function renderProfile() {
  return `<div class="profile-grid"><section class="card profile-card"><div class="profile-cover"></div><div class="profile-details"><span class="avatar avatar-large">${escapeHtml(initials(state.user.name))}</span><h2>${escapeHtml(state.user.name)}</h2><p>${escapeHtml(state.user.email)}</p><span class="role-pill">Inventory manager</span><div class="profile-meta"><div><small>WORKSPACE</small><b>Northstar Studio</b></div><div><small>MEMBER SINCE</small><b>${fmtDate(state.user.created_at)}</b></div></div><button class="button button-quiet" data-action="edit-profile">${icon("user", 16)} Edit profile</button></div></section>
      <section class="card security-card"><span class="section-kicker">ACCOUNT SECURITY</span><h2>Keep your account secure.</h2><p>Your StockSense account is protected with a password. If you forget it, request a one-time reset code from the sign-in screen.</p><div class="security-row"><span class="security-lock">${icon("check", 18)}</span><span><b>Password protected</b><small>Signed in as ${escapeHtml(state.user.email)}</small></span><span class="security-enabled">ACTIVE</span></div><button class="button button-danger-outline" data-action="logout">${icon("logout", 16)} Sign out of StockSense</button></section></div>`;
}

function emptyState(title, body) {
  return `<div class="empty-state"><span>${icon("box", 23)}</span><b>${escapeHtml(title)}</b><p>${escapeHtml(body)}</p></div>`;
}

function renderModal() {
  const modal = state.modal;
  let title = "", subtitle = "", form = "";
  if (modal.kind === "operation") {
    const type = modal.type;
    const labels = { receipt: ["New receipt","Record incoming goods from a vendor."], delivery: ["New delivery order","Pick and prepare goods for shipment."], internal: ["New internal transfer","Move stock between two locations."], adjustment: ["New inventory adjustment","Update recorded stock to match your physical count."] };
    [title, subtitle] = labels[type];
    form = operationForm(type);
  } else if (modal.kind === "product") {
    const product = modal.product;
    title = product ? "Edit product" : "Add a product";
    subtitle = product ? "Update your product details and reorder rule." : "Add a new item to your inventory catalog.";
    form = productForm(product);
  } else if (modal.kind === "category") {
    title = "Add product category"; subtitle = "Keep your catalog organized.";
    form = `<form data-form="category"><label>Category name<input name="name" required placeholder="e.g. Office supplies"></label><div class="modal-actions"><button type="button" class="button button-quiet" data-action="close-modal">Cancel</button><button class="button button-primary">Add category</button></div></form>`;
  } else if (modal.kind === "warehouse") {
    title = "Add a warehouse"; subtitle = "Add a warehouse and its first stock location.";
    form = `<form data-form="warehouse"><div class="form-row"><label>Warehouse name<input name="name" required placeholder="e.g. East Coast DC"></label><label>Warehouse code<input name="code" required placeholder="e.g. WH-EAST"></label></div><label>Address <span class="optional">OPTIONAL</span><input name="address" placeholder="Street, city, state"></label><div class="form-divider">FIRST LOCATION</div><div class="form-row"><label>Location name<input name="location_name" required value="Main Store"></label><label>Location code<input name="location_code" required value="MAIN"></label></div><div class="modal-actions"><button type="button" class="button button-quiet" data-action="close-modal">Cancel</button><button class="button button-primary">Create warehouse</button></div></form>`;
  } else if (modal.kind === "profile") {
    title = "Edit your profile"; subtitle = "Your name appears across your workspace.";
    form = `<form data-form="profile"><label>Full name<input name="name" required minlength="2" maxlength="80" value="${escapeHtml(state.user.name)}"></label><label>Email address<input value="${escapeHtml(state.user.email)}" disabled><small class="field-hint">Email changes aren’t available yet.</small></label><div class="modal-actions"><button type="button" class="button button-quiet" data-action="close-modal">Cancel</button><button class="button button-primary">Save changes</button></div></form>`;
  } else if (modal.kind === "detail") {
    title = modal.operation.reference; subtitle = `${titleCase(modal.operation.type)} · Created ${fmtDate(modal.operation.created_at)}`;
    form = operationDetail(modal.operation);
  }
  return `<div class="modal-backdrop" data-action="backdrop"><section class="modal ${modal.kind === "detail" ? "modal-wide" : ""}" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div class="modal-header"><div><span class="section-kicker">${modal.kind === "operation" ? "OPERATIONS / " + modal.type.toUpperCase() : modal.kind === "product" ? "PRODUCT CATALOG" : modal.kind === "detail" ? "OPERATION DETAILS" : "WORKSPACE SETTINGS"}</span><h2 id="modal-title">${escapeHtml(title)}</h2><p>${escapeHtml(subtitle)}</p></div><button class="icon-button small" data-action="close-modal" aria-label="Close dialog">${icon("close", 18)}</button></div><div class="modal-body">${form}</div></section></div>`;
}

function operationForm(type) {
  const allLocations = state.data.warehouses.flatMap(w => w.locations.map(l => ({ ...l, warehouse: w.name })));
  const source = state.data.warehouses.flatMap(w => w.locations.map(l => `<option value="${l.id}">${escapeHtml(w.name)} · ${escapeHtml(l.name)}</option>`)).join("");
  const destination = source;
  const productOptions = state.data.products.map(p => `<option value="${p.id}" data-unit="${escapeHtml(p.unit)}" data-stock="${p.total_stock}">${escapeHtml(p.name)} · ${escapeHtml(p.sku)}</option>`).join("");
  return `<form data-form="operation" data-type="${type}">
    ${type === "receipt" ? `<label>Supplier name<input name="partner" required placeholder="e.g. Acme Materials Co."></label>` : ""}
    ${type === "delivery" ? `<label>Customer / order reference<input name="partner" placeholder="e.g. SO-1042"></label>` : ""}
    ${type === "internal" ? `<div class="form-row"><label>From location<select name="source_location_id" required><option value="">Select location</option>${source}</select></label><label>To location<select name="destination_location_id" required><option value="">Select location</option>${destination}</select></label></div>` : ""}
    ${type === "delivery" || type === "adjustment" ? `<label>${type === "delivery" ? "Source location" : "Count location"}<select name="source_location_id" required><option value="">Select location</option>${source}</select></label>` : ""}
    ${type === "receipt" ? `<label>Receive into<select name="destination_location_id" required><option value="">Select location</option>${destination}</select></label>` : ""}
    <div class="form-divider">PRODUCTS <button type="button" class="inline-add" data-action="add-operation-line">${icon("plus", 14)} Add another</button></div>
    <div class="operation-lines">${operationLine(productOptions, type)}</div>
    <label>Scheduled date <span class="optional">OPTIONAL</span><input name="scheduled_at" type="date" value="${new Date().toISOString().slice(0,10)}"></label>
    <label>Notes <span class="optional">OPTIONAL</span><textarea name="notes" rows="2" placeholder="Add a note for your team..."></textarea></label>
    <div class="modal-actions"><button type="button" class="button button-quiet" data-action="close-modal">Cancel</button><button type="button" class="button button-quiet" data-action="save-draft">Save as draft</button><button class="button button-primary">${type === "adjustment" ? "Save adjustment" : "Create operation"}</button></div>
  </form>`;
}

function operationLine(productOptions, type, removable = false) {
  return `<div class="line-row"><label>Product<select name="product_id" required><option value="">Select product</option>${productOptions}</select></label><label>${type === "adjustment" ? "Counted quantity" : "Quantity"}<div class="quantity-field"><input name="${type === "adjustment" ? "counted_quantity" : "quantity"}" type="number" min="${type === "adjustment" ? "0" : "0.01"}" step="any" required placeholder="0"><span class="line-unit">Units</span></div></label>${removable ? `<button type="button" class="remove-line" data-action="remove-operation-line" aria-label="Remove product">${icon("close", 15)}</button>` : ""}</div>`;
}

function productForm(product) {
  const isEdit = Boolean(product);
  return `<form data-form="product" data-id="${isEdit ? product.id : ""}"><div class="form-row"><label>Product name<input name="name" required value="${escapeHtml(product?.name || "")}" placeholder="e.g. Steel Rods"></label><label>SKU / Code<input name="sku" required value="${escapeHtml(product?.sku || "")}" placeholder="e.g. STL-001"></label></div>
    <div class="form-row"><label>Category<select name="category_id"><option value="">Uncategorized</option>${options(state.data.categories.map(c => [String(c.id), c.name]), product?.category_id)}</select></label><label>Unit of measure<select name="unit">${options(["Units","kg","g","Litres","Metres","Sheets","Boxes","Packs"].map(x=>[x,x]),product?.unit || "Units")}</select></label></div>
    <div class="form-row"><label>Reorder point<input name="reorder_level" type="number" min="0" step="any" required value="${escapeHtml(product?.reorder_level ?? 10)}"></label>${!isEdit ? `<label>Initial stock<input name="initial_stock" type="number" min="0" step="any" value="0"></label>` : `<div class="field-note"><span>${icon("box", 16)}</span>Available stock changes through receipts, deliveries, transfers, or adjustments.</div>`}</div>
    ${!isEdit ? `<label>Stock location<select name="location_id" required>${state.data.warehouses.flatMap(w => w.locations.map(l => `<option value="${l.id}">${escapeHtml(w.name)} · ${escapeHtml(l.name)}</option>`)).join("")}</select></label>` : ""}
    <div class="modal-actions"><button type="button" class="button button-quiet" data-action="close-modal">Cancel</button><button class="button button-primary">${isEdit ? "Save changes" : "Add product"}</button></div></form>`;
}

function operationDetail(op) {
  const items = op.items.map(item => `<tr><td><b>${escapeHtml(item.product_name)}</b><small>${escapeHtml(item.sku)}</small></td><td>${number(item.quantity, 1)} ${escapeHtml(item.unit)}</td>${item.counted_quantity !== null ? `<td>${number(item.counted_quantity, 1)} ${escapeHtml(item.unit)} counted</td>` : ""}</tr>`).join("");
  const sourceLocation = [op.source_warehouse,op.source_location].filter(Boolean).join(" · ") || "—";
  const destLocation = [op.destination_warehouse,op.destination_location].filter(Boolean).join(" · ") || "—";
  return `<div class="detail-topline">${badge(op.status)}<span>Created ${fmtDate(op.created_at)}</span></div><div class="detail-info-grid"><div><small>${op.type === "receipt" ? "SUPPLIER" : "CONTACT / REFERENCE"}</small><b>${escapeHtml(op.partner || "—")}</b></div><div><small>FROM</small><b>${escapeHtml(op.type === "receipt" ? "External supplier" : sourceLocation)}</b></div><div><small>TO</small><b>${escapeHtml(op.type === "delivery" ? "Customer / external" : destLocation)}</b></div></div><div class="detail-items"><h3>Products in this operation</h3><table class="data-table"><thead><tr><th>PRODUCT</th><th>QUANTITY</th>${op.type === "adjustment" ? "<th>PHYSICAL COUNT</th>" : ""}</tr></thead><tbody>${items}</tbody></table></div>${op.notes ? `<div class="detail-notes"><small>NOTES</small><p>${escapeHtml(op.notes)}</p></div>` : ""}${op.status === "done" ? `<div class="validated-note">${icon("check", 17)} Stock updated and movement recorded in the ledger.</div>` : ""}<div class="modal-actions">${op.status !== "done" && op.status !== "canceled" ? `<button class="button button-danger-outline" data-action="cancel-operation" data-id="${op.id}">Cancel operation</button><span class="modal-spacer"></span><button class="button button-quiet" data-action="set-status" data-id="${op.id}" data-status="waiting">Mark waiting</button><button class="button button-primary" data-action="validate-operation" data-id="${op.id}">${icon("check", 16)} Validate stock</button>` : `<button class="button button-quiet" data-action="close-modal">Close</button>`}</div>`;
}

function renderAuth(mode = "login", message = "") {
  const login = mode === "login";
  const signup = mode === "signup";
  const forgot = mode === "forgot";
  const reset = mode === "reset";
  app.innerHTML = `<main class="auth-layout"><section class="auth-brand-panel"><a class="brand auth-brand" href="#"><span class="brand-mark">${icon("box", 20)}</span><span class="brand-name">stock<span>sense</span><small>INVENTORY, IN SYNC.</small></span></a><div class="auth-hero"><span class="auth-overline"><i></i> YOUR INVENTORY, IN SYNC</span><h1>Know what<br>you have.<br><span>Move with</span><br><span>confidence.</span></h1><p>One clear view of every product, every warehouse, every movement.</p><div class="auth-illustration"><div class="illustration-lines"></div><div class="illustration-box box-a"></div><div class="illustration-box box-b"></div><div class="illustration-box box-c"></div><div class="illustration-card"><span class="illustration-check">${icon("check",15)}</span><span><b>Stock moved</b><small>Main Store → Production</small></span><strong>+24</strong></div><div class="illustration-dot dot-a"></div><div class="illustration-dot dot-b"></div></div></div><div class="auth-foot"><span>© 2026 StockSense</span><span>Thoughtful inventory, for everyone.</span></div></section>
    <section class="auth-main"><div class="auth-form-wrap"><div class="mobile-auth-brand">${icon("box",19)} stocksense</div><div class="auth-form-heading"><span class="section-kicker">${login ? "WELCOME BACK" : signup ? "GET STARTED" : "ACCOUNT RECOVERY"}</span><h2>${login ? "Sign in to your workspace" : signup ? "Create your StockSense account" : forgot ? "Reset your password" : "Choose a new password"}</h2><p>${login ? "Your inventory is right where you left it." : signup ? "Start bringing your inventory into sync." : forgot ? "We’ll send a one-time code to your email." : "Enter the 6-digit code from your API server terminal."}</p></div>
    ${message ? `<div class="auth-message">${icon("alert",17)}<span>${escapeHtml(message)}</span></div>` : ""}
    <form data-form="auth" data-mode="${mode}">
      ${!reset ? `<label>Login ID<input name="loginId" required minlength="12" maxlength="12" placeholder="${signup ? 'ManagXXXXXXX' : 'Login ID'}"></label>` : ""}
      ${!login && !reset ? `<label>Email address<input name="email" type="email" required autocomplete="email" placeholder="you@company.com"></label>` : ""}
      ${reset ? `<label>Email address<input name="email" type="email" required autocomplete="email" placeholder="you@company.com" value="${escapeHtml(state.resetEmail || "")}"></label><label>6-digit reset code<input name="code" inputmode="numeric" pattern="[0-9]{6}" required placeholder="000000"></label>` : ""}
      ${login || signup || reset ? `<label>Password<span class="password-label">${login ? `<button type="button" class="auth-link" data-auth-mode="forgot">Forgot password?</button>` : ""}</span><input name="password" type="password" required minlength="8" autocomplete="${login ? "current-password" : "new-password"}" placeholder="${login ? "Enter your password" : "At least 8 characters"}"></label>` : ""}
      <button class="button button-primary auth-submit">${reset ? "Update password" : signup ? "Create account" : forgot ? "Send reset code" : "Sign in"}${icon("chevron",17)}</button>
      ${!forgot && !reset ? `<p class="auth-switch">${signup ? "Already have an account?" : "New to StockSense?"} <button type="button" data-auth-mode="${signup ? "login" : "signup"}">${signup ? "Sign in" : "Create an account"}</button></p>` : `<p class="auth-switch"><button type="button" data-auth-mode="login">← Back to sign in</button></p>`}
    </form><div class="auth-trust">${icon("check",14)} Your inventory data is encrypted and secure</div></div><div class="auth-mobile-foot">© 2026 StockSense</div></section></main>`;
}

function signOut(showToast = true) {
  clearToken();
  state.token = null;
  state.data = null;
  state.user = null;
  state.page = "dashboard";
  renderAuth();
  if (showToast) toast("You have been signed out.");
}

function formObject(form) {
  return Object.fromEntries(new FormData(form).entries());
}

async function submitAuth(form) {
  const mode = form.dataset.mode;
  const values = formObject(form);
  const button = form.querySelector(".auth-submit");
  button.disabled = true;
  button.classList.add("is-loading");
  try {
    if (mode === "login" || mode === "signup") {
      const response = await request(`/auth/${mode}`, { method: "POST", body: values });
      setToken(response.token);
      state.token = response.token;
      await refresh();
    } else if (mode === "forgot") {
      state.resetEmail = values.email;
      const result = await request("/auth/forgot-password", { method: "POST", body: values });
      renderAuth("reset", result.message);
    } else {
      await request("/auth/reset-password", { method: "POST", body: values });
      state.resetEmail = values.email;
      renderAuth("login", "Your password has been updated. Sign in with your new password.");
    }
  } catch (error) {
    renderAuth(mode, error.message);
  }
}

async function submitForm(form) {
  const values = formObject(form);
  try {
    if (form.dataset.form === "auth") return submitAuth(form);
    if (form.dataset.form === "operation") {
      const type = form.dataset.type;
      const items = [...form.querySelectorAll(".line-row")].map(row => {
        const product_id = Number(row.querySelector('[name="product_id"]').value);
        const amount = Number(row.querySelector('[name="quantity"],[name="counted_quantity"]').value);
        return { product_id, quantity: amount, ...(type === "adjustment" ? { counted_quantity: amount } : {}) };
      });
      const payload = { type, items, partner: values.partner || "", notes: values.notes || "", scheduled_at: values.scheduled_at || null, source_location_id: values.source_location_id ? Number(values.source_location_id) : null, destination_location_id: values.destination_location_id ? Number(values.destination_location_id) : null };
      const op = await call("/operations", { method: "POST", body: payload });
      if (form.dataset.saveDraft !== "true") {
        await call(`/operations/${op.id}/status`, { method: "POST", body: { status: "ready" } });
        if (type === "adjustment") {
          await call(`/operations/${op.id}/validate`, { method: "POST", body: {} });
        }
      }
      state.modal = null;
      await refresh();
      toast(form.dataset.saveDraft === "true" ? "Draft saved successfully." : type === "adjustment" ? "Stock adjustment validated." : "Operation created and marked ready.");
      return;
    }
    if (form.dataset.form === "product") {
      const product = {
        name: values.name, sku: values.sku, category_id: values.category_id ? Number(values.category_id) : null,
        unit: values.unit, reorder_level: Number(values.reorder_level),
      };
      if (form.dataset.id) {
        await call(`/products/${form.dataset.id}`, { method: "PATCH", body: product });
      } else {
        product.initial_stock = [{ location_id: Number(values.location_id), quantity: Number(values.initial_stock || 0) }];
        await call("/products", { method: "PUT", body: product });
      }
      state.modal = null; await refresh(); toast(form.dataset.id ? "Product updated." : "Product added to your catalog.");
    }
    if (form.dataset.form === "category") {
      await call("/categories", { method: "PUT", body: values });
      state.modal = null; await refresh(); toast("Category created.");
    }
    if (form.dataset.form === "warehouse") {
      await call("/warehouses", { method: "PUT", body: values });
      state.modal = null; await refresh(); toast("Warehouse created.");
    }
    if (form.dataset.form === "profile") {
      state.user = await call("/profile", { method: "PATCH", body: values });
      state.modal = null; await refresh(); toast("Profile updated.");
    }
  } catch (error) {
    toast(error.message, "error");
  }
}

app.addEventListener("click", async event => {
  const target = event.target.closest("button, a, [data-action]");
  if (!target) return;
  if (target.dataset.page) {
    event.preventDefault();
    state.page = target.dataset.page;
    state.mobileNav = false;
    state.modal = null;
    render();
    return;
  }
  if (target.dataset.authMode) {
    renderAuth(target.dataset.authMode);
    return;
  }
  const action = target.dataset.action;
  if (action === "toggle-nav") { state.mobileNav = true; render(); }
  if (action === "close-nav") { state.mobileNav = false; render(); }
  if (action === "close-modal") { state.modal = null; render(); }
  if (action === "backdrop" && event.target === target) { state.modal = null; render(); }
  if (action === "logout") signOut();
  if (action === "new-operation") { state.modal = { kind: "operation", type: target.dataset.type || "receipt" }; render(); }
  if (action === "new-product") { state.modal = { kind: "product" }; render(); }
  if (action === "new-category") { state.modal = { kind: "category" }; render(); }
  if (action === "new-warehouse") { state.modal = { kind: "warehouse" }; render(); }
  if (action === "edit-profile") { state.modal = { kind: "profile" }; render(); }
  if (action === "add-operation-line") {
    const rows = document.querySelector(".operation-lines");
    const select = document.querySelector(".operation-lines select");
    const optionHtml = [...select.options].slice(1).map(o => `<option value="${escapeHtml(o.value)}">${escapeHtml(o.textContent)}</option>`).join("");
    rows.insertAdjacentHTML("beforeend", operationLine(optionHtml, state.modal.type, true));
  }
  if (action === "remove-operation-line") target.closest(".line-row").remove();
  if (action === "save-draft") {
    const form = target.closest("form");
    form.dataset.saveDraft = "true";
    form.requestSubmit();
  }
  if (action === "export") exportCsv(state.page === "history" ? state.data.ledger : state.data.operations);
  if (action === "refresh") { await refresh(); toast("Inventory refreshed."); }
  if (action === "help") { event.preventDefault(); toast("Tip: validate a receipt to add stock, then track every change in the ledger."); }
  if (action === "notifications") {
    const alerts = state.data.kpis.low_stock + state.data.kpis.out_of_stock;
    toast(alerts ? `${alerts} products need attention. Check stock health on your overview.` : "You're all caught up.");
  }
  if (target.dataset.kpi === "attention") { state.page = "products"; state.productSearch = ""; render(); }
  if (target.dataset.kpi === "receipt") { state.page = "receipts"; render(); }
  if (target.dataset.kpi === "delivery") { state.page = "deliveries"; render(); }
  if (target.dataset.operation) {
    const op = state.data.operations.find(item => item.id === Number(target.dataset.operation));
    if (op) { state.modal = { kind: "detail", operation: op }; render(); }
  }
  if (target.dataset.editProduct) {
    const product = state.data.products.find(item => item.id === Number(target.dataset.editProduct));
    if (product) { state.modal = { kind: "product", product }; render(); }
  }
  if (action === "validate-operation" || action === "cancel-operation" || action === "set-status") {
    const id = Number(target.dataset.id);
    try {
      if (action === "validate-operation") {
        await call(`/operations/${id}/validate`, { method: "POST", body: {} });
        toast("Operation validated. Stock and ledger updated.");
      } else {
        await call(`/operations/${id}/status`, { method: "POST", body: { status: action === "cancel-operation" ? "canceled" : target.dataset.status } });
        toast(action === "cancel-operation" ? "Operation canceled." : "Operation status updated.");
      }
      const previous = state.modal;
      await refresh();
      if (previous?.kind === "detail") {
        const operation = state.data.operations.find(item => item.id === id);
        if (operation) state.modal = { kind: "detail", operation };
        render();
      }
    } catch (error) { toast(error.message, "error"); }
  }
});

app.addEventListener("submit", event => {
  const form = event.target.closest("form[data-form]");
  if (!form) return;
  event.preventDefault();
  submitForm(form);
});

app.addEventListener("change", event => {
  const target = event.target;
  if (target.matches("[data-filter]")) {
    state.filters[target.dataset.filter] = target.value;
    render();
  }
  if (target.id === "product-category") {
    state.productCategory = target.value;
    render();
  }
  if (target.matches('.line-row select[name="product_id"]')) {
    const unit = target.selectedOptions[0]?.dataset.unit || "Units";
    target.closest(".line-row").querySelector(".line-unit").textContent = unit;
  }
});

app.addEventListener("input", event => {
  const target = event.target;
  if (target.id === "product-search") {
    const start = target.selectionStart;
    state.productSearch = target.value;
    render();
    const replacement = document.querySelector("#product-search");
    replacement?.focus();
    replacement?.setSelectionRange(start, start);
  }
  if (target.id === "ledger-search") {
    const query = target.value.toLowerCase();
    document.querySelectorAll("[data-ledger]").forEach(row => row.hidden = !row.dataset.ledger.includes(query));
  }
  if (target.id === "global-search") {
    state.search = target.value;
    if (target.value.trim()) {
      const match = state.data.products.some(p => `${p.name} ${p.sku}`.toLowerCase().includes(target.value.trim().toLowerCase()));
      if (match) { state.page = "products"; state.productSearch = target.value; render(); document.querySelector("#product-search")?.focus(); }
    }
  }
  if (target.matches(".line-row select[name='product_id']")) {
    target.closest(".line-row").querySelector(".line-unit").textContent = target.selectedOptions[0]?.dataset.unit || "Units";
  }
});

document.addEventListener("keydown", event => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    document.querySelector("#global-search")?.focus();
  }
  if (event.key === "Escape" && state.modal) {
    state.modal = null;
    render();
  }
});

function exportCsv(rows) {
  if (!rows.length) return toast("There’s nothing to export yet.", "error");
  const headers = Object.keys(rows[0]);
  const cell = value => `"${String(value ?? "").replace(/"/g, '""')}"`;
  const contents = [headers.map(cell).join(","), ...rows.map(row => headers.map(key => cell(typeof row[key] === "object" ? JSON.stringify(row[key]) : row[key])).join(","))].join("\r\n");
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([contents], { type: "text/csv;charset=utf-8" }));
  link.download = `stocksense-${state.page}-${new Date().toISOString().slice(0,10)}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

start();
