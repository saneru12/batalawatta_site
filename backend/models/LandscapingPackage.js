import mongoose from "mongoose";

const normalizeStringList = (value) => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => String(item || "").trim())
    .filter(Boolean);
};

const LandscapingPackageSchema = new mongoose.Schema(
  {
    // Optional short code/slug (e.g. starter, classic). If not provided, UI will use _id.
    code: { type: String, trim: true, lowercase: true, unique: true, sparse: true, index: true },

    name: { type: String, required: true, trim: true },
    description: { type: String, default: "", trim: true },
    priceRange: { type: String, default: "", trim: true },
    duration: { type: String, default: "", trim: true },
    bestFor: { type: String, default: "", trim: true },
    idealArea: { type: String, default: "", trim: true },
    consultationMode: { type: String, default: "", trim: true },
    aftercare: { type: String, default: "", trim: true },
    architectLed: { type: Boolean, default: true },

    includes: { type: [String], default: [] },
    deliverables: { type: [String], default: [] },
    exclusions: { type: [String], default: [] },
    imageUrl: { type: String, default: "", trim: true },

    isActive: { type: Boolean, default: true, index: true },
    sortOrder: { type: Number, default: 0, index: true },
  },
  { timestamps: true }
);

LandscapingPackageSchema.pre("save", function (next) {
  this.includes = normalizeStringList(this.includes);
  this.deliverables = normalizeStringList(this.deliverables);
  this.exclusions = normalizeStringList(this.exclusions);

  if (this.code && !String(this.code).trim()) this.code = undefined;
  next();
});

export default mongoose.model("LandscapingPackage", LandscapingPackageSchema);
