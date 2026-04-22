import mongoose from 'mongoose';

const OrderItemSchema = new mongoose.Schema(
  {
    plant: { type: mongoose.Schema.Types.ObjectId, ref: 'Plant', required: true },
    name: String,
    price: Number,
    qty: { type: Number, default: 1 },
  },
  { _id: false }
);

const DeliveryActivitySchema = new mongoose.Schema(
  {
    key: { type: String, required: true },
    label: { type: String, default: '' },
    note: { type: String, default: '' },
    proofPhotoUrl: { type: String, default: '' },
    proofOriginalName: { type: String, default: '' },
    recipientName: { type: String, default: '' },
    cashCollected: { type: Number, default: 0 },
    issueCode: { type: String, default: '' },
    loggedByRole: { type: String, default: 'system' },
    loggedById: { type: String, default: '' },
    loggedByName: { type: String, default: '' },
    at: { type: Date, default: Date.now },
  },
  { _id: false }
);

const DeliverySchema = new mongoose.Schema(
  {
    method: { type: String, default: 'nursery_vehicle' },
    vehicleType: { type: String, default: 'Own vehicle' },
    zoneId: { type: String, default: '' },
    zoneName: { type: String, default: '' },
    fee: { type: Number, default: 0 },
    preferredDate: { type: String, default: '' },
    preferredTimeSlot: { type: String, default: '' },
    scheduledDate: { type: String, default: '' },
    scheduledTimeSlot: { type: String, default: '' },
    estimatedDate: { type: String, default: '' },
    estimatedTimeSlot: { type: String, default: '' },
    leadTimeLabel: { type: String, default: '' },
    recipientName: { type: String, default: '' },
    recipientPhone: { type: String, default: '' },
    landmark: { type: String, default: '' },
    instructions: { type: String, default: '' },
    deliveryBoyId: { type: mongoose.Schema.Types.ObjectId, ref: 'DeliveryBoy', default: null },
    deliveryBoyName: { type: String, default: '' },
    deliveryBoyPhone: { type: String, default: '' },
    deliveryBoyUsername: { type: String, default: '' },
    vehicleNumber: { type: String, default: '' },
    routeSequence: { type: Number, default: 0 },
    assignedAt: { type: Date, default: null },
    assignedBy: { type: String, default: '' },
    lastActivityKey: { type: String, default: '' },
    lastActivityLabel: { type: String, default: '' },
    lastActivityAt: { type: Date, default: null },
    codCollectedAmount: { type: Number, default: 0 },
    codCollectedAt: { type: Date, default: null },
    deliveryProofUrl: { type: String, default: '' },
    deliveryProofOriginalName: { type: String, default: '' },
    activityLogs: { type: [DeliveryActivitySchema], default: [] },
  },
  { _id: false }
);

const PaymentSchema = new mongoose.Schema(
  {
    methodCode: { type: String, default: 'cod' },
    methodLabel: { type: String, default: 'Cash on Delivery' },
    status: { type: String, default: 'cash_on_delivery' },
    note: { type: String, default: '' },
    amountExpected: { type: Number, default: 0 },
    amountReceived: { type: Number, default: 0 },
    currency: { type: String, default: 'LKR' },
    payerName: { type: String, default: '' },
    payerPhone: { type: String, default: '' },
    reference: { type: String, default: '' },
    paidAt: { type: String, default: '' },
    slipUrl: { type: String, default: '' },
    slipOriginalName: { type: String, default: '' },
    selectedWalletKey: { type: String, default: '' },
    network: { type: String, default: '' },
    destinationLabel: { type: String, default: '' },
    destinationValue: { type: String, default: '' },
    verificationNote: { type: String, default: '' },
    verifiedAt: { type: Date, default: null },
    verifiedBy: { type: String, default: '' },
  },
  { _id: false }
);

const StatusTimelineSchema = new mongoose.Schema(
  {
    status: { type: String, required: true },
    title: { type: String, default: '' },
    note: { type: String, default: '' },
    updatedBy: { type: String, default: 'system' },
    at: { type: Date, default: Date.now },
  },
  { _id: false }
);

const OrderSchema = new mongoose.Schema(
  {
    orderCode: { type: String, default: '', index: true },
    sessionId: { type: String, required: true, index: true },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', default: null, index: true },
    customer: {
      name: { type: String, required: true },
      phone: { type: String, required: true },
      email: { type: String, default: '' },
      address: { type: String, required: true },
    },
    paymentMethod: { type: String, default: 'Cash on Delivery' },
    payment: { type: PaymentSchema, default: () => ({}) },
    notes: { type: String, default: '' },
    adminNote: { type: String, default: '' },
    items: [OrderItemSchema],
    subtotal: { type: Number, default: 0 },
    delivery: { type: DeliverySchema, default: () => ({}) },
    total: { type: Number, default: 0 },
    status: { type: String, default: 'pending' },
    statusTimeline: { type: [StatusTimelineSchema], default: [] },
  },
  { timestamps: true }
);

export default mongoose.model('Order', OrderSchema);
