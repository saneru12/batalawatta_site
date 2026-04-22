const msg = document.getElementById('checkoutMsg');
const itemsEl = document.getElementById('checkoutItems');
const subtotalEl = document.getElementById('summarySubtotal');
const deliveryFeeEl = document.getElementById('summaryDeliveryFee');
const totalEl = document.getElementById('checkoutTotal');
const zoneHelpEl = document.getElementById('zoneHelp');
const estimateCardEl = document.getElementById('deliveryEstimateCard');
const minimumHintEl = document.getElementById('minimumOrderHint');
const successEl = document.getElementById('checkoutSuccess');
const processStepsEl = document.getElementById('deliveryProcessSteps');
const paymentPolicyNoteEl = document.getElementById('paymentPolicyNote');
const paymentTagEl = document.getElementById('paymentTag');
const paymentMethodHelpEl = document.getElementById('paymentMethodHelp');
const paymentMediaWrapEl = document.getElementById('paymentMediaWrap');
const paymentQrImageEl = document.getElementById('paymentQrImage');
const paymentQrLinkEl = document.getElementById('paymentQrLink');
const cryptoWalletWrapEl = document.getElementById('cryptoWalletWrap');
const cryptoWalletEl = document.getElementById('cryptoWallet');
const standardPaymentWrapEl = document.getElementById('standardPaymentWrap');
const payerNameLabelEl = document.getElementById('payerNameLabel');
const paymentReferenceLabelEl = document.getElementById('paymentReferenceLabel');
const paymentSlipWrapEl = document.getElementById('paymentSlipWrap');
const paymentSlipHelpEl = document.getElementById('paymentSlipHelp');
const paymentSlipPreviewEl = document.getElementById('paymentSlipPreview');
const paymentSlipInput = document.getElementById('paymentSlip');

let cartItems = [];
let subtotalValue = 0;
let deliveryConfig = null;
let paymentConfig = null;

function setMsg(text) {
  if (msg) msg.textContent = text || '';
}

function money(value, currency = 'LKR') {
  const amount = Number(value || 0);
  if (currency && currency !== 'LKR') {
    return `${currency} ${amount.toLocaleString('en-LK', { maximumFractionDigits: 8 })}`;
  }
  return `Rs. ${amount.toLocaleString('en-LK', { maximumFractionDigits: 0 })}`;
}

function toNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function formatDateLabel(iso) {
  if (!iso) return '';
  const date = new Date(`${iso}T00:00:00`);
  return date.toLocaleDateString('en-LK', { year: 'numeric', month: 'short', day: 'numeric' });
}

function todayIso() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getSelectedZone() {
  if (!deliveryConfig) return null;
  const zoneId = document.getElementById('deliveryZone')?.value || '';
  return deliveryConfig.zones.find((zone) => zone.id === zoneId) || null;
}

function getSelectedTimeSlot() {
  if (!deliveryConfig) return null;
  const slotId = document.getElementById('preferredTimeSlot')?.value || '';
  return deliveryConfig.timeSlots.find((slot) => slot.id === slotId) || null;
}

function currentTotal() {
  const zone = getSelectedZone();
  return subtotalValue + Number(zone?.fee || 0);
}

function getAvailablePaymentMethods() {
  const methods = Array.isArray(paymentConfig?.methods) ? paymentConfig.methods : [];
  const total = currentTotal();
  return methods.filter((method) => {
    if (method.code !== 'cod') return true;
    const max = Number(method.maxOrderAmount || 0);
    return !(max > 0 && total > max);
  });
}

function getSelectedPaymentMethod() {
  const select = document.getElementById('paymentMethod');
  const methodCode = select?.value || '';
  return getAvailablePaymentMethods().find((method) => method.code === methodCode) || getAvailablePaymentMethods()[0] || null;
}

function getSelectedCryptoWallet(methodOverride) {
  const method = methodOverride || getSelectedPaymentMethod();
  if (!method || method.code !== 'crypto') return null;
  const wallets = Array.isArray(method.wallets) ? method.wallets : [];
  const walletKey = cryptoWalletEl?.value || '';
  return wallets.find((wallet) => wallet.key === walletKey) || wallets[0] || null;
}

function prefillCustomer() {
  if (!isLoggedIn()) return;
  const customer = getCustomer();
  if (!customer) return;

  const nameEl = document.getElementById('name');
  const phoneEl = document.getElementById('phone');
  const emailEl = document.getElementById('email');
  const addressEl = document.getElementById('address');
  const recipientNameEl = document.getElementById('recipientName');
  const recipientPhoneEl = document.getElementById('recipientPhone');

  if (nameEl && !nameEl.value) nameEl.value = customer.name || '';
  if (phoneEl && !phoneEl.value) phoneEl.value = customer.phone || '';
  if (emailEl && !emailEl.value) emailEl.value = customer.email || '';
  if (addressEl && !addressEl.value) addressEl.value = customer.address || '';
  if (recipientNameEl && !recipientNameEl.value) recipientNameEl.value = customer.name || '';
  if (recipientPhoneEl && !recipientPhoneEl.value) recipientPhoneEl.value = customer.phone || '';
}

function itemRow(item) {
  const image = item?.plant?.image || item?.plant?.imageUrl || item?.image || 'https://picsum.photos/seed/plant/300/200';
  const name = item?.plant?.name || item?.name || 'Plant';
  const price = toNumber(item?.plant?.price ?? item?.price ?? 0);
  const qty = Number(item?.qty ?? item?.quantity ?? 1);
  const lineTotal = price * qty;
  return `
    <div class="checkout-item">
      <img class="checkout-thumb" src="${image}" alt="${name}">
      <div class="checkout-meta">
        <div class="checkout-title">${name}</div>
        <div class="muted">${money(price)} x ${qty}</div>
        <div class="checkout-subtotal">Item total: <b>${money(lineTotal)}</b></div>
      </div>
      <div class="checkout-line">${money(lineTotal)}</div>
    </div>
  `;
}

function renderProcessSteps() {
  if (!processStepsEl || !deliveryConfig?.stages?.length) return;
  const visibleStages = deliveryConfig.stages.filter((stage) => stage.key !== 'cancelled');
  processStepsEl.innerHTML = visibleStages
    .map(
      (stage, index) => `
        <div class="process-step-mini">
          <span class="step-no">${index + 1}</span>
          <div>
            <strong>${stage.title}</strong>
            <div class="muted">${stage.description}</div>
          </div>
        </div>
      `
    )
    .join('');
}

function renderZoneOptions() {
  const zoneSelect = document.getElementById('deliveryZone');
  const slotSelect = document.getElementById('preferredTimeSlot');
  if (!deliveryConfig || !zoneSelect || !slotSelect) return;

  zoneSelect.innerHTML = `
    <option value="">Select your delivery zone</option>
    ${deliveryConfig.zones
      .map((zone) => `<option value="${zone.id}">${zone.name} - ${money(zone.fee)}</option>`)
      .join('')}
  `;

  slotSelect.innerHTML = deliveryConfig.timeSlots
    .map((slot) => `<option value="${slot.id}">${slot.label}</option>`)
    .join('');

  if (deliveryConfig.zones[0]) zoneSelect.value = deliveryConfig.zones[0].id;
  const defaultSlot = deliveryConfig.timeSlots.find((slot) => slot.id === (deliveryConfig.zones[0]?.defaultTimeSlot || 'afternoon'));
  if (defaultSlot) slotSelect.value = defaultSlot.id;
}

function estimateWindowLabel() {
  const zone = getSelectedZone();
  const slot = getSelectedTimeSlot();
  const preferredDate = document.getElementById('preferredDate')?.value || '';
  if (!zone || !slot) return '';
  const displayDate = preferredDate || todayIso();
  return `${formatDateLabel(displayDate)} - ${slot.label}`;
}

function setQrDisplay(imageUrl) {
  if (!paymentMediaWrapEl || !paymentQrImageEl || !paymentQrLinkEl) return;
  if (imageUrl) {
    paymentMediaWrapEl.style.display = 'flex';
    paymentQrImageEl.style.display = 'block';
    paymentQrImageEl.src = imageUrl;
    paymentQrLinkEl.style.display = 'inline-flex';
    paymentQrLinkEl.href = imageUrl;
  } else {
    paymentMediaWrapEl.style.display = 'none';
    paymentQrImageEl.style.display = 'none';
    paymentQrImageEl.removeAttribute('src');
    paymentQrLinkEl.style.display = 'none';
    paymentQrLinkEl.removeAttribute('href');
  }
}

function renderPaymentOptions() {
  const select = document.getElementById('paymentMethod');
  if (!select) return;

  const previous = select.value;
  const methods = getAvailablePaymentMethods();

  if (!methods.length) {
    select.innerHTML = '<option value="">No payment methods configured</option>';
    select.value = '';
    updatePaymentUi();
    return;
  }

  select.innerHTML = methods.map((method) => `<option value="${method.code}">${method.label}</option>`).join('');
  if (methods.some((method) => method.code === previous)) {
    select.value = previous;
  } else {
    select.value = methods[0].code;
  }

  updatePaymentUi();
}

function renderCryptoWalletUi(method) {
  const wallets = Array.isArray(method?.wallets) ? method.wallets : [];
  if (!cryptoWalletEl) return;
  cryptoWalletEl.innerHTML = wallets.map((wallet) => `<option value="${wallet.key}">${wallet.label} - ${wallet.network}</option>`).join('');
  const wallet = getSelectedCryptoWallet(method);
  if (wallet) cryptoWalletEl.value = wallet.key;

  const selectedWallet = getSelectedCryptoWallet(method);
  setQrDisplay(selectedWallet?.qrImageUrl || '');
  paymentMethodHelpEl.innerHTML = `
    <div class="payment-method-title">${method.label}</div>
    <div class="muted">${method.note || ''}</div>
    ${selectedWallet ? `
      <div class="payment-details-grid">
        <div><span class="muted">Coin</span><strong>${selectedWallet.coin || '-'}</strong></div>
        <div><span class="muted">Network</span><strong>${selectedWallet.network || '-'}</strong></div>
      </div>
      <div class="payment-destination-box">
        <span class="muted">Address</span>
        <code>${selectedWallet.address || '-'}</code>
      </div>
      ${selectedWallet.instructions ? `<div class="muted compact-copy">${selectedWallet.instructions}</div>` : ''}
    ` : '<div class="muted">No active crypto wallet configured.</div>'}
  `;
}

function updatePaymentUi() {
  const method = getSelectedPaymentMethod();
  const total = currentTotal();
  window.__siteWhatsAppNumber = paymentConfig?.whatsappNumber || window.__siteWhatsAppNumber || '';

  if (paymentPolicyNoteEl) {
    paymentPolicyNoteEl.textContent = paymentConfig?.paymentPolicyNote || 'Orders with uploaded proofs are verified by the nursery before dispatch.';
  }

  if (!method) {
    paymentMethodHelpEl.innerHTML = '<div class="muted">No payment method available.</div>';
    standardPaymentWrapEl.style.display = 'none';
    cryptoWalletWrapEl.style.display = 'none';
    paymentSlipWrapEl.style.display = 'none';
    setQrDisplay('');
    return;
  }

  if (paymentTagEl) {
    paymentTagEl.textContent = method.code === 'cod' ? 'Pay later' : method.code === 'crypto' ? 'Manual verify + hash' : 'Upload proof';
  }

  payerNameLabelEl.textContent = method.payerLabel || 'Payer Name';
  paymentReferenceLabelEl.textContent = method.referenceLabel || 'Reference';

  if (method.code === 'crypto') {
    standardPaymentWrapEl.style.display = 'none';
    cryptoWalletWrapEl.style.display = 'grid';
    paymentSlipWrapEl.style.display = 'block';
    paymentSlipHelpEl.textContent = paymentConfig?.slipGuidance || 'Upload a clear payment screenshot.';
    renderCryptoWalletUi(method);
  } else {
    cryptoWalletWrapEl.style.display = 'none';
    standardPaymentWrapEl.style.display = method.code === 'cod' ? 'none' : 'grid';
    paymentSlipWrapEl.style.display = method.requiresSlip ? 'block' : 'none';
    paymentSlipHelpEl.textContent = method.requiresSlip
      ? (paymentConfig?.slipGuidance || 'Upload a clear payment screenshot or PDF slip.')
      : 'No slip is required for this method.';

    let qrImageUrl = '';
    let detailsHtml = '';
    if (method.bankDetails) {
      qrImageUrl = method.bankDetails.qrImageUrl || '';
      detailsHtml = `
        <div class="payment-details-grid">
          <div><span class="muted">Bank</span><strong>${method.bankDetails.bankName || '-'}</strong></div>
          <div><span class="muted">Branch</span><strong>${method.bankDetails.branch || '-'}</strong></div>
        </div>
        <div class="payment-details-grid">
          <div><span class="muted">Account Name</span><strong>${method.bankDetails.accountName || '-'}</strong></div>
          <div><span class="muted">Account No</span><strong>${method.bankDetails.accountNumber || '-'}</strong></div>
        </div>
      `;
    } else if (method.qr) {
      qrImageUrl = method.qr.qrImageUrl || '';
      detailsHtml = `
        <div class="payment-details-grid">
          <div><span class="muted">QR Merchant</span><strong>${method.qr.merchantName || 'Batalawatta Plant Nursery'}</strong></div>
          <div><span class="muted">Total to pay</span><strong>${money(total)}</strong></div>
        </div>
      `;
    } else if (method.details) {
      detailsHtml = `
        <div class="payment-details-grid">
          <div><span class="muted">Skrill Email</span><strong>${method.details.email || '-'}</strong></div>
          <div><span class="muted">Customer ID</span><strong>${method.details.customerId || '-'}</strong></div>
        </div>
      `;
    }

    setQrDisplay(qrImageUrl);
    paymentMethodHelpEl.innerHTML = method.code === 'cod'
      ? `
        <div class="payment-method-title">${method.label}</div>
        <div class="muted">${method.note || ''}</div>
        <div class="payment-destination-box compact">
          <span class="muted">Order total to be collected at delivery</span>
          <strong>${money(total)}</strong>
        </div>
      `
      : `
        <div class="payment-method-title">${method.label}</div>
        <div class="muted">${method.note || ''}</div>
        ${detailsHtml}
        <div class="payment-destination-box compact">
          <span class="muted">Pay this exact amount</span>
          <strong>${money(total)}</strong>
        </div>
      `;
  }

  if (minimumHintEl && deliveryConfig) {
    if (subtotalValue > 0 && subtotalValue < Number(deliveryConfig.minimumRecommendedOrder || 0)) {
      minimumHintEl.style.display = 'block';
      minimumHintEl.textContent = `Orders below ${money(deliveryConfig.minimumRecommendedOrder)} may be scheduled with the next available delivery route.`;
    } else {
      minimumHintEl.style.display = 'none';
      minimumHintEl.textContent = '';
    }
  }
}

function updatePricing() {
  const zone = getSelectedZone();
  const fee = Number(zone?.fee || 0);
  const total = subtotalValue + fee;

  subtotalEl.textContent = money(subtotalValue);
  deliveryFeeEl.textContent = money(fee);
  totalEl.textContent = money(total);

  if (zoneHelpEl) {
    if (!zone) {
      zoneHelpEl.textContent = 'Select a delivery zone to calculate the fee and lead time.';
    } else {
      zoneHelpEl.innerHTML = `
        <strong>${zone.name}</strong><br>
        Delivery fee: ${money(zone.fee)} - Lead time: ${zone.leadTimeLabel}
      `;
    }
  }

  if (estimateCardEl && zone) {
    estimateCardEl.style.display = 'block';
    estimateCardEl.innerHTML = `
      <h3>Estimated delivery</h3>
      <div class="summary-line">
        <span>Requested window</span>
        <strong>${estimateWindowLabel()}</strong>
      </div>
      <div class="summary-line">
        <span>Zone lead time</span>
        <strong>${zone.leadTimeLabel}</strong>
      </div>
      <div class="muted compact-copy">Final route confirmation will be shared by phone or WhatsApp before dispatch.</div>
    `;
  }

  renderPaymentOptions();
}

async function loadDeliveryConfig() {
  const res = await fetch(`${API_BASE}/orders/delivery-config`);
  if (!res.ok) throw new Error('Failed to load delivery rules');
  deliveryConfig = await res.json();
  renderZoneOptions();
  renderProcessSteps();
}

async function loadPaymentConfig() {
  const res = await fetch(`${API_BASE}/settings/payment`);
  if (!res.ok) throw new Error('Failed to load payment settings');
  paymentConfig = await res.json();
  window.__siteWhatsAppNumber = paymentConfig?.whatsappNumber || window.__siteWhatsAppNumber || '';
  renderPaymentOptions();
}

async function loadSummary() {
  setMsg('Loading cart...');
  try {
    const cart = await apiCartGet();
    cartItems = cart?.items || [];
    window.__lastCartItems = cartItems;

    if (!cartItems.length) {
      itemsEl.innerHTML = '<div class="muted">Your cart is empty. <a href="products.html">Browse plants</a></div>';
      subtotalValue = 0;
      updatePricing();
      setMsg('');
      return;
    }

    itemsEl.innerHTML = cartItems.map(itemRow).join('');
    subtotalValue = cartItems.reduce((sum, item) => {
      const price = toNumber(item?.plant?.price ?? item?.price ?? 0);
      const qty = Number(item?.qty ?? item?.quantity ?? 1);
      return sum + price * qty;
    }, 0);
    updatePricing();
    setMsg('');
  } catch (_error) {
    setMsg('API connection error. Start backend.');
  }
}

async function placeOrder(payload, slipFile) {
  const formData = new FormData();
  formData.append('orderPayload', JSON.stringify(payload));
  if (slipFile) formData.append('paymentSlip', slipFile);

  const res = await fetch(`${API_BASE}/orders/checkout`, {
    method: 'POST',
    headers: authHeaders(),
    body: formData,
  });
  return res.json();
}

function getPaymentReferenceValue(method) {
  if (method?.code === 'crypto') {
    return document.getElementById('paymentReference')?.value.trim() || '';
  }
  return document.getElementById('paymentReferenceStandard')?.value.trim() || '';
}

function buildWhatsAppMessage(result, payload) {
  const itemsText = (window.__lastCartItems || [])
    .map((item) => {
      const name = item?.plant?.name || item?.name || 'Item';
      const price = toNumber(item?.plant?.price ?? item?.price ?? 0);
      const qty = Number(item?.qty ?? item?.quantity ?? 1);
      return `- ${name} x${qty} = Rs. ${Math.round(price * qty)}`;
    })
    .join('\n');

  const zone = getSelectedZone();
  const slot = getSelectedTimeSlot();
  const order = result?.order || {};
  const payment = order.payment || {};

  return [
    'Batalawatta Plant Nursery - New Order',
    `Order Code: ${result?.orderCode || order.orderCode || ''}`,
    `Order ID: ${result?.orderId || order._id || ''}`,
    '',
    'Customer:',
    `Name: ${payload.customer.name}`,
    `Phone: ${payload.customer.phone}`,
    payload.customer.email ? `Email: ${payload.customer.email}` : '',
    `Address: ${payload.customer.address}`,
    payload.delivery.landmark ? `Landmark: ${payload.delivery.landmark}` : '',
    payload.delivery.instructions ? `Delivery Instructions: ${payload.delivery.instructions}` : '',
    payload.notes ? `Order Note: ${payload.notes}` : '',
    '',
    'Delivery:',
    zone ? `Zone: ${zone.name}` : '',
    payload.delivery.preferredDate ? `Preferred Date: ${payload.delivery.preferredDate}` : '',
    slot ? `Preferred Slot: ${slot.label}` : '',
    '',
    'Payment:',
    `Method: ${payment.methodLabel || payload.payment.methodCode}`,
    `Status: ${payment.status || ''}`,
    payload.payment.payerName ? `Payer: ${payload.payment.payerName}` : '',
    payload.payment.reference ? `Reference: ${payload.payment.reference}` : '',
    payment.destinationLabel ? `Destination: ${payment.destinationLabel}` : '',
    payment.destinationValue ? `Address/Account: ${payment.destinationValue}` : '',
    payment.slipUrl ? `Slip: ${payment.slipUrl}` : '',
    '',
    'Items:',
    itemsText || '(items unavailable)',
    '',
    `Subtotal: ${money(result?.subtotal || subtotalValue)}`,
    `Delivery Fee: ${money(result?.deliveryFee || Number(zone?.fee || 0))}`,
    `Total: ${money(result?.total || 0, payment.currency || 'LKR')}`,
  ]
    .filter(Boolean)
    .join('\n');
}

function renderSuccessPanel(order) {
  if (!successEl) return;
  const slotLabel = getSelectedTimeSlot()?.label || order?.delivery?.estimatedTimeSlot || '';
  const payment = order?.payment || {};
  const paymentLine = payment.methodCode === 'cod'
    ? 'Cash will be collected when the order is delivered.'
    : 'Payment proof uploaded. The nursery will verify it before dispatch.';

  successEl.style.display = 'block';
  successEl.innerHTML = `
    <div class="success-title">Order placed successfully</div>
    <div class="muted">Order Code: <strong>${order?.orderCode || order?._id || ''}</strong></div>
    <div class="summary-line" style="margin-top:12px;">
      <span>Estimated delivery</span>
      <strong>${order?.delivery?.estimatedDate ? formatDateLabel(order.delivery.estimatedDate) : 'To be confirmed'}${slotLabel ? ` - ${slotLabel}` : ''}</strong>
    </div>
    <div class="summary-line">
      <span>Payment</span>
      <strong>${payment.methodLabel || order?.paymentMethod || 'COD'}</strong>
    </div>
    <div class="summary-line">
      <span>Status</span>
      <strong>${payment.status || 'pending'}</strong>
    </div>
    <div class="muted compact-copy">${paymentLine}</div>
  `;
}

function setSuggestedDate() {
  const dateEl = document.getElementById('preferredDate');
  if (!dateEl) return;
  dateEl.min = todayIso();
  if (!dateEl.value) dateEl.value = todayIso();
}

function handleSlipPreview() {
  const file = paymentSlipInput?.files?.[0];
  if (!paymentSlipPreviewEl) return;
  if (!file) {
    paymentSlipPreviewEl.textContent = '';
    return;
  }
  paymentSlipPreviewEl.textContent = `Selected file: ${file.name} (${Math.round(file.size / 1024)} KB)`;
}

document.addEventListener('DOMContentLoaded', async () => {
  refreshCartBadge();
  prefillCustomer();
  setSuggestedDate();

  try {
    await Promise.all([loadDeliveryConfig(), loadPaymentConfig()]);
  } catch (_error) {
    setMsg('Failed to load checkout configuration.');
  }

  await loadSummary();

  ['deliveryZone', 'preferredTimeSlot', 'preferredDate'].forEach((id) => {
    const element = document.getElementById(id);
    if (element) element.addEventListener('change', updatePricing);
  });

  document.getElementById('paymentMethod')?.addEventListener('change', updatePaymentUi);
  cryptoWalletEl?.addEventListener('change', () => renderCryptoWalletUi(getSelectedPaymentMethod()));
  paymentSlipInput?.addEventListener('change', handleSlipPreview);

  document.getElementById('name')?.addEventListener('input', () => {
    const recipientNameEl = document.getElementById('recipientName');
    if (recipientNameEl && !recipientNameEl.dataset.userEdited) {
      recipientNameEl.value = document.getElementById('name').value.trim();
    }
  });

  document.getElementById('phone')?.addEventListener('input', () => {
    const recipientPhoneEl = document.getElementById('recipientPhone');
    if (recipientPhoneEl && !recipientPhoneEl.dataset.userEdited) {
      recipientPhoneEl.value = document.getElementById('phone').value.trim();
    }
  });

  ['recipientName', 'recipientPhone'].forEach((id) => {
    const element = document.getElementById(id);
    if (element) {
      element.addEventListener('input', () => {
        element.dataset.userEdited = element.value.trim() ? '1' : '';
      });
    }
  });

  const form = document.getElementById('checkoutForm');
  const submitButton = form?.querySelector('button[type="submit"]');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    if (!cartItems.length) {
      setMsg('Your cart is empty.');
      return;
    }

    const zone = getSelectedZone();
    const slot = getSelectedTimeSlot();
    const method = getSelectedPaymentMethod();

    if (!zone || !slot) {
      setMsg('Please select a delivery zone and time slot.');
      return;
    }

    if (!method) {
      setMsg('No payment method is available right now.');
      return;
    }

    const slipFile = paymentSlipInput?.files?.[0] || null;
    const paymentReference = getPaymentReferenceValue(method);
    if (method.requiresSlip && !slipFile) {
      setMsg('Please upload the payment slip or screenshot.');
      return;
    }
    if (method.requiresReference && !paymentReference) {
      setMsg('Please enter the transaction hash / payment reference.');
      return;
    }

    const payload = {
      sessionId: ensureSessionId(),
      customer: {
        name: document.getElementById('name').value.trim(),
        phone: document.getElementById('phone').value.trim(),
        email: document.getElementById('email').value.trim(),
        address: document.getElementById('address').value.trim(),
      },
      notes: document.getElementById('notes').value.trim(),
      payment: {
        methodCode: method.code,
        payerName: document.getElementById('payerName').value.trim(),
        payerPhone: document.getElementById('payerPhone').value.trim(),
        reference: paymentReference,
        paidAt: document.getElementById('paymentPaidAt').value,
        selectedWalletKey: method.code === 'crypto' ? (cryptoWalletEl?.value || '') : '',
      },
      paymentMethod: method.label,
      delivery: {
        zoneId: zone.id,
        preferredDate: document.getElementById('preferredDate').value,
        preferredTimeSlot: slot.id,
        recipientName: document.getElementById('recipientName').value.trim() || document.getElementById('name').value.trim(),
        recipientPhone: document.getElementById('recipientPhone').value.trim() || document.getElementById('phone').value.trim(),
        landmark: document.getElementById('landmark').value.trim(),
        instructions: document.getElementById('deliveryInstructions').value.trim(),
      },
    };

    if (submitButton) submitButton.disabled = true;
    setMsg('Placing order...');

    try {
      const result = await placeOrder(payload, slipFile);
      if (result?.error) {
        setMsg(result.message || 'Order failed');
        if (submitButton) submitButton.disabled = false;
        return;
      }

      renderSuccessPanel(result.order);
      setMsg('Order placed. Open WhatsApp to send the summary to the nursery.');

      const message = buildWhatsAppMessage(result, payload);
      const url = typeof buildWhatsAppUrl === 'function'
        ? buildWhatsAppUrl(message, paymentConfig?.whatsappNumber)
        : `https://wa.me/${paymentConfig?.whatsappNumber || ''}?text=${encodeURIComponent(message)}`;

      const waWrap = document.getElementById('waWrap');
      const waBtn = document.getElementById('waBtn');
      if (waBtn) waBtn.href = url;
      if (waWrap) waWrap.style.display = 'flex';

      try {
        window.open(url, '_blank', 'noopener');
      } catch (_error) {
        // ignore popup blockers; button is visible.
      }

      cartItems = [];
      window.__lastCartItems = [];
      itemsEl.innerHTML = '<div class="muted">Cart cleared after order placement. You can continue shopping anytime.</div>';
      subtotalValue = 0;
      updatePricing();
      refreshCartBadge();
      form.reset();
      prefillCustomer();
      setSuggestedDate();
      handleSlipPreview();
      if (submitButton) submitButton.disabled = false;
    } catch (_error) {
      setMsg('Order failed. Please try again.');
      if (submitButton) submitButton.disabled = false;
    }
  });
});
