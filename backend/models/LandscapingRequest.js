import mongoose from "mongoose";

const LandscapingRequestSchema = new mongoose.Schema(
  {
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", required: true, index: true },
    packageId: { type: mongoose.Schema.Types.ObjectId, ref: "LandscapingPackage", required: true, index: true },

    // Keep a snapshot of package details at the time of request (so admin still sees what was requested)
    packageSnapshot: {
      name: { type: String, required: true },
      priceRange: { type: String, default: "" },
      duration: { type: String, default: "" },
      bestFor: { type: String, default: "" },
      idealArea: { type: String, default: "" },
      consultationMode: { type: String, default: "" },
      aftercare: { type: String, default: "" },
    },

    customer: {
      name: { type: String, required: true, trim: true },
      phone: { type: String, required: true, trim: true },
      address: { type: String, required: true, trim: true },
    },

    gardenSize: { type: String, default: "", trim: true },
    propertyType: { type: String, default: "", trim: true },
    budgetRange: { type: String, default: "", trim: true },
    consultationPreference: { type: String, default: "", trim: true },
    preferredDate: { type: String, default: "", trim: true },
    projectGoals: { type: String, default: "", trim: true },
    notes: { type: String, default: "", trim: true },

    status: { type: String, default: "new", index: true },
    adminNote: { type: String, default: "", trim: true },
  },
  { timestamps: true }
);

export default mongoose.model("LandscapingRequest", LandscapingRequestSchema);
