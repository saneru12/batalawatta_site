if (!isLoggedIn()) {
  requireLogin(window.location.pathname.split("/").pop() + window.location.search);
}

document.addEventListener("DOMContentLoaded", () => {
  if (!protectPage()) return;
});

const listEl = document.getElementById("cartList");
const totalEl = document.getElementById("cartTotal");
const msgEl = document.getElementById("msg");
const deliveryInfoEl = document.getElementById("deliveryInfoCard");

function money(value) {
  const amount = Number(value) || 0;
  return `Rs. ${amount.toLocaleString("en-LK", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function toNumber(value) {
  if (typeof value === "number") return value;
  const text = String(value ?? "").replace(/,/g, "");
  const match = text.match(/\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : 0;
}

async function loadDeliveryInfo() {
  if (!deliveryInfoEl) return;
  try {
    const res = await fetch(`${API_BASE}/orders/delivery-config`);
    const config = await res.json();
    if (!res.ok) throw new Error("Delivery info unavailable");

    const firstZone = config?.zones?.[0];
    deliveryInfoEl.innerHTML = `
      <h3>Delivery at checkout</h3>
      <div class="summary-line">
        <span>Service type</span>
        <strong>${config.serviceType || "Own vehicle delivery"}</strong>
      </div>
      <div class="summary-line">
        <span>Starting fee</span>
        <strong>${money(firstZone?.fee || 0)}</strong>
      </div>
      <div class="summary-line">
        <span>Same-day cutoff</span>
        <strong>${config.sameDayCutoffLabel || "12:00 PM"}</strong>
      </div>
      <div class="muted compact-copy">Zone-based delivery fee and preferred delivery slot can be selected during checkout.</div>
    `;
  } catch (_error) {
    deliveryInfoEl.innerHTML = `<div class="muted">Delivery zones will be shown at checkout.</div>`;
  }
}

async function render() {
  msgEl.textContent = "Loading...";
  const cart = await apiCartGet();
  const items = cart.items || [];

  if (items.length === 0) {
    listEl.innerHTML = `<div class="muted">Your cart is empty.</div>`;
    totalEl.textContent = money(0);
    msgEl.textContent = "";
    refreshCartBadge();
    return;
  }

  let total = 0;

  listEl.innerHTML = items.map((item) => {
    const plant = item.plant || {};
    const price = toNumber(plant.price);
    const qty = Number(item.qty) || 1;
    total += price * qty;

    return `
      <div class="cart-item">
        <img class="cart-thumb" src="${plant.image || plant.imageUrl || "https://picsum.photos/seed/cart/160/120"}" alt="${plant.name || ""}">
        <div>
          <div class="cart-title">${plant.name || "Plant"}</div>
          <div class="muted">${plant.category || ""}</div>
          <div class="muted">${money(price)}</div>
        </div>
        <div class="cart-qty">
          <button class="qty-btn" data-act="minus" data-id="${plant._id}" aria-label="Decrease quantity">-</button>
          <input class="qty-input" data-id="${plant._id}" value="${qty}" inputmode="numeric" />
          <button class="qty-btn" data-act="plus" data-id="${plant._id}" aria-label="Increase quantity">+</button>
        </div>
        <div class="cart-line">${money(price * qty)}</div>
        <button class="cart-remove" data-act="remove" data-id="${plant._id}" aria-label="Remove">×</button>
      </div>
    `;
  }).join("");

  totalEl.textContent = money(total);
  msgEl.textContent = "";
  refreshCartBadge();
}

listEl.addEventListener("click", async (event) => {
  const btn = event.target.closest("button");
  if (!btn) return;

  const id = btn.getAttribute("data-id");
  const act = btn.getAttribute("data-act");
  if (!id || !act) return;

  const cart = await apiCartGet();
  const item = (cart.items || []).find((row) => String(row.plant?._id || row.plant) === String(id));
  const currentQty = Number(item?.qty) || 1;

  if (act === "minus") await apiCartUpdate(id, Math.max(0, currentQty - 1));
  if (act === "plus") await apiCartUpdate(id, currentQty + 1);
  if (act === "remove") await apiCartRemove(id);

  await render();
});

listEl.addEventListener("change", async (event) => {
  const input = event.target.closest("input.qty-input");
  if (!input) return;

  const id = input.getAttribute("data-id");
  const qty = Math.max(0, Math.floor(Number(input.value) || 0));
  await apiCartUpdate(id, qty);
  await render();
});

document.getElementById("btnClear").addEventListener("click", async () => {
  await apiCartClear();
  await render();
});

document.getElementById("btnCheckout").addEventListener("click", async () => {
  const cart = await apiCartGet();
  if (!cart?.items?.length) {
    msgEl.textContent = "Cart is empty.";
    return;
  }
  window.location.href = "checkout.html";
});

Promise.all([render(), loadDeliveryInfo()]).catch(() => {
  msgEl.textContent = "API connection error. Start backend.";
});
