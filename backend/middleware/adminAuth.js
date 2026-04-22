import jwt from "jsonwebtoken";
import crypto from "crypto";
import bcrypt from "bcryptjs";

function getTokenFromReq(req) {
  const h = req.headers.authorization || "";
  if (!h.toLowerCase().startsWith("bearer ")) return null;
  return h.slice(7).trim();
}

export function signAdminToken() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET missing in .env");
  return jwt.sign({ role: "admin" }, secret, { expiresIn: "7d" });
}

export function requireAdmin(req, res, next) {
  try {
    const token = getTokenFromReq(req);
    if (!token) return res.status(401).json({ message: "Missing token" });
    const secret = process.env.JWT_SECRET;
    const decoded = jwt.verify(token, secret);
    if (decoded?.role !== "admin") return res.status(403).json({ message: "Not authorized" });
    req.admin = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid/expired token" });
  }
}

// Optional admin: sets req.admin if valid token exists, otherwise continues as guest.
export function optionalAdmin(req, _res, next) {
  try {
    const token = getTokenFromReq(req);
    if (!token) return next();
    const secret = process.env.JWT_SECRET;
    const decoded = jwt.verify(token, secret);
    if (decoded?.role === "admin") req.admin = decoded;
  } catch {}
  next();
}

// Verifies admin login credentials against env vars.
// Supports either ADMIN_PASSWORD (plain) OR ADMIN_PASSWORD_HASH (bcrypt).
export async function verifyAdminCredentials(email, password) {
  const adminEmail = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();
  const adminPass = process.env.ADMIN_PASSWORD || "";
  const adminHash = process.env.ADMIN_PASSWORD_HASH || "";

  if (!adminEmail || (!adminPass && !adminHash)) return false;
  if ((email || "").trim().toLowerCase() !== adminEmail) return false;

  if (adminHash) {
    return bcrypt.compare(password || "", adminHash);
  }

  // Constant-time compare for plain password
  const a = Buffer.from(adminPass);
  const b = Buffer.from(password || "");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
