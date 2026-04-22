import mongoose from 'mongoose';

const CodSchema = new mongoose.Schema(
  {
    enabled: { type: Boolean, default: true },
    title: { type: String, default: 'Cash on Delivery' },
    maxOrderAmount: { type: Number, default: 25000 },
    instructions: {
      type: String,
      default: 'Keep the exact amount ready. COD orders are reconfirmed by phone or WhatsApp before dispatch.',
    },
  },
  { _id: false }
);

const BankTransferSchema = new mongoose.Schema(
  {
    enabled: { type: Boolean, default: true },
    title: { type: String, default: 'Direct Bank Transfer' },
    bankName: { type: String, default: '' },
    accountName: { type: String, default: '' },
    accountNumber: { type: String, default: '' },
    branch: { type: String, default: '' },
    instructions: {
      type: String,
      default: 'Pay the exact order total and upload a clear slip or screenshot before placing the order.',
    },
    qrImageUrl: { type: String, default: '' },
  },
  { _id: false }
);

const LankaQrSchema = new mongoose.Schema(
  {
    enabled: { type: Boolean, default: true },
    title: { type: String, default: 'LANKAQR / Mobile Banking QR' },
    merchantName: { type: String, default: '' },
    instructions: {
      type: String,
      default: 'Scan the QR using any supported banking app, pay the exact amount, then upload the screenshot or slip.',
    },
    qrImageUrl: { type: String, default: '' },
  },
  { _id: false }
);

const SkrillSchema = new mongoose.Schema(
  {
    enabled: { type: Boolean, default: false },
    title: { type: String, default: 'Skrill' },
    email: { type: String, default: '' },
    customerId: { type: String, default: '' },
    instructions: {
      type: String,
      default: 'Send the payment to the configured Skrill account, then upload the screenshot before placing the order.',
    },
  },
  { _id: false }
);

const CryptoWalletSchema = new mongoose.Schema(
  {
    key: { type: String, required: true },
    enabled: { type: Boolean, default: false },
    label: { type: String, default: '' },
    coin: { type: String, default: '' },
    network: { type: String, default: '' },
    address: { type: String, default: '' },
    instructions: {
      type: String,
      default: 'Send only on the selected network. Upload a transaction screenshot after payment.',
    },
    qrImageUrl: { type: String, default: '' },
  },
  { _id: false }
);

const CryptoSchema = new mongoose.Schema(
  {
    enabled: { type: Boolean, default: false },
    title: { type: String, default: 'Crypto Payment' },
    instructions: {
      type: String,
      default: 'Send the exact amount using one of the configured wallets, then upload a screenshot and the transaction hash.',
    },
    wallets: {
      type: [CryptoWalletSchema],
      default: () => [
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
      ],
    },
  },
  { _id: false }
);

const SiteCustomizationSchema = new mongoose.Schema(
  {
    footerTagline: { type: String, default: 'Healthy plants • Home gardening • Delivery available' },
    contactPhone: { type: String, default: '+94 77 000 0000' },
    contactEmail: { type: String, default: 'hello@batalawatta.lk' },
    contactAddress: { type: String, default: 'Batalawatta, Sri Lanka' },
    businessHours: { type: String, default: 'Mon - Sat • 8.00 AM - 6.00 PM' },
    deliveryNote: { type: String, default: 'Islandwide delivery available for selected areas' },
    footerCopyright: { type: String, default: 'All rights reserved.' },
    facebookUrl: { type: String, default: '' },
    instagramUrl: { type: String, default: '' },
    tiktokUrl: { type: String, default: '' },
    mapsUrl: { type: String, default: '' },
    promoImageUrl: { type: String, default: '' },
    promoAlt: { type: String, default: 'Batalawatta Plant Nursery special offer' },
  },
  { _id: false }
);

const PaymentSettingsSchema = new mongoose.Schema(
  {
    singletonKey: { type: String, required: true, unique: true, default: 'main' },
    businessName: { type: String, default: 'Batalawatta Plant Nursery' },
    whatsappNumber: { type: String, default: '94752515517' },
    orderPrefix: { type: String, default: 'BPN' },
    paymentPolicyNote: {
      type: String,
      default: 'Orders paid by transfer, QR, Skrill, or crypto are dispatched after payment verification. Keep your slip or transaction screenshot ready.',
    },
    slipGuidance: {
      type: String,
      default: 'Upload a clear JPG, PNG, WEBP, or PDF proof of payment. Blurry screenshots may delay verification.',
    },
    cod: { type: CodSchema, default: () => ({}) },
    bankTransfer: { type: BankTransferSchema, default: () => ({}) },
    lankaQr: { type: LankaQrSchema, default: () => ({}) },
    skrill: { type: SkrillSchema, default: () => ({}) },
    crypto: { type: CryptoSchema, default: () => ({}) },
    site: { type: SiteCustomizationSchema, default: () => ({}) },
  },
  { timestamps: true }
);

export default mongoose.model('PaymentSettings', PaymentSettingsSchema);
