import mongoose from "mongoose";

const CustomerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, trim: true, lowercase: true, index: true },
    phone: { type: String, default: "", trim: true },
    address: { type: String, default: "", trim: true },
    passwordHash: { type: String, required: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model("Customer", CustomerSchema);
