import express from "express";
import Plant from "../models/Plant.js";
import { requireAdmin } from "../middleware/adminAuth.js";

const router = express.Router();

// GET /api/plants?search=&category=
router.get("/", async (req, res) => {
  try {
    const { search = "", category = "" } = req.query;

    const q = {};
    if (category) q.category = category;
    if (search) q.name = { $regex: search, $options: "i" };

    const plants = await Plant.find(q).sort({ createdAt: -1 });
    res.json(plants);
  } catch (e) {
    res.status(500).json({ message: "Server error" });
  }
});


// GET /api/plants/:id
router.get("/:id", async (req, res) => {
  try {
    const plant = await Plant.findById(req.params.id);
    if (!plant) return res.status(404).json({ message: "Plant not found" });
    res.json(plant);
  } catch (e) {
    res.status(400).json({ message: "Invalid plant id" });
  }
});

// POST /api/plants (admin)
router.post("/", requireAdmin, async (req, res) => {
  try {
    const plant = await Plant.create(req.body);
    res.status(201).json(plant);
  } catch (e) {
    res.status(400).json({ message: "Invalid plant data" });
  }
});

export default router;


// PUT /api/plants/:id (admin)
router.put("/:id", requireAdmin, async (req, res) => {
  try {
    const updated = await Plant.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!updated) return res.status(404).json({ message: "Plant not found" });
    res.json(updated);
  } catch (e) {
    res.status(400).json({ message: "Invalid plant data" });
  }
});

// DELETE /api/plants/:id (admin)
router.delete("/:id", requireAdmin, async (req, res) => {
  try {
    const deleted = await Plant.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: "Plant not found" });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ message: "Server error" });
  }
});
