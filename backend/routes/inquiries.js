import express from "express";
import Inquiry from "../models/Inquiry.js";
import { requireAdmin } from "../middleware/adminAuth.js";
import { requireCustomer } from "../middleware/customerAuth.js";

const router = express.Router();

// POST /api/inquiries
router.post("/", requireCustomer, async (req, res) => {
  try {
    const { name, phone, email, message } = req.body;
    if (!name || !message) {
      return res.status(400).json({ message: "Name and message are required" });
    }
    const inquiry = await Inquiry.create({ customerId: req.customer.id, name, phone, email, message });
    res.status(201).json({ message: "Inquiry submitted", inquiry });
  } catch (e) {
    res.status(500).json({ message: "Server error" });
  }
});

// GET /api/inquiries (admin)
router.get("/", requireAdmin, async (req, res) => {
  try {
    const inquiries = await Inquiry.find().sort({ createdAt: -1 });
    res.json(inquiries);
  } catch (e) {
    res.status(500).json({ message: "Server error" });
  }
});

// GET /api/inquiries/my (customer) - view own inquiries in profile
router.get("/my", requireCustomer, async (req, res) => {
  try {
    const inquiries = await Inquiry.find({ customerId: req.customer.id })
      .sort({ createdAt: -1 })
      .limit(200);
    return res.json(inquiries);
  } catch (e) {
    return res.status(500).json({ message: "Server error" });
  }
});


// PATCH /api/inquiries/:id (admin) - update status / adminReply
router.patch("/:id", requireAdmin, async (req, res) => {
  try {
    const { status, adminReply } = req.body || {};
    const allowed = ["new", "in_progress", "resolved"];
    if (status && !allowed.includes(status)) return res.status(400).json({ message: "Invalid status" });

    const updated = await Inquiry.findByIdAndUpdate(
      req.params.id,
      { ...(status ? { status } : {}), ...(typeof adminReply === "string" ? { adminReply } : {}) },
      { new: true }
    );
    if (!updated) return res.status(404).json({ message: "Inquiry not found" });
    res.json(updated);
  } catch (e) {
    res.status(500).json({ message: "Server error" });
  }
});

// DELETE /api/inquiries/:id (admin)
router.delete("/:id", requireAdmin, async (req, res) => {
  try {
    const deleted = await Inquiry.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: "Inquiry not found" });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
