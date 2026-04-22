// Shared config
const API_BASE = 'http://localhost:5000/api';

// Fallback WhatsApp number. Checkout can override this with the admin-configured number.
const DEFAULT_WHATSAPP_NUMBER = '94752515517';
const DEFAULT_PROMO_IMAGE = 'assets/img/site/promo-offer.svg';

function buildWhatsAppUrl(message, overrideNumber) {
  const number = String(overrideNumber || window.__siteWhatsAppNumber || DEFAULT_WHATSAPP_NUMBER || '').replace(/[^0-9]/g, '');
  const text = encodeURIComponent(message || '');
  return `https://wa.me/${number}?text=${text}`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function normalizeExternalUrl(value) {
  const url = String(value || '').trim();
  return /^https?:\/\//i.test(url) ? url : '';
}

function formatPhoneDisplay(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (raw.startsWith('+')) return raw;
  const digits = raw.replace(/\D/g, '');
  return digits.startsWith('94') ? `+${digits}` : raw;
}

async function loadSiteSettings() {
  if (window.__siteSettings) return window.__siteSettings;
  if (!window.__siteSettingsPromise) {
    window.__siteSettingsPromise = fetch(`${API_BASE}/settings/payment`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load site settings');
        return res.json();
      })
      .then((data) => {
        window.__siteSettings = data;
        return data;
      })
      .catch(() => null);
  }
  return window.__siteSettingsPromise;
}

function applyBrandName(settings) {
  const brand = settings?.businessName || 'Batalawatta Plant Nursery';
  document.querySelectorAll('a.brand').forEach((node) => {
    node.textContent = brand;
  });
}

function buildFooterHtml(settings) {
  const site = settings?.site || {};
  const year = new Date().getFullYear();
  const brand = escapeHtml(settings?.businessName || 'Batalawatta Plant Nursery');
  const tagline = escapeHtml(site.footerTagline || 'Healthy plants • Home gardening • Delivery available');
  const deliveryNote = escapeHtml(site.deliveryNote || '');
  const address = escapeHtml(site.contactAddress || '');
  const hours = escapeHtml(site.businessHours || '');
  const phone = escapeHtml(formatPhoneDisplay(site.contactPhone || settings?.whatsappNumber || ''));
  const email = escapeHtml(site.contactEmail || '');
  const whatsappDisplay = escapeHtml(formatPhoneDisplay(settings?.whatsappNumber || ''));
  const mapsUrl = normalizeExternalUrl(site.mapsUrl);
  const facebookUrl = normalizeExternalUrl(site.facebookUrl);
  const instagramUrl = normalizeExternalUrl(site.instagramUrl);
  const tiktokUrl = normalizeExternalUrl(site.tiktokUrl);
  const copyrightText = escapeHtml(site.footerCopyright || 'All rights reserved.');
  const whatsappHref = buildWhatsAppUrl('Hello Batalawatta Plant Nursery, I would like to know more about your plants and delivery options.', settings?.whatsappNumber);

  const usefulLinks = [
    mapsUrl ? `<a href="${mapsUrl}" target="_blank" rel="noopener">Get directions</a>` : '',
    facebookUrl ? `<a href="${facebookUrl}" target="_blank" rel="noopener">Facebook</a>` : '',
    instagramUrl ? `<a href="${instagramUrl}" target="_blank" rel="noopener">Instagram</a>` : '',
    tiktokUrl ? `<a href="${tiktokUrl}" target="_blank" rel="noopener">TikTok</a>` : '',
  ].filter(Boolean).join('');

  return `
    <div class="footer-wrap footer-wrap--dynamic">
      <div class="site-footer-grid">
        <div class="site-footer-col">
          <div class="site-footer-title">${brand}</div>
          <div class="site-footer-meta">${tagline}</div>
          ${deliveryNote ? `<div class="site-footer-note">${deliveryNote}</div>` : ''}
          <div class="site-footer-note">© ${year} ${brand}. ${copyrightText}</div>
        </div>
        <div class="site-footer-col">
          ${address ? `<div class="site-footer-meta"><b>Address:</b> ${address}</div>` : ''}
          ${hours ? `<div class="site-footer-meta"><b>Hours:</b> ${hours}</div>` : ''}
          ${mapsUrl ? `<div class="site-footer-links"><a href="${mapsUrl}" target="_blank" rel="noopener">Open location map</a></div>` : ''}
        </div>
        <div class="site-footer-col">
          <div class="site-footer-contact">
            ${phone ? `<div class="site-footer-meta"><b>Phone:</b> ${phone}</div>` : ''}
            ${email ? `<div class="site-footer-meta"><b>Email:</b> <a href="mailto:${email}">${email}</a></div>` : ''}
            ${whatsappDisplay ? `<div class="site-footer-meta"><b>WhatsApp:</b> <a href="${whatsappHref}" target="_blank" rel="noopener">${whatsappDisplay}</a></div>` : ''}
          </div>
          ${usefulLinks ? `<div class="site-footer-links">${usefulLinks}</div>` : ''}
        </div>
      </div>
    </div>
  `;
}

function applyFooter(settings) {
  const footers = document.querySelectorAll('footer');
  if (!footers.length) return;
  const html = buildFooterHtml(settings);
  footers.forEach((footer) => {
    footer.innerHTML = html;
  });
}

function applyHeroPromo(settings) {
  const img = document.getElementById('heroPromoImage');
  if (!img) return;
  img.src = settings?.site?.promoImageUrl || DEFAULT_PROMO_IMAGE;
  img.alt = settings?.site?.promoAlt || 'Batalawatta Plant Nursery special offer';
}

document.addEventListener('DOMContentLoaded', async () => {
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  const settings = await loadSiteSettings();
  const whatsapp = settings?.whatsappNumber || DEFAULT_WHATSAPP_NUMBER;
  window.__siteWhatsAppNumber = whatsapp;
  window.WHATSAPP_NUMBER = whatsapp;

  if (!settings) return;
  applyBrandName(settings);
  applyFooter(settings);
  applyHeroPromo(settings);
});
