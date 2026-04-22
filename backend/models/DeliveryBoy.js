import mongoose from 'mongoose';

const DeliveryBoySchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true },
    username: { type: String, required: true, unique: true, trim: true, lowercase: true, index: true },
    email: { type: String, default: '', trim: true, lowercase: true },
    phone: { type: String, required: true, trim: true },
    passwordHash: { type: String, required: true },
    isActive: { type: Boolean, default: true },
    availabilityStatus: {
      type: String,
      enum: ['available', 'busy', 'off_duty', 'leave'],
      default: 'available',
    },
    vehicleType: { type: String, default: 'Own vehicle', trim: true },
    vehicleNumber: { type: String, default: '', trim: true },
    coverageZoneIds: { type: [String], default: [] },
    preferredTimeSlotIds: { type: [String], default: [] },
    maxStopsPerDay: { type: Number, default: 10 },
    maxStopsPerSlot: { type: Number, default: 4 },
    notes: { type: String, default: '', trim: true },
    sortOrder: { type: Number, default: 0 },
    lastLoginAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export default mongoose.model('DeliveryBoy', DeliveryBoySchema);
