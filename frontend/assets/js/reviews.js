if (!isLoggedIn()) { requireLogin(window.location.pathname.split("/").pop() + window.location.search); }

document.addEventListener("DOMContentLoaded", () => {
  if (!protectPage()) return;
  try { const c=getCustomer(); const n=document.getElementById("name"); if(c && n && !n.value) n.value=c.name||""; } catch {}
 if (!protectPage()) return; });

// Reviews / Ratings (MongoDB via backend API)
// Requires assets/js/app.js (API_BASE) and assets/js/cart.js (refreshCartBadge) to be loaded before this file.

const listEl = document.getElementById("reviewsList");
const form = document.getElementById("reviewForm");
const msgEl = document.getElementById("reviewMsg");
const statsEl = document.getElementById("reviewStats");

function esc(s = "") {
  return String(s).replace(/[&<>"']/g, (m) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[m]));
}

function stars(n) {
  const full = "★★★★★".slice(0, n);
  const empty = "☆☆☆☆☆".slice(0, 5 - n);
  return `<span class="stars" aria-label="${n} out of 5">${full}${empty}</span>`;
}

function formatDate(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return "";
  }
}

async function loadReviews() {
  if (!listEl) return;
  listEl.innerHTML = `<div class="muted">Loading reviews...</div>`;
  try {
    const res = await fetch(`${API_BASE}/reviews?limit=50`);
    const reviews = await res.json();

    if (!Array.isArray(reviews) || reviews.length === 0) {
      listEl.innerHTML = `<div class="muted">No reviews yet. Be the first to leave one!</div>`;
      if (statsEl) statsEl.textContent = "0 reviews";
      return;
    }

    const avg = reviews.reduce((a, r) => a + (Number(r.rating) || 0), 0) / reviews.length;
    if (statsEl) statsEl.textContent = `${reviews.length} reviews • Avg ${avg.toFixed(1)}★`;

    listEl.innerHTML = reviews.map((r) => `
      <div class="review-item">
        <div class="review-top">
          <div class="review-name">${esc(r.name)}</div>
          <div class="review-meta">
            ${stars(Number(r.rating) || 0)}
            <span class="review-date">${formatDate(r.createdAt)}</span>
          </div>
        </div>
        <div class="review-comment">${esc(r.comment)}</div>
      </div>
    `).join("");
  } catch (err) {
    listEl.innerHTML = `<div class="muted">Failed to load reviews.</div>`;
    if (statsEl) statsEl.textContent = "—";
  }
}

form?.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (msgEl) msgEl.textContent = "";

  const name = document.getElementById("reviewName")?.value?.trim() || "";
  const comment = document.getElementById("reviewComment")?.value?.trim() || "";
  const rating = Number((new FormData(form)).get("rating"));

  if (!rating || rating < 1 || rating > 5) {
    if (msgEl) msgEl.textContent = "Please select a rating (1-5).";
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/reviews`, {
      method: "POST",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ name, rating, comment }),
    });
    const data = await res.json();
    if (!res.ok) {
      if (msgEl) msgEl.textContent = data?.message || "Failed to submit review.";
      return;
    }
    form.reset();
    if (msgEl) msgEl.textContent = "Thanks! Your review was submitted.";
    await loadReviews();
  } catch (err) {
    if (msgEl) msgEl.textContent = "Failed to submit review.";
  }
});

if (typeof refreshCartBadge === "function") refreshCartBadge();
loadReviews();
