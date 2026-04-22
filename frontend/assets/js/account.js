document.addEventListener("DOMContentLoaded", async () => {
  refreshCartBadge();

  if (!isLoggedIn()) {
    window.location.href = "login.html";
    return;
  }

  const profileMsg = document.getElementById("profileMsg");
  const passMsg = document.getElementById("passMsg");
  const ordersWrap = document.getElementById("ordersWrap");
  const ordersMsg = document.getElementById("ordersMsg");
  const landReqWrap = document.getElementById("landReqWrap");
  const landReqMsg = document.getElementById("landReqMsg");
  const inqWrap = document.getElementById("inqWrap");
  const inqMsg = document.getElementById("inqMsg");

  let deliveryConfig = null;

  function setMsg(el, text) {
    if (el) el.textContent = text || "";
  }

  function money(value) {
    return `Rs. ${Number(value || 0).toLocaleString("en-LK", { maximumFractionDigits: 0 })}`;
  }

  function badge(text, extraClass = "") {
    return `<span class="badge ${extraClass}">${escapeHtml(text || "")}</span>`;
  }

  function fetchStatusSteps(status) {
    const stages = deliveryConfig?.stages || [];
    if (status === "cancelled") return [];
    return stages.filter((stage) => stage.key !== "cancelled");
  }

  function statusIndex(status) {
    const steps = fetchStatusSteps(status);
    return steps.findIndex((step) => step.key === status);
  }

  function timeSlotLabel(slotId) {
    return deliveryConfig?.timeSlots?.find((slot) => slot.id === slotId)?.label || slotId || "";
  }

  function formatDateOnly(iso) {
    if (!iso) return "";
    const date = new Date(`${iso}T00:00:00`);
    return date.toLocaleDateString("en-LK", { year: "numeric", month: "short", day: "numeric" });
  }

  function formatDateTime(iso) {
    if (!iso) return "";
    const date = new Date(iso);
    return date.toLocaleString("en-LK", { year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" });
  }

  function orderStatusClass(status) {
    if (["delivered", "confirmed"].includes(status)) return "good";
    if (["cancelled"].includes(status)) return "bad";
    return "warn";
  }

  function paymentStatusMeta(status) {
    const map = {
      cash_on_delivery: { label: "Cash on delivery", cls: "warn" },
      proof_uploaded: { label: "Proof uploaded", cls: "warn" },
      under_review: { label: "Under review", cls: "warn" },
      verified: { label: "Verified", cls: "good" },
      rejected: { label: "Needs attention", cls: "bad" },
      awaiting_payment: { label: "Awaiting payment", cls: "bad" },
    };
    return map[status] || { label: status || "Pending", cls: "warn" };
  }

  function renderTrackingSteps(order) {
    if (order.status === "cancelled") {
      return `<div class="cancelled-note">This order was cancelled. Please contact the nursery if you need to reschedule.</div>`;
    }

    const steps = fetchStatusSteps(order.status);
    const currentIndex = statusIndex(order.status);
    return `
      <div class="tracking-steps">
        ${steps
          .map((step, index) => {
            const cls = index < currentIndex ? "done" : index === currentIndex ? "current" : "";
            return `
              <div class="tracking-step ${cls}">
                <span class="tracking-dot">${index + 1}</span>
                <div class="tracking-body">
                  <strong>${escapeHtml(step.title)}</strong>
                  <div class="muted">${escapeHtml(step.description || "")}</div>
                </div>
              </div>
            `;
          })
          .join("")}
      </div>
    `;
  }

  function renderTimeline(order) {
    const timeline = Array.isArray(order.statusTimeline) ? [...order.statusTimeline].sort((a, b) => new Date(b.at) - new Date(a.at)) : [];
    if (!timeline.length) return "";
    return `
      <div class="timeline-list">
        ${timeline
          .map(
            (entry) => `
              <div class="timeline-item">
                <div class="timeline-top">
                  <strong>${escapeHtml(entry.title || entry.status || "Update")}</strong>
                  <span class="muted">${formatDateTime(entry.at)}</span>
                </div>
                ${entry.note ? `<div class="muted">${escapeHtml(entry.note)}</div>` : ""}
              </div>
            `
          )
          .join("")}
      </div>
    `;
  }

  function orderCard(order) {
    const items = (order.items || []).map((item) => `${item.name} × ${item.qty}`).join(", ");
    const scheduledDate = order.delivery?.scheduledDate ? formatDateOnly(order.delivery.scheduledDate) : "";
    const preferredDate = order.delivery?.preferredDate ? formatDateOnly(order.delivery.preferredDate) : "";
    const payment = order.payment || {};
    const paymentMeta = paymentStatusMeta(payment.status);
    const deliveryWindow = scheduledDate
      ? `${scheduledDate}${order.delivery?.scheduledTimeSlot ? ` • ${timeSlotLabel(order.delivery.scheduledTimeSlot)}` : ""}`
      : preferredDate
        ? `${preferredDate}${order.delivery?.preferredTimeSlot ? ` • ${timeSlotLabel(order.delivery.preferredTimeSlot)}` : ""}`
        : order.delivery?.leadTimeLabel || "To be confirmed";

    return `
      <div class="card order-tracker-card" style="padding:14px; margin-bottom:14px;">
        <div class="row" style="justify-content:space-between; gap:10px; align-items:flex-start;">
          <div>
            <div><b>Order ID:</b> ${order._id}</div>
            <div class="muted">${formatDateTime(order.createdAt)}</div>
          </div>
          <div style="text-align:right;">
            <div><b>${money(order.total)}</b></div>
            <div>${badge(order.statusMeta?.title || order.status || "pending", orderStatusClass(order.status))}</div>
          </div>
        </div>

        <div class="tracker-summary-grid">
          <div>
            <div class="summary-line"><span>Subtotal</span><strong>${money(order.subtotal)}</strong></div>
            <div class="summary-line"><span>Delivery Fee</span><strong>${money(order.delivery?.fee)}</strong></div>
            <div class="summary-line"><span>Payment</span><strong>${escapeHtml(payment.methodLabel || order.paymentMethod || "COD")}</strong></div>
            <div class="summary-line"><span>Payment Status</span><strong>${badge(paymentMeta.label, paymentMeta.cls)}</strong></div>
          </div>
          <div>
            <div class="summary-line"><span>Zone</span><strong>${escapeHtml(order.delivery?.zoneName || "-")}</strong></div>
            <div class="summary-line"><span>Window</span><strong>${escapeHtml(deliveryWindow)}</strong></div>
            <div class="summary-line"><span>Receiver</span><strong>${escapeHtml(order.delivery?.recipientName || order.customer?.name || "-")}</strong></div>
          </div>
        </div>

        <div style="margin-top:10px;"><b>Items:</b> <span class="muted">${escapeHtml(items || "-")}</span></div>
        <div style="margin-top:6px;"><b>Delivery Address:</b> <span class="muted">${escapeHtml(order.customer?.address || "")}</span></div>
        ${order.delivery?.landmark ? `<div style="margin-top:6px;"><b>Landmark:</b> <span class="muted">${escapeHtml(order.delivery.landmark)}</span></div>` : ""}
        ${order.delivery?.instructions ? `<div style="margin-top:6px;"><b>Delivery Instructions:</b> <span class="muted">${escapeHtml(order.delivery.instructions)}</span></div>` : ""}
        ${order.notes ? `<div style="margin-top:6px;"><b>Your Note:</b> <span class="muted">${escapeHtml(order.notes)}</span></div>` : ""}
        ${payment.reference ? `<div style="margin-top:6px;"><b>Payment Reference:</b> <span class="muted">${escapeHtml(payment.reference)}</span></div>` : ""}
        ${payment.slipUrl ? `<div style="margin-top:6px;"><a class="btn btn-outline" href="${escapeHtml(payment.slipUrl)}" target="_blank" rel="noopener">Open uploaded payment proof</a></div>` : ""}
        ${order.adminNote ? `<div class="customer-update-box"><b>Nursery Update:</b><div class="muted">${escapeHtml(order.adminNote)}</div></div>` : ""}
        ${(order.delivery?.deliveryBoyName || order.delivery?.deliveryBoyPhone || order.delivery?.vehicleNumber) ? `
          <div class="delivery-driver-box">
            <b>Dispatch Team</b>
            <div class="muted">${escapeHtml(order.delivery?.deliveryBoyName || "Delivery boy")}${order.delivery?.deliveryBoyPhone ? ` • ${escapeHtml(order.delivery.deliveryBoyPhone)}` : ""}${order.delivery?.vehicleNumber ? ` • Vehicle ${escapeHtml(order.delivery.vehicleNumber)}` : ""}</div>
          </div>
        ` : ""}

        <div style="margin-top:14px;">
          <h3 style="margin:0 0 10px;">Delivery Progress</h3>
          ${renderTrackingSteps(order)}
        </div>

        <div style="margin-top:14px;">
          <h3 style="margin:0 0 10px;">Status History</h3>
          ${renderTimeline(order)}
        </div>
      </div>
    `;
  }

  async function loadDeliveryConfig() {
    try {
      const res = await fetch(`${API_BASE}/orders/delivery-config`);
      if (!res.ok) throw new Error("config failed");
      deliveryConfig = await res.json();
    } catch (_error) {
      deliveryConfig = { stages: [], timeSlots: [] };
    }
  }

  async function loadMe() {
    const res = await fetch(`${API_BASE}/customers/me`, { headers: authHeaders() });
    const data = await res.json();
    if (!res.ok) {
      clearCustomerAuth();
      window.location.href = "login.html";
      return null;
    }

    setCustomerAuth(getCustomerToken(), data.customer);
    document.getElementById("p_name").value = data.customer.name || "";
    document.getElementById("p_email").value = data.customer.email || "";
    document.getElementById("p_phone").value = data.customer.phone || "";
    document.getElementById("p_address").value = data.customer.address || "";
    return data.customer;
  }

  async function loadOrders() {
    setMsg(ordersMsg, "Loading orders...");
    try {
      const res = await fetch(`${API_BASE}/orders/my`, { headers: authHeaders() });
      const data = await res.json();
      if (!res.ok) {
        setMsg(ordersMsg, data?.message || "Failed to load orders");
        ordersWrap.innerHTML = "";
        return;
      }
      if (!data.length) {
        ordersWrap.innerHTML = `<div class="muted">No orders yet. <a href="products.html">Shop plants</a></div>`;
        setMsg(ordersMsg, "");
        return;
      }
      ordersWrap.innerHTML = data.map(orderCard).join("");
      setMsg(ordersMsg, "");
    } catch (_error) {
      setMsg(ordersMsg, "Server connection error. Start backend.");
    }
  }

  function landReqCard(request) {
    const date = new Date(request.createdAt);
    const packageName = request.packageSnapshot?.name || "Package";
    return `
      <div class="card" style="padding:12px; margin-bottom:12px;">
        <div class="row" style="justify-content:space-between; gap:10px;">
          <div>
            <div><b>${escapeHtml(packageName)}</b></div>
            <div class="muted">${date.toLocaleString()}</div>
          </div>
          <div style="text-align:right;">${badge(request.status || "new")}</div>
        </div>
        <div style="margin-top:8px;"><b>Address:</b> <span class="muted">${escapeHtml(request.customer?.address || "")}</span></div>
        ${request.propertyType ? `<div style="margin-top:6px;"><b>Property type:</b> <span class="muted">${escapeHtml(request.propertyType)}</span></div>` : ""}
        ${request.gardenSize ? `<div style="margin-top:6px;"><b>Garden size:</b> <span class="muted">${escapeHtml(request.gardenSize)}</span></div>` : ""}
        ${request.budgetRange ? `<div style="margin-top:6px;"><b>Budget range:</b> <span class="muted">${escapeHtml(request.budgetRange)}</span></div>` : ""}
        ${request.consultationPreference ? `<div style="margin-top:6px;"><b>Consultation:</b> <span class="muted">${escapeHtml(request.consultationPreference)}</span></div>` : ""}
        ${request.preferredDate ? `<div style="margin-top:6px;"><b>Preferred date:</b> <span class="muted">${escapeHtml(request.preferredDate)}</span></div>` : ""}
        ${request.packageSnapshot?.aftercare ? `<div style="margin-top:6px;"><b>Aftercare:</b> <span class="muted">${escapeHtml(request.packageSnapshot.aftercare)}</span></div>` : ""}
        ${request.projectGoals ? `<div style="margin-top:6px;"><b>Project goals:</b> <span class="muted">${escapeHtml(request.projectGoals)}</span></div>` : ""}
        ${request.notes ? `<div style="margin-top:6px;"><b>Notes:</b> <span class="muted">${escapeHtml(request.notes)}</span></div>` : ""}
        ${request.adminNote ? `<div class="customer-update-box"><b>Admin note:</b><div class="muted">${escapeHtml(request.adminNote)}</div></div>` : ""}
      </div>
    `;
  }

  async function loadLandRequests() {
    if (!landReqWrap || !landReqMsg) return;
    setMsg(landReqMsg, "Loading landscaping requests...");
    try {
      const res = await fetch(`${API_BASE}/landscaping/requests/my`, { headers: authHeaders() });
      const data = await res.json();
      if (!res.ok) {
        setMsg(landReqMsg, data?.message || "Failed to load requests");
        landReqWrap.innerHTML = "";
        return;
      }
      if (!data.length) {
        landReqWrap.innerHTML = `<div class="muted">No landscaping requests yet. <a href="landscaping.html">Browse packages</a></div>`;
        setMsg(landReqMsg, "");
        return;
      }
      landReqWrap.innerHTML = data.map(landReqCard).join("");
      setMsg(landReqMsg, "");
    } catch (_error) {
      setMsg(landReqMsg, "Server connection error. Start backend.");
    }
  }

  function inquiryCard(inquiry) {
    const date = new Date(inquiry.createdAt);
    return `
      <div class="card" style="padding:12px; margin-bottom:12px;">
        <div class="row" style="justify-content:space-between; gap:10px;">
          <div>
            <div><b>Inquiry</b></div>
            <div class="muted">${date.toLocaleString()}</div>
          </div>
          <div style="text-align:right;">${badge(inquiry.status || "new")}</div>
        </div>
        <div style="margin-top:8px; white-space:pre-wrap;"><span class="muted">${escapeHtml(inquiry.message || "")}</span></div>
        ${inquiry.adminReply ? `<div class="customer-update-box"><b>Admin reply:</b><div class="muted">${escapeHtml(inquiry.adminReply)}</div></div>` : ""}
      </div>
    `;
  }

  async function loadInquiries() {
    if (!inqWrap || !inqMsg) return;
    setMsg(inqMsg, "Loading inquiries...");
    try {
      const res = await fetch(`${API_BASE}/inquiries/my`, { headers: authHeaders() });
      const data = await res.json();
      if (!res.ok) {
        setMsg(inqMsg, data?.message || "Failed to load inquiries");
        inqWrap.innerHTML = "";
        return;
      }
      if (!data.length) {
        inqWrap.innerHTML = `<div class="muted">No inquiries yet. <a href="contact.html">Send an inquiry</a></div>`;
        setMsg(inqMsg, "");
        return;
      }
      inqWrap.innerHTML = data.map(inquiryCard).join("");
      setMsg(inqMsg, "");
    } catch (_error) {
      setMsg(inqMsg, "Server connection error. Start backend.");
    }
  }

  document.getElementById("profileForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    setMsg(profileMsg, "Saving...");
    try {
      const payload = {
        name: document.getElementById("p_name").value.trim(),
        phone: document.getElementById("p_phone").value.trim(),
        address: document.getElementById("p_address").value.trim(),
      };
      const res = await fetch(`${API_BASE}/customers/me`, {
        method: "PUT",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg(profileMsg, data?.message || "Failed to save");
        return;
      }
      setCustomerAuth(getCustomerToken(), data.customer);
      setMsg(profileMsg, "Saved ✅");
      renderAuthLinks();
    } catch (_error) {
      setMsg(profileMsg, "Server connection error.");
    }
  });

  document.getElementById("passForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    setMsg(passMsg, "Updating...");
    try {
      const currentPassword = document.getElementById("curPass").value;
      const newPassword = document.getElementById("newPass").value;
      const res = await fetch(`${API_BASE}/customers/password`, {
        method: "PUT",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg(passMsg, data?.message || "Failed to update password");
        return;
      }
      document.getElementById("curPass").value = "";
      document.getElementById("newPass").value = "";
      setMsg(passMsg, "Password updated ✅");
    } catch (_error) {
      setMsg(passMsg, "Server connection error.");
    }
  });

  await loadDeliveryConfig();
  await loadMe();
  await loadOrders();
  await loadLandRequests();
  await loadInquiries();
});
