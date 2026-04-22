const quickFactsEl = document.getElementById("deliveryQuickFacts");
const processGridEl = document.getElementById("deliveryProcessGrid");
const zonesWrapEl = document.getElementById("deliveryZonesTableWrap");
const policiesEl = document.getElementById("deliveryPolicies");
const waBtnEl = document.getElementById("deliveryWaBtn");

function money(value) {
  return `Rs. ${Number(value || 0).toLocaleString("en-LK", { maximumFractionDigits: 0 })}`;
}

async function loadDeliveryPage() {
  const res = await fetch(`${API_BASE}/orders/delivery-config`);
  const config = await res.json();
  if (!res.ok) throw new Error("Failed to load delivery information");

  if (quickFactsEl) {
    quickFactsEl.innerHTML = `
      <ul class="mini-bullet-list">
        <li>Service base: ${config.baseLocation || "Batalawatta"}</li>
        <li>Vehicle: ${config.serviceType || "Own vehicle delivery"}</li>
        <li>Same-day cutoff: ${config.sameDayCutoffLabel || "12:00 PM"}</li>
        <li>Issue reporting window: ${config.issueReportWindowHours || 24} hours</li>
      </ul>
    `;
  }

  if (processGridEl) {
    const visibleStages = (config.stages || []).filter((stage) => stage.key !== "cancelled");
    processGridEl.innerHTML = visibleStages
      .map((stage, index) => `
        <div class="process-card">
          <div class="process-card-no">${index + 1}</div>
          <h3>${stage.title}</h3>
          <p class="muted">${stage.description}</p>
        </div>
      `)
      .join("");
  }

  if (zonesWrapEl) {
    zonesWrapEl.innerHTML = `
      <div class="table-wrap">
        <table class="delivery-zone-table">
          <thead>
            <tr>
              <th>Zone</th>
              <th>Areas</th>
              <th>Fee</th>
              <th>Lead Time</th>
            </tr>
          </thead>
          <tbody>
            ${(config.zones || [])
              .map(
                (zone) => `
                  <tr>
                    <td><strong>${zone.name}</strong></td>
                    <td>${(zone.areas || []).join(", ")}</td>
                    <td>${money(zone.fee)}</td>
                    <td>${zone.leadTimeLabel || "To be confirmed"}</td>
                  </tr>
                `
              )
              .join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  if (policiesEl) {
    policiesEl.innerHTML = (config.policies || [])
      .map((policy) => `<li>${policy}</li>`)
      .join("");
  }

  if (waBtnEl) {
    const message = [
      "Hello Batalawatta Plant Nursery,",
      "I need help with a plant delivery / special route request.",
      "Please guide me about delivery zones, date, and charges.",
    ].join("\n");
    waBtnEl.href = typeof buildWhatsAppUrl === "function"
      ? buildWhatsAppUrl(message)
      : `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  refreshCartBadge();
  try {
    await loadDeliveryPage();
  } catch (_error) {
    if (processGridEl) {
      processGridEl.innerHTML = `<div class="muted">Unable to load delivery information right now.</div>`;
    }
  }
});
