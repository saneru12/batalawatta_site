import mongoose from "mongoose";

const plantSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    category: {
      type: String,
      required: true,
      enum: ["Indoor", "Outdoor", "Flowering", "Fruit", "Medicinal", "Decorative"]
    },
    description: { type: String, default: "" },
    price: { type: Number, default: 0 },
    available: { type: Boolean, default: true },
    imageUrl: { type: String, default: "" }
  },
  { timestamps: true }
);

export default mongoose.model("Plant", plantSchema);
