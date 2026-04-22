// Cart system backed by MongoDB (via backend API) using a simple sessionId stored in localStorage.
// ✅ Login required (customer).

function ensureSessionId() {
  let sid = localStorage.getItem("bpn_sessionId");
  if (!sid) {
    sid = `sess_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    localStorage.setItem("bpn_sessionId", sid);
  }
  return sid;
}

async function apiCartGet() {
  if (!isLoggedIn()) return { sessionId: "", items: [] };
  const sid = ensureSessionId();
  const res = await fetch(`${API_BASE}/cart/${sid}`, { headers: authHeaders() });
  if (res.status === 401) return { sessionId: "", items: [] };
  return res.json();
}

async function apiCartAdd(plantId, qty) {
  if (!isLoggedIn()) return { error: true, message: "Login required" };
  const sid = ensureSessionId();
  const res = await fetch(`${API_BASE}/cart/add`, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ sessionId: sid, plantId, qty })
  });
  return res.json();
}

async function apiCartUpdate(plantId, qty) {
  if (!isLoggedIn()) return { error: true, message: "Login required" };
  const sid = ensureSessionId();
  const res = await fetch(`${API_BASE}/cart/update`, {
    method: "PUT",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ sessionId: sid, plantId, qty })
  });
  return res.json();
}

async function apiCartRemove(plantId) {
  if (!isLoggedIn()) return { error: true, message: "Login required" };
  const sid = ensureSessionId();
  const res = await fetch(`${API_BASE}/cart/remove/${sid}/${plantId}`, {
    method: "DELETE",
    headers: authHeaders()
  });
  return res.json();
}

async function apiCartClear() {
  if (!isLoggedIn()) return { error: true, message: "Login required" };
  const sid = ensureSessionId();
  const res = await fetch(`${API_BASE}/cart/clear/${sid}`, {
    method: "DELETE",
    headers: authHeaders()
  });
  return res.json();
}

// Navbar badge helper
async function refreshCartBadge() {
  const el = document.getElementById("cartCount");
  if (!el) return;

  if (!isLoggedIn()) {
    el.textContent = "0";
    return;
  }

  try {
    const cart = await apiCartGet();
    const count = (cart.items || []).reduce((s, it) => s + (Number(it.qty) || 0), 0);
    el.textContent = String(count);
  } catch (e) {
    // backend might be off; keep silent
  }
}

// Refresh badge on load
document.addEventListener("DOMContentLoaded", () => {
  refreshCartBadge();
});
