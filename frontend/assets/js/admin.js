/* Batalawatta Plant Nursery - Admin Panel (Vanilla JS)
   - Login via /api/admin/login
   - JWT stored in sessionStorage (clears on tab/browser close)
   - CRUD: Plants, Orders, Inquiries, Reviews
*/

const API_BASE = "http://localhost:5000/api";
// NOTE: Use sessionStorage (NOT localStorage) so the admin session does NOT survive
// browser/tab close. This satisfies the requirement: close browser & reopen => logged out.
const LS_KEY = "batalawatta_admin_token";

function getToken(){
  return sessionStorage.getItem(LS_KEY);
}

function clearToken(){
  sessionStorage.removeItem(LS_KEY);
}

// Auto logout when user leaves admin page (Back button, closing tab/browser, etc.)
// - pagehide: fires for normal navigation and for BFCache scenarios
// - beforeunload: fallback for browsers that don't reliably fire pagehide
// This intentionally does NOT keep the admin session alive if you refresh or navigate away.
window.addEventListener("pagehide", () => clearToken());
window.addEventListener("beforeunload", () => clearToken());

// If browser restores this page from Back-Forward Cache, re-run auth check.
// (Otherwise the UI might still look "logged in" even though the token was cleared.)
window.addEventListener("pageshow", (e) => {
  if (e.persisted || !getToken()) {
    // boot() is defined later; safe to call here.
    try { boot(); } catch { /* ignore */ }
  }
});

const el = (id) => document.getElementById(id);
const fmtLKR = (n) => (Number(n || 0)).toLocaleString("en-LK", { maximumFractionDigits: 0 });

function toast(msg){
  const t = el("toast");
  t.textContent = msg;
  t.style.display = "block";
  clearTimeout(window.__toastT);
  window.__toastT = setTimeout(() => (t.style.display = "none"), 2200);
}

function authHeaders(){
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function api(path, { method="GET", body=null, headers={} } = {}){
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: { "Content-Type":"application/json", ...authHeaders(), ...headers },
    body: body ? JSON.stringify(body) : null
  });
  const txt = await res.text();
  let data = null;
  try { data = txt ? JSON.parse(txt) : null; } catch { data = { raw: txt }; }
  if (!res.ok) {
    const msg = data?.message || data?.error?.message || data?.message || `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return data;
}

// ------- Views / Navigation -------
const pages = [
  "dashboard",
  "plants",
  "orders",
  "landscapingPackages",
  "landscapingRequests",
  "inquiries",
  "reviews",
  "settings",
];
let cache = {
  plants: [],
  orders: [],
  landscapingPackages: [],
  landscapingRequests: [],
  inquiries: [],
  reviews: [],
};

function showAdmin(){
  el("loginView").style.display = "none";
  el("adminView").style.display = "grid";
}

function showLogin(){
  el("adminView").style.display = "none";
  el("loginView").style.display = "flex";
}

function setActivePage(name){
  for (const p of pages){
    const pageEl = el(`page-${p}`);
    if (pageEl) pageEl.style.display = (p === name) ? "block" : "none";
  }
  document.querySelectorAll(".nav-item").forEach(b => {
    b.classList.toggle("active", b.dataset.page === name);
  });
  const titles = {
    dashboard: "Dashboard",
    plants: "Plants",
    orders: "Orders",
    landscapingPackages: "Landscaping Packages",
    landscapingRequests: "Landscaping Requests",
    inquiries: "Inquiries",
    reviews: "Reviews",
    settings: "Settings",
  };
  el("pageTitle").textContent = titles[name] || (name.charAt(0).toUpperCase() + name.slice(1));

  const subtitle = {
    dashboard: "Overview and quick actions",
    plants: "Manage products",
    orders: "Manage customer orders",
    landscapingPackages: "Manage packages shown on the website",
    landscapingRequests: "View and update customer requests",
    inquiries: "Manage contact messages",
    reviews: "Manage customer reviews",
    settings: "Website customization, contact details & payment options"
  }[name] || "";
  el("pageSubtitle").textContent = subtitle;
}

document.querySelectorAll(".nav-item").forEach(btn => {
  btn.addEventListener("click", () => {
    setActivePage(btn.dataset.page);
    renderCurrentPage();
  });
});

el("logoutBtn").addEventListener("click", () => {
  clearToken();
  toast("Logged out");
  showLogin();
});

el("refreshBtn").addEventListener("click", async () => {
  await refreshAll();
  renderCurrentPage();
});

el("globalSearch").addEventListener("input", () => renderCurrentPage());

document.querySelectorAll("[data-quick]").forEach(b=>{
  b.addEventListener("click", () => {
    const q = b.dataset.quick;
    if (q === "addPlant") openPlantModal();
    if (q === "pendingOrders"){ setActivePage("orders"); el("orderStatusFilter").value="pending"; renderOrders(); }
    if (q === "newInquiries"){ setActivePage("inquiries"); renderInquiries(); }
    if (q === "landPackages"){ setActivePage("landscapingPackages"); renderLandscapingPackages(); }
    if (q === "newLandReq"){ setActivePage("landscapingRequests"); el("landReqStatusFilter").value="new"; renderLandscapingRequests(); }
  });
});

// ------- Login -------
el("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  el("loginError").style.display = "none";
  try{
    const email = el("email").value.trim();
    const password = el("password").value;
    const out = await api("/admin/login", { method:"POST", body:{ email, password }});
    sessionStorage.setItem(LS_KEY, out.token);
    toast("Signed in");
    await boot();
  }catch(err){
    el("loginError").textContent = err.message;
    el("loginError").style.display = "block";
  }
});

async function checkToken(){
  const token = getToken();
  if (!token) return false;
  try{
    await api("/admin/me");
    return true;
  }catch{
    clearToken();
    return false;
  }
}

// ------- Data loading -------
async function refreshAll(){
  // Plants (admin: just use public GET)
  cache.plants = await api("/plants");
  // Orders (admin GET)
  const status = el("orderStatusFilter")?.value || "";
  cache.orders = await api(`/orders${status ? `?status=${encodeURIComponent(status)}` : ""}`);

  // Landscaping packages + requests
  cache.landscapingPackages = await api("/landscaping/packages/all");
  const landStatus = el("landReqStatusFilter")?.value || "";
  cache.landscapingRequests = await api(`/landscaping/requests${landStatus ? `?status=${encodeURIComponent(landStatus)}` : ""}`);

  // Inquiries (admin GET)
  cache.inquiries = await api("/inquiries");
  // Reviews (admin GET all)
  cache.reviews = await api("/reviews?all=1&limit=100");
  renderStats();
}

function renderStats(){
  el("statPlants").textContent = cache.plants.length;
  if (el("statPackages")) el("statPackages").textContent = cache.landscapingPackages.length;
  el("statOrders").textContent = cache.orders.length;
  if (el("statLandReq")) el("statLandReq").textContent = cache.landscapingRequests.filter(r => (r.status||"new") === "new").length;
  el("statInquiries").textContent = cache.inquiries.filter(i => (i.status || "new") === "new").length;
  el("statReviews").textContent = cache.reviews.filter(r => r.approved !== false).length;
}

function renderCurrentPage(){
  const active = document.querySelector(".nav-item.active")?.dataset.page || "dashboard";
  if (active === "dashboard") renderStats();
  if (active === "plants") renderPlants();
  if (active === "orders") renderOrders();
  if (active === "landscapingPackages") renderLandscapingPackages();
  if (active === "landscapingRequests") renderLandscapingRequests();
  if (active === "inquiries") renderInquiries();
  if (active === "reviews") renderReviews();
}

// ------- Modal helpers -------
function openModal(title, bodyHtml, footHtml, options = {}){
  const modal = el("modal");
  modal.dataset.size = options.size || "";
  modal.dataset.variant = options.variant || "";
  el("modalTitle").textContent = title;
  el("modalBody").innerHTML = bodyHtml;
  el("modalFoot").innerHTML = footHtml || "";
  modal.style.display = "flex";
}
function closeModal(){
  const modal = el("modal");
  modal.style.display = "none";
  delete modal.dataset.size;
  delete modal.dataset.variant;
}
el("modalClose").addEventListener("click", closeModal);
el("modal").addEventListener("click", (e)=>{ if (e.target === el("modal")) closeModal(); });

// ------- Plants -------
el("addPlantBtn").addEventListener("click", () => openPlantModal());

function plantMatches(p, q){
  if (!q) return true;
  q = q.toLowerCase();
  return (p.name||"").toLowerCase().includes(q) ||
         (p.category||"").toLowerCase().includes(q) ||
         String(p.price||"").includes(q);
}

function renderPlants(){
  const q = el("globalSearch").value.trim();
  const tbody = el("plantsTable").querySelector("tbody");
  tbody.innerHTML = "";
  const list = cache.plants.filter(p => plantMatches(p,q));
  for (const p of list){
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><strong>${escapeHtml(p.name||"")}</strong><div class="muted">${escapeHtml((p.description||"").slice(0,80))}</div></td>
      <td>${escapeHtml(p.category||"")}</td>
      <td class="num">${fmtLKR(p.price)}</td>
      <td>${p.available ? '<span class="badge good">Yes</span>' : '<span class="badge bad">No</span>'}</td>
      <td class="actions">
        <button class="btn small" data-act="edit">Edit</button>
        <button class="btn small danger" data-act="del">Delete</button>
      </td>`;
    tr.querySelector('[data-act="edit"]').addEventListener("click", ()=> openPlantModal(p));
    tr.querySelector('[data-act="del"]').addEventListener("click", ()=> deletePlant(p));
    tbody.appendChild(tr);
  }
}

function openPlantModal(p=null){
  const isEdit = !!p;
  openModal(
    isEdit ? "Edit plant" : "Add plant",
    `
    <form id="plantForm">
      <div class="grid two">
        <label><span>Name</span><input id="p_name" value="${escapeAttr(p?.name||"")}" required></label>
        <label><span>Category</span><input id="p_cat" value="${escapeAttr(p?.category||"")}" placeholder="Indoor / Flowering / ..." required></label>
      </div>
      <label><span>Description</span><textarea id="p_desc" required>${escapeHtml(p?.description||"")}</textarea></label>
      <div class="grid two">
        <label><span>Price (LKR)</span><input id="p_price" type="number" min="0" value="${escapeAttr(p?.price ?? "")}" required></label>
        <label><span>Image URL</span><input id="p_img" value="${escapeAttr(p?.imageUrl||"")}" placeholder="https://..."></label>
      </div>
      <label class="row" style="margin-top:.4rem;">
        <input id="p_avail" type="checkbox" style="width:auto" ${p?.available ? "checked" : ""} />
        <span class="muted">Available</span>
      </label>
    </form>
    `,
    `
      <button class="btn" id="cancelPlant">Cancel</button>
      <button class="btn primary" id="savePlant">${isEdit ? "Update" : "Create"}</button>
    `
  );

  el("cancelPlant").addEventListener("click", closeModal);
  el("savePlant").addEventListener("click", async () => {
    try{
      const body = {
        name: el("p_name").value.trim(),
        category: el("p_cat").value.trim(),
        description: el("p_desc").value.trim(),
        price: Number(el("p_price").value || 0),
        imageUrl: el("p_img").value.trim(),
        available: el("p_avail").checked
      };
      if (!body.name || !body.category || !body.description) throw new Error("Please fill required fields");
      if (isEdit){
        await api(`/plants/${p._id}`, { method:"PUT", body });
        toast("Plant updated");
      }else{
        await api("/plants", { method:"POST", body });
        toast("Plant created");
      }
      closeModal();
      cache.plants = await api("/plants");
      renderStats(); renderPlants();
    }catch(err){
      toast(err.message);
    }
  });
}

async function deletePlant(p){
  if (!confirm(`Delete "${p.name}"?`)) return;
  try{
    await api(`/plants/${p._id}`, { method:"DELETE" });
    toast("Deleted");
    cache.plants = await api("/plants");
    renderStats(); renderPlants();
  }catch(err){ toast(err.message); }
}

// ------- Orders -------
el("orderStatusFilter").addEventListener("change", async ()=>{
  try{
    const status = el("orderStatusFilter").value;
    cache.orders = await api(`/orders${status ? `?status=${encodeURIComponent(status)}` : ""}`);
    renderOrders();
  }catch(err){ toast(err.message); }
});

// ------- Landscaping Packages -------
if (el("addLandPkgBtn")) {
  el("addLandPkgBtn").addEventListener("click", () => openLandPkgModal());
}

function landPkgMatches(p, q){
  if (!q) return true;
  q = q.toLowerCase();
  return (p.name||"").toLowerCase().includes(q) ||
         (p.code||"").toLowerCase().includes(q) ||
         (p.priceRange||"").toLowerCase().includes(q) ||
         (p.duration||"").toLowerCase().includes(q) ||
         (p.bestFor||"").toLowerCase().includes(q) ||
         (p.idealArea||"").toLowerCase().includes(q) ||
         (p.consultationMode||"").toLowerCase().includes(q) ||
         (p.aftercare||"").toLowerCase().includes(q) ||
         (p.description||"").toLowerCase().includes(q) ||
         (p.deliverables||[]).join(" ").toLowerCase().includes(q) ||
         (p.exclusions||[]).join(" ").toLowerCase().includes(q);
}

function renderLandscapingPackages(){
  const q = el("globalSearch").value.trim();
  const tbody = el("landPkgsTable")?.querySelector("tbody");
  if (!tbody) return;
  tbody.innerHTML = "";
  const list = cache.landscapingPackages
    .filter(p => landPkgMatches(p,q))
    .sort((a,b)=> (a.sortOrder||0) - (b.sortOrder||0) || new Date(b.createdAt)-new Date(a.createdAt));

  for (const p of list){
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>
        <strong>${escapeHtml(p.name||"")}</strong>
        ${p.code ? `<div class="muted">code: ${escapeHtml(p.code)}</div>` : ""}
        ${p.consultationMode ? `<div class="muted">Consultation: ${escapeHtml(p.consultationMode)}</div>` : ""}
        ${(p.deliverables||[]).length ? `<div class="muted">Deliverables: ${(p.deliverables||[]).length}</div>` : ""}
      </td>
      <td>
        <div>${escapeHtml(p.priceRange||"")}</div>
        ${p.bestFor ? `<div class="muted">${escapeHtml(p.bestFor)}</div>` : ""}
      </td>
      <td>
        <div>${escapeHtml(p.duration||"")}</div>
        ${p.aftercare ? `<div class="muted">${escapeHtml(p.aftercare)}</div>` : ""}
      </td>
      <td>${p.isActive ? '<span class="badge good">Yes</span>' : '<span class="badge bad">No</span>'}</td>
      <td class="num">${escapeHtml(String(p.sortOrder ?? 0))}</td>
      <td class="actions">
        <button class="btn small" data-act="edit">Edit</button>
        <button class="btn small danger" data-act="del">Delete</button>
      </td>`;
    tr.querySelector('[data-act="edit"]').onclick = () => openLandPkgModal(p);
    tr.querySelector('[data-act="del"]').onclick = () => deleteLandPkg(p);
    tbody.appendChild(tr);
  }
}

function openLandPkgModal(p=null){
  const isEdit = !!p;
  const includesText = Array.isArray(p?.includes) ? p.includes.join("\n") : "";
  const deliverablesText = Array.isArray(p?.deliverables) ? p.deliverables.join("\n") : "";
  const exclusionsText = Array.isArray(p?.exclusions) ? p.exclusions.join("\n") : "";
  openModal(
    isEdit ? "Edit package" : "Add package",
    `
      <form id="landPkgForm">
        <div class="grid two">
          <label><span>Code (optional)</span><input id="lp_code" value="${escapeAttr(p?.code||"")}" placeholder="starter"></label>
          <label><span>Sort order</span><input id="lp_sort" type="number" value="${escapeAttr(p?.sortOrder ?? 0)}"></label>
        </div>
        <label><span>Name *</span><input id="lp_name" value="${escapeAttr(p?.name||"")}" required></label>
        <label><span>Description</span><textarea id="lp_desc" placeholder="Short customer-facing package description">${escapeHtml(p?.description||"")}</textarea></label>
        <div class="grid two">
          <label><span>Price range</span><input id="lp_price" value="${escapeAttr(p?.priceRange||"")}" placeholder="Rs. 25,000 - 45,000"></label>
          <label><span>Duration</span><input id="lp_dur" value="${escapeAttr(p?.duration||"")}" placeholder="1 - 2 days"></label>
        </div>
        <div class="grid two">
          <label><span>Best for</span><input id="lp_best" value="${escapeAttr(p?.bestFor||"")}" placeholder="Medium home gardens"></label>
          <label><span>Ideal area</span><input id="lp_area" value="${escapeAttr(p?.idealArea||"")}" placeholder="10-20 perch home gardens"></label>
        </div>
        <div class="grid two">
          <label><span>Consultation mode</span><input id="lp_consult" value="${escapeAttr(p?.consultationMode||"")}" placeholder="On-site consultation with landscape architect"></label>
          <label><span>Aftercare</span><input id="lp_aftercare" value="${escapeAttr(p?.aftercare||"")}" placeholder="7-day follow-up guidance"></label>
        </div>
        <label><span>Image URL</span><input id="lp_img" value="${escapeAttr(p?.imageUrl||"")}" placeholder="assets/img/landscaping/starter.png"></label>
        <label><span>Includes (one per line)</span><textarea id="lp_includes" placeholder="Item 1
Item 2
Item 3">${escapeHtml(includesText)}</textarea></label>
        <label><span>Deliverables (one per line)</span><textarea id="lp_deliverables" placeholder="Concept layout
Plant palette
Execution notes">${escapeHtml(deliverablesText)}</textarea></label>
        <label><span>Exclusions / separately quoted (one per line)</span><textarea id="lp_exclusions" placeholder="Lighting fixtures
Major civil works">${escapeHtml(exclusionsText)}</textarea></label>
        <div class="grid two" style="margin-top:.4rem;">
          <label class="row">
            <input id="lp_architect" type="checkbox" style="width:auto" ${p?.architectLed !== false ? "checked" : ""} />
            <span class="muted">Landscape architect-led package</span>
          </label>
          <label class="row">
            <input id="lp_active" type="checkbox" style="width:auto" ${p?.isActive !== false ? "checked" : ""} />
            <span class="muted">Active (show on website)</span>
          </label>
        </div>
      </form>
    `,
    `
      <button class="btn" id="cancelLandPkg">Cancel</button>
      <button class="btn primary" id="saveLandPkg">${isEdit ? "Update" : "Create"}</button>
    `
  );

  el("cancelLandPkg").onclick = closeModal;
  el("saveLandPkg").onclick = async () => {
    try{
      const body = {
        code: el("lp_code").value.trim(),
        sortOrder: Number(el("lp_sort").value || 0),
        name: el("lp_name").value.trim(),
        description: el("lp_desc").value.trim(),
        priceRange: el("lp_price").value.trim(),
        duration: el("lp_dur").value.trim(),
        bestFor: el("lp_best").value.trim(),
        idealArea: el("lp_area").value.trim(),
        consultationMode: el("lp_consult").value.trim(),
        aftercare: el("lp_aftercare").value.trim(),
        imageUrl: el("lp_img").value.trim(),
        includes: el("lp_includes").value.split("\n").map(s=>s.trim()).filter(Boolean),
        deliverables: el("lp_deliverables").value.split("\n").map(s=>s.trim()).filter(Boolean),
        exclusions: el("lp_exclusions").value.split("\n").map(s=>s.trim()).filter(Boolean),
        architectLed: el("lp_architect").checked,
        isActive: el("lp_active").checked,
      };
      if (!body.name) throw new Error("Package name is required");

      if (!body.code) delete body.code; // avoid empty-string unique index issues

      if (isEdit){
        await api(`/landscaping/packages/${p._id}`, { method:"PUT", body });
        toast("Package updated");
      } else {
        await api("/landscaping/packages", { method:"POST", body });
        toast("Package created");
      }

      closeModal();
      cache.landscapingPackages = await api("/landscaping/packages/all");
      renderStats();
      renderLandscapingPackages();
    }catch(err){ toast(err.message); }
  };
}

async function deleteLandPkg(p){
  if (!confirm(`Delete package "${p.name}"?`)) return;
  try{
    await api(`/landscaping/packages/${p._id}`, { method:"DELETE" });
    toast("Deleted");
    cache.landscapingPackages = await api("/landscaping/packages/all");
    renderStats();
    renderLandscapingPackages();
  }catch(err){ toast(err.message); }
}

// ------- Landscaping Requests -------
if (el("landReqStatusFilter")) {
  el("landReqStatusFilter").addEventListener("change", async () => {
    try{
      const status = el("landReqStatusFilter").value;
      cache.landscapingRequests = await api(`/landscaping/requests${status ? `?status=${encodeURIComponent(status)}` : ""}`);
      renderLandscapingRequests();
      renderStats();
    }catch(err){ toast(err.message); }
  });
}

function landReqMatches(r, q){
  if (!q) return true;
  q = q.toLowerCase();
  return (r.customer?.name||"").toLowerCase().includes(q) ||
         (r.customer?.phone||"").toLowerCase().includes(q) ||
         (r.customer?.address||"").toLowerCase().includes(q) ||
         (r.packageSnapshot?.name||"").toLowerCase().includes(q) ||
         (r.propertyType||"").toLowerCase().includes(q) ||
         (r.gardenSize||"").toLowerCase().includes(q) ||
         (r.budgetRange||"").toLowerCase().includes(q) ||
         (r.consultationPreference||"").toLowerCase().includes(q) ||
         (r.projectGoals||"").toLowerCase().includes(q) ||
         (r.status||"").toLowerCase().includes(q) ||
         (r.notes||"").toLowerCase().includes(q) ||
         (r.adminNote||"").toLowerCase().includes(q);
}

function landStatusBadge(s){
  const map = {
    new: "bad",
    in_progress: "warn",
    scheduled: "warn",
    completed: "good",
    cancelled: "bad",
  };
  const cls = map[s] || "";
  return `<span class="badge ${cls}">${escapeHtml(s||"")}</span>`;
}

function renderLandscapingRequests(){
  const q = el("globalSearch").value.trim();
  const tbody = el("landReqTable")?.querySelector("tbody");
  if (!tbody) return;
  tbody.innerHTML = "";
  const list = cache.landscapingRequests
    .filter(r => landReqMatches(r,q))
    .sort((a,b)=> new Date(b.createdAt)-new Date(a.createdAt));

  for (const r of list){
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${formatDate(r.createdAt)}</td>
      <td>
        <strong>${escapeHtml(r.customer?.name||"")}</strong>
        <div class="muted">${escapeHtml(r.customer?.address||"")}</div>
        ${r.propertyType ? `<div class="muted">${escapeHtml(r.propertyType)}</div>` : ""}
      </td>
      <td>${escapeHtml(r.customer?.phone||"")}</td>
      <td>
        <div>${escapeHtml(r.packageSnapshot?.name || "")}</div>
        ${r.gardenSize ? `<div class="muted">${escapeHtml(r.gardenSize)}</div>` : ""}
      </td>
      <td>${landStatusBadge(r.status)}</td>
      <td class="actions">
        <button class="btn small" data-act="view">View</button>
        <button class="btn small" data-act="status">Update</button>
      </td>
    `;
    tr.querySelector('[data-act="view"]').onclick = () => openLandReqDetails(r);
    tr.querySelector('[data-act="status"]').onclick = () => openLandReqStatusModal(r);
    tbody.appendChild(tr);
  }
}

function openLandReqDetails(r){
  el("landReqDetailsMeta").textContent = `${r._id} • ${formatDate(r.createdAt)} • ${r.status || "new"}`;
  el("landReqDetailsBody").innerHTML = `
    <div class="grid two">
      <div class="card inner">
        <h4>Customer</h4>
        <div><strong>${escapeHtml(r.customer?.name||"")}</strong></div>
        <div class="muted">${escapeHtml(r.customer?.phone||"")}</div>
        <div style="margin-top:.5rem">${escapeHtml(r.customer?.address||"")}</div>
        ${r.propertyType ? `<div class="muted" style="margin-top:.5rem">Property type: ${escapeHtml(r.propertyType)}</div>` : ""}
      </div>
      <div class="card inner">
        <h4>Package</h4>
        <div><strong>${escapeHtml(r.packageSnapshot?.name||"")}</strong></div>
        <div class="muted">Price: ${escapeHtml(r.packageSnapshot?.priceRange||"")}</div>
        <div class="muted">Duration: ${escapeHtml(r.packageSnapshot?.duration||"")}</div>
        <div class="muted">Best for: ${escapeHtml(r.packageSnapshot?.bestFor||"")}</div>
        ${r.packageSnapshot?.idealArea ? `<div class="muted">Ideal area: ${escapeHtml(r.packageSnapshot.idealArea)}</div>` : ""}
        ${r.packageSnapshot?.consultationMode ? `<div class="muted">Consultation: ${escapeHtml(r.packageSnapshot.consultationMode)}</div>` : ""}
        ${r.packageSnapshot?.aftercare ? `<div class="muted">Aftercare: ${escapeHtml(r.packageSnapshot.aftercare)}</div>` : ""}
        <div class="muted" style="margin-top:.5rem">Status: ${escapeHtml(r.status||"")}</div>
      </div>
    </div>
    <div class="card inner" style="margin-top:1rem;">
      <h4>Request brief</h4>
      ${r.gardenSize ? `<div><b>Garden size:</b> <span class="muted">${escapeHtml(r.gardenSize)}</span></div>` : ""}
      ${r.budgetRange ? `<div><b>Budget range:</b> <span class="muted">${escapeHtml(r.budgetRange)}</span></div>` : ""}
      ${r.consultationPreference ? `<div><b>Preferred consultation:</b> <span class="muted">${escapeHtml(r.consultationPreference)}</span></div>` : ""}
      ${r.preferredDate ? `<div><b>Preferred date:</b> <span class="muted">${escapeHtml(r.preferredDate)}</span></div>` : ""}
      ${r.projectGoals ? `<div style="margin-top:.5rem"><b>Project goals:</b><div class="muted" style="white-space:pre-wrap">${escapeHtml(r.projectGoals)}</div></div>` : ""}
      ${r.notes ? `<div style="margin-top:.5rem"><b>Notes:</b><div class="muted" style="white-space:pre-wrap">${escapeHtml(r.notes)}</div></div>` : ""}
      ${r.adminNote ? `<div style="margin-top:.7rem"><b>Admin note:</b><div class="muted" style="white-space:pre-wrap">${escapeHtml(r.adminNote)}</div></div>` : ""}
    </div>
  `;
  el("landReqDetails").style.display = "block";
  el("closeLandReqDetails").onclick = () => (el("landReqDetails").style.display = "none");
  window.scrollTo({ top: document.body.scrollHeight, behavior:"smooth" });
}

function openLandReqStatusModal(r){
  openModal(
    "Update landscaping request",
    `
      <div class="grid two">
        <label><span>Status</span>
          <select id="lr_status">
            ${["new","in_progress","scheduled","completed","cancelled"].map(s => `<option value="${s}" ${ (r.status||"new")===s ? "selected" : "" }>${s}</option>`).join("")}
          </select>
        </label>
        <label><span>Customer</span><input value="${escapeAttr(r.customer?.name||"")}" disabled></label>
      </div>
      <label><span>Admin note (visible to customer)</span><textarea id="lr_note">${escapeHtml(r.adminNote||"")}</textarea></label>
      <div class="muted">Tip: update status so the customer can track progress in their account.</div>
    `,
    `
      <button class="btn" id="cancelLandReq">Cancel</button>
      <button class="btn primary" id="saveLandReq">Save</button>
    `
  );
  el("cancelLandReq").onclick = closeModal;
  el("saveLandReq").onclick = async () => {
    try{
      await api(`/landscaping/requests/${r._id}`, { method:"PATCH", body:{ status: el("lr_status").value, adminNote: el("lr_note").value } });
      toast("Request updated");
      closeModal();
      const status = el("landReqStatusFilter").value;
      cache.landscapingRequests = await api(`/landscaping/requests${status ? `?status=${encodeURIComponent(status)}` : ""}`);
      renderStats();
      renderLandscapingRequests();
    }catch(err){ toast(err.message); }
  };
}

const ORDER_STATUSES = ["pending", "confirmed", "preparing", "scheduled", "out_for_delivery", "delivered", "cancelled"];
const ORDER_TIME_SLOTS = {
  morning: "Morning (9:00 AM - 12:00 PM)",
  afternoon: "Afternoon (1:00 PM - 4:00 PM)",
  evening: "Evening (4:30 PM - 6:30 PM)",
};

function formatDateOnly(iso){
  if (!iso) return "";
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString("en-LK", { year:"numeric", month:"short", day:"2-digit" });
}

function slotLabel(slotId){
  return ORDER_TIME_SLOTS[slotId] || slotId || "";
}

function orderWindowSummary(order){
  const scheduledDate = order.delivery?.scheduledDate ? formatDateOnly(order.delivery.scheduledDate) : "";
  const preferredDate = order.delivery?.preferredDate ? formatDateOnly(order.delivery.preferredDate) : "";
  if (scheduledDate) {
    return `${scheduledDate}${order.delivery?.scheduledTimeSlot ? ` • ${slotLabel(order.delivery.scheduledTimeSlot)}` : ""}`;
  }
  if (preferredDate) {
    return `${preferredDate}${order.delivery?.preferredTimeSlot ? ` • ${slotLabel(order.delivery.preferredTimeSlot)}` : ""}`;
  }
  return order.delivery?.leadTimeLabel || "To be confirmed";
}

function orderMatches(o, q){
  if (!q) return true;
  q = q.toLowerCase();
  return (o.customer?.name||"").toLowerCase().includes(q) ||
         (o.customer?.phone||"").toLowerCase().includes(q) ||
         (o.customer?.address||"").toLowerCase().includes(q) ||
         (o.delivery?.zoneName||"").toLowerCase().includes(q) ||
         (o.delivery?.recipientName||"").toLowerCase().includes(q) ||
         (o.status||"").toLowerCase().includes(q);
}

function statusBadge(s){
  const map = {
    pending: "warn",
    confirmed: "good",
    preparing: "warn",
    scheduled: "warn",
    out_for_delivery: "warn",
    delivered: "good",
    cancelled: "bad"
  };
  const cls = map[s] || "";
  return `<span class="badge ${cls}">${escapeHtml(s||"")}</span>`;
}

function renderOrders(){
  const q = el("globalSearch").value.trim();
  const tbody = el("ordersTable").querySelector("tbody");
  tbody.innerHTML = "";
  const list = cache.orders.filter(o => orderMatches(o,q));
  for (const o of list){
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${formatDate(o.createdAt)}</td>
      <td>
        <strong>${escapeHtml(o.customer?.name||"")}</strong>
        <div class="muted">${escapeHtml(o.customer?.address||"")}</div>
        <div class="muted">${escapeHtml(o.delivery?.zoneName||"")}</div>
      </td>
      <td>
        <div>${escapeHtml(o.customer?.phone||"")}</div>
        <div class="muted">${escapeHtml(orderWindowSummary(o))}</div>
      </td>
      <td class="num">${fmtLKR(o.total)}</td>
      <td>${statusBadge(o.status)}</td>
      <td class="actions">
        <button class="btn small" data-act="view">View</button>
        <button class="btn small" data-act="status">Update</button>
      </td>`;
    tr.querySelector('[data-act="view"]').addEventListener("click", ()=> openOrderDetails(o));
    tr.querySelector('[data-act="status"]').addEventListener("click", ()=> openOrderStatusModal(o));
    tbody.appendChild(tr);
  }
}

function renderOrderTimeline(timeline){
  const list = Array.isArray(timeline) ? [...timeline].sort((a,b)=> new Date(b.at) - new Date(a.at)) : [];
  if (!list.length) return `<div class="muted">No tracking updates yet.</div>`;
  return `
    <div class="admin-timeline">
      ${list.map(item => `
        <div class="admin-timeline-item">
          <div class="admin-timeline-top">
            <strong>${escapeHtml(item.title || item.status || "Update")}</strong>
            <span class="muted">${formatDate(item.at)}</span>
          </div>
          ${item.note ? `<div class="muted">${escapeHtml(item.note)}</div>` : ""}
        </div>
      `).join("")}
    </div>
  `;
}

async function openOrderDetails(o){
  try{
    const full = await api(`/orders/${o._id}`);
    el("orderDetailsMeta").textContent = `${full._id} • ${formatDate(full.createdAt)} • ${full.status}`;
    el("orderDetailsBody").innerHTML = `
      <div class="grid two">
        <div class="card inner">
          <h4>Customer</h4>
          <div><strong>${escapeHtml(full.customer?.name||"")}</strong></div>
          <div class="muted">${escapeHtml(full.customer?.phone||"")}</div>
          <div class="muted">${escapeHtml(full.customer?.email||"")}</div>
          <div style="margin-top:.5rem">${escapeHtml(full.customer?.address||"")}</div>
        </div>
        <div class="card inner">
          <h4>Order</h4>
          <div>Subtotal: <strong>LKR ${fmtLKR(full.subtotal)}</strong></div>
          <div>Delivery Fee: <strong>LKR ${fmtLKR(full.delivery?.fee)}</strong></div>
          <div>Total: <strong>LKR ${fmtLKR(full.total)}</strong></div>
          <div class="muted">Status: ${escapeHtml(full.status||"")}</div>
          <div class="muted">Payment: ${escapeHtml(full.paymentMethod||"COD")}</div>
          ${full.notes ? `<div class="muted">Customer note: ${escapeHtml(full.notes)}</div>` : ""}
          ${full.adminNote ? `<div class="muted">Visible update: ${escapeHtml(full.adminNote)}</div>` : ""}
        </div>
      </div>

      <div class="grid two" style="margin-top:1rem;">
        <div class="card inner">
          <h4>Delivery details</h4>
          <div><b>Zone:</b> <span class="muted">${escapeHtml(full.delivery?.zoneName||"")}</span></div>
          <div><b>Requested window:</b> <span class="muted">${escapeHtml(orderWindowSummary(full))}</span></div>
          ${full.delivery?.scheduledDate ? `<div><b>Scheduled:</b> <span class="muted">${escapeHtml(formatDateOnly(full.delivery.scheduledDate))}${full.delivery?.scheduledTimeSlot ? ` • ${escapeHtml(slotLabel(full.delivery.scheduledTimeSlot))}` : ""}</span></div>` : ""}
          <div><b>Receiver:</b> <span class="muted">${escapeHtml(full.delivery?.recipientName || full.customer?.name || "")}${full.delivery?.recipientPhone ? ` • ${escapeHtml(full.delivery.recipientPhone)}` : ""}</span></div>
          ${full.delivery?.landmark ? `<div><b>Landmark:</b> <span class="muted">${escapeHtml(full.delivery.landmark)}</span></div>` : ""}
          ${full.delivery?.instructions ? `<div style="margin-top:.5rem"><b>Instructions:</b><div class="muted">${escapeHtml(full.delivery.instructions)}</div></div>` : ""}
        </div>
        <div class="card inner">
          <h4>Dispatch</h4>
          <div><b>Delivery boy:</b> <span class="muted">${escapeHtml(full.delivery?.deliveryBoyName || "-")}</span></div>
          <div><b>Phone:</b> <span class="muted">${escapeHtml(full.delivery?.deliveryBoyPhone || "-")}</span></div>
          <div><b>Vehicle:</b> <span class="muted">${escapeHtml(full.delivery?.vehicleNumber || "-")}</span></div>
          <div><b>Lead time:</b> <span class="muted">${escapeHtml(full.delivery?.leadTimeLabel || "-")}</span></div>
        </div>
      </div>

      <div class="card inner" style="margin-top:1rem;">
        <h4>Items</h4>
        <div class="table-wrap">
          <table class="table" style="min-width:600px">
            <thead><tr><th>Plant</th><th class="num">Price</th><th class="num">Qty</th><th class="num">Subtotal</th></tr></thead>
            <tbody>
              ${(full.items||[]).map(it => `
                <tr>
                  <td>${escapeHtml(it.name || it.plant?.name || "Item")}</td>
                  <td class="num">${fmtLKR(it.price)}</td>
                  <td class="num">${it.qty}</td>
                  <td class="num">${fmtLKR((it.price||0)*(it.qty||1))}</td>
                </tr>`).join("")}
            </tbody>
          </table>
        </div>
      </div>

      <div class="card inner" style="margin-top:1rem;">
        <h4>Status history</h4>
        ${renderOrderTimeline(full.statusTimeline)}
      </div>
    `;
    el("orderDetails").style.display = "block";
    el("closeOrderDetails").onclick = ()=> el("orderDetails").style.display="none";
    window.scrollTo({ top: document.body.scrollHeight, behavior:"smooth" });
  }catch(err){ toast(err.message); }
}

function openOrderStatusModal(o){
  const scheduledDate = o.delivery?.scheduledDate || o.delivery?.preferredDate || "";
  const scheduledTimeSlot = o.delivery?.scheduledTimeSlot || o.delivery?.preferredTimeSlot || "afternoon";
  openModal(
    "Update order",
    `
      <div class="grid two">
        <label><span>Status</span>
          <select id="o_status">
            ${ORDER_STATUSES.map(s => `<option value="${s}" ${o.status===s?"selected":""}>${s}</option>`).join("")}
          </select>
        </label>
        <label><span>Delivery Zone</span><input value="${escapeAttr(o.delivery?.zoneName || "")}" disabled></label>
      </div>

      <div class="grid two">
        <label><span>Scheduled Date</span><input id="o_sched_date" type="date" value="${escapeAttr(scheduledDate)}"></label>
        <label><span>Scheduled Time Slot</span>
          <select id="o_sched_slot">
            ${Object.entries(ORDER_TIME_SLOTS).map(([id,label]) => `<option value="${id}" ${scheduledTimeSlot===id?"selected":""}>${label}</option>`).join("")}
          </select>
        </label>
      </div>

      <div class="grid two">
        <label><span>Delivery Boy Name</span><input id="o_driver_name" value="${escapeAttr(o.delivery?.deliveryBoyName || "")}" placeholder="Kamal"></label>
        <label><span>Delivery Boy Phone</span><input id="o_driver_phone" value="${escapeAttr(o.delivery?.deliveryBoyPhone || "")}" placeholder="07X XXX XXXX"></label>
      </div>

      <div class="grid two">
        <label><span>Vehicle Number</span><input id="o_vehicle_no" value="${escapeAttr(o.delivery?.vehicleNumber || "")}" placeholder="CAB-1234"></label>
        <label><span>Total (read only)</span><input value="LKR ${fmtLKR(o.total)}" disabled></label>
      </div>

      <label><span>Customer note (read only)</span><textarea disabled>${escapeHtml(o.notes||"")}</textarea></label>
      <label><span>Tracking note / customer update (visible to customer)</span><textarea id="o_admin_note">${escapeHtml(o.adminNote||"")}</textarea></label>
      <div class="muted">Tip: use scheduled + out_for_delivery statuses so the customer can clearly track the dispatch process.</div>
    `,
    `
      <button class="btn" id="cancelOrder">Cancel</button>
      <button class="btn primary" id="saveOrder">Save</button>
    `
  );
  el("cancelOrder").onclick = closeModal;
  el("saveOrder").onclick = async () => {
    try{
      await api(`/orders/${o._id}`, {
        method:"PATCH",
        body:{
          status: el("o_status").value,
          adminNote: el("o_admin_note").value,
          delivery: {
            scheduledDate: el("o_sched_date").value,
            scheduledTimeSlot: el("o_sched_slot").value,
            deliveryBoyName: el("o_driver_name").value,
            deliveryBoyPhone: el("o_driver_phone").value,
            vehicleNumber: el("o_vehicle_no").value,
          }
        }
      });
      toast("Order updated");
      closeModal();
      const status = el("orderStatusFilter").value;
      cache.orders = await api(`/orders${status ? `?status=${encodeURIComponent(status)}` : ""}`);
      renderStats(); renderOrders();
    }catch(err){ toast(err.message); }
  };
}

function inquiryMatches(i, q){
  if (!q) return true;
  q = q.toLowerCase();
  return (i.name||"").toLowerCase().includes(q) ||
         (i.phone||"").toLowerCase().includes(q) ||
         (i.email||"").toLowerCase().includes(q) ||
         (i.status||"new").toLowerCase().includes(q) ||
         (i.message||"").toLowerCase().includes(q);
}

function renderInquiries(){
  const q = el("globalSearch").value.trim();
  const tbody = el("inquiriesTable").querySelector("tbody");
  tbody.innerHTML = "";
  const list = cache.inquiries
    .filter(i => inquiryMatches(i,q))
    .sort((a,b)=> new Date(b.createdAt)-new Date(a.createdAt));
  for (const i of list){
    const status = i.status || "new";
    const badgeCls = status === "resolved" ? "good" : status === "in_progress" ? "warn" : "bad";
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${formatDate(i.createdAt)}</td>
      <td><strong>${escapeHtml(i.name||"")}</strong></td>
      <td>${escapeHtml(i.phone||"")}</td>
      <td>${escapeHtml(i.email||"")}</td>
      <td><span class="badge ${badgeCls}">${escapeHtml(status)}</span></td>
      <td class="actions">
        <button class="btn small" data-act="view">View</button>
        <button class="btn small" data-act="status">Status</button>
        <button class="btn small danger" data-act="del">Delete</button>
      </td>`;
    tr.querySelector('[data-act="view"]').onclick = ()=> openInquiryDetails(i);
    tr.querySelector('[data-act="status"]').onclick = ()=> openInquiryStatusModal(i);
    tr.querySelector('[data-act="del"]').onclick = ()=> deleteInquiry(i);
    tbody.appendChild(tr);
  }
}

function openInquiryDetails(i){
  el("inquiryDetailsMeta").textContent = `${i._id} • ${formatDate(i.createdAt)}`;
  el("inquiryDetailsBody").innerHTML = `
    <div class="grid two">
      <div class="card inner">
        <h4>From</h4>
        <div><strong>${escapeHtml(i.name||"")}</strong></div>
        <div class="muted">${escapeHtml(i.phone||"")}</div>
        <div class="muted">${escapeHtml(i.email||"")}</div>
        <div class="muted">Status: ${escapeHtml(i.status||"new")}</div>
      </div>
      <div class="card inner">
        <h4>Message</h4>
        <div style="white-space:pre-wrap">${escapeHtml(i.message||"")}</div>
        ${i.adminReply ? `
          <div style="margin-top:1rem; padding-top:1rem; border-top:1px solid var(--line);">
            <h4 style="margin:0 0 .4rem;">Admin reply</h4>
            <div class="muted" style="white-space:pre-wrap">${escapeHtml(i.adminReply||"")}</div>
          </div>
        ` : ""}
      </div>
    </div>
  `;
  el("inquiryDetails").style.display = "block";
  el("closeInquiryDetails").onclick = ()=> el("inquiryDetails").style.display="none";
  window.scrollTo({ top: document.body.scrollHeight, behavior:"smooth" });
}

function openInquiryStatusModal(i){
  openModal(
    "Update inquiry status",
    `
      <label><span>Status</span>
        <select id="i_status">
          ${["new","in_progress","resolved"].map(s => `<option value="${s}" ${ (i.status||"new")===s ? "selected":"" }>${s}</option>`).join("")}
        </select>
      </label>
      <label><span>Admin reply (visible to customer)</span>
        <textarea id="i_reply" placeholder="Type your reply / note here…">${escapeHtml(i.adminReply||"")}</textarea>
      </label>
      <div class="muted">Tip: mark as resolved after replying.</div>
    `,
    `
      <button class="btn" id="cancelInquiry">Cancel</button>
      <button class="btn primary" id="saveInquiry">Save</button>
    `
  );
  el("cancelInquiry").onclick = closeModal;
  el("saveInquiry").onclick = async () => {
    try{
      await api(`/inquiries/${i._id}`, { method:"PATCH", body:{ status: el("i_status").value, adminReply: el("i_reply").value }});
      toast("Inquiry updated");
      closeModal();
      cache.inquiries = await api("/inquiries");
      renderStats(); renderInquiries();
    }catch(err){ toast(err.message); }
  };
}

async function deleteInquiry(i){
  if (!confirm("Delete this inquiry?")) return;
  try{
    await api(`/inquiries/${i._id}`, { method:"DELETE" });
    toast("Deleted");
    cache.inquiries = await api("/inquiries");
    renderStats(); renderInquiries();
  }catch(err){ toast(err.message); }
}

// ------- Reviews -------
function reviewMatches(r, q){
  if (!q) return true;
  q=q.toLowerCase();
  return (r.name||"").toLowerCase().includes(q) ||
         String(r.rating||"").includes(q) ||
         (r.comment||"").toLowerCase().includes(q) ||
         String(r.approved!==false).includes(q);
}

function renderReviews(){
  const q = el("globalSearch").value.trim();
  const tbody = el("reviewsTable").querySelector("tbody");
  tbody.innerHTML = "";
  const list = cache.reviews.filter(r => reviewMatches(r,q));
  for (const r of list){
    const approved = r.approved !== false;
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${formatDate(r.createdAt)}</td>
      <td><strong>${escapeHtml(r.name||"")}</strong></td>
      <td class="num">${r.rating}</td>
      <td>${escapeHtml((r.comment||"").slice(0,120))}${(r.comment||"").length>120 ? "…" : ""}</td>
      <td>${approved ? '<span class="badge good">Yes</span>' : '<span class="badge bad">No</span>'}</td>
      <td class="actions">
        <button class="btn small" data-act="toggle">${approved ? "Hide" : "Approve"}</button>
        <button class="btn small danger" data-act="del">Delete</button>
      </td>`;
    tr.querySelector('[data-act="toggle"]').onclick = ()=> toggleReview(r, !approved);
    tr.querySelector('[data-act="del"]').onclick = ()=> deleteReview(r);
    tbody.appendChild(tr);
  }
}

async function toggleReview(r, approved){
  try{
    await api(`/reviews/${r._id}`, { method:"PATCH", body:{ approved }});
    toast("Updated");
    cache.reviews = await api("/reviews?all=1&limit=100");
    renderStats(); renderReviews();
  }catch(err){ toast(err.message); }
}

async function deleteReview(r){
  if (!confirm("Delete this review?")) return;
  try{
    await api(`/reviews/${r._id}`, { method:"DELETE" });
    toast("Deleted");
    cache.reviews = await api("/reviews?all=1&limit=100");
    renderStats(); renderReviews();
  }catch(err){ toast(err.message); }
}

// ------- Utilities -------
function formatDate(iso){
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleString("en-LK", { year:"numeric", month:"short", day:"2-digit", hour:"2-digit", minute:"2-digit" });
}
function escapeHtml(str){
  return String(str || "")
    .replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;")
    .replaceAll('"',"&quot;").replaceAll("'","&#039;");
}
function escapeAttr(str){ return escapeHtml(str).replaceAll("\n"," "); }

// ------- Boot -------
async function boot(){
  const ok = await checkToken();
  if (!ok){ showLogin(); return; }
  showAdmin();
  setActivePage("dashboard");
  await refreshAll();
  renderCurrentPage();
}

boot();

let paymentSettingsState = null;

function paymentStatusMeta(status){
  const map = {
    cash_on_delivery: { label: 'Cash on delivery', cls: 'warn' },
    proof_uploaded: { label: 'Proof uploaded', cls: 'warn' },
    under_review: { label: 'Under review', cls: 'warn' },
    verified: { label: 'Verified', cls: 'good' },
    rejected: { label: 'Rejected', cls: 'bad' },
    awaiting_payment: { label: 'Awaiting payment', cls: 'bad' },
  };
  return map[status] || { label: status || 'Unknown', cls: '' };
}

function paymentStatusBadge(status){
  const meta = paymentStatusMeta(status);
  return `<span class="payment-status-pill ${meta.cls}">${escapeHtml(meta.label)}</span>`;
}

function renderOrders(){
  const q = el('globalSearch').value.trim();
  const tbody = el('ordersTable').querySelector('tbody');
  tbody.innerHTML = '';
  const list = cache.orders.filter((o) => orderMatches(o, q));
  for (const o of list){
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>
        <div>${formatDate(o.createdAt)}</div>
        <div class="muted">${escapeHtml(o.orderCode || '')}</div>
      </td>
      <td>
        <div class="order-meta-stack">
          <strong>${escapeHtml(o.customer?.name || '')}</strong>
          <div class="muted">${escapeHtml(o.customer?.address || '')}</div>
          <div class="muted">${escapeHtml(o.delivery?.zoneName || '')}</div>
          <div>${paymentStatusBadge(o.payment?.status)}</div>
        </div>
      </td>
      <td>
        <div>${escapeHtml(o.customer?.phone || '')}</div>
        <div class="muted">${escapeHtml(orderWindowSummary(o))}</div>
      </td>
      <td class="num">${fmtLKR(o.total)}</td>
      <td>
        ${statusBadge(o.status)}
        <div class="muted" style="margin-top:6px;">${escapeHtml(o.payment?.methodLabel || o.paymentMethod || 'COD')}</div>
      </td>
      <td class="actions">
        <button class="btn small" data-act="view">View</button>
        <button class="btn small" data-act="status">Update</button>
      </td>`;
    tr.querySelector('[data-act="view"]').addEventListener('click', () => openOrderDetails(o));
    tr.querySelector('[data-act="status"]').addEventListener('click', () => openOrderStatusModal(o));
    tbody.appendChild(tr);
  }
}

async function openOrderDetails(o){
  try {
    const full = await api(`/orders/${o._id}`);
    el('orderDetailsMeta').textContent = `${full.orderCode || full._id} • ${formatDate(full.createdAt)} • ${full.status}`;
    const payment = full.payment || {};
    const paymentMeta = paymentStatusMeta(payment.status);
    const slipBlock = payment.slipUrl
      ? `<a class="btn btn-outline payment-proof-link" href="${escapeAttr(payment.slipUrl)}" target="_blank" rel="noopener">Open uploaded proof</a>`
      : '<div class="muted">No payment proof uploaded for this order.</div>';

    el('orderDetailsBody').innerHTML = `
      <div class="grid two">
        <div class="card inner">
          <h4>Customer</h4>
          <div><strong>${escapeHtml(full.customer?.name || '')}</strong></div>
          <div class="muted">${escapeHtml(full.customer?.phone || '')}</div>
          <div class="muted">${escapeHtml(full.customer?.email || '')}</div>
          <div style="margin-top:.5rem">${escapeHtml(full.customer?.address || '')}</div>
        </div>
        <div class="card inner">
          <h4>Order</h4>
          <div>Order Code: <strong>${escapeHtml(full.orderCode || '-')}</strong></div>
          <div>Subtotal: <strong>LKR ${fmtLKR(full.subtotal)}</strong></div>
          <div>Delivery Fee: <strong>LKR ${fmtLKR(full.delivery?.fee)}</strong></div>
          <div>Total: <strong>LKR ${fmtLKR(full.total)}</strong></div>
          <div class="muted">Status: ${escapeHtml(full.status || '')}</div>
          <div class="muted">Payment: ${escapeHtml(payment.methodLabel || full.paymentMethod || 'COD')}</div>
          ${full.notes ? `<div class="muted">Customer note: ${escapeHtml(full.notes)}</div>` : ''}
          ${full.adminNote ? `<div class="muted">Visible update: ${escapeHtml(full.adminNote)}</div>` : ''}
        </div>
      </div>

      <div class="grid two" style="margin-top:1rem;">
        <div class="card inner">
          <h4>Delivery details</h4>
          <div><b>Zone:</b> <span class="muted">${escapeHtml(full.delivery?.zoneName || '')}</span></div>
          <div><b>Requested window:</b> <span class="muted">${escapeHtml(orderWindowSummary(full))}</span></div>
          ${full.delivery?.scheduledDate ? `<div><b>Scheduled:</b> <span class="muted">${escapeHtml(formatDateOnly(full.delivery.scheduledDate))}${full.delivery?.scheduledTimeSlot ? ` • ${escapeHtml(slotLabel(full.delivery.scheduledTimeSlot))}` : ''}</span></div>` : ''}
          <div><b>Receiver:</b> <span class="muted">${escapeHtml(full.delivery?.recipientName || full.customer?.name || '')}${full.delivery?.recipientPhone ? ` • ${escapeHtml(full.delivery.recipientPhone)}` : ''}</span></div>
          ${full.delivery?.landmark ? `<div><b>Landmark:</b> <span class="muted">${escapeHtml(full.delivery.landmark)}</span></div>` : ''}
          ${full.delivery?.instructions ? `<div style="margin-top:.5rem"><b>Instructions:</b><div class="muted">${escapeHtml(full.delivery.instructions)}</div></div>` : ''}
        </div>
        <div class="card inner payment-proof-card">
          <h4>Payment proof</h4>
          <div class="payment-proof-grid">
            <div>
              <div><span class="muted">Method</span><strong>${escapeHtml(payment.methodLabel || full.paymentMethod || 'COD')}</strong></div>
              <div style="margin-top:8px;"><span class="muted">Status</span><strong>${escapeHtml(paymentMeta.label)}</strong></div>
              <div style="margin-top:8px;"><span class="muted">Expected amount</span><strong>${escapeHtml((payment.currency || 'LKR'))} ${fmtLKR(payment.amountExpected || full.total)}</strong></div>
            </div>
            <div>
              <div><span class="muted">Payer</span><strong>${escapeHtml(payment.payerName || '-')}</strong></div>
              <div style="margin-top:8px;"><span class="muted">Reference</span><strong>${escapeHtml(payment.reference || '-')}</strong></div>
              <div style="margin-top:8px;"><span class="muted">Destination</span><strong>${escapeHtml(payment.destinationLabel || '-')}</strong></div>
            </div>
          </div>
          ${payment.destinationValue ? `<div class="payment-destination-box"><span class="muted">Address / account</span><code>${escapeHtml(payment.destinationValue)}</code></div>` : ''}
          ${payment.verificationNote ? `<div class="payment-settings-note"><b>Verification note</b><div class="muted">${escapeHtml(payment.verificationNote)}</div></div>` : ''}
          ${slipBlock}
        </div>
      </div>

      <div class="card inner" style="margin-top:1rem;">
        <h4>Items</h4>
        <div class="table-wrap">
          <table class="table" style="min-width:600px">
            <thead><tr><th>Plant</th><th class="num">Price</th><th class="num">Qty</th><th class="num">Subtotal</th></tr></thead>
            <tbody>
              ${(full.items || []).map((it) => `
                <tr>
                  <td>${escapeHtml(it.name || it.plant?.name || 'Item')}</td>
                  <td class="num">${fmtLKR(it.price)}</td>
                  <td class="num">${it.qty}</td>
                  <td class="num">${fmtLKR((it.price || 0) * (it.qty || 1))}</td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <div class="card inner" style="margin-top:1rem;">
        <h4>Status history</h4>
        ${renderOrderTimeline(full.statusTimeline)}
      </div>
    `;
    el('orderDetails').style.display = 'block';
    el('closeOrderDetails').onclick = () => { el('orderDetails').style.display = 'none'; };
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
  } catch (err) {
    toast(err.message);
  }
}

function openOrderStatusModal(o){
  const scheduledDate = o.delivery?.scheduledDate || o.delivery?.preferredDate || '';
  const scheduledTimeSlot = o.delivery?.scheduledTimeSlot || o.delivery?.preferredTimeSlot || 'afternoon';
  const payment = o.payment || {};
  const paymentStatuses = ['cash_on_delivery', 'proof_uploaded', 'under_review', 'verified', 'rejected', 'awaiting_payment'];
  const slipHtml = payment.slipUrl
    ? `<a class="btn payment-proof-link" href="${escapeAttr(payment.slipUrl)}" target="_blank" rel="noopener">Open uploaded proof</a>`
    : '<div class="muted field-help">No uploaded proof attached.</div>';

  openModal(
    'Update order',
    `
      <div class="order-update-layout">
        <div class="modal-kpi-grid">
          <div class="modal-kpi">
            <span>Order</span>
            <strong>${escapeHtml(o.orderCode || o._id || 'Order')}</strong>
          </div>
          <div class="modal-kpi">
            <span>Total</span>
            <strong>LKR ${fmtLKR(o.total)}</strong>
          </div>
          <div class="modal-kpi">
            <span>Payment method</span>
            <strong>${escapeHtml(payment.methodLabel || o.paymentMethod || 'Cash on Delivery')}</strong>
          </div>
          <div class="modal-kpi">
            <span>Customer</span>
            <strong>${escapeHtml(o.customer?.name || '-')}</strong>
          </div>
        </div>

        <div class="modal-section">
          <div class="modal-section-head">
            <div>
              <h4>Order status & scheduling</h4>
              <p class="muted">Keep dispatch details compact and easy to review.</p>
            </div>
          </div>
          <div class="grid two order-edit-grid">
            <label><span>Status</span>
              <select id="o_status">
                ${ORDER_STATUSES.map((s) => `<option value="${s}" ${o.status === s ? 'selected' : ''}>${s}</option>`).join('')}
              </select>
            </label>
            <label><span>Delivery Zone</span><input value="${escapeAttr(o.delivery?.zoneName || '')}" disabled></label>
          </div>
          <div class="grid two order-edit-grid">
            <label><span>Scheduled Date</span><input id="o_sched_date" type="date" value="${escapeAttr(scheduledDate)}"></label>
            <label><span>Scheduled Time Slot</span>
              <select id="o_sched_slot">
                ${Object.entries(ORDER_TIME_SLOTS).map(([id, label]) => `<option value="${id}" ${scheduledTimeSlot === id ? 'selected' : ''}>${label}</option>`).join('')}
              </select>
            </label>
          </div>
          <div class="grid two order-edit-grid">
            <label><span>Delivery Boy Name</span><input id="o_driver_name" value="${escapeAttr(o.delivery?.deliveryBoyName || '')}" placeholder="Kamal"></label>
            <label><span>Delivery Boy Phone</span><input id="o_driver_phone" value="${escapeAttr(o.delivery?.deliveryBoyPhone || '')}" placeholder="07X XXX XXXX"></label>
          </div>
          <div class="grid two order-edit-grid">
            <label><span>Vehicle Number</span><input id="o_vehicle_no" value="${escapeAttr(o.delivery?.vehicleNumber || '')}" placeholder="CAB-1234"></label>
            <label><span>Expected amount</span><input value="${escapeAttr(payment.currency || 'LKR')} ${fmtLKR(payment.amountExpected || o.total)}" disabled></label>
          </div>
        </div>

        <div class="modal-section">
          <div class="modal-section-head">
            <div>
              <h4>Payment review</h4>
              <p class="muted">Review proof, mark status, and keep an internal note.</p>
            </div>
            ${slipHtml}
          </div>
          <div class="grid two order-edit-grid">
            <label><span>Payment status</span>
              <select id="o_payment_status">
                ${paymentStatuses.map((status) => `<option value="${status}" ${payment.status === status ? 'selected' : ''}>${paymentStatusMeta(status).label}</option>`).join('')}
              </select>
            </label>
            <label><span>Amount received</span><input id="o_payment_amount" type="number" min="0" step="0.01" value="${escapeAttr(payment.amountReceived || 0)}"></label>
          </div>
          <div class="grid two order-edit-grid">
            <label><span>Payer name</span><input id="o_payment_payer" value="${escapeAttr(payment.payerName || '')}"></label>
            <label><span>Reference / hash</span><input id="o_payment_reference" value="${escapeAttr(payment.reference || '')}"></label>
          </div>
          <label><span>Payment note (internal + timeline)</span><textarea id="o_payment_note" class="compact-textarea">${escapeHtml(payment.verificationNote || '')}</textarea></label>
        </div>

        <div class="grid two order-edit-grid">
          <label><span>Customer note (read only)</span><textarea disabled class="compact-textarea">${escapeHtml(o.notes || '')}</textarea></label>
          <label><span>Tracking note / customer update</span><textarea id="o_admin_note" class="compact-textarea">${escapeHtml(o.adminNote || '')}</textarea></label>
        </div>

        <div class="muted field-help">Tip: verify payment first for transfer, QR, Skrill, or crypto orders and then move the order to confirmed or preparing.</div>
      </div>
    `,
    `
      <button class="btn" id="cancelOrder">Cancel</button>
      <button class="btn primary" id="saveOrder">Save</button>
    `,
    { size: 'wide', variant: 'order-update' }
  );
  el('cancelOrder').onclick = closeModal;
  el('saveOrder').onclick = async () => {
    try {
      await api(`/orders/${o._id}`, {
        method: 'PATCH',
        body: {
          status: el('o_status').value,
          adminNote: el('o_admin_note').value,
          payment: {
            status: el('o_payment_status').value,
            amountReceived: el('o_payment_amount').value,
            payerName: el('o_payment_payer').value,
            reference: el('o_payment_reference').value,
            verificationNote: el('o_payment_note').value,
          },
          delivery: {
            scheduledDate: el('o_sched_date').value,
            scheduledTimeSlot: el('o_sched_slot').value,
            deliveryBoyName: el('o_driver_name').value,
            deliveryBoyPhone: el('o_driver_phone').value,
            vehicleNumber: el('o_vehicle_no').value,
          }
        }
      });
      toast('Order updated');
      closeModal();
      const status = el('orderStatusFilter').value;
      cache.orders = await api(`/orders${status ? `?status=${encodeURIComponent(status)}` : ''}`);
      renderStats();
      renderOrders();
    } catch (err) {
      toast(err.message);
    }
  };
}

function renderCurrentPage(){
  const active = document.querySelector('.nav-item.active')?.dataset.page || 'dashboard';
  if (active === 'dashboard') renderStats();
  if (active === 'plants') renderPlants();
  if (active === 'orders') renderOrders();
  if (active === 'landscapingPackages') renderLandscapingPackages();
  if (active === 'landscapingRequests') renderLandscapingRequests();
  if (active === 'inquiries') renderInquiries();
  if (active === 'reviews') renderReviews();
  if (active === 'settings') renderPaymentSettings();
}

async function apiForm(path, method, formData){
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: { ...authHeaders() },
    body: formData,
  });
  const txt = await res.text();
  let data = null;
  try { data = txt ? JSON.parse(txt) : null; } catch { data = { raw: txt }; }
  if (!res.ok) {
    const msg = data?.message || data?.details || `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return data;
}

function renderSettingsPreview(targetId, url){
  const target = el(targetId);
  if (!target) return;
  if (!url) {
    target.innerHTML = '<span class="muted">No file uploaded yet.</span>';
    return;
  }
  const isPdf = /\.pdf($|\?)/i.test(url);
  target.innerHTML = isPdf
    ? `<a class="btn btn-outline" href="${escapeAttr(url)}" target="_blank" rel="noopener">Open current PDF</a>`
    : `<img src="${escapeAttr(url)}" alt="QR preview"><a class="btn btn-outline" href="${escapeAttr(url)}" target="_blank" rel="noopener">Open current file</a>`;
}

function getDefaultCryptoWallets(){
  return [
    { key: 'wallet_1', enabled: false, label: 'USDT (TRC20)', coin: 'USDT', network: 'TRC20', address: '', instructions: 'Best for low network fees. Send only via TRC20.', qrImageUrl: '' },
    { key: 'wallet_2', enabled: false, label: 'BTC', coin: 'BTC', network: 'Bitcoin', address: '', instructions: 'Use Bitcoin network only.', qrImageUrl: '' },
    { key: 'wallet_3', enabled: false, label: 'ETH / ERC20', coin: 'ETH', network: 'ERC20', address: '', instructions: 'Use ERC20 network only.', qrImageUrl: '' },
  ];
}

function collectPaymentSettingsFiles(){
  const fileEntries = [];

  if (el('ps_bank_qr')?.files?.[0]) fileEntries.push(['bankTransferQr', el('ps_bank_qr').files[0]]);
  if (el('ps_lanka_qr')?.files?.[0]) fileEntries.push(['lankaQrImage', el('ps_lanka_qr').files[0]]);
  if (el('site_promoImage')?.files?.[0]) fileEntries.push(['sitePromoImage', el('site_promoImage').files[0]]);

  const walletCards = Array.from(document.querySelectorAll('#cryptoWalletSettings .wallet-settings-card'));
  walletCards.forEach((_, index) => {
    const fileInput = el(`ps_crypto_wallet_${index}_qr`);
    if (fileInput?.files?.[0]) {
      fileEntries.push([`cryptoWalletQr${index}`, fileInput.files[0]]);
    }
  });

  return fileEntries;
}

async function submitPaymentSettingsRequest(payload){
  const fileEntries = collectPaymentSettingsFiles();

  if (!fileEntries.length) {
    try {
      return await api('/settings/payment/admin', { method: 'POST', body: payload });
    } catch (err) {
      if (/Failed to fetch/i.test(String(err?.message || ''))) {
        return api('/settings/payment/admin', { method: 'PUT', body: payload });
      }
      throw err;
    }
  }

  const formData = new FormData();
  formData.append('payload', JSON.stringify(payload));
  fileEntries.forEach(([fieldName, file]) => formData.append(fieldName, file));

  try {
    return await apiForm('/settings/payment/admin', 'POST', formData);
  } catch (err) {
    if (/Failed to fetch/i.test(String(err?.message || ''))) {
      return apiForm('/settings/payment/admin', 'PUT', formData);
    }
    throw err;
  }
}

function cryptoWalletCard(wallet, index){
  return `
    <div class="wallet-settings-card">
      <div class="grid two">
        <label><span>Wallet label</span><input id="ps_crypto_wallet_${index}_label" value="${escapeAttr(wallet.label || '')}" placeholder="USDT (TRC20)"></label>
        <label><span>Coin</span><input id="ps_crypto_wallet_${index}_coin" value="${escapeAttr(wallet.coin || '')}" placeholder="USDT"></label>
      </div>
      <div class="grid two" style="margin-top:12px;">
        <label><span>Network</span><input id="ps_crypto_wallet_${index}_network" value="${escapeAttr(wallet.network || '')}" placeholder="TRC20"></label>
        <label><span>QR image</span><input id="ps_crypto_wallet_${index}_qr" type="file" accept=".jpg,.jpeg,.png,.webp,.pdf"></label>
      </div>
      <label style="margin-top:12px;"><span>Address</span><textarea id="ps_crypto_wallet_${index}_address" placeholder="Wallet address">${escapeHtml(wallet.address || '')}</textarea></label>
      <label style="margin-top:12px;"><input id="ps_crypto_wallet_${index}_enabled" type="checkbox" ${wallet.enabled ? 'checked' : ''}> <span class="muted">Enable this wallet</span></label>
      <label style="margin-top:12px;"><span>Instructions</span><textarea id="ps_crypto_wallet_${index}_instructions">${escapeHtml(wallet.instructions || '')}</textarea></label>
      <div id="ps_crypto_wallet_${index}_preview" class="settings-upload-preview"></div>
    </div>
  `;
}

function populatePaymentSettingsForm(settings){
  if (!settings) return;
  const wallets = Array.isArray(settings.crypto?.wallets) && settings.crypto.wallets.length
    ? settings.crypto.wallets
    : getDefaultCryptoWallets();

  paymentSettingsState = {
    ...settings,
    crypto: {
      ...(settings.crypto || {}),
      wallets,
    },
  };

  el('paymentSettingsMsg').textContent = '';
  el('site_footerTagline').value = settings.site?.footerTagline || '';
  el('site_contactPhone').value = settings.site?.contactPhone || '';
  el('site_contactEmail').value = settings.site?.contactEmail || '';
  el('site_contactAddress').value = settings.site?.contactAddress || '';
  el('site_businessHours').value = settings.site?.businessHours || '';
  el('site_deliveryNote').value = settings.site?.deliveryNote || '';
  el('site_mapsUrl').value = settings.site?.mapsUrl || '';
  el('site_facebookUrl').value = settings.site?.facebookUrl || '';
  el('site_instagramUrl').value = settings.site?.instagramUrl || '';
  el('site_tiktokUrl').value = settings.site?.tiktokUrl || '';
  el('site_footerCopyright').value = settings.site?.footerCopyright || '';
  el('site_promoAlt').value = settings.site?.promoAlt || '';
  renderSettingsPreview('site_promo_preview', settings.site?.promoImageUrl || 'assets/img/site/promo-offer.svg');

  el('ps_businessName').value = settings.businessName || '';
  el('ps_whatsappNumber').value = settings.whatsappNumber || '';
  el('ps_orderPrefix').value = settings.orderPrefix || '';
  el('ps_slipGuidance').value = settings.slipGuidance || '';
  el('ps_paymentPolicyNote').value = settings.paymentPolicyNote || '';

  el('ps_cod_title').value = settings.cod?.title || '';
  el('ps_cod_maxAmount').value = settings.cod?.maxOrderAmount || 0;
  el('ps_cod_enabled').checked = settings.cod?.enabled !== false;
  el('ps_cod_instructions').value = settings.cod?.instructions || '';

  el('ps_bank_title').value = settings.bankTransfer?.title || '';
  el('ps_bank_bankName').value = settings.bankTransfer?.bankName || '';
  el('ps_bank_accountName').value = settings.bankTransfer?.accountName || '';
  el('ps_bank_accountNumber').value = settings.bankTransfer?.accountNumber || '';
  el('ps_bank_branch').value = settings.bankTransfer?.branch || '';
  el('ps_bank_enabled').checked = settings.bankTransfer?.enabled !== false;
  el('ps_bank_instructions').value = settings.bankTransfer?.instructions || '';
  renderSettingsPreview('ps_bank_preview', settings.bankTransfer?.qrImageUrl || '');

  el('ps_lanka_title').value = settings.lankaQr?.title || '';
  el('ps_lanka_merchantName').value = settings.lankaQr?.merchantName || '';
  el('ps_lanka_enabled').checked = settings.lankaQr?.enabled !== false;
  el('ps_lanka_instructions').value = settings.lankaQr?.instructions || '';
  renderSettingsPreview('ps_lanka_preview', settings.lankaQr?.qrImageUrl || '');

  el('ps_skrill_title').value = settings.skrill?.title || '';
  el('ps_skrill_email').value = settings.skrill?.email || '';
  el('ps_skrill_customerId').value = settings.skrill?.customerId || '';
  el('ps_skrill_enabled').checked = !!settings.skrill?.enabled;
  el('ps_skrill_instructions').value = settings.skrill?.instructions || '';

  el('ps_crypto_title').value = settings.crypto?.title || '';
  el('ps_crypto_enabled').checked = !!settings.crypto?.enabled;
  el('ps_crypto_instructions').value = settings.crypto?.instructions || '';

  const walletWrap = el('cryptoWalletSettings');
  walletWrap.innerHTML = wallets.map((wallet, index) => cryptoWalletCard(wallet, index)).join('');
  wallets.forEach((wallet, index) => renderSettingsPreview(`ps_crypto_wallet_${index}_preview`, wallet.qrImageUrl || ''));
}

async function loadPaymentSettingsAdmin(force = false){
  if (!force && paymentSettingsState) return paymentSettingsState;
  const settings = await api('/settings/payment/admin');
  populatePaymentSettingsForm(settings);
  return settings;
}

function collectPaymentSettingsPayload(){
  const wallets = Array.from(document.querySelectorAll('#cryptoWalletSettings .wallet-settings-card')).map((_, index) => ({
    key: paymentSettingsState?.crypto?.wallets?.[index]?.key || `wallet_${index + 1}`,
    enabled: !!el(`ps_crypto_wallet_${index}_enabled`)?.checked,
    label: el(`ps_crypto_wallet_${index}_label`)?.value || '',
    coin: el(`ps_crypto_wallet_${index}_coin`)?.value || '',
    network: el(`ps_crypto_wallet_${index}_network`)?.value || '',
    address: el(`ps_crypto_wallet_${index}_address`)?.value || '',
    instructions: el(`ps_crypto_wallet_${index}_instructions`)?.value || '',
  }));

  return {
    site: {
      footerTagline: el('site_footerTagline').value,
      contactPhone: el('site_contactPhone').value,
      contactEmail: el('site_contactEmail').value,
      contactAddress: el('site_contactAddress').value,
      businessHours: el('site_businessHours').value,
      deliveryNote: el('site_deliveryNote').value,
      mapsUrl: el('site_mapsUrl').value,
      facebookUrl: el('site_facebookUrl').value,
      instagramUrl: el('site_instagramUrl').value,
      tiktokUrl: el('site_tiktokUrl').value,
      footerCopyright: el('site_footerCopyright').value,
      promoAlt: el('site_promoAlt').value,
    },
    businessName: el('ps_businessName').value,
    whatsappNumber: el('ps_whatsappNumber').value,
    orderPrefix: el('ps_orderPrefix').value,
    slipGuidance: el('ps_slipGuidance').value,
    paymentPolicyNote: el('ps_paymentPolicyNote').value,
    cod: {
      title: el('ps_cod_title').value,
      enabled: !!el('ps_cod_enabled').checked,
      maxOrderAmount: el('ps_cod_maxAmount').value,
      instructions: el('ps_cod_instructions').value,
    },
    bankTransfer: {
      title: el('ps_bank_title').value,
      bankName: el('ps_bank_bankName').value,
      accountName: el('ps_bank_accountName').value,
      accountNumber: el('ps_bank_accountNumber').value,
      branch: el('ps_bank_branch').value,
      enabled: !!el('ps_bank_enabled').checked,
      instructions: el('ps_bank_instructions').value,
    },
    lankaQr: {
      title: el('ps_lanka_title').value,
      merchantName: el('ps_lanka_merchantName').value,
      enabled: !!el('ps_lanka_enabled').checked,
      instructions: el('ps_lanka_instructions').value,
    },
    skrill: {
      title: el('ps_skrill_title').value,
      email: el('ps_skrill_email').value,
      customerId: el('ps_skrill_customerId').value,
      enabled: !!el('ps_skrill_enabled').checked,
      instructions: el('ps_skrill_instructions').value,
    },
    crypto: {
      title: el('ps_crypto_title').value,
      enabled: !!el('ps_crypto_enabled').checked,
      instructions: el('ps_crypto_instructions').value,
      wallets,
    },
  };
}

async function savePaymentSettings(event){
  event.preventDefault();
  try {
    el('paymentSettingsMsg').textContent = 'Saving payment settings...';
    const payload = collectPaymentSettingsPayload();
    const result = await submitPaymentSettingsRequest(payload);
    paymentSettingsState = result.settings;
    populatePaymentSettingsForm(result.settings);
    toast('Payment settings saved');

    const hasConfiguredCryptoWallet = !!result.settings?.crypto?.wallets?.some((wallet) => (wallet.address || '').trim());
    const cryptoNeedsWallet = !!result.settings?.crypto?.enabled && !hasConfiguredCryptoWallet;
    el('paymentSettingsMsg').textContent = cryptoNeedsWallet
      ? 'Saved successfully. Add at least one crypto wallet address to show Crypto at checkout.'
      : 'Saved successfully.';
  } catch (err) {
    el('paymentSettingsMsg').textContent = err.message;
    toast(err.message);
  }
}

function bindPaymentSettingsEvents(){
  const form = el('paymentSettingsForm');
  if (form && !form.dataset.bound){
    form.addEventListener('submit', savePaymentSettings);
    form.dataset.bound = '1';
  }
  const reloadBtn = el('reloadPaymentSettingsBtn');
  if (reloadBtn && !reloadBtn.dataset.bound){
    reloadBtn.addEventListener('click', async () => {
      try {
        el('paymentSettingsMsg').textContent = 'Reloading...';
        await loadPaymentSettingsAdmin(true);
        el('paymentSettingsMsg').textContent = 'Latest settings loaded.';
      } catch (err) {
        el('paymentSettingsMsg').textContent = err.message;
      }
    });
    reloadBtn.dataset.bound = '1';
  }
}

async function renderPaymentSettings(){
  bindPaymentSettingsEvents();
  try {
    await loadPaymentSettingsAdmin();
  } catch (err) {
    el('paymentSettingsMsg').textContent = err.message;
  }
}

// ===== Delivery Ops Extension =====
if (!pages.includes('deliveryOps')) {
  pages.splice(3, 0, 'deliveryOps');
}
cache.deliveryOps = cache.deliveryOps || { settings: null, dispatch: null };

const deliveryOpsState = {
  settings: null,
  dispatch: null,
  loadedDate: '',
};

function deliveryOpsTodayIso(){
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function setDeliveryOpsMsg(text){
  if (el('deliveryOpsMsg')) el('deliveryOpsMsg').textContent = text || '';
}

function deliveryOpsSplitLines(text){
  return String(text || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function deliveryOpsSortByOrder(list){
  return [...(Array.isArray(list) ? list : [])].sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0));
}

function deliveryOpsGetSettings(){
  return deliveryOpsState.settings || { timeSlots: [], zones: [], dispatchRules: {} };
}

function deliveryOpsGetDispatch(){
  return deliveryOpsState.dispatch || { summary: {}, team: [], orders: [] };
}

function deliveryOpsTimeSlotLabel(slotId){
  const slot = deliveryOpsGetSettings().timeSlots?.find((item) => item.id === slotId);
  return slot?.label || slotId || '';
}

function deliveryOpsZoneName(zoneId){
  const zone = deliveryOpsGetSettings().zones?.find((item) => item.id === zoneId);
  return zone?.name || zoneId || '';
}

function deliveryOpsWindowLabel(order){
  const scheduledDate = order.delivery?.scheduledDate ? formatDateOnly(order.delivery.scheduledDate) : '';
  const preferredDate = order.delivery?.preferredDate ? formatDateOnly(order.delivery.preferredDate) : '';
  if (scheduledDate) {
    return `${scheduledDate}${order.delivery?.scheduledTimeSlot ? ` • ${deliveryOpsTimeSlotLabel(order.delivery.scheduledTimeSlot)}` : ''}`;
  }
  if (preferredDate) {
    return `${preferredDate}${order.delivery?.preferredTimeSlot ? ` • ${deliveryOpsTimeSlotLabel(order.delivery.preferredTimeSlot)}` : ''}`;
  }
  if (order.delivery?.estimatedDate) {
    return `${formatDateOnly(order.delivery.estimatedDate)}${order.delivery?.estimatedTimeSlot ? ` • ${deliveryOpsTimeSlotLabel(order.delivery.estimatedTimeSlot)}` : ''}`;
  }
  return order.delivery?.leadTimeLabel || 'To be confirmed';
}

function deliveryBoyStatusBadge(staff){
  const status = staff?.availabilityStatus || 'available';
  const map = {
    available: 'good',
    busy: 'warn',
    off_duty: 'bad',
    leave: 'bad',
  };
  const text = staff?.isActive === false ? 'inactive' : status;
  const cls = staff?.isActive === false ? 'bad' : (map[status] || '');
  return `<span class="badge ${cls}">${escapeHtml(text)}</span>`;
}

function orderCodeLabel(order){
  return escapeHtml(order.orderCode || order._id || 'Order');
}

async function loadDeliveryOpsData(force = false){
  const dateInput = el('dispatchBoardDate');
  if (dateInput && !dateInput.value) dateInput.value = deliveryOpsTodayIso();
  const date = dateInput?.value || deliveryOpsTodayIso();
  if (!force && deliveryOpsState.settings && deliveryOpsState.dispatch && deliveryOpsState.loadedDate === date) {
    return;
  }
  setDeliveryOpsMsg('Loading delivery operations...');
  const dispatch = await api(`/delivery/admin/dispatch-board?date=${encodeURIComponent(date)}`);
  deliveryOpsState.dispatch = dispatch;
  deliveryOpsState.settings = dispatch.settings || deliveryOpsState.settings;
  deliveryOpsState.loadedDate = date;
  cache.deliveryOps = { settings: deliveryOpsState.settings, dispatch };
  populateDeliverySettingsForm(deliveryOpsState.settings);
  renderDeliveryOps();
  setDeliveryOpsMsg('');
}

function populateDeliverySettingsForm(settings){
  if (!settings) return;
  if (el('do_serviceTitle')) el('do_serviceTitle').value = settings.serviceTitle || '';
  if (el('do_serviceType')) el('do_serviceType').value = settings.serviceType || '';
  if (el('do_baseLocation')) el('do_baseLocation').value = settings.baseLocation || '';
  if (el('do_vehicleNote')) el('do_vehicleNote').value = settings.vehicleNote || '';
  if (el('do_minimumRecommendedOrder')) el('do_minimumRecommendedOrder').value = settings.minimumRecommendedOrder ?? 0;
  if (el('do_issueReportWindowHours')) el('do_issueReportWindowHours').value = settings.issueReportWindowHours ?? 24;
  if (el('do_sameDayCutoffHour')) el('do_sameDayCutoffHour').value = settings.sameDayCutoffHour ?? 12;
  if (el('do_sameDayCutoffLabel')) el('do_sameDayCutoffLabel').value = settings.sameDayCutoffLabel || '';
  if (el('do_contactBeforeArrival')) el('do_contactBeforeArrival').checked = !!settings.contactBeforeArrival;
  if (el('do_clusterByZone')) el('do_clusterByZone').checked = settings.dispatchRules?.clusterByZone !== false;
  if (el('do_autoSuggestRouteSequence')) el('do_autoSuggestRouteSequence').checked = settings.dispatchRules?.autoSuggestRouteSequence !== false;
  if (el('do_maxStopsPerDay')) el('do_maxStopsPerDay').value = settings.dispatchRules?.maxStopsPerBoyPerDay ?? 10;
  if (el('do_maxStopsPerSlot')) el('do_maxStopsPerSlot').value = settings.dispatchRules?.maxStopsPerBoyPerSlot ?? 4;
  if (el('do_policies')) el('do_policies').value = (settings.policies || []).join('\n');
}

function collectDeliverySettingsPayload(){
  const settings = deliveryOpsGetSettings();
  return {
    serviceTitle: el('do_serviceTitle')?.value || '',
    serviceType: el('do_serviceType')?.value || '',
    baseLocation: el('do_baseLocation')?.value || '',
    vehicleNote: el('do_vehicleNote')?.value || '',
    minimumRecommendedOrder: el('do_minimumRecommendedOrder')?.value || 0,
    issueReportWindowHours: el('do_issueReportWindowHours')?.value || 24,
    sameDayCutoffHour: el('do_sameDayCutoffHour')?.value || 12,
    sameDayCutoffLabel: el('do_sameDayCutoffLabel')?.value || '',
    contactBeforeArrival: !!el('do_contactBeforeArrival')?.checked,
    policies: deliveryOpsSplitLines(el('do_policies')?.value || ''),
    timeSlots: deliveryOpsSortByOrder(settings.timeSlots || []),
    zones: deliveryOpsSortByOrder(settings.zones || []),
    dispatchRules: {
      maxStopsPerBoyPerDay: el('do_maxStopsPerDay')?.value || 10,
      maxStopsPerBoyPerSlot: el('do_maxStopsPerSlot')?.value || 4,
      clusterByZone: !!el('do_clusterByZone')?.checked,
      autoSuggestRouteSequence: !!el('do_autoSuggestRouteSequence')?.checked,
    },
  };
}

async function persistDeliverySettings(payload, successMessage = 'Delivery settings saved'){
  setDeliveryOpsMsg('Saving delivery settings...');
  const result = await api('/delivery/admin/settings', { method: 'PUT', body: payload });
  deliveryOpsState.settings = result.settings;
  populateDeliverySettingsForm(result.settings);
  toast(successMessage);
  await loadDeliveryOpsData(true);
  setDeliveryOpsMsg(successMessage);
}

function renderDeliveryStats(){
  const settings = deliveryOpsGetSettings();
  const dispatch = deliveryOpsGetDispatch();
  if (el('deliveryStatZones')) el('deliveryStatZones').textContent = (settings.zones || []).filter((zone) => zone.isActive !== false).length;
  if (el('deliveryStatTeam')) el('deliveryStatTeam').textContent = (dispatch.team || []).length;
  if (el('deliveryStatUnassigned')) el('deliveryStatUnassigned').textContent = dispatch.summary?.unassigned ?? 0;
  if (el('deliveryStatOnRoute')) el('deliveryStatOnRoute').textContent = dispatch.summary?.outForDelivery ?? 0;
}

function renderDeliveryTimeSlots(){
  const tbody = el('deliveryTimeSlotsTable')?.querySelector('tbody');
  if (!tbody) return;
  tbody.innerHTML = '';
  const slots = deliveryOpsSortByOrder(deliveryOpsGetSettings().timeSlots || []);
  for (const slot of slots){
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${escapeHtml(slot.label || '')}</strong><div class="muted">${escapeHtml(slot.id || '')}</div></td>
      <td>${escapeHtml([slot.startTime, slot.endTime].filter(Boolean).join(' - ') || '-') }</td>
      <td>${slot.isActive !== false ? '<span class="badge good">active</span>' : '<span class="badge bad">hidden</span>'}</td>
      <td class="num">${Number(slot.sortOrder || 0)}</td>
      <td class="actions">
        <button class="btn small" data-act="edit">Edit</button>
        <button class="btn small" data-act="toggle">${slot.isActive !== false ? 'Hide' : 'Show'}</button>
      </td>
    `;
    tr.querySelector('[data-act="edit"]').onclick = () => openDeliverySlotModal(slot);
    tr.querySelector('[data-act="toggle"]').onclick = async () => {
      const payload = collectDeliverySettingsPayload();
      payload.timeSlots = payload.timeSlots.map((item) => item.id === slot.id ? { ...item, isActive: item.isActive === false } : item);
      await persistDeliverySettings(payload, 'Time slot updated');
    };
    tbody.appendChild(tr);
  }
}

function renderDeliveryZones(){
  const tbody = el('deliveryZonesAdminTable')?.querySelector('tbody');
  if (!tbody) return;
  tbody.innerHTML = '';
  const zones = deliveryOpsSortByOrder(deliveryOpsGetSettings().zones || []);
  for (const zone of zones){
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>
        <strong>${escapeHtml(zone.name || '')}</strong>
        <div class="muted">${escapeHtml(zone.id || '')}</div>
        ${zone.notes ? `<div class="muted">${escapeHtml(zone.notes)}</div>` : ''}
      </td>
      <td>${escapeHtml((zone.areas || []).join(', '))}</td>
      <td class="num">${fmtLKR(zone.fee || 0)}</td>
      <td>${escapeHtml(zone.leadTimeLabel || '-')}</td>
      <td>${zone.sameDayEligible ? '<span class="badge good">Yes</span>' : '<span class="badge">No</span>'}</td>
      <td class="actions">
        <button class="btn small" data-act="edit">Edit</button>
        <button class="btn small" data-act="toggle">${zone.isActive !== false ? 'Hide' : 'Show'}</button>
      </td>
    `;
    tr.querySelector('[data-act="edit"]').onclick = () => openDeliveryZoneModal(zone);
    tr.querySelector('[data-act="toggle"]').onclick = async () => {
      const payload = collectDeliverySettingsPayload();
      payload.zones = payload.zones.map((item) => item.id === zone.id ? { ...item, isActive: item.isActive === false } : item);
      await persistDeliverySettings(payload, 'Zone updated');
    };
    tbody.appendChild(tr);
  }
}

function renderDeliveryTeam(){
  const tbody = el('deliveryTeamTable')?.querySelector('tbody');
  if (!tbody) return;
  tbody.innerHTML = '';
  const team = deliveryOpsSortByOrder(deliveryOpsGetDispatch().team || []);
  for (const staff of team){
    const zoneNames = (staff.coverageZoneIds || []).map(deliveryOpsZoneName).filter(Boolean);
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>
        <strong>${escapeHtml(staff.fullName || '')}</strong>
        <div class="muted">@${escapeHtml(staff.username || '')}</div>
        ${staff.lastLoginAt ? `<div class="muted">Last login: ${formatDate(staff.lastLoginAt)}</div>` : '<div class="muted">Never logged in yet</div>'}
      </td>
      <td>
        <div>${escapeHtml(staff.phone || '-')}</div>
        <div class="muted">${escapeHtml(staff.vehicleType || '-')} ${staff.vehicleNumber ? `• ${escapeHtml(staff.vehicleNumber)}` : ''}</div>
      </td>
      <td>
        <div>${zoneNames.length ? escapeHtml(zoneNames.join(', ')) : '<span class="muted">All active zones</span>'}</div>
        ${staff.preferredTimeSlotIds?.length ? `<div class="muted">Prefers: ${escapeHtml(staff.preferredTimeSlotIds.map(deliveryOpsTimeSlotLabel).join(', '))}</div>` : ''}
      </td>
      <td>
        <div class="delivery-inline-list">
          <span class="delivery-workload-pill">Today ${staff.currentWorkload?.assignedToday ?? 0}/${staff.maxStopsPerDay || 0}</span>
          <span class="delivery-workload-pill">Open ${staff.currentWorkload?.openAssigned ?? 0}</span>
        </div>
      </td>
      <td>${deliveryBoyStatusBadge(staff)}</td>
      <td class="actions">
        <button class="btn small" data-act="edit">Edit</button>
        <button class="btn small" data-act="disable">${staff.isActive === false ? 'Disabled' : 'Deactivate'}</button>
      </td>
    `;
    tr.querySelector('[data-act="edit"]').onclick = () => openDeliveryBoyModal(staff);
    tr.querySelector('[data-act="disable"]').onclick = () => deactivateDeliveryBoy(staff);
    tbody.appendChild(tr);
  }
}

function renderDispatchBoard(){
  const tbody = el('dispatchBoardTable')?.querySelector('tbody');
  if (!tbody) return;
  tbody.innerHTML = '';
  const orders = deliveryOpsGetDispatch().orders || [];
  for (const order of orders){
    const top = order.recommendedDrivers?.[0];
    const assignedLabel = order.delivery?.deliveryBoyName
      ? `${escapeHtml(order.delivery.deliveryBoyName)}${order.delivery?.routeSequence ? ` • Stop ${Number(order.delivery.routeSequence)}` : ''}`
      : '<span class="muted">Unassigned</span>';
    const recommendationHtml = top
      ? `<div class="delivery-recommendation-stack"><strong>${escapeHtml(top.staff?.fullName || '')}</strong><div class="mini">Score ${Math.round(top.score || 0)}</div><div class="mini">${escapeHtml((top.reasons || []).slice(0, 2).join(' • '))}</div></div>`
      : '<span class="muted">No suggestion</span>';
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>
        <strong>${orderCodeLabel(order)}</strong>
        <div class="muted">${formatDate(order.createdAt)}</div>
        <div class="muted">LKR ${fmtLKR(order.total || 0)}</div>
      </td>
      <td>
        <strong>${escapeHtml(order.customer?.name || '')}</strong>
        <div class="muted">${escapeHtml(order.customer?.phone || '')}</div>
        <div class="muted">${escapeHtml(order.customer?.address || '')}</div>
      </td>
      <td>
        <div><strong>${escapeHtml(order.delivery?.zoneName || '-')}</strong></div>
        <div class="muted">${escapeHtml(deliveryOpsWindowLabel(order))}</div>
      </td>
      <td>${statusBadge(order.status)}</td>
      <td>${assignedLabel}</td>
      <td>${recommendationHtml}</td>
      <td class="actions">
        <div class="delivery-order-actions">
          <button class="btn small" data-act="view">Open</button>
          <button class="btn small" data-act="assign">${top ? 'Assign best' : 'Manage'}</button>
        </div>
      </td>
    `;
    tr.querySelector('[data-act="view"]').onclick = () => openOrderDetails(order);
    tr.querySelector('[data-act="assign"]').onclick = () => {
      if (top?.staff?._id) {
        assignDriverToOrder(order, top.staff._id, top.suggestedRouteSequence || 1);
      } else {
        openOrderStatusModal(order);
      }
    };
    tbody.appendChild(tr);
  }
}

function renderDeliveryOps(){
  renderDeliveryStats();
  renderDeliveryTimeSlots();
  renderDeliveryZones();
  renderDispatchBoard();
  renderDeliveryTeam();
}

async function saveDeliverySettings(event){
  event.preventDefault();
  try {
    const payload = collectDeliverySettingsPayload();
    await persistDeliverySettings(payload, 'Delivery settings saved');
  } catch (err) {
    setDeliveryOpsMsg(err.message);
    toast(err.message);
  }
}

function openDeliverySlotModal(slot = null){
  openModal(
    slot ? 'Edit time slot' : 'Add time slot',
    `
      <div class="grid two">
        <label><span>Slot ID</span><input id="ds_id" value="${escapeAttr(slot?.id || '')}" placeholder="morning"></label>
        <label><span>Label</span><input id="ds_label" value="${escapeAttr(slot?.label || '')}" placeholder="Morning (9:00 AM - 12:00 PM)"></label>
      </div>
      <div class="grid two">
        <label><span>Start time</span><input id="ds_start" value="${escapeAttr(slot?.startTime || '')}" placeholder="09:00"></label>
        <label><span>End time</span><input id="ds_end" value="${escapeAttr(slot?.endTime || '')}" placeholder="12:00"></label>
      </div>
      <div class="grid two">
        <label><span>Sort order</span><input id="ds_sort" type="number" min="1" step="1" value="${escapeAttr(slot?.sortOrder || (deliveryOpsGetSettings().timeSlots?.length || 0) + 1)}"></label>
        <label><input id="ds_active" type="checkbox" ${slot?.isActive === false ? '' : 'checked'}> <span class="muted">Show this slot on checkout</span></label>
      </div>
    `,
    `
      <button class="btn" id="cancelSlot">Cancel</button>
      <button class="btn primary" id="saveSlot">Save</button>
    `
  );
  el('cancelSlot').onclick = closeModal;
  el('saveSlot').onclick = async () => {
    try {
      const id = (el('ds_id').value || el('ds_label').value || 'slot').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
      if (!id || !el('ds_label').value.trim()) throw new Error('Slot ID and label are required');
      const payload = collectDeliverySettingsPayload();
      const nextSlot = {
        id,
        label: el('ds_label').value.trim(),
        startTime: el('ds_start').value.trim(),
        endTime: el('ds_end').value.trim(),
        sortOrder: Number(el('ds_sort').value || 0),
        isActive: !!el('ds_active').checked,
      };
      const list = deliveryOpsSortByOrder(payload.timeSlots.filter((item) => item.id !== (slot?.id || id)).concat(nextSlot));
      payload.timeSlots = list;
      await persistDeliverySettings(payload, slot ? 'Time slot updated' : 'Time slot added');
      closeModal();
    } catch (err) {
      toast(err.message);
    }
  };
}

function openDeliveryZoneModal(zone = null){
  const slotOptions = deliveryOpsSortByOrder(deliveryOpsGetSettings().timeSlots || [])
    .map((slot) => `<option value="${slot.id}" ${slot.id === (zone?.defaultTimeSlot || '') ? 'selected' : ''}>${slot.label}</option>`)
    .join('');
  openModal(
    zone ? 'Edit delivery zone' : 'Add delivery zone',
    `
      <div class="grid two">
        <label><span>Zone ID</span><input id="dz_id" value="${escapeAttr(zone?.id || '')}" placeholder="zone_battaramulla"></label>
        <label><span>Zone name</span><input id="dz_name" value="${escapeAttr(zone?.name || '')}" placeholder="Zone A - Battaramulla / Pelawatta"></label>
      </div>
      <label><span>Areas (comma separated)</span><textarea id="dz_areas" class="compact-textarea">${escapeHtml((zone?.areas || []).join(', '))}</textarea></label>
      <div class="grid two">
        <label><span>Delivery fee (LKR)</span><input id="dz_fee" type="number" min="0" step="1" value="${escapeAttr(zone?.fee || 0)}"></label>
        <label><span>Lead time label</span><input id="dz_lead" value="${escapeAttr(zone?.leadTimeLabel || '')}" placeholder="Same day or next day"></label>
      </div>
      <div class="grid two">
        <label><span>Default lead days</span><input id="dz_days" type="number" min="0" step="1" value="${escapeAttr(zone?.defaultLeadDays ?? 1)}"></label>
        <label><span>Default time slot</span><select id="dz_slot">${slotOptions}</select></label>
      </div>
      <div class="grid two">
        <label><input id="dz_sameDay" type="checkbox" ${zone?.sameDayEligible ? 'checked' : ''}> <span class="muted">Allow same-day delivery in this zone</span></label>
        <label><span>Zone-specific cutoff hour (optional)</span><input id="dz_cutoff" type="number" min="0" max="23" step="1" value="${escapeAttr(zone?.sameDayCutoffHour ?? '')}"></label>
      </div>
      <div class="grid two">
        <label><span>Sort order</span><input id="dz_sort" type="number" min="1" step="1" value="${escapeAttr(zone?.sortOrder || (deliveryOpsGetSettings().zones?.length || 0) + 1)}"></label>
        <label><input id="dz_active" type="checkbox" ${zone?.isActive === false ? '' : 'checked'}> <span class="muted">Show this zone on delivery page and checkout</span></label>
      </div>
      <label><span>Internal note (optional)</span><input id="dz_notes" value="${escapeAttr(zone?.notes || '')}" placeholder="Useful for dispatch team only"></label>
    `,
    `
      <button class="btn" id="cancelZone">Cancel</button>
      <button class="btn primary" id="saveZone">Save</button>
    `,
    { size: 'wide' }
  );
  el('cancelZone').onclick = closeModal;
  el('saveZone').onclick = async () => {
    try {
      const generatedId = (el('dz_id').value || el('dz_name').value || 'zone')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');
      if (!generatedId || !el('dz_name').value.trim()) throw new Error('Zone ID and name are required');
      const payload = collectDeliverySettingsPayload();
      const nextZone = {
        id: generatedId,
        name: el('dz_name').value.trim(),
        areas: el('dz_areas').value.split(',').map((item) => item.trim()).filter(Boolean),
        fee: Number(el('dz_fee').value || 0),
        leadTimeLabel: el('dz_lead').value.trim(),
        defaultLeadDays: Number(el('dz_days').value || 0),
        sameDayEligible: !!el('dz_sameDay').checked,
        sameDayCutoffHour: el('dz_cutoff').value === '' ? null : Number(el('dz_cutoff').value),
        defaultTimeSlot: el('dz_slot').value,
        sortOrder: Number(el('dz_sort').value || 0),
        isActive: !!el('dz_active').checked,
        notes: el('dz_notes').value.trim(),
      };
      payload.zones = deliveryOpsSortByOrder(payload.zones.filter((item) => item.id !== (zone?.id || generatedId)).concat(nextZone));
      await persistDeliverySettings(payload, zone ? 'Zone updated' : 'Zone added');
      closeModal();
    } catch (err) {
      toast(err.message);
    }
  };
}

function deliveryMultiCheckboxHtml(items, selectedIds, idPrefix, labelFn){
  return items.map((item) => `
    <label class="delivery-workload-pill" style="display:flex; align-items:center; gap:.45rem; padding:.45rem .65rem; cursor:pointer;">
      <input type="checkbox" value="${escapeAttr(item.id)}" id="${escapeAttr(idPrefix)}_${escapeAttr(item.id)}" ${selectedIds.includes(item.id) ? 'checked' : ''}>
      <span>${escapeHtml(labelFn(item))}</span>
    </label>
  `).join('');
}

function readCheckedValues(prefix){
  return Array.from(document.querySelectorAll(`[id^="${prefix}_"]:checked`)).map((node) => node.value);
}

function openDeliveryBoyModal(staff = null){
  const settings = deliveryOpsGetSettings();
  const zones = deliveryOpsSortByOrder(settings.zones || []);
  const slots = deliveryOpsSortByOrder(settings.timeSlots || []);
  openModal(
    staff ? 'Edit delivery boy' : 'Add delivery boy',
    `
      <div class="grid two">
        <label><span>Full name</span><input id="db_fullName" value="${escapeAttr(staff?.fullName || '')}" placeholder="Kamal Perera"></label>
        <label><span>Username</span><input id="db_username" value="${escapeAttr(staff?.username || '')}" placeholder="kamal"></label>
      </div>
      <div class="grid two">
        <label><span>Phone</span><input id="db_phone" value="${escapeAttr(staff?.phone || '')}" placeholder="07X XXX XXXX"></label>
        <label><span>Email (optional)</span><input id="db_email" value="${escapeAttr(staff?.email || '')}" placeholder="kamal@example.com"></label>
      </div>
      <div class="grid two">
        <label><span>Password ${staff ? '(leave blank to keep current password)' : ''}</span><input id="db_password" type="password" placeholder="Temporary password"></label>
        <label><span>Availability</span>
          <select id="db_availability">
            ${['available','busy','off_duty','leave'].map((status) => `<option value="${status}" ${status === (staff?.availabilityStatus || 'available') ? 'selected' : ''}>${status}</option>`).join('')}
          </select>
        </label>
      </div>
      <div class="grid two">
        <label><span>Vehicle type</span><input id="db_vehicleType" value="${escapeAttr(staff?.vehicleType || 'Own vehicle')}"></label>
        <label><span>Vehicle number</span><input id="db_vehicleNumber" value="${escapeAttr(staff?.vehicleNumber || '')}" placeholder="CAB-1234"></label>
      </div>
      <div class="grid two">
        <label><span>Max stops per day</span><input id="db_maxStopsPerDay" type="number" min="1" step="1" value="${escapeAttr(staff?.maxStopsPerDay || 10)}"></label>
        <label><span>Max stops per slot</span><input id="db_maxStopsPerSlot" type="number" min="1" step="1" value="${escapeAttr(staff?.maxStopsPerSlot || 4)}"></label>
      </div>
      <div class="grid two">
        <label><span>Sort order</span><input id="db_sortOrder" type="number" min="0" step="1" value="${escapeAttr(staff?.sortOrder || 0)}"></label>
        <label><input id="db_isActive" type="checkbox" ${staff?.isActive === false ? '' : 'checked'}> <span class="muted">Active rider account</span></label>
      </div>
      <label><span>Coverage zones</span>
        <div class="delivery-inline-list">${deliveryMultiCheckboxHtml(zones, staff?.coverageZoneIds || [], 'db_zone', (item) => item.name)}</div>
      </label>
      <label><span>Preferred time slots</span>
        <div class="delivery-inline-list">${deliveryMultiCheckboxHtml(slots, staff?.preferredTimeSlotIds || [], 'db_slot', (item) => item.label)}</div>
      </label>
      <label><span>Notes (internal)</span><textarea id="db_notes" class="compact-textarea">${escapeHtml(staff?.notes || '')}</textarea></label>
    `,
    `
      <button class="btn" id="cancelDeliveryBoy">Cancel</button>
      <button class="btn primary" id="saveDeliveryBoy">Save</button>
    `,
    { size: 'wide' }
  );
  el('cancelDeliveryBoy').onclick = closeModal;
  el('saveDeliveryBoy').onclick = async () => {
    try {
      const body = {
        fullName: el('db_fullName').value.trim(),
        username: el('db_username').value.trim(),
        phone: el('db_phone').value.trim(),
        email: el('db_email').value.trim(),
        password: el('db_password').value,
        availabilityStatus: el('db_availability').value,
        vehicleType: el('db_vehicleType').value.trim(),
        vehicleNumber: el('db_vehicleNumber').value.trim(),
        maxStopsPerDay: el('db_maxStopsPerDay').value,
        maxStopsPerSlot: el('db_maxStopsPerSlot').value,
        sortOrder: el('db_sortOrder').value,
        isActive: !!el('db_isActive').checked,
        coverageZoneIds: readCheckedValues('db_zone'),
        preferredTimeSlotIds: readCheckedValues('db_slot'),
        notes: el('db_notes').value.trim(),
      };
      if (!body.fullName || !body.username || !body.phone) throw new Error('Full name, username, and phone are required');
      if (!staff && !body.password) throw new Error('Temporary password is required for a new delivery boy');
      if (staff) {
        await api(`/delivery/admin/staff/${staff._id}`, { method: 'PUT', body });
        toast('Delivery boy updated');
      } else {
        await api('/delivery/admin/staff', { method: 'POST', body });
        toast('Delivery boy added');
      }
      closeModal();
      await loadDeliveryOpsData(true);
    } catch (err) {
      toast(err.message);
    }
  };
}

async function deactivateDeliveryBoy(staff){
  if (!staff || !staff._id) return;
  if (!confirm(`Deactivate ${staff.fullName}?`)) return;
  try {
    await api(`/delivery/admin/staff/${staff._id}`, { method: 'DELETE' });
    toast('Delivery boy deactivated');
    await loadDeliveryOpsData(true);
  } catch (err) {
    toast(err.message);
  }
}

async function fetchDriverRecommendations(orderId){
  const res = await api(`/delivery/admin/orders/${orderId}/recommendations`);
  return res.recommendations || [];
}

async function assignDriverToOrder(order, deliveryBoyId, suggestedRouteSequence = 0){
  try {
    const fallbackStatus = ['pending','confirmed','preparing'].includes(order.status) ? 'scheduled' : order.status;
    await api(`/orders/${order._id}`, {
      method: 'PATCH',
      body: {
        status: fallbackStatus,
        delivery: {
          deliveryBoyId,
          scheduledDate: order.delivery?.scheduledDate || order.delivery?.preferredDate || order.delivery?.estimatedDate || deliveryOpsState.loadedDate || deliveryOpsTodayIso(),
          scheduledTimeSlot: order.delivery?.scheduledTimeSlot || order.delivery?.preferredTimeSlot || order.delivery?.estimatedTimeSlot || '',
          routeSequence: suggestedRouteSequence || order.delivery?.routeSequence || 1,
        },
      },
    });
    toast('Driver assigned');
    await refreshAll();
    await loadDeliveryOpsData(true);
  } catch (err) {
    toast(err.message);
  }
}

renderOrders = function(){
  const q = el('globalSearch').value.trim();
  const tbody = el('ordersTable').querySelector('tbody');
  tbody.innerHTML = '';
  const list = cache.orders.filter((o) => orderMatches(o, q));
  for (const o of list){
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>
        <strong>${orderCodeLabel(o)}</strong>
        <div class="muted">${formatDate(o.createdAt)}</div>
      </td>
      <td>
        <strong>${escapeHtml(o.customer?.name || '')}</strong>
        <div class="muted">${escapeHtml(o.customer?.address || '')}</div>
        <div class="muted">${escapeHtml(o.delivery?.zoneName || '')}</div>
        ${o.delivery?.deliveryBoyName ? `<div class="muted">Assigned: ${escapeHtml(o.delivery.deliveryBoyName)}</div>` : ''}
      </td>
      <td>
        <div>${escapeHtml(o.customer?.phone || '')}</div>
        <div class="muted">${escapeHtml(deliveryOpsWindowLabel(o))}</div>
      </td>
      <td class="num">${fmtLKR(o.total)}</td>
      <td>${statusBadge(o.status)}</td>
      <td class="actions">
        <button class="btn small" data-act="view">View</button>
        <button class="btn small" data-act="status">Update</button>
      </td>`;
    tr.querySelector('[data-act="view"]').addEventListener('click', () => openOrderDetails(o));
    tr.querySelector('[data-act="status"]').addEventListener('click', () => openOrderStatusModal(o));
    tbody.appendChild(tr);
  }
};

function renderDriverActivityTimeline(logs){
  const list = Array.isArray(logs) ? [...logs].sort((a, b) => new Date(b.at || 0) - new Date(a.at || 0)) : [];
  if (!list.length) return `<div class="muted">No rider activities logged yet.</div>`;
  return `
    <div class="delivery-activity-log">
      ${list.map((item) => `
        <div class="delivery-activity-item">
          <div class="delivery-activity-top">
            <strong>${escapeHtml(item.label || item.key || 'Update')}</strong>
            <span class="muted">${formatDate(item.at)}</span>
          </div>
          ${item.note ? `<div class="muted">${escapeHtml(item.note)}</div>` : ''}
          <div class="delivery-inline-list" style="margin-top:.45rem;">
            ${item.loggedByName ? `<span class="delivery-workload-pill">By ${escapeHtml(item.loggedByName)}</span>` : ''}
            ${item.recipientName ? `<span class="delivery-workload-pill">Recipient ${escapeHtml(item.recipientName)}</span>` : ''}
            ${item.cashCollected ? `<span class="delivery-workload-pill">Cash LKR ${fmtLKR(item.cashCollected)}</span>` : ''}
            ${item.issueCode ? `<span class="delivery-workload-pill">Issue ${escapeHtml(item.issueCode)}</span>` : ''}
            ${item.proofPhotoUrl ? `<a class="btn small" href="${escapeHtml(item.proofPhotoUrl)}" target="_blank" rel="noopener">Proof</a>` : ''}
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

openOrderDetails = async function(o){
  try{
    const full = await api(`/orders/${o._id}`);
    el('orderDetailsMeta').textContent = `${full.orderCode || full._id} • ${formatDate(full.createdAt)} • ${full.status}`;
    el('orderDetailsBody').innerHTML = `
      <div class="grid two">
        <div class="card inner">
          <h4>Customer</h4>
          <div><strong>${escapeHtml(full.customer?.name || '')}</strong></div>
          <div class="muted">${escapeHtml(full.customer?.phone || '')}</div>
          <div class="muted">${escapeHtml(full.customer?.email || '')}</div>
          <div style="margin-top:.5rem">${escapeHtml(full.customer?.address || '')}</div>
        </div>
        <div class="card inner">
          <h4>Order</h4>
          <div>Order code: <strong>${orderCodeLabel(full)}</strong></div>
          <div>Subtotal: <strong>LKR ${fmtLKR(full.subtotal)}</strong></div>
          <div>Delivery Fee: <strong>LKR ${fmtLKR(full.delivery?.fee)}</strong></div>
          <div>Total: <strong>LKR ${fmtLKR(full.total)}</strong></div>
          <div class="muted">Status: ${escapeHtml(full.status || '')}</div>
          <div class="muted">Payment: ${escapeHtml(full.payment?.methodLabel || full.paymentMethod || 'COD')}</div>
          <div class="muted">Payment status: ${paymentStatusBadge(full.payment?.status)}</div>
          ${full.notes ? `<div class="muted">Customer note: ${escapeHtml(full.notes)}</div>` : ''}
          ${full.adminNote ? `<div class="muted">Visible update: ${escapeHtml(full.adminNote)}</div>` : ''}
          ${full.payment?.slipUrl ? `<div style="margin-top:.6rem;"><a class="btn small" href="${escapeHtml(full.payment.slipUrl)}" target="_blank" rel="noopener">Open payment proof</a></div>` : ''}
        </div>
      </div>

      <div class="grid two" style="margin-top:1rem;">
        <div class="card inner">
          <h4>Delivery details</h4>
          <div><b>Zone:</b> <span class="muted">${escapeHtml(full.delivery?.zoneName || '')}</span></div>
          <div><b>Requested window:</b> <span class="muted">${escapeHtml(deliveryOpsWindowLabel(full))}</span></div>
          ${full.delivery?.scheduledDate ? `<div><b>Scheduled:</b> <span class="muted">${escapeHtml(formatDateOnly(full.delivery.scheduledDate))}${full.delivery?.scheduledTimeSlot ? ` • ${escapeHtml(deliveryOpsTimeSlotLabel(full.delivery.scheduledTimeSlot))}` : ''}</span></div>` : ''}
          <div><b>Receiver:</b> <span class="muted">${escapeHtml(full.delivery?.recipientName || full.customer?.name || '')}${full.delivery?.recipientPhone ? ` • ${escapeHtml(full.delivery.recipientPhone)}` : ''}</span></div>
          ${full.delivery?.landmark ? `<div><b>Landmark:</b> <span class="muted">${escapeHtml(full.delivery.landmark)}</span></div>` : ''}
          ${full.delivery?.instructions ? `<div style="margin-top:.5rem"><b>Instructions:</b><div class="muted">${escapeHtml(full.delivery.instructions)}</div></div>` : ''}
        </div>
        <div class="card inner">
          <h4>Dispatch</h4>
          <div><b>Delivery boy:</b> <span class="muted">${escapeHtml(full.delivery?.deliveryBoyName || '-')}</span></div>
          <div><b>Phone:</b> <span class="muted">${escapeHtml(full.delivery?.deliveryBoyPhone || '-')}</span></div>
          <div><b>Username:</b> <span class="muted">${escapeHtml(full.delivery?.deliveryBoyUsername || '-')}</span></div>
          <div><b>Vehicle:</b> <span class="muted">${escapeHtml(full.delivery?.vehicleNumber || '-')}</span></div>
          <div><b>Route stop:</b> <span class="muted">${full.delivery?.routeSequence ? `#${full.delivery.routeSequence}` : '-'}</span></div>
          <div><b>Last rider update:</b> <span class="muted">${escapeHtml(full.delivery?.lastActivityLabel || '-')}</span></div>
          ${full.delivery?.deliveryProofUrl ? `<div style="margin-top:.6rem;"><a class="btn small" href="${escapeHtml(full.delivery.deliveryProofUrl)}" target="_blank" rel="noopener">Open delivery proof</a></div>` : ''}
        </div>
      </div>

      <div class="card inner" style="margin-top:1rem;">
        <h4>Items</h4>
        <div class="table-wrap">
          <table class="table" style="min-width:600px">
            <thead><tr><th>Plant</th><th class="num">Price</th><th class="num">Qty</th><th class="num">Subtotal</th></tr></thead>
            <tbody>
              ${(full.items||[]).map((it) => `
                <tr>
                  <td>${escapeHtml(it.name || it.plant?.name || 'Item')}</td>
                  <td class="num">${fmtLKR(it.price)}</td>
                  <td class="num">${it.qty}</td>
                  <td class="num">${fmtLKR((it.price||0)*(it.qty||1))}</td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <div class="card inner" style="margin-top:1rem;">
        <h4>Rider Activity Log</h4>
        ${renderDriverActivityTimeline(full.delivery?.activityLogs)}
      </div>

      <div class="card inner" style="margin-top:1rem;">
        <h4>Status history</h4>
        ${renderOrderTimeline(full.statusTimeline)}
      </div>
    `;
    el('orderDetails').style.display = 'block';
    el('closeOrderDetails').onclick = () => (el('orderDetails').style.display = 'none');
    window.scrollTo({ top: document.body.scrollHeight, behavior:'smooth' });
  }catch(err){ toast(err.message); }
};

openOrderStatusModal = async function(o){
  try {
    const [full, recommendations] = await Promise.all([
      api(`/orders/${o._id}`),
      fetchDriverRecommendations(o._id).catch(() => []),
    ]);
    const delivery = full.delivery || {};
    const payment = full.payment || {};
    const scheduledDate = delivery.scheduledDate || delivery.preferredDate || delivery.estimatedDate || deliveryOpsState.loadedDate || deliveryOpsTodayIso();
    const scheduledTimeSlot = delivery.scheduledTimeSlot || delivery.preferredTimeSlot || delivery.estimatedTimeSlot || (deliveryOpsGetSettings().timeSlots?.[0]?.id || '');
    const teamOptions = recommendations.length
      ? recommendations
      : (deliveryOpsGetDispatch().team || []).map((staff) => ({
          staff,
          score: 0,
          recommended: true,
          suggestedRouteSequence: staff.currentWorkload?.nextRouteSequence || 1,
          reasons: [],
        }));

    const deliverySelectOptions = ['<option value="">Unassigned</option>'].concat(teamOptions.map((item) => {
      const selected = item.staff?._id === (delivery.deliveryBoyId || '') ? 'selected' : '';
      const scoreLabel = item.score ? ` • score ${Math.round(item.score)}` : '';
      return `<option value="${item.staff?._id}" ${selected}>${escapeHtml(item.staff?.fullName || '')}${scoreLabel}</option>`;
    })).join('');

    const best = teamOptions[0];
    const defaultSequence = delivery.routeSequence || best?.suggestedRouteSequence || 1;
    const slipHtml = payment.slipUrl
      ? `<a class="btn small" href="${escapeHtml(payment.slipUrl)}" target="_blank" rel="noopener">Payment Proof</a>`
      : '';

    openModal(
      'Update order',
      `
        <div class="order-update-layout">
          <div class="modal-kpi-grid">
            <div class="modal-kpi"><span>Order</span><strong>${orderCodeLabel(full)}</strong></div>
            <div class="modal-kpi"><span>Total</span><strong>LKR ${fmtLKR(full.total || 0)}</strong></div>
            <div class="modal-kpi"><span>Zone</span><strong>${escapeHtml(delivery.zoneName || '-')}</strong></div>
            <div class="modal-kpi"><span>Payment</span><strong>${escapeHtml(payment.methodLabel || 'Cash on Delivery')}</strong></div>
          </div>

          <div class="modal-section">
            <div class="modal-section-head">
              <div>
                <h4>Order status & scheduling</h4>
                <p class="muted">Use scheduled date/slot + rider assignment so the dispatch board stays balanced.</p>
              </div>
            </div>
            <div class="grid two order-edit-grid">
              <label><span>Status</span>
                <select id="o_status">
                  ${ORDER_STATUSES.map((s) => `<option value="${s}" ${full.status===s ? 'selected' : ''}>${s}</option>`).join('')}
                </select>
              </label>
              <label><span>Delivery Zone</span><input value="${escapeAttr(delivery.zoneName || '')}" disabled></label>
            </div>
            <div class="grid two order-edit-grid">
              <label><span>Scheduled Date</span><input id="o_sched_date" type="date" value="${escapeAttr(scheduledDate)}"></label>
              <label><span>Scheduled Time Slot</span>
                <select id="o_sched_slot">
                  ${(deliveryOpsGetSettings().timeSlots || []).map((slot) => `<option value="${slot.id}" ${scheduledTimeSlot === slot.id ? 'selected' : ''}>${slot.label}</option>`).join('')}
                </select>
              </label>
            </div>
          </div>

          <div class="modal-section">
            <div class="modal-section-head">
              <div>
                <h4>Rider assignment</h4>
                <p class="muted">Recommendations are ranked by zone coverage, workload, and slot capacity.</p>
              </div>
            </div>
            <div class="grid two order-edit-grid">
              <label><span>Delivery boy</span>
                <select id="o_delivery_boy">${deliverySelectOptions}</select>
              </label>
              <label><span>Route sequence</span><input id="o_route_sequence" type="number" min="1" step="1" value="${escapeAttr(defaultSequence)}"></label>
            </div>
            <div id="o_recommendation_hint" class="delivery-modal-hint muted">
              ${best ? `Best suggestion: ${escapeHtml(best.staff?.fullName || '')}${best.reasons?.length ? ` • ${escapeHtml(best.reasons.slice(0, 2).join(' • '))}` : ''}` : 'No recommendation available yet.'}
            </div>
          </div>

          <div class="modal-section">
            <div class="modal-section-head">
              <div>
                <h4>Payment review</h4>
                <p class="muted">Verify prepaid orders before dispatching them.</p>
              </div>
              ${slipHtml}
            </div>
            <div class="grid two order-edit-grid">
              <label><span>Payment status</span>
                <select id="o_payment_status">
                  ${['cash_on_delivery','proof_uploaded','under_review','verified','rejected','awaiting_payment'].map((status) => `<option value="${status}" ${payment.status === status ? 'selected' : ''}>${paymentStatusMeta(status).label}</option>`).join('')}
                </select>
              </label>
              <label><span>Amount received</span><input id="o_payment_amount" type="number" min="0" step="0.01" value="${escapeAttr(payment.amountReceived || 0)}"></label>
            </div>
            <div class="grid two order-edit-grid">
              <label><span>Payer name</span><input id="o_payment_payer" value="${escapeAttr(payment.payerName || '')}"></label>
              <label><span>Reference / hash</span><input id="o_payment_reference" value="${escapeAttr(payment.reference || '')}"></label>
            </div>
            <label><span>Payment note (internal + timeline)</span><textarea id="o_payment_note" class="compact-textarea">${escapeHtml(payment.verificationNote || '')}</textarea></label>
          </div>

          <div class="grid two order-edit-grid">
            <label><span>Customer note (read only)</span><textarea disabled class="compact-textarea">${escapeHtml(full.notes || '')}</textarea></label>
            <label><span>Tracking note / customer update</span><textarea id="o_admin_note" class="compact-textarea">${escapeHtml(full.adminNote || '')}</textarea></label>
          </div>
        </div>
      `,
      `
        <button class="btn" id="cancelOrder">Cancel</button>
        <button class="btn primary" id="saveOrder">Save</button>
      `,
      { size: 'wide', variant: 'order-update' }
    );
    el('cancelOrder').onclick = closeModal;
    el('saveOrder').onclick = async () => {
      try {
        await api(`/orders/${full._id}`, {
          method: 'PATCH',
          body: {
            status: el('o_status').value,
            adminNote: el('o_admin_note').value,
            payment: {
              status: el('o_payment_status').value,
              amountReceived: el('o_payment_amount').value,
              payerName: el('o_payment_payer').value,
              reference: el('o_payment_reference').value,
              verificationNote: el('o_payment_note').value,
            },
            delivery: {
              deliveryBoyId: el('o_delivery_boy').value,
              scheduledDate: el('o_sched_date').value,
              scheduledTimeSlot: el('o_sched_slot').value,
              routeSequence: el('o_route_sequence').value,
            }
          }
        });
        toast('Order updated');
        closeModal();
        const status = el('orderStatusFilter').value;
        cache.orders = await api(`/orders${status ? `?status=${encodeURIComponent(status)}` : ''}`);
        await loadDeliveryOpsData(true);
        renderStats();
        renderOrders();
      } catch (err) {
        toast(err.message);
      }
    };
  } catch (err) {
    toast(err.message);
  }
};

setActivePage = function(name){
  for (const p of pages){
    const pageEl = el(`page-${p}`);
    if (pageEl) pageEl.style.display = (p === name) ? 'block' : 'none';
  }
  document.querySelectorAll('.nav-item').forEach((b) => {
    b.classList.toggle('active', b.dataset.page === name);
  });
  const titles = {
    dashboard: 'Dashboard',
    plants: 'Plants',
    orders: 'Orders',
    deliveryOps: 'Delivery Ops',
    landscapingPackages: 'Landscaping Packages',
    landscapingRequests: 'Landscaping Requests',
    inquiries: 'Inquiries',
    reviews: 'Reviews',
    settings: 'Settings',
  };
  el('pageTitle').textContent = titles[name] || (name.charAt(0).toUpperCase() + name.slice(1));
  const subtitle = {
    dashboard: 'Overview and quick actions',
    plants: 'Manage products',
    orders: 'Manage customer orders',
    deliveryOps: 'Zones, dispatching, and delivery boy portal management',
    landscapingPackages: 'Manage packages shown on the website',
    landscapingRequests: 'View and update customer requests',
    inquiries: 'Manage contact messages',
    reviews: 'Manage customer reviews',
    settings: 'Website customization, contact details & payment options',
  }[name] || '';
  el('pageSubtitle').textContent = subtitle;
};

renderCurrentPage = async function(){
  const active = document.querySelector('.nav-item.active')?.dataset.page || 'dashboard';
  if (active === 'dashboard') renderStats();
  if (active === 'plants') renderPlants();
  if (active === 'orders') renderOrders();
  if (active === 'deliveryOps') {
    await loadDeliveryOpsData();
    renderDeliveryOps();
  }
  if (active === 'landscapingPackages') renderLandscapingPackages();
  if (active === 'landscapingRequests') renderLandscapingRequests();
  if (active === 'inquiries') renderInquiries();
  if (active === 'reviews') renderReviews();
  if (active === 'settings') renderPaymentSettings();
};

function bindDeliveryOpsEvents(){
  const form = el('deliverySettingsForm');
  if (form && !form.dataset.bound){
    form.addEventListener('submit', saveDeliverySettings);
    form.dataset.bound = '1';
  }
  const reloadBtn = el('reloadDeliveryOpsBtn');
  if (reloadBtn && !reloadBtn.dataset.bound){
    reloadBtn.addEventListener('click', () => loadDeliveryOpsData(true).catch((err) => { setDeliveryOpsMsg(err.message); toast(err.message); }));
    reloadBtn.dataset.bound = '1';
  }
  const boardBtn = el('reloadDispatchBoardBtn');
  if (boardBtn && !boardBtn.dataset.bound){
    boardBtn.addEventListener('click', () => loadDeliveryOpsData(true).catch((err) => { setDeliveryOpsMsg(err.message); toast(err.message); }));
    boardBtn.dataset.bound = '1';
  }
  const dateInput = el('dispatchBoardDate');
  if (dateInput && !dateInput.dataset.bound){
    if (!dateInput.value) dateInput.value = deliveryOpsTodayIso();
    dateInput.addEventListener('change', () => loadDeliveryOpsData(true).catch((err) => { setDeliveryOpsMsg(err.message); toast(err.message); }));
    dateInput.dataset.bound = '1';
  }
  const addSlotBtn = el('addDeliverySlotBtn');
  if (addSlotBtn && !addSlotBtn.dataset.bound){
    addSlotBtn.addEventListener('click', () => openDeliverySlotModal());
    addSlotBtn.dataset.bound = '1';
  }
  const addZoneBtn = el('addDeliveryZoneBtn');
  if (addZoneBtn && !addZoneBtn.dataset.bound){
    addZoneBtn.addEventListener('click', () => openDeliveryZoneModal());
    addZoneBtn.dataset.bound = '1';
  }
  const addStaffBtn = el('addDeliveryBoyBtn');
  if (addStaffBtn && !addStaffBtn.dataset.bound){
    addStaffBtn.addEventListener('click', () => openDeliveryBoyModal());
    addStaffBtn.dataset.bound = '1';
  }
}

bindDeliveryOpsEvents();
