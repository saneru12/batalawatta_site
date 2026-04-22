import mongoose from 'mongoose';

const DeliveryTimeSlotSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    label: { type: String, required: true },
    startTime: { type: String, default: '' },
    endTime: { type: String, default: '' },
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { _id: false }
);

const DeliveryZoneSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    name: { type: String, required: true },
    areas: { type: [String], default: [] },
    fee: { type: Number, default: 0 },
    leadTimeLabel: { type: String, default: '' },
    defaultLeadDays: { type: Number, default: 1 },
    sameDayEligible: { type: Boolean, default: false },
    sameDayCutoffHour: { type: Number, default: null },
    defaultTimeSlot: { type: String, default: '' },
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    notes: { type: String, default: '' },
  },
  { _id: false }
);

const DispatchRulesSchema = new mongoose.Schema(
  {
    maxStopsPerBoyPerDay: { type: Number, default: 10 },
    maxStopsPerBoyPerSlot: { type: Number, default: 4 },
    clusterByZone: { type: Boolean, default: true },
    autoSuggestRouteSequence: { type: Boolean, default: true },
  },
  { _id: false }
);

const DeliverySettingsSchema = new mongoose.Schema(
  {
    singletonKey: { type: String, required: true, unique: true, default: 'main' },
    serviceTitle: { type: String, default: 'Batalawatta Team Delivery' },
    serviceType: { type: String, default: 'Own vehicle delivery' },
    vehicleNote: {
      type: String,
      default: 'Plants are delivered using the nursery team\'s own vehicles for safer handling and better quality control.',
    },
    baseLocation: { type: String, default: 'Batalawatta, Battaramulla' },
    minimumRecommendedOrder: { type: Number, default: 3000 },
    sameDayCutoffHour: { type: Number, default: 12 },
    sameDayCutoffLabel: { type: String, default: '12:00 PM' },
    contactBeforeArrival: { type: Boolean, default: true },
    issueReportWindowHours: { type: Number, default: 24 },
    policies: { type: [String], default: [] },
    timeSlots: { type: [DeliveryTimeSlotSchema], default: [] },
    zones: { type: [DeliveryZoneSchema], default: [] },
    dispatchRules: { type: DispatchRulesSchema, default: () => ({}) },
  },
  { timestamps: true }
);

export default mongoose.model('DeliverySettings', DeliverySettingsSchema);
