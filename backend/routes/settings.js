import express from 'express';
import { requireAdmin } from '../middleware/adminAuth.js';
import {
  buildAdminPaymentSettings,
  buildPublicPaymentSettings,
  ensurePaymentSettings,
} from '../config/payment.js';
import { createUploader, toPublicUploadPath } from '../utils/uploads.js';

const router = express.Router();
const settingsUpload = createUploader('payment-settings', 8);
const settingsUploadFields = [
  { name: 'bankTransferQr', maxCount: 1 },
  { name: 'lankaQrImage', maxCount: 1 },
  { name: 'sitePromoImage', maxCount: 1 },
  { name: 'cryptoWalletQr0', maxCount: 1 },
  { name: 'cryptoWalletQr1', maxCount: 1 },
  { name: 'cryptoWalletQr2', maxCount: 1 },
  { name: 'cryptoWalletQr3', maxCount: 1 },
  { name: 'cryptoWalletQr4', maxCount: 1 },
];
const settingsUploadMiddleware = settingsUpload.fields(settingsUploadFields);

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

function cleanText(value) {
  return String(value || '').trim();
}

function toBoolean(value, fallback = false) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
    if (['false', '0', 'no', 'off', ''].includes(normalized)) return false;
  }
  return fallback;
}

function toNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function normalizeWallets(inputWallets = [], existingWallets = []) {
  const list = Array.isArray(inputWallets) ? inputWallets : [];
  const current = Array.isArray(existingWallets) ? existingWallets : [];
  const total = Math.max(list.length, current.length, 3);
  const normalized = [];

  for (let index = 0; index < total; index += 1) {
    const input = list[index] || {};
    const existing = current[index] || {};
    normalized.push({
      key: cleanText(input.key) || cleanText(existing.key) || `wallet_${index + 1}`,
      enabled: toBoolean(input.enabled, Boolean(existing.enabled)),
      label: cleanText(input.label) || cleanText(existing.label),
      coin: cleanText(input.coin) || cleanText(existing.coin),
      network: cleanText(input.network) || cleanText(existing.network),
      address: cleanText(input.address) || cleanText(existing.address),
      instructions: cleanText(input.instructions) || cleanText(existing.instructions),
      qrImageUrl: cleanText(input.qrImageUrl) || cleanText(existing.qrImageUrl),
    });
  }

  return normalized;
}

function autoEnableConfiguredWallets(wallets = [], cryptoEnabled = false) {
  const normalized = Array.isArray(wallets) ? wallets.map((wallet) => ({ ...wallet })) : [];
  if (!cryptoEnabled) return normalized;

  const hasActiveConfiguredWallet = normalized.some((wallet) => Boolean(wallet.enabled) && cleanText(wallet.address));
  if (hasActiveConfiguredWallet) return normalized;

  const firstConfiguredIndex = normalized.findIndex((wallet) => cleanText(wallet.address));
  if (firstConfiguredIndex >= 0) {
    normalized[firstConfiguredIndex].enabled = true;
  }

  return normalized;
}

async function saveAdminPaymentSettings(req, res) {
  try {
    const settings = await ensurePaymentSettings();
    const payload = parseJsonField(req.body, 'payload', req.body || {});
    const files = req.files || {};

    const businessName = cleanText(payload.businessName) || settings.businessName;
    const whatsappNumber = cleanText(payload.whatsappNumber) || settings.whatsappNumber;
    const orderPrefix = cleanText(payload.orderPrefix) || settings.orderPrefix;
    const paymentPolicyNote = cleanText(payload.paymentPolicyNote) || settings.paymentPolicyNote;
    const slipGuidance = cleanText(payload.slipGuidance) || settings.slipGuidance;

    const existing = settings.toObject();
    const inputCod = payload.cod || {};
    const inputBank = payload.bankTransfer || {};
    const inputLankaQr = payload.lankaQr || {};
    const inputSkrill = payload.skrill || {};
    const inputCrypto = payload.crypto || {};
    const inputSite = payload.site || {};

    const cryptoEnabled = toBoolean(inputCrypto.enabled, Boolean(existing.crypto?.enabled));
    const wallets = autoEnableConfiguredWallets(
      normalizeWallets(inputCrypto.wallets, existing.crypto?.wallets || []),
      cryptoEnabled
    );

    const bankTransferQrFile = files.bankTransferQr?.[0];
    const lankaQrFile = files.lankaQrImage?.[0];
    const sitePromoImageFile = files.sitePromoImage?.[0];
    const cryptoWalletQrFiles = [
      files.cryptoWalletQr0?.[0],
      files.cryptoWalletQr1?.[0],
      files.cryptoWalletQr2?.[0],
      files.cryptoWalletQr3?.[0],
      files.cryptoWalletQr4?.[0],
    ];

    for (let index = 0; index < cryptoWalletQrFiles.length; index += 1) {
      if (cryptoWalletQrFiles[index]) {
        wallets[index] = wallets[index] || { key: `wallet_${index + 1}` };
        wallets[index].qrImageUrl = toPublicUploadPath('payment-settings', cryptoWalletQrFiles[index].filename);
      }
    }

    settings.businessName = businessName;
    settings.whatsappNumber = whatsappNumber;
    settings.orderPrefix = orderPrefix;
    settings.paymentPolicyNote = paymentPolicyNote;
    settings.slipGuidance = slipGuidance;

    settings.cod = {
      enabled: toBoolean(inputCod.enabled, existing.cod?.enabled !== false),
      title: cleanText(inputCod.title) || cleanText(existing.cod?.title) || 'Cash on Delivery',
      maxOrderAmount: toNumber(inputCod.maxOrderAmount, toNumber(existing.cod?.maxOrderAmount, 0)),
      instructions: cleanText(inputCod.instructions) || cleanText(existing.cod?.instructions),
    };

    settings.bankTransfer = {
      enabled: toBoolean(inputBank.enabled, existing.bankTransfer?.enabled !== false),
      title: cleanText(inputBank.title) || cleanText(existing.bankTransfer?.title) || 'Direct Bank Transfer',
      bankName: cleanText(inputBank.bankName) || cleanText(existing.bankTransfer?.bankName),
      accountName: cleanText(inputBank.accountName) || cleanText(existing.bankTransfer?.accountName),
      accountNumber: cleanText(inputBank.accountNumber) || cleanText(existing.bankTransfer?.accountNumber),
      branch: cleanText(inputBank.branch) || cleanText(existing.bankTransfer?.branch),
      instructions: cleanText(inputBank.instructions) || cleanText(existing.bankTransfer?.instructions),
      qrImageUrl: bankTransferQrFile
        ? toPublicUploadPath('payment-settings', bankTransferQrFile.filename)
        : cleanText(existing.bankTransfer?.qrImageUrl),
    };

    settings.lankaQr = {
      enabled: toBoolean(inputLankaQr.enabled, existing.lankaQr?.enabled !== false),
      title: cleanText(inputLankaQr.title) || cleanText(existing.lankaQr?.title) || 'LANKAQR / Mobile Banking QR',
      merchantName: cleanText(inputLankaQr.merchantName) || cleanText(existing.lankaQr?.merchantName),
      instructions: cleanText(inputLankaQr.instructions) || cleanText(existing.lankaQr?.instructions),
      qrImageUrl: lankaQrFile
        ? toPublicUploadPath('payment-settings', lankaQrFile.filename)
        : cleanText(existing.lankaQr?.qrImageUrl),
    };

    settings.skrill = {
      enabled: toBoolean(inputSkrill.enabled, Boolean(existing.skrill?.enabled)),
      title: cleanText(inputSkrill.title) || cleanText(existing.skrill?.title) || 'Skrill',
      email: cleanText(inputSkrill.email) || cleanText(existing.skrill?.email),
      customerId: cleanText(inputSkrill.customerId) || cleanText(existing.skrill?.customerId),
      instructions: cleanText(inputSkrill.instructions) || cleanText(existing.skrill?.instructions),
    };

    settings.crypto = {
      enabled: cryptoEnabled,
      title: cleanText(inputCrypto.title) || cleanText(existing.crypto?.title) || 'Crypto Payment',
      instructions: cleanText(inputCrypto.instructions) || cleanText(existing.crypto?.instructions),
      wallets,
    };

    settings.site = {
      footerTagline: cleanText(inputSite.footerTagline) || cleanText(existing.site?.footerTagline) || 'Healthy plants • Home gardening • Delivery available',
      contactPhone: cleanText(inputSite.contactPhone) || cleanText(existing.site?.contactPhone),
      contactEmail: cleanText(inputSite.contactEmail) || cleanText(existing.site?.contactEmail),
      contactAddress: cleanText(inputSite.contactAddress) || cleanText(existing.site?.contactAddress),
      businessHours: cleanText(inputSite.businessHours) || cleanText(existing.site?.businessHours),
      deliveryNote: cleanText(inputSite.deliveryNote) || cleanText(existing.site?.deliveryNote),
      footerCopyright: cleanText(inputSite.footerCopyright) || cleanText(existing.site?.footerCopyright) || 'All rights reserved.',
      facebookUrl: cleanText(inputSite.facebookUrl) || cleanText(existing.site?.facebookUrl),
      instagramUrl: cleanText(inputSite.instagramUrl) || cleanText(existing.site?.instagramUrl),
      tiktokUrl: cleanText(inputSite.tiktokUrl) || cleanText(existing.site?.tiktokUrl),
      mapsUrl: cleanText(inputSite.mapsUrl) || cleanText(existing.site?.mapsUrl),
      promoAlt: cleanText(inputSite.promoAlt) || cleanText(existing.site?.promoAlt) || 'Batalawatta Plant Nursery special offer',
      promoImageUrl: sitePromoImageFile
        ? toPublicUploadPath('payment-settings', sitePromoImageFile.filename)
        : cleanText(existing.site?.promoImageUrl),
    };

    await settings.save();
    res.json({ ok: true, settings: buildAdminPaymentSettings(settings, req) });
  } catch (err) {
    res.status(500).json({ error: true, message: 'Failed to save payment settings', details: err.message });
  }
}

router.get('/payment', async (req, res) => {
  try {
    const settings = await ensurePaymentSettings();
    res.json(buildPublicPaymentSettings(settings, req));
  } catch (err) {
    res.status(500).json({ error: true, message: 'Failed to load payment settings', details: err.message });
  }
});

router.get('/payment/admin', requireAdmin, async (req, res) => {
  try {
    const settings = await ensurePaymentSettings();
    res.json(buildAdminPaymentSettings(settings, req));
  } catch (err) {
    res.status(500).json({ error: true, message: 'Failed to load admin payment settings', details: err.message });
  }
});

router.put('/payment/admin', requireAdmin, settingsUploadMiddleware, saveAdminPaymentSettings);
router.post('/payment/admin', requireAdmin, settingsUploadMiddleware, saveAdminPaymentSettings);

router.use((err, _req, res, next) => {
  if (err?.name === 'MulterError' || /Only JPG, PNG, WEBP, or PDF/i.test(String(err?.message || ''))) {
    res.status(400).json({ error: true, message: err.message });
    return;
  }
  next(err);
});

export default router;
