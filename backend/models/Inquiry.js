import mongoose from "mongoose";

const inquirySchema = new mongoose.Schema(
  {
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", default: null },
    name: { type: String, required: true, trim: true },
    phone: { type: String, default: "" },
    email: { type: String, default: "" },
    message: { type: String, required: true },
    status: { type: String, default: "new" },

    // Admin can add a reply/note; customer can see it in their profile.
    adminReply: { type: String, default: "" }
  },
  { timestamps: true }
);

export default mongoose.model("Inquiry", inquirySchema);
