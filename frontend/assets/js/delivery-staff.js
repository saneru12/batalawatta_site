const API_BASE = 'https://batalawattasite-production.up.railway.app/api';
const TOKEN_KEY = 'bpn_delivery_staff_token';
const PROFILE_KEY = 'bpn_delivery_staff_profile';

const ACTIVITY_META = {
  accepted: {
    label: 'Accept route',
    subtitle: 'Confirm that you received this delivery assignment.',
  },
  loaded: {
    label: 'Plants loaded',
    subtitle: 'Log when the plants are safely loaded to the vehicle.',
  },
  departed: {
    label: 'Left nursery',
    subtitle: 'Use this when you leave the nursery and start the trip.',
  },
  arrived: {
    label: 'Arrived nearby',
    subtitle: 'Log when you are close to the delivery location.',
  },
  delivered: {
    label: 'Delivered successfully',
    subtitle: 'Record the handover, receiver name, and COD collection if needed.',
    showRecipient: true,
    showCash: true,
  },
  issue: {
    label: 'Report issue',
    subtitle: 'Use this for address issues, reschedules, failed contact, or cash mismatch.',
    showIssueCode: true,
    requireNote: true,
  },
};

const state = {
  staff: loadProfileCache(),
  config: null,
  orders: [],
  selectedDate: todayIso(),
  selectedStatus: '',
  currentModal: null,
};

function byId(id) {
  return document.getElementById(id);
}

function getToken() {
  return sessionStorage.getItem(TOKEN_KEY) || '';
}

function setSession(token, staff) {
  sessionStorage.setItem(TOKEN_KEY, token);
  if (staff) {
    sessionStorage.setItem(PROFILE_KEY, JSON.stringify(staff));
    state.staff = staff;
  }
}

function clearSession() {
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(PROFILE_KEY);
  state.staff = null;
}

function loadProfileCache() {
  try {
    return JSON.parse(sessionStorage.getItem(PROFILE_KEY) || 'null');
  } catch {
    return null;
  }
}

function authHeaders(extra = {}) {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}`, ...extra } : { ...extra };
}

async function api(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, options);
  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { message: text };
  }

  if (!response.ok) {
    const error = new Error(data?.message || data?.details || `Request failed (${response.status})`);
    error.status = response.status;
    throw error;
  }

  return data;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function cleanText(value) {
  return String(value || '').trim();
}

function toDigits(value) {
  return String(value || '').replace(/\D/g, '');
}

function todayIso() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function money(value) {
  return `Rs. ${Number(value || 0).toLocaleString('en-LK', { maximumFractionDigits: 0 })}`;
}

function formatDateOnly(value) {
  if (!value) return '—';
  const date = new Date(`${value}T00:00:00`);
  return date.toLocaleDateString('en-LK', { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatDateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  return date.toLocaleString('en-LK', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function slotLabel(slotId) {
  return state.config?.timeSlots?.find((slot) => slot.id === slotId)?.label || slotId || 'Time slot not set';
}

function zoneName(zoneId, fallbackName = '') {
  return state.config?.zones?.find((zone) => zone.id === zoneId)?.name || fallbackName || zoneId || 'Zone not set';
}

function badgeClass(status) {
  if (['delivered', 'verified', 'available'].includes(status)) return 'good';
  if (['issue', 'cancelled', 'rejected', 'leave'].includes(status)) return 'bad';
  if (['scheduled', 'out_for_delivery', 'busy', 'proof_uploaded', 'under_review', 'cash_on_delivery'].includes(status)) return 'warn';
  return 'neutral';
}

function statusLabel(status) {
  const map = {
    pending: 'Pending',
    confirmed: 'Confirmed',
    preparing: 'Preparing',
    scheduled: 'Scheduled',
    out_for_delivery: 'Out for delivery',
    delivered: 'Delivered',
    cancelled: 'Cancelled',
    available: 'Available',
    busy: 'Busy',
    off_duty: 'Off duty',
    leave: 'On leave',
    cash_on_delivery: 'Cash on delivery',
    proof_uploaded: 'Proof uploaded',
    under_review: 'Under review',
    verified: 'Verified',
    rejected: 'Needs review',
  };
  return map[status] || status || '—';
}

function setMessage(text, tone = 'neutral') {
  const box = byId('staffMessage');
  if (!box) return;
  if (!text) {
    box.style.display = 'none';
    box.textContent = '';
    return;
  }
  box.style.display = 'block';
  box.textContent = text;
  box.style.background = tone === 'error' ? '#fde7e9' : tone === 'good' ? '#e4f8ec' : '#edf6ea';
  box.style.borderColor = tone === 'error' ? '#f1c4ca' : tone === 'good' ? '#c7eecf' : '#dfe8dc';
  box.style.color = tone === 'error' ? '#8d2533' : '#203126';
}

function setError(id, text) {
  const node = byId(id);
  if (!node) return;
  node.textContent = text || '';
  node.style.display = text ? 'block' : 'none';
}

function showLoginView() {
  byId('staffLoginView').style.display = 'grid';
  byId('staffAppView').style.display = 'none';
}

function showAppView() {
  byId('staffLoginView').style.display = 'none';
  byId('staffAppView').style.display = 'block';
}

function renderProfile() {
  const profileWrap = byId('staffProfileMeta');
  const welcome = byId('staffWelcomeLine');
  if (!state.staff || !profileWrap || !welcome) return;

  const coverage = state.staff.coverageZoneIds?.length
    ? state.staff.coverageZoneIds.map((id) => zoneName(id)).join(', ')
    : 'All active zones';
  const slots = state.staff.preferredTimeSlotIds?.length
    ? state.staff.preferredTimeSlotIds.map((id) => slotLabel(id)).join(', ')
    : 'Any active time slot';

  welcome.textContent = `${state.staff.fullName || state.staff.username} • ${state.staff.vehicleType || 'Own vehicle'}${state.staff.vehicleNumber ? ` • ${state.staff.vehicleNumber}` : ''}`;
  profileWrap.innerHTML = `
    <div class="staff-meta-row">
      <span>Name</span>
      <strong>${escapeHtml(state.staff.fullName || 'Delivery staff')}</strong>
    </div>
    <div class="staff-meta-row">
      <span>Availability</span>
      <strong><span class="staff-pill ${badgeClass(state.staff.availabilityStatus)}">${escapeHtml(statusLabel(state.staff.availabilityStatus))}</span></strong>
    </div>
    <div class="staff-meta-row">
      <span>Contact</span>
      <strong>${escapeHtml(state.staff.phone || state.staff.email || state.staff.username || '—')}</strong>
    </div>
    <div class="staff-meta-row">
      <span>Coverage zones</span>
      <strong>${escapeHtml(coverage)}</strong>
    </div>
    <div class="staff-meta-row">
      <span>Preferred slots</span>
      <strong>${escapeHtml(slots)}</strong>
    </div>
    <div class="staff-meta-row">
      <span>Capacity</span>
      <strong>${escapeHtml(`${state.staff.maxStopsPerDay || 0} stops / day • ${state.staff.maxStopsPerSlot || 0} per slot`)}</strong>
    </div>
  `;
}

function computeStats() {
  const issues = state.orders.filter((order) => order.delivery?.lastActivityKey === 'issue').length;
  const out = state.orders.filter((order) => order.status === 'out_for_delivery').length;
  const delivered = state.orders.filter((order) => order.status === 'delivered').length;
  return {
    assigned: state.orders.length,
    out,
    delivered,
    issues,
  };
}

function renderStats() {
  const wrap = byId('staffStatsWrap');
  if (!wrap) return;
  const stats = computeStats();
  wrap.innerHTML = `
    <div class="staff-stat-card">
      <div class="k">Assigned orders</div>
      <div class="v">${stats.assigned}</div>
      <div class="small-note">Selected date and filter</div>
    </div>
    <div class="staff-stat-card">
      <div class="k">Out for delivery</div>
      <div class="v">${stats.out}</div>
      <div class="small-note">Trips currently on the road</div>
    </div>
    <div class="staff-stat-card">
      <div class="k">Delivered</div>
      <div class="v">${stats.delivered}</div>
      <div class="small-note">Completed handovers</div>
    </div>
    <div class="staff-stat-card">
      <div class="k">Need admin attention</div>
      <div class="v">${stats.issues}</div>
      <div class="small-note">Orders with latest issue log</div>
    </div>
  `;
}

function currentWindowLabel(order) {
  const date = order.delivery?.scheduledDate || order.delivery?.preferredDate || order.delivery?.estimatedDate || '';
  const slotId = order.delivery?.scheduledTimeSlot || order.delivery?.preferredTimeSlot || order.delivery?.estimatedTimeSlot || '';
  return `${formatDateOnly(date)} • ${slotLabel(slotId)}`;
}

function phoneLink(phone) {
  const digits = toDigits(phone);
  return digits ? `tel:+${digits}` : '#';
}

function whatsappLink(order) {
  const digits = toDigits(order.customer?.phone || order.delivery?.recipientPhone);
  const message = `Hello ${order.delivery?.recipientName || order.customer?.name || ''}, this is the Batalawatta delivery team about your plant order ${order.orderCode || order._id}.`;
  return digits ? `https://wa.me/${digits}?text=${encodeURIComponent(message)}` : '#';
}

function mapsLink(order) {
  const query = order.customer?.address || order.delivery?.landmark || '';
  return query ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}` : '#';
}

function itemListHtml(order) {
  return (order.items || [])
    .map((item) => `
      <div class="staff-item-chip">
        <div>
          <strong>${escapeHtml(item.name || 'Plant')}</strong>
          <div class="small-note">Qty ${Number(item.qty || 1)} • ${money(item.price || 0)} each</div>
        </div>
        <div><strong>${money((Number(item.price || 0) * Number(item.qty || 1)))}</strong></div>
      </div>
    `)
    .join('');
}

function logListHtml(order) {
  const logs = Array.isArray(order.delivery?.activityLogs) ? order.delivery.activityLogs.slice(0, 5) : [];
  if (!logs.length) {
    return '<div class="staff-item-chip">No delivery activity logged yet.</div>';
  }
  return logs
    .map((entry) => `
      <div class="staff-log-item">
        <div class="staff-log-head">
          <div>
            <strong>${escapeHtml(entry.label || 'Update')}</strong>
            <div class="small-note">${escapeHtml(entry.loggedByName || 'Staff update')}</div>
          </div>
          <div class="staff-log-time">${escapeHtml(formatDateTime(entry.at))}</div>
        </div>
        ${entry.note ? `<div>${escapeHtml(entry.note)}</div>` : ''}
        ${entry.recipientName ? `<div class="small-note">Recipient: ${escapeHtml(entry.recipientName)}</div>` : ''}
        ${entry.cashCollected ? `<div class="small-note">Cash collected: ${escapeHtml(money(entry.cashCollected))}</div>` : ''}
        ${entry.issueCode ? `<div class="small-note">Issue code: ${escapeHtml(entry.issueCode)}</div>` : ''}
        ${entry.proofPhotoUrl ? `<div class="staff-log-proof"><a class="staff-muted-link" href="${escapeHtml(entry.proofPhotoUrl)}" target="_blank" rel="noopener">Open proof file</a></div>` : ''}
      </div>
    `)
    .join('');
}

function isActionDisabled(order, actionKey) {
  if (['delivered', 'cancelled'].includes(order.status)) return actionKey !== 'issue';
  const lastKey = order.delivery?.lastActivityKey || '';
  if (actionKey === 'accepted' && lastKey === 'accepted') return true;
  if (actionKey === 'loaded' && ['loaded', 'departed', 'arrived', 'delivered'].includes(lastKey)) return true;
  if (actionKey === 'departed' && order.status === 'out_for_delivery') return true;
  if (actionKey === 'arrived' && ['arrived', 'delivered'].includes(lastKey)) return true;
  if (actionKey === 'delivered' && order.status === 'delivered') return true;
  return false;
}

function actionButtonsHtml(order) {
  return Object.entries(ACTIVITY_META)
    .map(([key, meta]) => `
      <button class="btn ${key === 'issue' ? 'btn-outline' : ''} staff-activity-btn" type="button" data-order-id="${order._id}" data-activity-key="${key}" ${isActionDisabled(order, key) ? 'disabled' : ''}>
        ${escapeHtml(meta.label)}
      </button>
    `)
    .join('');
}

function renderOrders() {
  const wrap = byId('staffOrdersWrap');
  if (!wrap) return;
  if (!state.orders.length) {
    wrap.innerHTML = `
      <div class="staff-empty">
        <h3>No assigned orders found</h3>
        <p>Selected date and filter එකට match වෙන orders නැත්නම් admin assign කරනකම් නැවත refresh කරන්න.</p>
      </div>
    `;
    return;
  }

  const sorted = [...state.orders].sort((a, b) => {
    const routeA = Number(a.delivery?.routeSequence || 0) || 9999;
    const routeB = Number(b.delivery?.routeSequence || 0) || 9999;
    if (routeA !== routeB) return routeA - routeB;
    return new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
  });

  wrap.innerHTML = sorted
    .map((order) => `
      <article class="staff-order-card">
        <div class="staff-order-top">
          <div class="staff-order-title">
            <div class="staff-order-code">${escapeHtml(order.orderCode || order._id)}</div>
            <div class="small-note">Created ${escapeHtml(formatDateTime(order.createdAt))}</div>
          </div>
          <div>
            <div class="staff-order-route-badge">Route #${Number(order.delivery?.routeSequence || 0) || '—'}</div>
            <div style="margin-top:8px;"><span class="staff-pill ${badgeClass(order.status)}">${escapeHtml(statusLabel(order.status))}</span></div>
          </div>
        </div>

        <div class="staff-grid-two">
          <div class="staff-detail-box">
            <span>Customer</span>
            <strong>${escapeHtml(order.customer?.name || '—')}</strong>
            <div class="small-note">${escapeHtml(order.customer?.phone || order.delivery?.recipientPhone || 'No phone')}</div>
          </div>
          <div class="staff-detail-box">
            <span>Delivery window</span>
            <strong>${escapeHtml(currentWindowLabel(order))}</strong>
            <div class="small-note">${escapeHtml(zoneName(order.delivery?.zoneId, order.delivery?.zoneName))}</div>
          </div>
          <div class="staff-detail-box">
            <span>Payment</span>
            <strong>${escapeHtml(statusLabel(order.payment?.status || order.payment?.methodCode || 'Pending'))}</strong>
            <div class="small-note">${escapeHtml(order.payment?.methodLabel || order.payment?.methodCode || '—')} • Total ${escapeHtml(money(order.total || 0))}</div>
          </div>
          <div class="staff-detail-box">
            <span>Last update</span>
            <strong>${escapeHtml(order.delivery?.lastActivityLabel || 'No delivery activity yet')}</strong>
            <div class="small-note">${escapeHtml(formatDateTime(order.delivery?.lastActivityAt || order.updatedAt))}</div>
          </div>
        </div>

        <div class="staff-detail-box">
          <span>Delivery address</span>
          <strong>${escapeHtml(order.customer?.address || '—')}</strong>
          ${order.delivery?.landmark ? `<div class="small-note">Landmark: ${escapeHtml(order.delivery.landmark)}</div>` : ''}
          ${order.delivery?.instructions ? `<div class="small-note">Instructions: ${escapeHtml(order.delivery.instructions)}</div>` : ''}
        </div>

        <div class="staff-contact-actions">
          <a class="btn btn-outline" href="${escapeHtml(phoneLink(order.customer?.phone || order.delivery?.recipientPhone))}">Call receiver</a>
          <a class="btn btn-outline" href="${escapeHtml(whatsappLink(order))}" target="_blank" rel="noopener">WhatsApp</a>
          <a class="btn btn-outline" href="${escapeHtml(mapsLink(order))}" target="_blank" rel="noopener">Open map</a>
        </div>

        <div>
          <h4 style="margin:0 0 10px;">Items</h4>
          <div class="staff-items-list">${itemListHtml(order)}</div>
        </div>

        <div>
          <h4 style="margin:0 0 10px;">Quick actions</h4>
          <div class="staff-action-row">${actionButtonsHtml(order)}</div>
        </div>

        <div>
          <h4 style="margin:0 0 10px;">Activity log</h4>
          <div class="staff-logs-list">${logListHtml(order)}</div>
        </div>
      </article>
    `)
    .join('');
}

function renderAll() {
  renderProfile();
  renderStats();
  renderOrders();
}

async function loadConfig() {
  state.config = await api('/delivery/config');
}

async function loadProfile() {
  const data = await api('/delivery/staff/me', {
    headers: authHeaders(),
  });
  state.staff = data.staff;
  sessionStorage.setItem(PROFILE_KEY, JSON.stringify(data.staff));
}

async function loadOrders() {
  const params = new URLSearchParams();
  if (state.selectedDate) params.set('date', state.selectedDate);
  if (state.selectedStatus) params.set('status', state.selectedStatus);
  state.orders = await api(`/delivery/staff/orders?${params.toString()}`, {
    headers: authHeaders(),
  });
}

async function refreshDashboard() {
  try {
    setMessage('Loading assigned orders...');
    if (!state.config) {
      await loadConfig();
    }
    await loadProfile();
    await loadOrders();
    renderAll();
    setMessage(`Showing ${state.orders.length} assigned order(s) for ${formatDateOnly(state.selectedDate)}.`, 'good');
  } catch (error) {
    if (error.status === 401) {
      clearSession();
      showLoginView();
      setError('staffLoginError', 'Your session ended. Please log in again.');
      return;
    }
    setMessage(error.message || 'Failed to load delivery dashboard.', 'error');
  }
}

function openActivityModal(orderId, activityKey) {
  const order = state.orders.find((item) => item._id === orderId);
  const meta = ACTIVITY_META[activityKey];
  if (!order || !meta) return;

  state.currentModal = { orderId, activityKey };
  byId('activityOrderId').value = orderId;
  byId('activityKey').value = activityKey;
  byId('staffModalTitle').textContent = meta.label;
  byId('staffModalSub').textContent = meta.subtitle;
  byId('staffModalOrderBrief').innerHTML = `
    <strong>${escapeHtml(order.orderCode || order._id)}</strong>
    <div>${escapeHtml(order.customer?.name || 'Customer')} • ${escapeHtml(zoneName(order.delivery?.zoneId, order.delivery?.zoneName))}</div>
    <div>${escapeHtml(currentWindowLabel(order))}</div>
  `;

  byId('activityNoteField').value = '';
  byId('recipientNameField').value = order.delivery?.recipientName || order.customer?.name || '';
  byId('cashCollectedField').value = order.payment?.methodCode === 'cod' ? String(Math.round(Number(order.total || 0))) : '';
  byId('issueCodeField').value = '';
  byId('proofPhotoField').value = '';
  setError('staffActivityError', '');

  const showRecipient = Boolean(meta.showRecipient);
  const showCash = Boolean(meta.showCash && order.payment?.methodCode === 'cod');
  const showIssueCode = Boolean(meta.showIssueCode);
  byId('recipientWrap').style.display = showRecipient ? 'grid' : 'none';
  byId('cashWrap').style.display = showCash ? 'grid' : 'none';
  byId('issueCodeWrap').style.display = showIssueCode ? 'grid' : 'none';

  byId('staffActivityModal').style.display = 'grid';
}

function closeActivityModal() {
  state.currentModal = null;
  byId('staffActivityModal').style.display = 'none';
  setError('staffActivityError', '');
}

async function submitActivity(event) {
  event.preventDefault();
  if (!state.currentModal) return;

  const orderId = byId('activityOrderId').value;
  const activityKey = byId('activityKey').value;
  const meta = ACTIVITY_META[activityKey];
  const note = cleanText(byId('activityNoteField').value);
  const issueCode = cleanText(byId('issueCodeField').value);
  const recipientName = cleanText(byId('recipientNameField').value);
  const cashCollected = Number(byId('cashCollectedField').value || 0);
  const proofFile = byId('proofPhotoField').files?.[0] || null;

  if (meta?.requireNote && !note) {
    setError('staffActivityError', 'Please add a short note for this update.');
    return;
  }
  if (meta?.showIssueCode && !issueCode) {
    setError('staffActivityError', 'Please select an issue type.');
    return;
  }

  const payload = {
    activityKey,
    note,
    issueCode,
    recipientName,
    cashCollected: Number.isFinite(cashCollected) ? cashCollected : 0,
  };

  const formData = new FormData();
  formData.append('payload', JSON.stringify(payload));
  if (proofFile) {
    formData.append('proofPhoto', proofFile);
  }

  try {
    setError('staffActivityError', '');
    const response = await fetch(`${API_BASE}/delivery/staff/orders/${orderId}/activity`, {
      method: 'POST',
      headers: authHeaders(),
      body: formData,
    });
    const text = await response.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { message: text };
    }

    if (!response.ok) {
      throw new Error(data?.message || 'Failed to save activity.');
    }

    state.orders = state.orders.map((order) => (order._id === orderId ? data.order : order));
    renderAll();
    closeActivityModal();
    setMessage(`${meta.label} saved for ${data.order.orderCode || data.order._id}.`, 'good');
  } catch (error) {
    setError('staffActivityError', error.message || 'Failed to save activity.');
  }
}

async function handleLogin(event) {
  event.preventDefault();
  setError('staffLoginError', '');
  const username = cleanText(byId('staffUsername').value).toLowerCase();
  const password = byId('staffPassword').value || '';

  try {
    const data = await api('/delivery/staff/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    setSession(data.token, data.staff);
    showAppView();
    await refreshDashboard();
  } catch (error) {
    setError('staffLoginError', error.message || 'Unable to sign in.');
  }
}

async function boot() {
  byId('staffDateFilter').value = state.selectedDate;
  byId('staffStatusFilter').value = state.selectedStatus;

  if (!getToken()) {
    clearSession();
    showLoginView();
    return;
  }

  showAppView();
  await refreshDashboard();
}

function bindEvents() {
  byId('staffLoginForm').addEventListener('submit', handleLogin);
  byId('staffLogoutBtn').addEventListener('click', () => {
    clearSession();
    showLoginView();
    setMessage('');
  });
  byId('staffRefreshBtn').addEventListener('click', refreshDashboard);
  byId('staffDateFilter').addEventListener('change', async (event) => {
    state.selectedDate = event.target.value || todayIso();
    await refreshDashboard();
  });
  byId('staffStatusFilter').addEventListener('change', async (event) => {
    state.selectedStatus = event.target.value || '';
    await refreshDashboard();
  });
  byId('staffOrdersWrap').addEventListener('click', (event) => {
    const button = event.target.closest('.staff-activity-btn');
    if (!button) return;
    openActivityModal(button.dataset.orderId, button.dataset.activityKey);
  });
  byId('staffModalClose').addEventListener('click', closeActivityModal);
  byId('staffModalCancel').addEventListener('click', closeActivityModal);
  byId('staffActivityForm').addEventListener('submit', submitActivity);
  byId('staffActivityModal').addEventListener('click', (event) => {
    if (event.target === byId('staffActivityModal')) {
      closeActivityModal();
    }
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  bindEvents();
  await boot();
});
