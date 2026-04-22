import express from "express";
import Review from "../models/Review.js";
import { requireAdmin, optionalAdmin } from "../middleware/adminAuth.js";
import { requireCustomer } from "../middleware/customerAuth.js";

const router = express.Router();

// GET /api/reviews?limit=20
router.get("/", optionalAdmin, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || "30", 10), 100);
    const wantsAll = req.query.all === "1";
    if (wantsAll && !req.admin) return res.status(401).json({ message: "Admin token required" });
    const q = wantsAll ? {} : { approved: { $ne: false } };
    const reviews = await Review.find(q).sort({ createdAt: -1 }).limit(limit);
    res.json(reviews);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch reviews" });
  }
});

// POST /api/reviews
router.post("/", requireCustomer, async (req, res) => {
  try {
    const { name, rating, comment } = req.body || {};

    const r = Number(rating);
    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ message: "Name is required" });
    }
    if (!comment || typeof comment !== "string" || !comment.trim()) {
      return res.status(400).json({ message: "Comment is required" });
    }
    if (!Number.isFinite(r) || r < 1 || r > 5) {
      return res.status(400).json({ message: "Rating must be between 1 and 5" });
    }

    const created = await Review.create({
      customerId: req.customer.id,
      name: name.trim(),
      rating: r,
      comment: comment.trim(),
    });

    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ message: "Failed to submit review" });
  }
});

export default router;


// PATCH /api/reviews/:id (admin) - approve/hide review
router.patch("/:id", requireAdmin, async (req, res) => {
  try {
    const { approved } = req.body || {};
    if (typeof approved !== "boolean") return res.status(400).json({ message: "approved must be boolean" });
    const updated = await Review.findByIdAndUpdate(req.params.id, { approved }, { new: true });
    if (!updated) return res.status(404).json({ message: "Review not found" });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: "Failed to update review" });
  }
});

// DELETE /api/reviews/:id (admin)
router.delete("/:id", requireAdmin, async (req, res) => {
  try {
    const deleted = await Review.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: "Review not found" });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: "Failed to delete review" });
  }
});
