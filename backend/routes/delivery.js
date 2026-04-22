import express from 'express';
import bcrypt from 'bcryptjs';
import Order from '../models/Order.js';
import DeliveryBoy from '../models/DeliveryBoy.js';
import { requireAdmin } from '../middleware/adminAuth.js';
import { requireDeliveryStaff, signDeliveryStaffToken } from '../middleware/deliveryStaffAuth.js';
import {
  buildAdminDeliveryConfig,
  buildPublicDeliveryConfig,
  ensureDeliverySettings,
  formatDateISO,
  getTimeSlotById,
  getZoneById,
  listActiveTimeSlots,
  listActiveZones,
  normalizeDeliverySettingsPayload,
} from '../config/deliverySettings.js';
import { createTimelineEntry, normalizeTimeline } from '../config/delivery.js';
import { createUploader, resolveMediaUrl, toPublicUploadPath } from '../utils/uploads.js';

const router = express.Router();
const proofUpload = createUploader('delivery-proofs', 8);

const OPEN_ORDER_STATUSES = ['pending', 'confirmed', 'preparing', 'scheduled', 'out_for_delivery'];
const STAFF_ACTIVITY_META = {
  accepted: {
    label: 'Route accepted',
    timelineStatus: null,
    defaultNote: 'Delivery assignment accepted by the delivery team.',
  },
  loaded: {
    label: 'Plants loaded',
    timelineStatus: null,
    defaultNote: 'Plants have been loaded to the delivery vehicle.',
  },
  departed: {
    label: 'Left nursery',
    timelineStatus: 'out_for_delivery',
    defaultNote: 'The delivery team has left the nursery and is on the way.',
  },
  arrived: {
    label: 'Arrived nearby',
    timelineStatus: null,
    defaultNote: 'The delivery team is near the destination.',
  },
  delivered: {
    label: 'Delivered successfully',
    timelineStatus: 'delivered',
    defaultNote: 'Order handed over successfully.',
  },
  issue: {
    label: 'Delivery issue reported',
    timelineStatus: null,
    defaultNote: 'A delivery issue was reported by the delivery team.',
    requiresNote: true,
  },
};

function cleanText(value) {
  return String(value || '').trim();
}

function toNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function parseJsonField(body, key, fallback = {}) {
  const raw = body?.[key];
  if (!raw) return fallback;
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(String(raw));
  } catch {
    return fallback;
  }
}

function todayIso() {
  return formatDateISO(new Date());
}

function normalizeUsername(value) {
  return cleanText(value).toLowerCase();
}

function staffDisplayName(staff) {
  return cleanText(staff?.fullName) || cleanText(staff?.username) || 'Delivery staff';
}

function sanitizeStaff(staffDoc, extras = {}) {
  const staff = staffDoc?.toObject ? staffDoc.toObject() : { ...staffDoc };
  return {
    _id: staff._id,
    fullName: cleanText(staff.fullName),
    username: normalizeUsername(staff.username),
    email: cleanText(staff.email),
    phone: cleanText(staff.phone),
    isActive: staff.isActive !== false,
    availabilityStatus: cleanText(staff.availabilityStatus) || 'available',
    vehicleType: cleanText(staff.vehicleType),
    vehicleNumber: cleanText(staff.vehicleNumber),
    coverageZoneIds: Array.isArray(staff.coverageZoneIds) ? staff.coverageZoneIds.map((id) => cleanText(id)).filter(Boolean) : [],
    preferredTimeSlotIds: Array.isArray(staff.preferredTimeSlotIds) ? staff.preferredTimeSlotIds.map((id) => cleanText(id)).filter(Boolean) : [],
    maxStopsPerDay: Math.max(1, toNumber(staff.maxStopsPerDay, 10)),
    maxStopsPerSlot: Math.max(1, toNumber(staff.maxStopsPerSlot, 4)),
    notes: cleanText(staff.notes),
    sortOrder: toNumber(staff.sortOrder, 0),
    lastLoginAt: staff.lastLoginAt || null,
    createdAt: staff.createdAt || null,
    updatedAt: staff.updatedAt || null,
    ...extras,
  };
}

function resolveActivityLogMedia(req, entry = {}) {
  return {
    key: cleanText(entry.key),
    label: cleanText(entry.label),
    note: cleanText(entry.note),
    recipientName: cleanText(entry.recipientName),
    cashCollected: toNumber(entry.cashCollected, 0),
    issueCode: cleanText(entry.issueCode),
    loggedByRole: cleanText(entry.loggedByRole),
    loggedById: cleanText(entry.loggedById),
    loggedByName: cleanText(entry.loggedByName),
    at: entry.at || null,
    proofPhotoUrl: entry.proofPhotoUrl ? resolveMediaUrl(req, entry.proofPhotoUrl) : '',
    proofOriginalName: cleanText(entry.proofOriginalName),
  };
}

function decorateDeliveryOrder(orderDoc, req) {
  const order = orderDoc?.toObject ? orderDoc.toObject() : { ...orderDoc };
  const delivery = order.delivery || {};
  const payment = order.payment || {};
  return {
    _id: order._id,
    orderCode: cleanText(order.orderCode),
    createdAt: order.createdAt || null,
    updatedAt: order.updatedAt || null,
    status: cleanText(order.status) || 'pending',
    total: toNumber(order.total, 0),
    subtotal: toNumber(order.subtotal, 0),
    notes: cleanText(order.notes),
    adminNote: cleanText(order.adminNote),
    customer: {
      name: cleanText(order.customer?.name),
      phone: cleanText(order.customer?.phone),
      email: cleanText(order.customer?.email),
      address: cleanText(order.customer?.address),
    },
    payment: {
      methodCode: cleanText(payment.methodCode),
      methodLabel: cleanText(payment.methodLabel || order.paymentMethod),
      status: cleanText(payment.status),
      note: cleanText(payment.note),
      amountExpected: toNumber(payment.amountExpected, order.total),
      amountReceived: toNumber(payment.amountReceived, 0),
      currency: cleanText(payment.currency) || 'LKR',
      payerName: cleanText(payment.payerName),
      payerPhone: cleanText(payment.payerPhone),
      reference: cleanText(payment.reference),
      paidAt: cleanText(payment.paidAt),
      slipUrl: payment.slipUrl ? resolveMediaUrl(req, payment.slipUrl) : '',
      slipOriginalName: cleanText(payment.slipOriginalName),
      verificationNote: cleanText(payment.verificationNote),
      verifiedAt: payment.verifiedAt || null,
      verifiedBy: cleanText(payment.verifiedBy),
    },
    items: Array.isArray(order.items)
      ? order.items.map((item) => ({
          plant: item.plant?._id || item.plant || null,
          name: cleanText(item.name || item.plant?.name),
          price: toNumber(item.price, 0),
          qty: Math.max(1, toNumber(item.qty, 1)),
        }))
      : [],
    delivery: {
      method: cleanText(delivery.method) || 'nursery_vehicle',
      vehicleType: cleanText(delivery.vehicleType),
      zoneId: cleanText(delivery.zoneId),
      zoneName: cleanText(delivery.zoneName),
      fee: toNumber(delivery.fee, 0),
      preferredDate: cleanText(delivery.preferredDate),
      preferredTimeSlot: cleanText(delivery.preferredTimeSlot),
      scheduledDate: cleanText(delivery.scheduledDate),
      scheduledTimeSlot: cleanText(delivery.scheduledTimeSlot),
      estimatedDate: cleanText(delivery.estimatedDate),
      estimatedTimeSlot: cleanText(delivery.estimatedTimeSlot),
      leadTimeLabel: cleanText(delivery.leadTimeLabel),
      recipientName: cleanText(delivery.recipientName),
      recipientPhone: cleanText(delivery.recipientPhone),
      landmark: cleanText(delivery.landmark),
      instructions: cleanText(delivery.instructions),
      deliveryBoyId: delivery.deliveryBoyId ? String(delivery.deliveryBoyId) : '',
      deliveryBoyName: cleanText(delivery.deliveryBoyName),
      deliveryBoyPhone: cleanText(delivery.deliveryBoyPhone),
      deliveryBoyUsername: cleanText(delivery.deliveryBoyUsername),
      vehicleNumber: cleanText(delivery.vehicleNumber),
      routeSequence: toNumber(delivery.routeSequence, 0),
      assignedAt: delivery.assignedAt || null,
      assignedBy: cleanText(delivery.assignedBy),
      lastActivityKey: cleanText(delivery.lastActivityKey),
      lastActivityLabel: cleanText(delivery.lastActivityLabel),
      lastActivityAt: delivery.lastActivityAt || null,
      codCollectedAmount: toNumber(delivery.codCollectedAmount, 0),
      codCollectedAt: delivery.codCollectedAt || null,
      deliveryProofUrl: delivery.deliveryProofUrl ? resolveMediaUrl(req, delivery.deliveryProofUrl) : '',
      deliveryProofOriginalName: cleanText(delivery.deliveryProofOriginalName),
      activityLogs: Array.isArray(delivery.activityLogs)
        ? delivery.activityLogs.map((entry) => resolveActivityLogMedia(req, entry)).sort((a, b) => new Date(b.at || 0) - new Date(a.at || 0))
        : [],
    },
    statusTimeline: normalizeTimeline(order.status, order.statusTimeline, order.createdAt).map((entry) => ({
      status: cleanText(entry.status),
      title: cleanText(entry.title),
      note: cleanText(entry.note),
      updatedBy: cleanText(entry.updatedBy),
      at: entry.at || null,
    })),
  };
}

function orderTargetDate(order) {
  return cleanText(order?.delivery?.scheduledDate) || cleanText(order?.delivery?.preferredDate) || cleanText(order?.delivery?.estimatedDate) || todayIso();
}

function orderTargetSlot(order) {
  return cleanText(order?.delivery?.scheduledTimeSlot) || cleanText(order?.delivery?.preferredTimeSlot) || cleanText(order?.delivery?.estimatedTimeSlot) || '';
}

function buildWorkloadMap(staffList, orders, targetDate) {
  const map = new Map();
  for (const staff of staffList) {
    map.set(String(staff._id), {
      openAssigned: 0,
      assignedToday: 0,
      outForDeliveryCount: 0,
      deliveredCount: 0,
      slotCounts: {},
      zoneCounts: {},
      nextRouteSequence: 1,
    });
  }

  for (const order of orders) {
    const deliveryBoyId = order?.delivery?.deliveryBoyId ? String(order.delivery.deliveryBoyId) : '';
    if (!deliveryBoyId || !map.has(deliveryBoyId)) continue;

    const workload = map.get(deliveryBoyId);
    const sameDate = orderTargetDate(order) === targetDate;
    workload.openAssigned += 1;
    if (sameDate) {
      workload.assignedToday += 1;
      const slot = orderTargetSlot(order);
      const zoneId = cleanText(order?.delivery?.zoneId);
      if (slot) workload.slotCounts[slot] = (workload.slotCounts[slot] || 0) + 1;
      if (zoneId) workload.zoneCounts[zoneId] = (workload.zoneCounts[zoneId] || 0) + 1;
      workload.nextRouteSequence = Math.max(workload.nextRouteSequence, toNumber(order?.delivery?.routeSequence, 0) + 1);
    }
    if (order.status === 'out_for_delivery') workload.outForDeliveryCount += 1;
    if (order.status === 'delivered') workload.deliveredCount += 1;
  }

  return map;
}

function buildRecommendations(order, staffList, openOrders, settingsConfig, targetDate = '') {
  const selectedDate = targetDate || orderTargetDate(order);
  const selectedSlot = orderTargetSlot(order);
  const zoneId = cleanText(order?.delivery?.zoneId);
  const zoneName = cleanText(order?.delivery?.zoneName);
  const rules = settingsConfig?.dispatchRules || {};
  const fallbackDayCap = Math.max(1, toNumber(rules.maxStopsPerBoyPerDay, 10));
  const fallbackSlotCap = Math.max(1, toNumber(rules.maxStopsPerBoyPerSlot, 4));
  const workloads = buildWorkloadMap(staffList, openOrders, selectedDate);

  return staffList
    .map((staff) => {
      const workload = workloads.get(String(staff._id)) || {
        openAssigned: 0,
        assignedToday: 0,
        outForDeliveryCount: 0,
        deliveredCount: 0,
        slotCounts: {},
        zoneCounts: {},
        nextRouteSequence: 1,
      };
      const staffData = sanitizeStaff(staff);
      const coversZone = !staffData.coverageZoneIds.length || staffData.coverageZoneIds.includes(zoneId);
      const prefersSlot = !selectedSlot || !staffData.preferredTimeSlotIds.length || staffData.preferredTimeSlotIds.includes(selectedSlot);
      const assignedInSlot = selectedSlot ? toNumber(workload.slotCounts[selectedSlot], 0) : 0;
      const sameZoneToday = zoneId ? toNumber(workload.zoneCounts[zoneId], 0) : 0;
      const maxStopsPerDay = Math.max(1, toNumber(staffData.maxStopsPerDay, fallbackDayCap));
      const maxStopsPerSlot = Math.max(1, toNumber(staffData.maxStopsPerSlot, fallbackSlotCap));

      let score = 100;
      if (!staffData.isActive) score -= 200;
      if (staffData.availabilityStatus === 'available') score += 8;
      if (staffData.availabilityStatus === 'busy') score -= 10;
      if (['off_duty', 'leave'].includes(staffData.availabilityStatus)) score -= 140;
      score += coversZone ? 30 : -18;
      score += prefersSlot ? 4 : -4;
      score -= workload.assignedToday * 12;
      score -= assignedInSlot * 10;
      if (rules.clusterByZone !== false && sameZoneToday > 0) {
        score += Math.min(12, sameZoneToday * 4);
      }
      if (workload.assignedToday >= maxStopsPerDay) score -= 35;
      if (assignedInSlot >= maxStopsPerSlot) score -= 25;
      if (workload.outForDeliveryCount > 0 && selectedDate === todayIso()) {
        score -= Math.min(18, workload.outForDeliveryCount * 6);
      }
      score += Math.min(10, Math.max(0, maxStopsPerDay - workload.assignedToday));

      const reasons = [
        coversZone ? `covers ${zoneName || zoneId || 'the selected area'}` : 'outside preferred zone coverage',
        `${workload.assignedToday}/${maxStopsPerDay} jobs on ${selectedDate || 'selected date'}`,
      ];
      if (selectedSlot) {
        reasons.push(`${assignedInSlot}/${maxStopsPerSlot} jobs in ${selectedSlot}`);
      }
      if (sameZoneToday > 0) {
        reasons.push(`${sameZoneToday} nearby stop(s) already on route`);
      }

      return {
        score,
        recommended: score > 0 && staffData.isActive && !['off_duty', 'leave'].includes(staffData.availabilityStatus),
        suggestedRouteSequence: Math.max(1, workload.nextRouteSequence || 1),
        reasons,
        staff: sanitizeStaff(staff, {
          currentWorkload: {
            openAssigned: workload.openAssigned,
            assignedToday: workload.assignedToday,
            assignedInSlot,
            sameZoneToday,
            outForDeliveryCount: workload.outForDeliveryCount,
            nextRouteSequence: Math.max(1, workload.nextRouteSequence || 1),
          },
        }),
      };
    })
    .sort((a, b) => b.score - a.score);
}

function validateStaffPayload(payload = {}) {
  const errors = [];
  if (!cleanText(payload.fullName)) errors.push('Full name is required.');
  if (!normalizeUsername(payload.username)) errors.push('Username is required.');
  if (!cleanText(payload.phone)) errors.push('Phone number is required.');
  return errors;
}

function normalizeStaffPayload(payload = {}, existingStaff = null) {
  const existing = existingStaff?.toObject ? existingStaff.toObject() : (existingStaff || {});
  return {
    fullName: cleanText(payload.fullName) || cleanText(existing.fullName),
    username: normalizeUsername(payload.username) || normalizeUsername(existing.username),
    email: cleanText(payload.email) || cleanText(existing.email),
    phone: cleanText(payload.phone) || cleanText(existing.phone),
    isActive: payload.isActive === undefined ? existing.isActive !== false : Boolean(payload.isActive),
    availabilityStatus: cleanText(payload.availabilityStatus) || cleanText(existing.availabilityStatus) || 'available',
    vehicleType: cleanText(payload.vehicleType) || cleanText(existing.vehicleType) || 'Own vehicle',
    vehicleNumber: cleanText(payload.vehicleNumber) || cleanText(existing.vehicleNumber),
    coverageZoneIds: Array.isArray(payload.coverageZoneIds)
      ? payload.coverageZoneIds.map((id) => cleanText(id)).filter(Boolean)
      : Array.isArray(existing.coverageZoneIds)
        ? existing.coverageZoneIds.map((id) => cleanText(id)).filter(Boolean)
        : [],
    preferredTimeSlotIds: Array.isArray(payload.preferredTimeSlotIds)
      ? payload.preferredTimeSlotIds.map((id) => cleanText(id)).filter(Boolean)
      : Array.isArray(existing.preferredTimeSlotIds)
        ? existing.preferredTimeSlotIds.map((id) => cleanText(id)).filter(Boolean)
        : [],
    maxStopsPerDay: Math.max(1, toNumber(payload.maxStopsPerDay, existing.maxStopsPerDay ?? 10)),
    maxStopsPerSlot: Math.max(1, toNumber(payload.maxStopsPerSlot, existing.maxStopsPerSlot ?? 4)),
    notes: cleanText(payload.notes) || cleanText(existing.notes),
    sortOrder: toNumber(payload.sortOrder, existing.sortOrder ?? 0),
  };
}

async function getAdminTeamWithWorkloads(targetDate = todayIso()) {
  const staffList = await DeliveryBoy.find().sort({ sortOrder: 1, fullName: 1 });
  const openOrders = await Order.find({ status: { $in: OPEN_ORDER_STATUSES } }).select('status delivery total orderCode customer');
  const workloads = buildWorkloadMap(staffList, openOrders, targetDate);

  return staffList.map((staff) => {
    const workload = workloads.get(String(staff._id)) || {
      openAssigned: 0,
      assignedToday: 0,
      outForDeliveryCount: 0,
      deliveredCount: 0,
      slotCounts: {},
      zoneCounts: {},
      nextRouteSequence: 1,
    };
    return sanitizeStaff(staff, {
      currentWorkload: {
        openAssigned: workload.openAssigned,
        assignedToday: workload.assignedToday,
        outForDeliveryCount: workload.outForDeliveryCount,
        nextRouteSequence: Math.max(1, workload.nextRouteSequence || 1),
      },
    });
  });
}

router.get('/config', async (_req, res) => {
  try {
    const settings = await ensureDeliverySettings();
    res.json(buildPublicDeliveryConfig(settings));
  } catch (err) {
    res.status(500).json({ error: true, message: 'Failed to load delivery config', details: err.message });
  }
});

router.get('/admin/settings', requireAdmin, async (_req, res) => {
  try {
    const settings = await ensureDeliverySettings();
    res.json(buildAdminDeliveryConfig(settings));
  } catch (err) {
    res.status(500).json({ error: true, message: 'Failed to load delivery settings', details: err.message });
  }
});

router.put('/admin/settings', requireAdmin, async (req, res) => {
  try {
    const settings = await ensureDeliverySettings();
    const normalized = normalizeDeliverySettingsPayload(req.body || {}, settings);
    settings.set(normalized);
    await settings.save();
    res.json({ ok: true, settings: buildAdminDeliveryConfig(settings) });
  } catch (err) {
    res.status(500).json({ error: true, message: 'Failed to save delivery settings', details: err.message });
  }
});

router.get('/admin/staff', requireAdmin, async (req, res) => {
  try {
    const date = cleanText(req.query.date) || todayIso();
    const team = await getAdminTeamWithWorkloads(date);
    res.json(team);
  } catch (err) {
    res.status(500).json({ error: true, message: 'Failed to load delivery team', details: err.message });
  }
});

router.post('/admin/staff', requireAdmin, async (req, res) => {
  try {
    const payload = req.body || {};
    const errors = validateStaffPayload(payload);
    if (!cleanText(payload.password)) errors.push('Temporary password is required.');
    if (errors.length) {
      return res.status(400).json({ error: true, message: errors.join(' ') });
    }

    const username = normalizeUsername(payload.username);
    const exists = await DeliveryBoy.findOne({ username });
    if (exists) {
      return res.status(400).json({ error: true, message: 'This username is already used by another delivery boy.' });
    }

    const settings = await ensureDeliverySettings();
    const zoneIds = new Set(listActiveZones(settings, { includeInactive: true }).map((zone) => zone.id));
    const slotIds = new Set(listActiveTimeSlots(settings, { includeInactive: true }).map((slot) => slot.id));
    const normalized = normalizeStaffPayload(payload);
    normalized.coverageZoneIds = normalized.coverageZoneIds.filter((id) => zoneIds.has(id));
    normalized.preferredTimeSlotIds = normalized.preferredTimeSlotIds.filter((id) => slotIds.has(id));
    normalized.passwordHash = await bcrypt.hash(String(payload.password), 10);

    const created = await DeliveryBoy.create(normalized);
    res.json({ ok: true, staff: sanitizeStaff(created) });
  } catch (err) {
    res.status(500).json({ error: true, message: 'Failed to create delivery boy', details: err.message });
  }
});

router.put('/admin/staff/:id', requireAdmin, async (req, res) => {
  try {
    const staff = await DeliveryBoy.findById(req.params.id);
    if (!staff) return res.status(404).json({ error: true, message: 'Delivery boy not found' });

    const settings = await ensureDeliverySettings();
    const zoneIds = new Set(listActiveZones(settings, { includeInactive: true }).map((zone) => zone.id));
    const slotIds = new Set(listActiveTimeSlots(settings, { includeInactive: true }).map((slot) => slot.id));

    const normalized = normalizeStaffPayload(req.body || {}, staff);
    const errors = validateStaffPayload(normalized);
    if (errors.length) {
      return res.status(400).json({ error: true, message: errors.join(' ') });
    }

    const usernameTaken = await DeliveryBoy.findOne({ username: normalized.username, _id: { $ne: staff._id } });
    if (usernameTaken) {
      return res.status(400).json({ error: true, message: 'This username is already used by another delivery boy.' });
    }

    normalized.coverageZoneIds = normalized.coverageZoneIds.filter((id) => zoneIds.has(id));
    normalized.preferredTimeSlotIds = normalized.preferredTimeSlotIds.filter((id) => slotIds.has(id));
    staff.set(normalized);

    if (cleanText(req.body?.password)) {
      staff.passwordHash = await bcrypt.hash(String(req.body.password), 10);
    }

    await staff.save();
    res.json({ ok: true, staff: sanitizeStaff(staff) });
  } catch (err) {
    res.status(500).json({ error: true, message: 'Failed to update delivery boy', details: err.message });
  }
});

router.delete('/admin/staff/:id', requireAdmin, async (req, res) => {
  try {
    const staff = await DeliveryBoy.findById(req.params.id);
    if (!staff) return res.status(404).json({ error: true, message: 'Delivery boy not found' });
    staff.isActive = false;
    staff.availabilityStatus = 'off_duty';
    await staff.save();
    res.json({ ok: true, staff: sanitizeStaff(staff) });
  } catch (err) {
    res.status(500).json({ error: true, message: 'Failed to deactivate delivery boy', details: err.message });
  }
});

router.get('/admin/orders/:id/recommendations', requireAdmin, async (req, res) => {
  try {
    const settings = await ensureDeliverySettings();
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ error: true, message: 'Order not found' });

    const staffList = await DeliveryBoy.find({ isActive: true }).sort({ sortOrder: 1, fullName: 1 });
    const openOrders = await Order.find({
      status: { $in: OPEN_ORDER_STATUSES },
      _id: { $ne: order._id },
    }).select('status delivery total orderCode customer');
    const recommendations = buildRecommendations(order, staffList, openOrders, buildAdminDeliveryConfig(settings), cleanText(req.query.date) || orderTargetDate(order));
    res.json({
      orderId: order._id,
      recommendations,
    });
  } catch (err) {
    res.status(500).json({ error: true, message: 'Failed to build recommendations', details: err.message });
  }
});

router.get('/admin/dispatch-board', requireAdmin, async (req, res) => {
  try {
    const date = cleanText(req.query.date) || todayIso();
    const settings = await ensureDeliverySettings();
    const staffList = await DeliveryBoy.find().sort({ sortOrder: 1, fullName: 1 });
    const openOrders = await Order.find({ status: { $in: OPEN_ORDER_STATUSES } }).sort({ createdAt: -1 }).limit(300);
    const decoratedOrders = openOrders.map((order) => decorateDeliveryOrder(order, req));
    const team = await getAdminTeamWithWorkloads(date);

    const ordersWithSuggestions = decoratedOrders.map((order) => ({
      ...order,
      recommendedDrivers: buildRecommendations(order, staffList, openOrders, buildAdminDeliveryConfig(settings), date).slice(0, 3),
    }));

    const summary = {
      date,
      unassigned: ordersWithSuggestions.filter((order) => !order.delivery.deliveryBoyId).length,
      scheduled: ordersWithSuggestions.filter((order) => order.status === 'scheduled').length,
      outForDelivery: ordersWithSuggestions.filter((order) => order.status === 'out_for_delivery').length,
      activeDrivers: team.filter((staff) => staff.isActive && !['off_duty', 'leave'].includes(staff.availabilityStatus)).length,
    };

    res.json({
      summary,
      settings: buildAdminDeliveryConfig(settings),
      team,
      orders: ordersWithSuggestions,
    });
  } catch (err) {
    res.status(500).json({ error: true, message: 'Failed to load dispatch board', details: err.message });
  }
});

router.post('/staff/login', async (req, res) => {
  try {
    const username = normalizeUsername(req.body?.username);
    const password = String(req.body?.password || '');

    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password are required.' });
    }

    const staff = await DeliveryBoy.findOne({ username });
    if (!staff || !staff.isActive) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const ok = await bcrypt.compare(password, staff.passwordHash);
    if (!ok) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    staff.lastLoginAt = new Date();
    await staff.save();

    res.json({
      token: signDeliveryStaffToken(staff),
      staff: sanitizeStaff(staff),
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', details: err.message });
  }
});

router.get('/staff/me', requireDeliveryStaff, async (req, res) => {
  try {
    const staff = await DeliveryBoy.findById(req.deliveryStaff.id);
    if (!staff || !staff.isActive) {
      return res.status(401).json({ message: 'Not authorized' });
    }
    res.json({ ok: true, staff: sanitizeStaff(staff) });
  } catch (err) {
    res.status(500).json({ message: 'Server error', details: err.message });
  }
});

router.get('/staff/orders', requireDeliveryStaff, async (req, res) => {
  try {
    const { status = '', date = '' } = req.query;
    const query = {
      'delivery.deliveryBoyId': req.deliveryStaff.id,
    };
    if (status) query.status = cleanText(status);
    const orders = await Order.find(query).sort({ updatedAt: -1 }).limit(150);
    let list = orders;
    if (date) {
      const targetDate = cleanText(date);
      list = list.filter((order) => orderTargetDate(order) === targetDate);
    }
    res.json(list.map((order) => decorateDeliveryOrder(order, req)));
  } catch (err) {
    res.status(500).json({ error: true, message: 'Failed to load assigned orders', details: err.message });
  }
});

router.post('/staff/orders/:id/activity', requireDeliveryStaff, proofUpload.single('proofPhoto'), async (req, res) => {
  try {
    const payload = parseJsonField(req.body, 'payload', req.body || {});
    const activityKey = cleanText(payload.activityKey);
    const meta = STAFF_ACTIVITY_META[activityKey];
    if (!meta) {
      return res.status(400).json({ error: true, message: 'Invalid activity type' });
    }

    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ error: true, message: 'Order not found' });

    const assignedStaffId = order?.delivery?.deliveryBoyId ? String(order.delivery.deliveryBoyId) : '';
    if (assignedStaffId !== String(req.deliveryStaff.id)) {
      return res.status(403).json({ error: true, message: 'This order is not assigned to you.' });
    }

    const note = cleanText(payload.note);
    if (meta.requiresNote && !note) {
      return res.status(400).json({ error: true, message: 'Please add a note for this activity.' });
    }

    if (!order.delivery) order.delivery = {};
    if (!order.payment) order.payment = {};

    const staff = await DeliveryBoy.findById(req.deliveryStaff.id);
    const now = new Date();
    const entry = {
      key: activityKey,
      label: meta.label,
      note: note || meta.defaultNote,
      proofPhotoUrl: req.file ? toPublicUploadPath('delivery-proofs', req.file.filename) : '',
      proofOriginalName: req.file?.originalname || '',
      recipientName: cleanText(payload.recipientName),
      cashCollected: Math.max(0, toNumber(payload.cashCollected, 0)),
      issueCode: cleanText(payload.issueCode),
      loggedByRole: 'delivery_staff',
      loggedById: String(req.deliveryStaff.id),
      loggedByName: staffDisplayName(staff),
      at: now,
    };

    const logs = Array.isArray(order.delivery.activityLogs) ? [...order.delivery.activityLogs] : [];
    logs.push(entry);
    order.delivery.activityLogs = logs;
    order.delivery.lastActivityKey = activityKey;
    order.delivery.lastActivityLabel = meta.label;
    order.delivery.lastActivityAt = now;

    if (entry.proofPhotoUrl) {
      order.delivery.deliveryProofUrl = entry.proofPhotoUrl;
      order.delivery.deliveryProofOriginalName = entry.proofOriginalName;
    }

    if (activityKey === 'accepted' && (!order.status || ['pending', 'confirmed', 'preparing'].includes(order.status))) {
      if (order.delivery.scheduledDate || order.delivery.preferredDate || order.delivery.estimatedDate) {
        order.status = 'scheduled';
      }
    }

    if (meta.timelineStatus) {
      order.status = meta.timelineStatus;
    }

    if (activityKey === 'delivered') {
      if (entry.cashCollected > 0) {
        order.delivery.codCollectedAmount = entry.cashCollected;
        order.delivery.codCollectedAt = now;
      }
      if (cleanText(order.payment.methodCode) === 'cod') {
        order.payment.amountReceived = entry.cashCollected > 0 ? entry.cashCollected : toNumber(order.total, 0);
        order.payment.status = 'verified';
        order.payment.note = 'Cash collected during delivery handover.';
        order.payment.verifiedAt = now;
        order.payment.verifiedBy = `delivery:${normalizeUsername(staff?.username)}`;
      }
    }

    const timeline = Array.isArray(order.statusTimeline) ? [...order.statusTimeline] : [];
    const timelineStatus = meta.timelineStatus || cleanText(order.status) || 'scheduled';
    timeline.push(createTimelineEntry(timelineStatus, entry.note, `delivery:${normalizeUsername(staff?.username)}`));
    order.statusTimeline = timeline;

    await order.save();
    const updated = await Order.findById(order._id);
    res.json({ ok: true, order: decorateDeliveryOrder(updated, req) });
  } catch (err) {
    res.status(500).json({ error: true, message: 'Failed to log delivery activity', details: err.message });
  }
});

router.use((err, _req, res, next) => {
  if (err?.name === 'MulterError' || /Only JPG, PNG, WEBP, or PDF/i.test(String(err?.message || ''))) {
    res.status(400).json({ error: true, message: err.message });
    return;
  }
  next(err);
});

export default router;
