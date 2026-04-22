// Landscaping page logic: render packages + architect-led package details + request flow
// Public users can browse packages. Login is required only when submitting a request.
// Uses buildWhatsAppUrl() and WHATSAPP_NUMBER from app.js

let LANDSCAPING_PACKAGES = [];
let ME = null;
let CURRENT_PKG = null;

function $(id) {
  return document.getElementById(id);
}

function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function previewList(items, limit = 4) {
  const list = Array.isArray(items) ? items.filter(Boolean) : [];
  return list.slice(0, limit);
}

function renderPackages() {
  const wrap = $("packagesGrid");
  if (!wrap) return;

  if (!LANDSCAPING_PACKAGES.length) {
    wrap.innerHTML = `<div class="empty-state">No landscaping packages are available right now. Please contact us for a custom quotation.</div>`;
    renderCompareTable();
    return;
  }

  wrap.innerHTML = LANDSCAPING_PACKAGES.map((pkg) => {
    const includesPreview = previewList(pkg.includes, 4)
      .map((item) => `<li>${escapeHtml(item)}</li>`)
      .join("");

    const architectBadge = pkg.architectLed !== false
      ? `<span class="pkg-badge">👷 Landscape architect-led</span>`
      : "";

    const image = pkg.imageUrl
      ? escapeHtml(pkg.imageUrl)
      : "https://placehold.co/800x500?text=Landscaping+Package";

    return `
      <article class="pkg-card">
        <div class="pkg-header">
          <div>
            <h3 class="pkg-title">${escapeHtml(pkg.name)}</h3>
            <p class="pkg-desc">${escapeHtml(pkg.description || "Professional landscape package tailored to your site condition and planting goals.")}</p>
          </div>
          ${architectBadge}
        </div>

        <img class="pkg-img" src="${image}" alt="${escapeHtml(pkg.name)} image" loading="lazy" />

        <div>
          <p class="pkg-price">${escapeHtml(pkg.priceRange || "Quotation on request")}</p>
        </div>

        <div class="pkg-info-grid">
          <div class="info-box">
            <span>Duration</span>
            <strong>${escapeHtml(pkg.duration || "To be confirmed")}</strong>
          </div>
          <div class="info-box">
            <span>Best for</span>
            <strong>${escapeHtml(pkg.bestFor || "Custom landscape projects")}</strong>
          </div>
          <div class="info-box">
            <span>Ideal area</span>
            <strong>${escapeHtml(pkg.idealArea || "Depends on site scope")}</strong>
          </div>
          <div class="info-box">
            <span>Aftercare</span>
            <strong>${escapeHtml(pkg.aftercare || "Guidance shared after completion")}</strong>
          </div>
        </div>

        <div>
          <h4 class="pkg-section-title">Included in this package</h4>
          <ul class="pkg-list">${includesPreview || "<li>Scope will be confirmed after consultation.</li>"}</ul>
        </div>

        <div class="pkg-actions">
          <button class="btn-primary" type="button" data-request="${pkg._id}">Request package</button>
          <button class="btn-outline" type="button" data-details="${pkg._id}">View full details</button>
        </div>
      </article>
    `;
  }).join("");

  wrap.onclick = (event) => {
    const button = event.target.closest("button");
    if (!button) return;

    const pkgId = button.getAttribute("data-request") || button.getAttribute("data-details");
    if (!pkgId) return;

    const pkg = LANDSCAPING_PACKAGES.find((item) => item._id === pkgId);
    if (!pkg) return;

    if (button.hasAttribute("data-details")) {
      openDetails(pkg);
      return;
    }

    if (!isLoggedIn()) {
      alert("Please login or register first to submit a landscaping request.");
      requireLogin(window.location.pathname.split("/").pop() + window.location.search);
      return;
    }

    openRequestModal(pkg);
  };
}

function renderCompareTable() {
  const wrap = $("packageCompareWrap");
  if (!wrap) return;

  if (!LANDSCAPING_PACKAGES.length) {
    wrap.innerHTML = "";
    return;
  }

  wrap.innerHTML = `
    <div class="compare-card">
      <div class="compare-head">
        <h3 style="margin:0 0 6px;">Package Comparison</h3>
        <p class="section-note">Major decision points එකක් table එකෙන් එකවර compare කරන්න.</p>
      </div>
      <div class="compare-table-wrap">
        <table class="compare-table">
          <thead>
            <tr>
              <th>Package</th>
              <th>Best for</th>
              <th>Consultation</th>
              <th>Duration</th>
              <th>Aftercare</th>
              <th>Deliverables</th>
            </tr>
          </thead>
          <tbody>
            ${LANDSCAPING_PACKAGES.map((pkg) => `
              <tr>
                <td>
                  <strong>${escapeHtml(pkg.name)}</strong>
                  <span class="muted-copy">${escapeHtml(pkg.priceRange || "Quote on request")}</span>
                </td>
                <td>${escapeHtml(pkg.bestFor || pkg.idealArea || "Custom projects")}</td>
                <td>${escapeHtml(pkg.consultationMode || "Consultation shared during request review")}</td>
                <td>${escapeHtml(pkg.duration || "To be confirmed")}</td>
                <td>${escapeHtml(pkg.aftercare || "Guidance after handover")}</td>
                <td>${escapeHtml((pkg.deliverables || []).slice(0, 3).join(", ") || "Scope summary shared after brief")}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function renderDetailsContent(pkg) {
  const includes = (pkg.includes || []).length
    ? (pkg.includes || []).map((item) => `<li>${escapeHtml(item)}</li>`).join("")
    : "<li>Scope will be finalized after consultation.</li>";

  const deliverables = (pkg.deliverables || []).length
    ? (pkg.deliverables || []).map((item) => `<li>${escapeHtml(item)}</li>`).join("")
    : "<li>Detailed deliverables will follow the architect brief.</li>";

  const exclusions = (pkg.exclusions || []).length
    ? (pkg.exclusions || []).map((item) => `<li>${escapeHtml(item)}</li>`).join("")
    : "<li>Any additional scope outside the package will be quoted separately.</li>";

  const image = pkg.imageUrl
    ? escapeHtml(pkg.imageUrl)
    : "https://placehold.co/800x500?text=Landscaping+Package";

  return `
    <div class="details-shell">
      <div class="details-main">
        <div class="detail-card">
          <img class="pkg-img" src="${image}" alt="${escapeHtml(pkg.name)} image" loading="lazy" />
          <p>${escapeHtml(pkg.description || "This package is designed to provide a practical, site-responsive landscaping solution.")}</p>
        </div>

        <div class="detail-card">
          <h4>What is included</h4>
          <ul class="detail-list">${includes}</ul>
        </div>

        <div class="detail-card">
          <h4>Customer deliverables</h4>
          <ul class="detail-list">${deliverables}</ul>
        </div>

        <div class="detail-card">
          <h4>Not included / separately quoted</h4>
          <ul class="detail-list">${exclusions}</ul>
        </div>
      </div>

      <aside class="details-side">
        <div class="detail-card">
          <h4>Package summary</h4>
          <div class="detail-kv">
            <div class="info-box">
              <span>Price range</span>
              <strong>${escapeHtml(pkg.priceRange || "To be confirmed")}</strong>
            </div>
            <div class="info-box">
              <span>Duration</span>
              <strong>${escapeHtml(pkg.duration || "To be confirmed")}</strong>
            </div>
            <div class="info-box">
              <span>Best for</span>
              <strong>${escapeHtml(pkg.bestFor || "Custom projects")}</strong>
            </div>
            <div class="info-box">
              <span>Ideal area</span>
              <strong>${escapeHtml(pkg.idealArea || "Depends on site scope")}</strong>
            </div>
          </div>
        </div>

        <div class="detail-card">
          <h4>Consultation & aftercare</h4>
          <ul class="detail-list">
            <li>${escapeHtml(pkg.consultationMode || "Consultation process will be confirmed after your request.")}</li>
            <li>${escapeHtml(pkg.aftercare || "Aftercare guidance will be provided after completion.")}</li>
            <li>${pkg.architectLed !== false ? "Landscape architect-led design review and package planning." : "Package planning support by the nursery team."}</li>
          </ul>
        </div>

        <div class="detail-card">
          <h4>Next step</h4>
          <p class="helper-note">Submit a request with your project brief. After review, the nursery will confirm consultation mode, final quotation, and schedule.</p>
          <div class="pkg-actions" style="margin-top: 10px;">
            <button class="btn-primary" type="button" id="detailsRequestBtn">Request this package</button>
            <button class="btn-outline" type="button" id="detailsCloseBtn">Close</button>
          </div>
        </div>
      </aside>
    </div>
  `;
}

function openDetails(pkg) {
  CURRENT_PKG = pkg;
  $("detailsTitle").textContent = pkg.name;
  $("detailsSubtitle").textContent = [pkg.priceRange, pkg.duration, pkg.bestFor].filter(Boolean).join(" • ");
  $("detailsBody").innerHTML = renderDetailsContent(pkg);

  const backdrop = $("detailsBackdrop");
  backdrop.style.display = "flex";
  backdrop.setAttribute("aria-hidden", "false");

  const requestBtn = $("detailsRequestBtn");
  const closeBtn = $("detailsCloseBtn");

  if (requestBtn) {
    requestBtn.onclick = () => {
      closeDetails();
      if (!isLoggedIn()) {
        alert("Please login or register first to request a landscaping package.");
        requireLogin(window.location.pathname.split("/").pop() + window.location.search);
        return;
      }
      openRequestModal(pkg);
    };
  }

  if (closeBtn) closeBtn.onclick = closeDetails;
}

function closeDetails() {
  const backdrop = $("detailsBackdrop");
  backdrop.style.display = "none";
  backdrop.setAttribute("aria-hidden", "true");
}

function openRequestModal(pkg) {
  CURRENT_PKG = pkg;
  $("requestTitle").textContent = pkg.name;
  $("requestSubtitle").textContent = [pkg.priceRange, pkg.duration, pkg.consultationMode].filter(Boolean).join(" • ");

  const form = $("requestForm");
  const previous = {
    name: $("custName").value || ME?.name || "",
    phone: $("custPhone").value || ME?.phone || "",
    address: $("custAddress").value || ME?.address || "",
    propertyType: $("propertyType").value || "",
    gardenSize: $("gardenSize").value || "",
    budgetRange: $("budgetRange").value || "",
    consultationPreference: $("consultationPreference").value || "",
    preferredDate: $("preferredDate").value || "",
    projectGoals: $("projectGoals").value || "",
    notes: $("notes").value || "",
  };

  form.reset();
  $("custName").value = previous.name;
  $("custPhone").value = previous.phone;
  $("custAddress").value = previous.address;
  $("propertyType").value = previous.propertyType;
  $("gardenSize").value = previous.gardenSize;
  $("budgetRange").value = previous.budgetRange;
  $("consultationPreference").value = previous.consultationPreference;
  $("preferredDate").value = previous.preferredDate;
  $("projectGoals").value = previous.projectGoals;
  $("notes").value = previous.notes;

  const backdrop = $("requestBackdrop");
  backdrop.style.display = "flex";
  backdrop.setAttribute("aria-hidden", "false");

  setTimeout(() => $("custName").focus(), 0);
}

function closeRequestModal() {
  const backdrop = $("requestBackdrop");
  backdrop.style.display = "none";
  backdrop.setAttribute("aria-hidden", "true");
}

function buildPackageMessage(pkg, formData) {
  const name = (formData.get("custName") || "").trim();
  const phone = (formData.get("custPhone") || "").trim();
  const address = (formData.get("custAddress") || "").trim();
  const propertyType = (formData.get("propertyType") || "").trim();
  const gardenSize = (formData.get("gardenSize") || "").trim();
  const budgetRange = (formData.get("budgetRange") || "").trim();
  const consultationPreference = (formData.get("consultationPreference") || "").trim();
  const preferredDate = (formData.get("preferredDate") || "").trim();
  const projectGoals = (formData.get("projectGoals") || "").trim();
  const notes = (formData.get("notes") || "").trim();

  return [
    "🌿 Batalawatta Plant Nursery - Landscaping Request",
    "",
    "Package:",
    `• ${pkg.name}`,
    `• Price Range: ${pkg.priceRange || "-"}`,
    `• Duration: ${pkg.duration || "-"}`,
    pkg.consultationMode ? `• Consultation: ${pkg.consultationMode}` : "",
    "",
    "Customer:",
    `Name: ${name}`,
    `Phone: ${phone}`,
    `Location: ${address}`,
    propertyType ? `Property Type: ${propertyType}` : "",
    gardenSize ? `Garden Size: ${gardenSize}` : "",
    budgetRange ? `Budget Range: ${budgetRange}` : "",
    consultationPreference ? `Preferred Consultation: ${consultationPreference}` : "",
    preferredDate ? `Preferred Date: ${preferredDate}` : "",
    projectGoals ? `Project Goals: ${projectGoals}` : "",
    "",
    "Package Includes:",
    ...(pkg.includes || []).map((item) => `• ${item}`),
    "",
    (pkg.deliverables || []).length ? "Deliverables:" : "",
    ...(pkg.deliverables || []).map((item) => `• ${item}`),
    "",
    notes ? `Additional Notes: ${notes}` : "",
    "",
    "Please review the site requirement and confirm final quotation, consultation method, and available schedule.",
  ].filter(Boolean).join("\n");
}

function wireModals() {
  const detailsBackdrop = $("detailsBackdrop");
  const requestBackdrop = $("requestBackdrop");

  $("detailsClose").addEventListener("click", closeDetails);
  $("requestClose").addEventListener("click", closeRequestModal);
  $("btnCancelRequest").addEventListener("click", closeRequestModal);

  detailsBackdrop.addEventListener("click", (event) => {
    if (event.target === detailsBackdrop) closeDetails();
  });
  requestBackdrop.addEventListener("click", (event) => {
    if (event.target === requestBackdrop) closeRequestModal();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (detailsBackdrop.style.display === "flex") closeDetails();
    if (requestBackdrop.style.display === "flex") closeRequestModal();
  });

  const preferredDate = $("preferredDate");
  if (preferredDate) {
    const today = new Date();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    preferredDate.min = `${today.getFullYear()}-${month}-${day}`;
  }

  $("requestForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!CURRENT_PKG) return;

    const formData = new FormData(event.currentTarget);
    const requiredFields = ["custName", "custPhone", "custAddress"];

    for (const field of requiredFields) {
      const value = (formData.get(field) || "").trim();
      if (!value) {
        alert("Please fill the required fields: Name, Phone, and Address.");
        return;
      }
    }

    try {
      const payload = {
        packageId: CURRENT_PKG._id,
        customer: {
          name: (formData.get("custName") || "").trim(),
          phone: (formData.get("custPhone") || "").trim(),
          address: (formData.get("custAddress") || "").trim(),
        },
        propertyType: (formData.get("propertyType") || "").trim(),
        gardenSize: (formData.get("gardenSize") || "").trim(),
        budgetRange: (formData.get("budgetRange") || "").trim(),
        consultationPreference: (formData.get("consultationPreference") || "").trim(),
        preferredDate: (formData.get("preferredDate") || "").trim(),
        projectGoals: (formData.get("projectGoals") || "").trim(),
        notes: (formData.get("notes") || "").trim(),
      };

      const response = await fetch(`${API_BASE}/landscaping/requests`, {
        method: "POST",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.message || "Failed to submit request");

      let message = buildPackageMessage(CURRENT_PKG, formData);
      if (data?.request?._id) message += `\n\nRequest ID: ${data.request._id}`;

      const url = typeof buildWhatsAppUrl === "function"
        ? buildWhatsAppUrl(message)
        : `https://wa.me/${window.WHATSAPP_NUMBER || "94700000000"}?text=${encodeURIComponent(message)}`;

      try {
        const win = window.open(url, "_blank");
        if (!win) window.location.href = url;
      } catch (_error) {
        window.location.href = url;
      }

      closeRequestModal();
      alert("✅ Your landscaping request was saved. You can track it in My Account → Landscaping Requests.");
    } catch (error) {
      alert(`❌ Could not submit request: ${error.message}`);
    }
  });
}

async function loadMeAndPackages() {
  if (isLoggedIn()) {
    try {
      const meResponse = await fetch(`${API_BASE}/customers/me`, { headers: authHeaders() });
      const meData = await meResponse.json();
      if (meResponse.ok) ME = meData.customer;
    } catch (_error) {
      // ignore profile prefill issues on public page
    }
  }

  try {
    const response = await fetch(`${API_BASE}/landscaping/packages`);
    const data = await response.json();
    if (!response.ok) throw new Error(data?.message || "Failed to load packages");
    LANDSCAPING_PACKAGES = Array.isArray(data) ? data : [];
  } catch (error) {
    console.error(error);
    LANDSCAPING_PACKAGES = [];
  }

  renderPackages();
  renderCompareTable();
}

document.addEventListener("DOMContentLoaded", () => {
  const year = $("year");
  if (year) year.textContent = new Date().getFullYear();

  try {
    if (typeof refreshCartBadge === "function") refreshCartBadge();
  } catch (_error) {
    // ignore badge refresh errors
  }

  wireModals();
  loadMeAndPackages();
});
