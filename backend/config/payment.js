import PaymentSettings from '../models/PaymentSettings.js';
import { resolveMediaUrl } from '../utils/uploads.js';

function cleanText(value) {
  return String(value || '').trim();
}

function toNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function cloneWallet(wallet = {}) {
  return {
    key: cleanText(wallet.key),
    enabled: Boolean(wallet.enabled),
    label: cleanText(wallet.label),
    coin: cleanText(wallet.coin),
    network: cleanText(wallet.network),
    address: cleanText(wallet.address),
    instructions: cleanText(wallet.instructions),
    qrImageUrl: cleanText(wallet.qrImageUrl),
  };
}

function defaultCryptoWallets() {
  return [
    {
      key: 'wallet_1',
      enabled: false,
      label: 'USDT (TRC20)',
      coin: 'USDT',
      network: 'TRC20',
      address: '',
      instructions: 'Best for low network fees. Send only via TRC20.',
      qrImageUrl: '',
    },
    {
      key: 'wallet_2',
      enabled: false,
      label: 'BTC',
      coin: 'BTC',
      network: 'Bitcoin',
      address: '',
      instructions: 'Use Bitcoin network only.',
      qrImageUrl: '',
    },
    {
      key: 'wallet_3',
      enabled: false,
      label: 'ETH / ERC20',
      coin: 'ETH',
      network: 'ERC20',
      address: '',
      instructions: 'Use ERC20 network only.',
      qrImageUrl: '',
    },
  ];
}

function getActiveCryptoWallets(crypto = {}) {
  const configuredWallets = Array.isArray(crypto.wallets)
    ? crypto.wallets.map(cloneWallet).filter((wallet) => wallet.address)
    : [];

  const explicitlyEnabledWallets = configuredWallets.filter((wallet) => wallet.enabled);
  return explicitlyEnabledWallets.length ? explicitlyEnabledWallets : configuredWallets;
}

export async function ensurePaymentSettings() {
  let settings = await PaymentSettings.findOne({ singletonKey: 'main' });
  if (!settings) {
    settings = await PaymentSettings.create({ singletonKey: 'main' });
  }
  return settings;
}

function buildSiteSettings(site = {}, req) {
  return {
    footerTagline: cleanText(site.footerTagline) || 'Healthy plants • Home gardening • Delivery available',
    contactPhone: cleanText(site.contactPhone),
    contactEmail: cleanText(site.contactEmail),
    contactAddress: cleanText(site.contactAddress),
    businessHours: cleanText(site.businessHours),
    deliveryNote: cleanText(site.deliveryNote),
    footerCopyright: cleanText(site.footerCopyright) || 'All rights reserved.',
    facebookUrl: cleanText(site.facebookUrl),
    instagramUrl: cleanText(site.instagramUrl),
    tiktokUrl: cleanText(site.tiktokUrl),
    mapsUrl: cleanText(site.mapsUrl),
    promoAlt: cleanText(site.promoAlt) || 'Batalawatta Plant Nursery special offer',
    promoImageUrl: site.promoImageUrl ? resolveMediaUrl(req, site.promoImageUrl) : '',
  };
}

function toResolvedMethod(req, method = {}) {
  const clone = { ...method };
  if (clone.bankDetails?.qrImageUrl) {
    clone.bankDetails.qrImageUrl = resolveMediaUrl(req, clone.bankDetails.qrImageUrl);
  }
  if (clone.qr?.qrImageUrl) {
    clone.qr.qrImageUrl = resolveMediaUrl(req, clone.qr.qrImageUrl);
  }
  if (clone.wallets?.length) {
    clone.wallets = clone.wallets.map((wallet) => ({
      ...wallet,
      qrImageUrl: wallet.qrImageUrl ? resolveMediaUrl(req, wallet.qrImageUrl) : '',
    }));
  }
  return clone;
}

export function buildCheckoutMethods(settingsDoc) {
  const settings = settingsDoc?.toObject ? settingsDoc.toObject() : (settingsDoc || {});
  const methods = [];

  if (settings.cod?.enabled !== false) {
    methods.push({
      code: 'cod',
      label: cleanText(settings.cod.title) || 'Cash on Delivery',
      requiresSlip: false,
      requiresReference: false,
      payerLabel: 'Receiver name (optional)',
      referenceLabel: 'Reference',
      note: cleanText(settings.cod.instructions),
      maxOrderAmount: toNumber(settings.cod.maxOrderAmount, 0),
      destinationLabel: 'Cash payment on delivery',
      destinationValue: '',
    });
  }

  if (settings.bankTransfer?.enabled !== false) {
    methods.push({
      code: 'bank_transfer',
      label: cleanText(settings.bankTransfer.title) || 'Direct Bank Transfer',
      requiresSlip: true,
      requiresReference: false,
      payerLabel: 'Account holder name',
      referenceLabel: 'Bank reference / slip note (optional)',
      note: cleanText(settings.bankTransfer.instructions),
      destinationLabel: cleanText(settings.bankTransfer.bankName) || 'Bank transfer',
      destinationValue: cleanText(settings.bankTransfer.accountNumber),
      bankDetails: {
        bankName: cleanText(settings.bankTransfer.bankName),
        accountName: cleanText(settings.bankTransfer.accountName),
        accountNumber: cleanText(settings.bankTransfer.accountNumber),
        branch: cleanText(settings.bankTransfer.branch),
        qrImageUrl: cleanText(settings.bankTransfer.qrImageUrl),
      },
    });
  }

  if (settings.lankaQr?.enabled !== false) {
    methods.push({
      code: 'lanka_qr',
      label: cleanText(settings.lankaQr.title) || 'LANKAQR / Mobile Banking QR',
      requiresSlip: true,
      requiresReference: false,
      payerLabel: 'Payer name',
      referenceLabel: 'Bank app reference (optional)',
      note: cleanText(settings.lankaQr.instructions),
      destinationLabel: cleanText(settings.lankaQr.merchantName) || 'LANKAQR',
      destinationValue: '',
      qr: {
        merchantName: cleanText(settings.lankaQr.merchantName),
        qrImageUrl: cleanText(settings.lankaQr.qrImageUrl),
      },
    });
  }

  if (settings.skrill?.enabled) {
    methods.push({
      code: 'skrill',
      label: cleanText(settings.skrill.title) || 'Skrill',
      requiresSlip: true,
      requiresReference: false,
      payerLabel: 'Sender name / email',
      referenceLabel: 'Skrill reference (optional)',
      note: cleanText(settings.skrill.instructions),
      destinationLabel: 'Skrill',
      destinationValue: cleanText(settings.skrill.email),
      details: {
        email: cleanText(settings.skrill.email),
        customerId: cleanText(settings.skrill.customerId),
      },
    });
  }

  const wallets = getActiveCryptoWallets(settings.crypto);

  if (settings.crypto?.enabled && wallets.length) {
    methods.push({
      code: 'crypto',
      label: cleanText(settings.crypto.title) || 'Crypto Payment',
      requiresSlip: true,
      requiresReference: true,
      payerLabel: 'Sender wallet / payer name',
      referenceLabel: 'Transaction hash / wallet reference',
      note: cleanText(settings.crypto.instructions),
      destinationLabel: 'Crypto wallet',
      destinationValue: '',
      wallets,
    });
  }

  return methods;
}

export function getCheckoutMethod(settingsDoc, methodCode) {
  const methods = buildCheckoutMethods(settingsDoc);
  if (!methods.length) return null;
  return methods.find((method) => method.code === methodCode) || methods[0];
}

export function buildPublicPaymentSettings(settingsDoc, req) {
  const settings = settingsDoc?.toObject ? settingsDoc.toObject() : (settingsDoc || {});
  const methods = buildCheckoutMethods(settings).map((method) => toResolvedMethod(req, method));

  return {
    businessName: cleanText(settings.businessName) || 'Batalawatta Plant Nursery',
    whatsappNumber: cleanText(settings.whatsappNumber) || '94752515517',
    orderPrefix: cleanText(settings.orderPrefix) || 'BPN',
    paymentPolicyNote: cleanText(settings.paymentPolicyNote),
    slipGuidance: cleanText(settings.slipGuidance),
    methods,
    site: buildSiteSettings(settings.site, req),
  };
}

export function buildAdminPaymentSettings(settingsDoc, req) {
  const settings = settingsDoc?.toObject ? settingsDoc.toObject() : (settingsDoc || {});
  return {
    businessName: cleanText(settings.businessName) || 'Batalawatta Plant Nursery',
    whatsappNumber: cleanText(settings.whatsappNumber) || '94752515517',
    orderPrefix: cleanText(settings.orderPrefix) || 'BPN',
    paymentPolicyNote: cleanText(settings.paymentPolicyNote),
    slipGuidance: cleanText(settings.slipGuidance),
    cod: {
      enabled: settings.cod?.enabled !== false,
      title: cleanText(settings.cod?.title) || 'Cash on Delivery',
      maxOrderAmount: toNumber(settings.cod?.maxOrderAmount, 0),
      instructions: cleanText(settings.cod?.instructions),
    },
    bankTransfer: {
      enabled: settings.bankTransfer?.enabled !== false,
      title: cleanText(settings.bankTransfer?.title) || 'Direct Bank Transfer',
      bankName: cleanText(settings.bankTransfer?.bankName),
      accountName: cleanText(settings.bankTransfer?.accountName),
      accountNumber: cleanText(settings.bankTransfer?.accountNumber),
      branch: cleanText(settings.bankTransfer?.branch),
      instructions: cleanText(settings.bankTransfer?.instructions),
      qrImageUrl: settings.bankTransfer?.qrImageUrl ? resolveMediaUrl(req, settings.bankTransfer.qrImageUrl) : '',
    },
    lankaQr: {
      enabled: settings.lankaQr?.enabled !== false,
      title: cleanText(settings.lankaQr?.title) || 'LANKAQR / Mobile Banking QR',
      merchantName: cleanText(settings.lankaQr?.merchantName),
      instructions: cleanText(settings.lankaQr?.instructions),
      qrImageUrl: settings.lankaQr?.qrImageUrl ? resolveMediaUrl(req, settings.lankaQr.qrImageUrl) : '',
    },
    skrill: {
      enabled: Boolean(settings.skrill?.enabled),
      title: cleanText(settings.skrill?.title) || 'Skrill',
      email: cleanText(settings.skrill?.email),
      customerId: cleanText(settings.skrill?.customerId),
      instructions: cleanText(settings.skrill?.instructions),
    },
    crypto: {
      enabled: Boolean(settings.crypto?.enabled),
      title: cleanText(settings.crypto?.title) || 'Crypto Payment',
      instructions: cleanText(settings.crypto?.instructions),
      wallets: (Array.isArray(settings.crypto?.wallets) && settings.crypto.wallets.length ? settings.crypto.wallets : defaultCryptoWallets()).map((wallet, index) => ({
        key: cleanText(wallet.key) || `wallet_${index + 1}`,
        enabled: Boolean(wallet.enabled),
        label: cleanText(wallet.label),
        coin: cleanText(wallet.coin),
        network: cleanText(wallet.network),
        address: cleanText(wallet.address),
        instructions: cleanText(wallet.instructions),
        qrImageUrl: wallet.qrImageUrl ? resolveMediaUrl(req, wallet.qrImageUrl) : '',
      })),
    },
    site: buildSiteSettings(settings.site, req),
  };
}

export function makeOrderCode(prefix = 'BPN') {
  const now = new Date();
  const datePart = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  const randomPart = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `${cleanText(prefix || 'BPN').toUpperCase()}-${datePart}-${randomPart}`;
}
