import mongoose from "mongoose";

const ReviewSchema = new mongoose.Schema(
  {
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", default: null },
    name: { type: String, required: true, trim: true, maxlength: 60 },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, required: true, trim: true, maxlength: 800 },
    approved: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model("Review", ReviewSchema);
