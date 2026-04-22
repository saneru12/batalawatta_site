import express from 'express';
import Cart from '../models/Cart.js';
import Order from '../models/Order.js';
import DeliveryBoy from '../models/DeliveryBoy.js';
import { requireAdmin, optionalAdmin } from '../middleware/adminAuth.js';
import { requireCustomer, optionalCustomer } from '../middleware/customerAuth.js';
import {
  createTimelineEntry,
  getStatusMeta,
  normalizeTimeline,
} from '../config/delivery.js';
import {
  buildPublicDeliveryConfig,
  ensureDeliverySettings,
  estimateDelivery,
  getZoneById,
} from '../config/deliverySettings.js';
import {
  ensurePaymentSettings,
  getCheckoutMethod,
  makeOrderCode,
} from '../config/payment.js';
import { createUploader, resolveMediaUrl, toPublicUploadPath } from '../utils/uploads.js';

const router = express.Router();
const checkoutUpload = createUploader('payment-slips', 8);

function cleanText(value) {
  return String(value || '').trim();
}

function toMoney(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

function toNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function isIsoDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''));
}

function parsePayload(req) {
  const raw = req.body?.orderPayload;
  if (raw && typeof raw === 'string') {
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }
  return req.body || {};
}

function normalizeMethodCode(value) {
  const normalized = cleanText(value).toLowerCase();
  if (!normalized) return 'cod';
  if (['cod', 'cash on delivery', 'cash on delivery (cod)'].includes(normalized)) return 'cod';
  if (['bank_transfer', 'bank transfer', 'direct bank transfer'].includes(normalized)) return 'bank_transfer';
  if (['lanka_qr', 'lankaqr', 'qr', 'mobile banking qr'].includes(normalized)) return 'lanka_qr';
  if (['skrill'].includes(normalized)) return 'skrill';
  if (['crypto', 'crypto payment', 'cryptocurrency'].includes(normalized)) return 'crypto';
  return normalized;
}

function resolveActivityLogs(req, logs = []) {
  return Array.isArray(logs)
    ? logs.map((entry) => ({
        key: cleanText(entry.key),
        label: cleanText(entry.label),
        note: cleanText(entry.note),
        recipientName: cleanText(entry.recipientName),
        cashCollected: toMoney(entry.cashCollected),
        issueCode: cleanText(entry.issueCode),
        loggedByRole: cleanText(entry.loggedByRole),
        loggedById: cleanText(entry.loggedById),
        loggedByName: cleanText(entry.loggedByName),
        at: entry.at || null,
        proofPhotoUrl: entry.proofPhotoUrl ? resolveMediaUrl(req, entry.proofPhotoUrl) : '',
        proofOriginalName: cleanText(entry.proofOriginalName),
      }))
    : [];
}

function decorateOrder(orderDoc, req) {
  const order = orderDoc?.toObject ? orderDoc.toObject() : { ...orderDoc };
  const delivery = order.delivery || {};
  const safeDeliveryFee = toMoney(delivery.fee || 0);
  const safeSubtotal = toMoney(order.subtotal || (order.total || 0) - safeDeliveryFee);
  const payment = order.payment || {};

  order.orderCode = order.orderCode || '';
  order.subtotal = safeSubtotal;
  order.total = toMoney(order.total || safeSubtotal + safeDeliveryFee);
  order.paymentMethod = order.paymentMethod || payment.methodLabel || 'Cash on Delivery';
  order.adminNote = order.adminNote || '';
  order.delivery = {
    method: delivery.method || 'nursery_vehicle',
    vehicleType: cleanText(delivery.vehicleType) || 'Own vehicle delivery',
    zoneId: cleanText(delivery.zoneId),
    zoneName: cleanText(delivery.zoneName),
    fee: safeDeliveryFee,
    preferredDate: cleanText(delivery.preferredDate),
    preferredTimeSlot: cleanText(delivery.preferredTimeSlot),
    scheduledDate: cleanText(delivery.scheduledDate),
    scheduledTimeSlot: cleanText(delivery.scheduledTimeSlot),
    estimatedDate: cleanText(delivery.estimatedDate),
    estimatedTimeSlot: cleanText(delivery.estimatedTimeSlot),
    leadTimeLabel: cleanText(delivery.leadTimeLabel),
    recipientName: cleanText(delivery.recipientName) || cleanText(order.customer?.name),
    recipientPhone: cleanText(delivery.recipientPhone) || cleanText(order.customer?.phone),
    landmark: cleanText(delivery.landmark),
    instructions: cleanText(delivery.instructions),
    deliveryBoyId: delivery.deliveryBoyId ? String(delivery.deliveryBoyId) : '',
    deliveryBoyName: cleanText(delivery.deliveryBoyName),
    deliveryBoyPhone: cleanText(delivery.deliveryBoyPhone),
    deliveryBoyUsername: cleanText(delivery.deliveryBoyUsername),
    vehicleNumber: cleanText(delivery.vehicleNumber),
    routeSequence: Math.max(0, toNumber(delivery.routeSequence, 0)),
    assignedAt: delivery.assignedAt || null,
    assignedBy: cleanText(delivery.assignedBy),
    lastActivityKey: cleanText(delivery.lastActivityKey),
    lastActivityLabel: cleanText(delivery.lastActivityLabel),
    lastActivityAt: delivery.lastActivityAt || null,
    codCollectedAmount: toMoney(delivery.codCollectedAmount),
    codCollectedAt: delivery.codCollectedAt || null,
    deliveryProofUrl: delivery.deliveryProofUrl ? resolveMediaUrl(req, delivery.deliveryProofUrl) : '',
    deliveryProofOriginalName: cleanText(delivery.deliveryProofOriginalName),
    activityLogs: resolveActivityLogs(req, delivery.activityLogs),
  };

  order.payment = {
    methodCode: payment.methodCode || normalizeMethodCode(order.paymentMethod),
    methodLabel: payment.methodLabel || order.paymentMethod || 'Cash on Delivery',
    status: payment.status || 'cash_on_delivery',
    note: payment.note || '',
    amountExpected: toMoney(payment.amountExpected || order.total),
    amountReceived: toMoney(payment.amountReceived || 0),
    currency: payment.currency || 'LKR',
    payerName: payment.payerName || '',
    payerPhone: payment.payerPhone || '',
    reference: payment.reference || '',
    paidAt: payment.paidAt || '',
    slipUrl: payment.slipUrl ? resolveMediaUrl(req, payment.slipUrl) : '',
    slipOriginalName: payment.slipOriginalName || '',
    selectedWalletKey: payment.selectedWalletKey || '',
    network: payment.network || '',
    destinationLabel: payment.destinationLabel || '',
    destinationValue: payment.destinationValue || '',
    verificationNote: payment.verificationNote || '',
    verifiedAt: payment.verifiedAt || null,
    verifiedBy: payment.verifiedBy || '',
  };

  order.statusMeta = getStatusMeta(order.status);
  order.statusTimeline = normalizeTimeline(order.status, order.statusTimeline, order.createdAt);
  return order;
}

function ensureCustomerOwnsOrder(req, order) {
  if (req.admin) return true;
  if (!req.customer?.id || !order?.customerId) return false;
  return String(order.customerId) === String(req.customer.id);
}

router.get('/delivery-config', async (_req, res) => {
  try {
    const settings = await ensureDeliverySettings();
    res.json(buildPublicDeliveryConfig(settings));
  } catch (err) {
    res.status(500).json({ error: true, message: 'Failed to load delivery config', details: err.message });
  }
});

router.post('/checkout', requireCustomer, checkoutUpload.single('paymentSlip'), async (req, res) => {
  try {
    const payload = parsePayload(req);
    const { sessionId, customer, notes, delivery, payment = {} } = payload || {};

    if (!sessionId) return res.status(400).json({ error: true, message: 'sessionId required' });
    if (!customer?.name || !customer?.phone || !customer?.address) {
      return res.status(400).json({ error: true, message: 'Customer details required' });
    }

    const settings = await ensureDeliverySettings();
    const zoneId = cleanText(delivery?.zoneId);
    if (!zoneId) {
      return res.status(400).json({ error: true, message: 'Please select a delivery zone' });
    }

    const zone = getZoneById(settings, zoneId);
    if (!zone) {
      return res.status(400).json({ error: true, message: 'Selected delivery zone is not available.' });
    }

    const preferredDate = cleanText(delivery?.preferredDate);
    if (preferredDate && !isIsoDate(preferredDate)) {
      return res.status(400).json({ error: true, message: 'Invalid preferred delivery date' });
    }

    const cart = await Cart.findOne({ sessionId }).populate('items.plant');
    if (!cart || !cart.items.length) {
      return res.status(400).json({ error: true, message: 'Cart is empty' });
    }

    const validCartItems = cart.items.filter((item) => item?.plant?._id);
    if (!validCartItems.length) {
      return res.status(400).json({ error: true, message: 'Selected plants are no longer available in the cart' });
    }

    const items = validCartItems.map((item) => ({
      plant: item.plant._id,
      name: item.plant.name,
      price: toMoney(item.plant.price),
      qty: Math.max(1, Number(item.qty || 1)),
    }));

    const subtotal = items.reduce((sum, item) => sum + toMoney(item.price) * Math.max(1, Number(item.qty || 1)), 0);
    const deliveryEstimate = estimateDelivery(settings, {
      zoneId,
      preferredDate,
      preferredTimeSlot: cleanText(delivery?.preferredTimeSlot),
    });
    const deliveryFee = toMoney(zone.fee);
    const total = subtotal + deliveryFee;

    const paymentSettings = await ensurePaymentSettings();
    const requestedMethodCode = normalizeMethodCode(payment.methodCode || payload.paymentMethod);
    const method = getCheckoutMethod(paymentSettings, requestedMethodCode);

    if (!method) {
      return res.status(400).json({ error: true, message: 'No active payment methods are configured.' });
    }

    if (method.code === 'cod' && Number(method.maxOrderAmount || 0) > 0 && total > Number(method.maxOrderAmount || 0)) {
      return res.status(400).json({
        error: true,
        message: `Cash on Delivery is only available up to Rs. ${Number(method.maxOrderAmount).toLocaleString('en-LK')}. Please use transfer, QR, Skrill, or crypto instead.`,
      });
    }

    if (method.requiresSlip && !req.file) {
      return res.status(400).json({ error: true, message: 'Please upload the payment slip or screenshot.' });
    }

    const selectedWallet = method.code === 'crypto'
      ? (method.wallets || []).find((wallet) => wallet.key === cleanText(payment.selectedWalletKey)) || (method.wallets || [])[0]
      : null;

    if (method.code === 'crypto' && !selectedWallet) {
      return res.status(400).json({ error: true, message: 'Please select a valid crypto wallet.' });
    }

    const paymentReference = cleanText(payment.reference);
    if (method.requiresReference && !paymentReference) {
      return res.status(400).json({ error: true, message: 'Transaction hash / payment reference is required for this method.' });
    }

    const paymentStatus = method.code === 'cod' ? 'cash_on_delivery' : 'proof_uploaded';
    const paymentNote = method.code === 'cod'
      ? 'Cash on delivery selected. Payment will be collected during handover.'
      : `Payment proof uploaded via ${method.label}. Awaiting nursery verification.`;

    const paymentData = {
      methodCode: method.code,
      methodLabel: method.label,
      status: paymentStatus,
      note: paymentNote,
      amountExpected: total,
      amountReceived: 0,
      currency: method.code === 'crypto' ? (selectedWallet?.coin || 'CRYPTO') : 'LKR',
      payerName: cleanText(payment.payerName),
      payerPhone: cleanText(payment.payerPhone) || cleanText(customer.phone),
      reference: paymentReference,
      paidAt: cleanText(payment.paidAt),
      slipUrl: req.file ? toPublicUploadPath('payment-slips', req.file.filename) : '',
      slipOriginalName: req.file?.originalname || '',
      selectedWalletKey: cleanText(payment.selectedWalletKey) || selectedWallet?.key || '',
      network: selectedWallet?.network || '',
      destinationLabel: selectedWallet?.label || method.destinationLabel || method.label,
      destinationValue: selectedWallet?.address || method.destinationValue || '',
      verificationNote: '',
      verifiedAt: null,
      verifiedBy: '',
    };

    const order = await Order.create({
      orderCode: makeOrderCode(paymentSettings.orderPrefix),
      customerId: req.customer.id,
      sessionId,
      customer: {
        name: cleanText(customer.name),
        phone: cleanText(customer.phone),
        email: cleanText(customer.email),
        address: cleanText(customer.address),
      },
      paymentMethod: method.label,
      payment: paymentData,
      notes: cleanText(notes),
      adminNote: '',
      items,
      subtotal,
      delivery: {
        method: 'nursery_vehicle',
        vehicleType: buildPublicDeliveryConfig(settings).serviceType,
        zoneId: zone.id,
        zoneName: zone.name,
        fee: deliveryFee,
        preferredDate,
        preferredTimeSlot: cleanText(delivery?.preferredTimeSlot),
        scheduledDate: '',
        scheduledTimeSlot: '',
        estimatedDate: deliveryEstimate.estimatedDate,
        estimatedTimeSlot: deliveryEstimate.estimatedTimeSlot,
        leadTimeLabel: zone.leadTimeLabel,
        recipientName: cleanText(delivery?.recipientName) || cleanText(customer.name),
        recipientPhone: cleanText(delivery?.recipientPhone) || cleanText(customer.phone),
        landmark: cleanText(delivery?.landmark),
        instructions: cleanText(delivery?.instructions),
        deliveryBoyId: null,
        deliveryBoyName: '',
        deliveryBoyPhone: '',
        deliveryBoyUsername: '',
        vehicleNumber: '',
        routeSequence: 0,
        assignedAt: null,
        assignedBy: '',
        lastActivityKey: '',
        lastActivityLabel: '',
        lastActivityAt: null,
        codCollectedAmount: 0,
        codCollectedAt: null,
        deliveryProofUrl: '',
        deliveryProofOriginalName: '',
        activityLogs: [],
      },
      total,
      status: 'pending',
      statusTimeline: [
        createTimelineEntry(
          'pending',
          `${zone.name} selected. ${paymentNote}`,
          'customer'
        ),
      ],
    });

    cart.items = [];
    await cart.save();

    const decorated = decorateOrder(order, req);
    res.json({
      ok: true,
      orderId: order._id,
      orderCode: order.orderCode,
      subtotal,
      deliveryFee,
      total,
      order: decorated,
    });
  } catch (err) {
    res.status(500).json({ error: true, message: 'Server error', details: err.message });
  }
});

router.get('/my', requireCustomer, async (req, res) => {
  try {
    const orders = await Order.find({ customerId: req.customer.id }).sort({ createdAt: -1 }).limit(100);
    return res.json(orders.map((order) => decorateOrder(order, req)));
  } catch (err) {
    return res.status(500).json({ error: true, message: 'Server error', details: err.message });
  }
});

router.get('/', requireAdmin, async (req, res) => {
  try {
    const { status = '' } = req.query;
    const query = {};
    if (status) query.status = status;
    const orders = await Order.find(query).sort({ createdAt: -1 }).limit(500);
    res.json(orders.map((order) => decorateOrder(order, req)));
  } catch (err) {
    res.status(500).json({ error: true, message: 'Server error', details: err.message });
  }
});

router.patch('/:id', requireAdmin, async (req, res) => {
  try {
    const {
      status,
      adminNote,
      delivery: deliveryUpdate = {},
      payment: paymentUpdate = {},
    } = req.body || {};

    const allowedStatuses = ['pending', 'confirmed', 'preparing', 'scheduled', 'out_for_delivery', 'delivered', 'cancelled'];
    const allowedPaymentStatuses = ['cash_on_delivery', 'proof_uploaded', 'under_review', 'verified', 'rejected', 'awaiting_payment'];

    if (status && !allowedStatuses.includes(status)) {
      return res.status(400).json({ error: true, message: 'Invalid status' });
    }
    if (paymentUpdate?.status && !allowedPaymentStatuses.includes(paymentUpdate.status)) {
      return res.status(400).json({ error: true, message: 'Invalid payment status' });
    }

    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ error: true, message: 'Order not found' });

    const deliverySettings = await ensureDeliverySettings();

    if (!order.delivery) order.delivery = {};
    if (!order.payment) order.payment = {};

    const previousStatus = order.status || 'pending';
    const previousPaymentStatus = order.payment.status || 'cash_on_delivery';
    const previousDeliveryBoyId = order.delivery.deliveryBoyId ? String(order.delivery.deliveryBoyId) : '';

    if (typeof adminNote === 'string') {
      order.adminNote = adminNote.trim();
    }

    const deliveryFields = [
      'scheduledDate',
      'scheduledTimeSlot',
      'recipientName',
      'recipientPhone',
      'landmark',
      'instructions',
      'vehicleNumber',
    ];

    for (const field of deliveryFields) {
      if (Object.prototype.hasOwnProperty.call(deliveryUpdate, field)) {
        order.delivery[field] = cleanText(deliveryUpdate[field]);
      }
    }

    if (Object.prototype.hasOwnProperty.call(deliveryUpdate, 'routeSequence')) {
      order.delivery.routeSequence = Math.max(0, toNumber(deliveryUpdate.routeSequence, 0));
    }

    if (Object.prototype.hasOwnProperty.call(deliveryUpdate, 'zoneId') && cleanText(deliveryUpdate.zoneId)) {
      const zone = getZoneById(deliverySettings, cleanText(deliveryUpdate.zoneId));
      if (!zone) {
        return res.status(400).json({ error: true, message: 'Selected delivery zone is not available.' });
      }
      order.delivery.zoneId = zone.id;
      order.delivery.zoneName = zone.name;
      order.delivery.fee = toMoney(zone.fee);
      order.delivery.leadTimeLabel = zone.leadTimeLabel;
      order.total = toMoney(order.subtotal) + toMoney(zone.fee);
      if (order.payment) {
        order.payment.amountExpected = toMoney(order.total);
      }
    }

    let deliveryBoyAssignmentNote = '';
    if (Object.prototype.hasOwnProperty.call(deliveryUpdate, 'deliveryBoyId')) {
      const requestedDeliveryBoyId = cleanText(deliveryUpdate.deliveryBoyId);
      if (!requestedDeliveryBoyId) {
        order.delivery.deliveryBoyId = null;
        order.delivery.deliveryBoyName = '';
        order.delivery.deliveryBoyPhone = '';
        order.delivery.deliveryBoyUsername = '';
        order.delivery.vehicleNumber = cleanText(order.delivery.vehicleNumber);
        order.delivery.routeSequence = Object.prototype.hasOwnProperty.call(deliveryUpdate, 'routeSequence')
          ? Math.max(0, toNumber(deliveryUpdate.routeSequence, 0))
          : 0;
        order.delivery.assignedAt = null;
        order.delivery.assignedBy = '';
        if (previousDeliveryBoyId) {
          deliveryBoyAssignmentNote = 'Delivery boy assignment cleared.';
        }
      } else {
        const staff = await DeliveryBoy.findById(requestedDeliveryBoyId);
        if (!staff) {
          return res.status(400).json({ error: true, message: 'Selected delivery boy was not found.' });
        }
        order.delivery.deliveryBoyId = staff._id;
        order.delivery.deliveryBoyName = cleanText(staff.fullName);
        order.delivery.deliveryBoyPhone = cleanText(staff.phone);
        order.delivery.deliveryBoyUsername = cleanText(staff.username);
        order.delivery.vehicleNumber = cleanText(deliveryUpdate.vehicleNumber) || cleanText(staff.vehicleNumber);
        order.delivery.vehicleType = cleanText(staff.vehicleType) || cleanText(order.delivery.vehicleType) || 'Own vehicle delivery';
        order.delivery.assignedAt = new Date();
        order.delivery.assignedBy = 'admin';
        deliveryBoyAssignmentNote = previousDeliveryBoyId && previousDeliveryBoyId === String(staff._id)
          ? ''
          : `${cleanText(staff.fullName)} assigned for delivery.`;
      }
    }

    if (status) {
      order.status = status;
      if (status === 'scheduled') {
        order.delivery.scheduledDate = order.delivery.scheduledDate || order.delivery.preferredDate || order.delivery.estimatedDate || '';
        order.delivery.scheduledTimeSlot = order.delivery.scheduledTimeSlot || order.delivery.preferredTimeSlot || order.delivery.estimatedTimeSlot || '';
      }
    }

    if (Object.prototype.hasOwnProperty.call(paymentUpdate, 'status') && paymentUpdate.status) {
      order.payment.status = paymentUpdate.status;
      if (paymentUpdate.status === 'verified') {
        order.payment.verifiedAt = new Date();
        order.payment.verifiedBy = 'admin';
      }
      if (paymentUpdate.status === 'rejected') {
        order.payment.verifiedAt = null;
        order.payment.verifiedBy = '';
      }
    }

    if (Object.prototype.hasOwnProperty.call(paymentUpdate, 'verificationNote')) {
      order.payment.verificationNote = cleanText(paymentUpdate.verificationNote);
    }
    if (Object.prototype.hasOwnProperty.call(paymentUpdate, 'reference')) {
      order.payment.reference = cleanText(paymentUpdate.reference);
    }
    if (Object.prototype.hasOwnProperty.call(paymentUpdate, 'amountReceived')) {
      order.payment.amountReceived = toMoney(paymentUpdate.amountReceived);
    }
    if (Object.prototype.hasOwnProperty.call(paymentUpdate, 'payerName')) {
      order.payment.payerName = cleanText(paymentUpdate.payerName);
    }
    if (Object.prototype.hasOwnProperty.call(paymentUpdate, 'paidAt')) {
      order.payment.paidAt = cleanText(paymentUpdate.paidAt);
    }

    const trimmedAdminNote = cleanText(adminNote);
    const timeline = Array.isArray(order.statusTimeline) ? [...order.statusTimeline] : [];

    if (status && status !== previousStatus) {
      timeline.push(createTimelineEntry(status, trimmedAdminNote, 'admin'));
    } else if (trimmedAdminNote) {
      timeline.push(createTimelineEntry(order.status || 'pending', trimmedAdminNote, 'admin'));
    }

    if (deliveryBoyAssignmentNote) {
      timeline.push(createTimelineEntry(order.status || 'pending', deliveryBoyAssignmentNote, 'admin'));
    }

    if (paymentUpdate?.status && paymentUpdate.status !== previousPaymentStatus) {
      const paymentStatusLabelMap = {
        cash_on_delivery: 'Cash on delivery selected',
        proof_uploaded: 'Payment proof uploaded',
        under_review: 'Payment is under review',
        verified: 'Payment verified',
        rejected: 'Payment proof needs attention',
        awaiting_payment: 'Waiting for payment proof',
      };
      const paymentNote = cleanText(paymentUpdate.verificationNote) || paymentStatusLabelMap[paymentUpdate.status] || 'Payment updated';
      timeline.push(createTimelineEntry(order.status || 'pending', paymentNote, 'admin'));
    }

    order.statusTimeline = timeline;
    await order.save();

    const updated = await Order.findById(req.params.id);
    res.json(decorateOrder(updated, req));
  } catch (err) {
    res.status(500).json({ error: true, message: 'Server error', details: err.message });
  }
});

router.get('/:id', optionalAdmin, optionalCustomer, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).populate('items.plant');
    if (!order) return res.status(404).json({ error: true, message: 'Order not found' });
    if (!ensureCustomerOwnsOrder(req, order)) {
      return res.status(403).json({ error: true, message: 'Not authorized' });
    }
    res.json(decorateOrder(order, req));
  } catch (err) {
    res.status(500).json({ error: true, message: 'Server error', details: err.message });
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
