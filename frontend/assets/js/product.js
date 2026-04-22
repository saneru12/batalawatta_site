let CURRENT_PLANT = null;
const msg = document.getElementById("msg");

function getId() {
  const params = new URLSearchParams(window.location.search);
  return params.get("id");
}

function setMsg(t) {
  if (!msg) return;
  msg.textContent = t || "";
}

function clampQty(v) {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.floor(n);
}

async function loadPlant() {
  const id = getId();
  if (!id) {
    setMsg("No plant id found in URL.");
    return;
  }

  setMsg("Loading...");
  const res = await fetch(`${API_BASE}/plants/${id}`);
  if (!res.ok) throw new Error("Plant not found");
  const plant = await res.json();
  CURRENT_PLANT = plant;

  document.getElementById("plantName").textContent = plant.name || "Plant";
  document.getElementById("plantCategory").textContent = plant.category ? `Category: ${plant.category}` : "";
  document.getElementById("plantPrice").textContent = `Rs. ${plant.price ?? ""}`;
  document.getElementById("plantDescription").textContent = plant.description || "";
  document.getElementById("plantStock").textContent = plant.available ? "In stock" : "Out of stock";
  document.getElementById("plantImage").src = plant.image || plant.imageUrl || "https://picsum.photos/seed/plant/800/600";

  setMsg("");
}

function wireQtyControls() {
  const qtyInput = document.getElementById("qty");
  document.getElementById("btnMinus").addEventListener("click", () => {
    qtyInput.value = String(Math.max(1, clampQty(qtyInput.value) - 1));
  });
  document.getElementById("btnPlus").addEventListener("click", () => {
    qtyInput.value = String(clampQty(qtyInput.value) + 1);
  });
}

async function addToCart(redirectTo) {
  if (!isLoggedIn()) { requireLogin(window.location.pathname.split('/').pop() + window.location.search); return; }
  if (!CURRENT_PLANT?._id) return;

  const q = clampQty(document.getElementById("qty").value);
  setMsg("Adding to cart...");

  const res = await apiCartAdd(CURRENT_PLANT._id, q);

  if (res?.message && res?.error) {
    setMsg(res.message);
    return;
  }

  setMsg("Added to cart ✔");
  refreshCartBadge();

  if (redirectTo === "cart") window.location.href = "cart.html";
  if (redirectTo === "checkout") window.location.href = "checkout.html";
  else setTimeout(() => setMsg(""), 1200);
}

document.addEventListener("DOMContentLoaded", () => {
  wireQtyControls();

  document.getElementById("btnAdd").addEventListener("click", () => addToCart(null));
  document.getElementById("btnBuy").addEventListener("click", () => addToCart("checkout"));

  loadPlant().catch(() => setMsg("API connection error. Start backend."));
});
