import express from "express";
import mongoose from "mongoose";
import Cart from "../models/Cart.js";
import { requireCustomer } from "../middleware/customerAuth.js";

const router = express.Router();

// All cart actions require a logged-in customer
router.use(requireCustomer);

// GET /api/cart/:sessionId  -> returns cart with populated plant details
router.get("/:sessionId", async (req, res) => {
  try {
    const { sessionId } = req.params;
    if (!sessionId) return res.status(400).json({ message: "sessionId is required" });

    const cart = await Cart.findOne({ sessionId }).populate("items.plant");
    return res.json(cart || { sessionId, items: [] });
  } catch (err) {
    return res.status(500).json({ message: "Failed to load cart", error: err.message });
  }
});

// POST /api/cart/add {sessionId, plantId, qty}
router.post("/add", async (req, res) => {
  try {
    const { sessionId, plantId, qty } = req.body;
    if (!sessionId || !plantId) return res.status(400).json({ message: "sessionId and plantId are required" });
    if (!mongoose.isValidObjectId(plantId)) return res.status(400).json({ message: "Invalid plantId" });

    const q = Math.max(1, Number(qty) || 1);

    const cart = await Cart.findOneAndUpdate(
      { sessionId },
      { $setOnInsert: { sessionId } },
      { upsert: true, new: true }
    );

    const existing = cart.items.find((it) => String(it.plant) === String(plantId));
    if (existing) {
      existing.qty = Math.max(1, existing.qty + q);
    } else {
      cart.items.push({ plant: plantId, qty: q });
    }

    await cart.save();
    const populated = await Cart.findOne({ sessionId }).populate("items.plant");
    return res.json(populated);
  } catch (err) {
    return res.status(500).json({ message: "Failed to add to cart", error: err.message });
  }
});

// PUT /api/cart/update {sessionId, plantId, qty}
router.put("/update", async (req, res) => {
  try {
    const { sessionId, plantId, qty } = req.body;
    if (!sessionId || !plantId) return res.status(400).json({ message: "sessionId and plantId are required" });

    const q = Number(qty);
    if (!Number.isFinite(q)) return res.status(400).json({ message: "qty must be a number" });

    const cart = await Cart.findOne({ sessionId });
    if (!cart) return res.json({ sessionId, items: [] });

    const idx = cart.items.findIndex((it) => String(it.plant) === String(plantId));
    if (idx === -1) return res.json(await Cart.findOne({ sessionId }).populate("items.plant"));

    if (q <= 0) cart.items.splice(idx, 1);
    else cart.items[idx].qty = Math.max(1, Math.floor(q));

    await cart.save();
    return res.json(await Cart.findOne({ sessionId }).populate("items.plant"));
  } catch (err) {
    return res.status(500).json({ message: "Failed to update cart", error: err.message });
  }
});

// DELETE /api/cart/remove/:sessionId/:plantId
router.delete("/remove/:sessionId/:plantId", async (req, res) => {
  try {
    const { sessionId, plantId } = req.params;
    const cart = await Cart.findOne({ sessionId });
    if (!cart) return res.json({ sessionId, items: [] });

    cart.items = cart.items.filter((it) => String(it.plant) !== String(plantId));
    await cart.save();

    return res.json(await Cart.findOne({ sessionId }).populate("items.plant"));
  } catch (err) {
    return res.status(500).json({ message: "Failed to remove item", error: err.message });
  }
});

// DELETE /api/cart/clear/:sessionId
router.delete("/clear/:sessionId", async (req, res) => {
  try {
    const { sessionId } = req.params;
    await Cart.findOneAndDelete({ sessionId });
    return res.json({ sessionId, items: [] });
  } catch (err) {
    return res.status(500).json({ message: "Failed to clear cart", error: err.message });
  }
});

export default router;
