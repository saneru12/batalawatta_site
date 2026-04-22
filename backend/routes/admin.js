import express from "express";
import { signAdminToken, verifyAdminCredentials, requireAdmin } from "../middleware/adminAuth.js";

const router = express.Router();

// POST /api/admin/login { email, password } -> { token }
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};
    const ok = await verifyAdminCredentials(email, password);
    if (!ok) return res.status(401).json({ message: "Invalid credentials" });

    const token = signAdminToken();
    res.json({ token });
  } catch (err) {
    res.status(500).json({ message: "Server error", details: err.message });
  }
});

// GET /api/admin/me -> basic token check
router.get("/me", requireAdmin, async (_req, res) => {
  res.json({ ok: true, role: "admin" });
});

export default router;
