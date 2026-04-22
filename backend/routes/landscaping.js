import express from "express";
import LandscapingPackage from "../models/LandscapingPackage.js";
import LandscapingRequest from "../models/LandscapingRequest.js";
import { requireAdmin } from "../middleware/adminAuth.js";
import { requireCustomer } from "../middleware/customerAuth.js";

const router = express.Router();

const toStringList = (value) => {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || "").trim()).filter(Boolean);
  }
  return String(value || "")
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
};

// -------------------- PACKAGES --------------------

// GET /api/landscaping/packages (public) - active packages for website
router.get("/packages", async (_req, res) => {
  try {
    const list = await LandscapingPackage.find({ isActive: true })
      .sort({ sortOrder: 1, createdAt: -1 })
      .lean();
    return res.json(list);
  } catch (err) {
    return res.status(500).json({ message: "Server error", details: err.message });
  }
});

// GET /api/landscaping/packages/all (admin)
router.get("/packages/all", requireAdmin, async (_req, res) => {
  try {
    const list = await LandscapingPackage.find({})
      .sort({ sortOrder: 1, createdAt: -1 })
      .lean();
    return res.json(list);
  } catch (err) {
    return res.status(500).json({ message: "Server error", details: err.message });
  }
});

// POST /api/landscaping/packages (admin)
router.post("/packages", requireAdmin, async (req, res) => {
  try {
    const {
      code,
      name,
      description = "",
      priceRange = "",
      duration = "",
      bestFor = "",
      idealArea = "",
      consultationMode = "",
      aftercare = "",
      architectLed = true,
      includes = [],
      deliverables = [],
      exclusions = [],
      imageUrl = "",
      isActive = true,
      sortOrder = 0,
    } = req.body || {};

    if (!name) return res.status(400).json({ message: "name is required" });

    const pkg = await LandscapingPackage.create({
      ...(code ? { code } : {}),
      name: String(name).trim(),
      description: String(description || "").trim(),
      priceRange: String(priceRange || "").trim(),
      duration: String(duration || "").trim(),
      bestFor: String(bestFor || "").trim(),
      idealArea: String(idealArea || "").trim(),
      consultationMode: String(consultationMode || "").trim(),
      aftercare: String(aftercare || "").trim(),
      architectLed: architectLed !== false,
      includes: toStringList(includes),
      deliverables: toStringList(deliverables),
      exclusions: toStringList(exclusions),
      imageUrl: String(imageUrl || "").trim(),
      isActive: !!isActive,
      sortOrder: Number(sortOrder || 0),
    });
    return res.status(201).json(pkg);
  } catch (err) {
    const msg = err?.code === 11000 ? "Duplicate code" : "Invalid package data";
    return res.status(400).json({ message: msg, details: err.message });
  }
});

// PUT /api/landscaping/packages/:id (admin)
router.put("/packages/:id", requireAdmin, async (req, res) => {
  try {
    const body = req.body || {};

    if (body.name !== undefined && !String(body.name).trim()) {
      return res.status(400).json({ message: "name cannot be empty" });
    }

    if (body.includes !== undefined) body.includes = toStringList(body.includes);
    if (body.deliverables !== undefined) body.deliverables = toStringList(body.deliverables);
    if (body.exclusions !== undefined) body.exclusions = toStringList(body.exclusions);
    if (body.code !== undefined && !String(body.code || "").trim()) delete body.code;

    const updated = await LandscapingPackage.findByIdAndUpdate(req.params.id, body, {
      new: true,
      runValidators: true,
    });
    if (!updated) return res.status(404).json({ message: "Package not found" });
    return res.json(updated);
  } catch (err) {
    const msg = err?.code === 11000 ? "Duplicate code" : "Invalid package data";
    return res.status(400).json({ message: msg, details: err.message });
  }
});

// DELETE /api/landscaping/packages/:id (admin)
router.delete("/packages/:id", requireAdmin, async (req, res) => {
  try {
    const deleted = await LandscapingPackage.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: "Package not found" });
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ message: "Server error", details: err.message });
  }
});

// -------------------- REQUESTS --------------------

// POST /api/landscaping/requests (customer)
router.post("/requests", requireCustomer, async (req, res) => {
  try {
    const {
      packageId,
      customer,
      gardenSize = "",
      propertyType = "",
      budgetRange = "",
      consultationPreference = "",
      preferredDate = "",
      projectGoals = "",
      notes = "",
    } = req.body || {};

    if (!packageId) return res.status(400).json({ message: "packageId is required" });
    if (!customer?.name || !customer?.phone || !customer?.address) {
      return res.status(400).json({ message: "customer.name, customer.phone, customer.address required" });
    }

    const pkg = await LandscapingPackage.findById(packageId);
    if (!pkg) return res.status(404).json({ message: "Package not found" });
    if (!pkg.isActive) return res.status(400).json({ message: "This package is currently inactive" });

    const reqDoc = await LandscapingRequest.create({
      customerId: req.customer.id,
      packageId: pkg._id,
      packageSnapshot: {
        name: pkg.name,
        priceRange: pkg.priceRange || "",
        duration: pkg.duration || "",
        bestFor: pkg.bestFor || "",
        idealArea: pkg.idealArea || "",
        consultationMode: pkg.consultationMode || "",
        aftercare: pkg.aftercare || "",
      },
      customer: {
        name: String(customer.name).trim(),
        phone: String(customer.phone).trim(),
        address: String(customer.address).trim(),
      },
      gardenSize: String(gardenSize || "").trim(),
      propertyType: String(propertyType || "").trim(),
      budgetRange: String(budgetRange || "").trim(),
      consultationPreference: String(consultationPreference || "").trim(),
      preferredDate: String(preferredDate || "").trim(),
      projectGoals: String(projectGoals || "").trim(),
      notes: String(notes || "").trim(),
      status: "new",
    });

    return res.status(201).json({ ok: true, request: reqDoc });
  } catch (err) {
    return res.status(500).json({ message: "Server error", details: err.message });
  }
});

// GET /api/landscaping/requests/my (customer)
router.get("/requests/my", requireCustomer, async (req, res) => {
  try {
    const list = await LandscapingRequest.find({ customerId: req.customer.id })
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();
    return res.json(list);
  } catch (err) {
    return res.status(500).json({ message: "Server error", details: err.message });
  }
});

// GET /api/landscaping/requests (admin)
router.get("/requests", requireAdmin, async (req, res) => {
  try {
    const { status = "" } = req.query;
    const q = {};
    if (status) q.status = status;
    const list = await LandscapingRequest.find(q)
      .sort({ createdAt: -1 })
      .limit(1000)
      .lean();
    return res.json(list);
  } catch (err) {
    return res.status(500).json({ message: "Server error", details: err.message });
  }
});

// PATCH /api/landscaping/requests/:id (admin) - update status/adminNote
router.patch("/requests/:id", requireAdmin, async (req, res) => {
  try {
    const { status, adminNote } = req.body || {};

    const allowed = ["new", "in_progress", "scheduled", "completed", "cancelled"];
    if (status && !allowed.includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const updated = await LandscapingRequest.findByIdAndUpdate(
      req.params.id,
      {
        ...(status ? { status } : {}),
        ...(typeof adminNote === "string" ? { adminNote } : {}),
      },
      { new: true }
    );
    if (!updated) return res.status(404).json({ message: "Request not found" });
    return res.json(updated);
  } catch (err) {
    return res.status(500).json({ message: "Server error", details: err.message });
  }
});

export default router;
