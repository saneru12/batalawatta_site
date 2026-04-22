import express from "express";
import bcrypt from "bcryptjs";
import Customer from "../models/Customer.js";
import { signCustomerToken, requireCustomer } from "../middleware/customerAuth.js";

const router = express.Router();

function safeCustomer(c) {
  return {
    id: c._id,
    name: c.name,
    email: c.email,
    phone: c.phone || "",
    address: c.address || "",
    createdAt: c.createdAt,
  };
}

/**
 * POST /api/customers/register
 * Body: { name, email, password, phone?, address? }
 */
router.post("/register", async (req, res) => {
  try {
    const { name, email, password, phone = "", address = "" } = req.body || {};
    if (!name || !email || !password) {
      return res.status(400).json({ message: "name, email, password required" });
    }
    if (String(password).length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }

    const existing = await Customer.findOne({ email: String(email).trim().toLowerCase() });
    if (existing) return res.status(409).json({ message: "Email already registered" });

    const passwordHash = await bcrypt.hash(String(password), 10);
    const customer = await Customer.create({
      name: String(name).trim(),
      email: String(email).trim().toLowerCase(),
      phone: String(phone || "").trim(),
      address: String(address || "").trim(),
      passwordHash,
    });

    const token = signCustomerToken(customer);
    return res.json({ token, customer: safeCustomer(customer) });
  } catch (err) {
    return res.status(500).json({ message: "Server error", details: err.message });
  }
});

/**
 * POST /api/customers/login
 * Body: { email, password }
 */
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ message: "email and password required" });

    const customer = await Customer.findOne({ email: String(email).trim().toLowerCase(), isActive: true });
    if (!customer) return res.status(401).json({ message: "Invalid credentials" });

    const ok = await bcrypt.compare(String(password), customer.passwordHash);
    if (!ok) return res.status(401).json({ message: "Invalid credentials" });

    const token = signCustomerToken(customer);
    return res.json({ token, customer: safeCustomer(customer) });
  } catch (err) {
    return res.status(500).json({ message: "Server error", details: err.message });
  }
});

/**
 * GET /api/customers/me
 */
router.get("/me", requireCustomer, async (req, res) => {
  try {
    const customer = await Customer.findById(req.customer.id);
    if (!customer) return res.status(404).json({ message: "Customer not found" });
    return res.json({ customer: safeCustomer(customer) });
  } catch (err) {
    return res.status(500).json({ message: "Server error", details: err.message });
  }
});

/**
 * PUT /api/customers/me
 * Body: { name?, phone?, address? }
 */
router.put("/me", requireCustomer, async (req, res) => {
  try {
    const { name, phone, address } = req.body || {};
    const customer = await Customer.findById(req.customer.id);
    if (!customer) return res.status(404).json({ message: "Customer not found" });

    if (name !== undefined) customer.name = String(name).trim() || customer.name;
    if (phone !== undefined) customer.phone = String(phone).trim();
    if (address !== undefined) customer.address = String(address).trim();
    await customer.save();

    return res.json({ ok: true, customer: safeCustomer(customer) });
  } catch (err) {
    return res.status(500).json({ message: "Server error", details: err.message });
  }
});

/**
 * PUT /api/customers/password
 * Body: { currentPassword, newPassword }
 */
router.put("/password", requireCustomer, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body || {};
    if (!currentPassword || !newPassword) return res.status(400).json({ message: "currentPassword and newPassword required" });
    if (String(newPassword).length < 6) return res.status(400).json({ message: "New password must be at least 6 characters" });

    const customer = await Customer.findById(req.customer.id);
    if (!customer) return res.status(404).json({ message: "Customer not found" });

    const ok = await bcrypt.compare(String(currentPassword), customer.passwordHash);
    if (!ok) return res.status(401).json({ message: "Current password incorrect" });

    customer.passwordHash = await bcrypt.hash(String(newPassword), 10);
    await customer.save();
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ message: "Server error", details: err.message });
  }
});

export default router;
