import mongoose from "mongoose";

const CartItemSchema = new mongoose.Schema(
  {
    plant: { type: mongoose.Schema.Types.ObjectId, ref: "Plant", required: true },
    qty: { type: Number, required: true, min: 1, default: 1 },
    addedAt: { type: Date, default: Date.now }
  },
  { _id: false }
);

const CartSchema = new mongoose.Schema(
  {
    sessionId: { type: String, required: true, unique: true, index: true },
    items: { type: [CartItemSchema], default: [] }
  },
  { timestamps: true }
);

export default mongoose.model("Cart", CartSchema);
