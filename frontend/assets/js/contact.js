if (!isLoggedIn()) { requireLogin(window.location.pathname.split("/").pop() + window.location.search); }

document.addEventListener("DOMContentLoaded", () => { if (!protectPage()) return; });

const form = document.getElementById("form");
const statusEl = document.getElementById("status");

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  statusEl.textContent = "Sending...";

  const payload = {
    name: document.getElementById("name").value.trim(),
    phone: document.getElementById("phone").value.trim(),
    email: document.getElementById("email").value.trim(),
    message: document.getElementById("message").value.trim()
  };

  try {
    const res = await fetch(`${API_BASE}/inquiries`, {
      method: "POST",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Failed");

    statusEl.textContent = "✅ Inquiry submitted successfully!";
    form.reset();
  } catch (err) {
    statusEl.textContent = "❌ Error: " + err.message;
  }
});
