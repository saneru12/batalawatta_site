import jwt from "jsonwebtoken";

function getTokenFromReq(req) {
  const h = req.headers.authorization || "";
  if (!h.toLowerCase().startsWith("bearer ")) return null;
  return h.slice(7).trim();
}

export function signCustomerToken(customer) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET missing in .env");
  return jwt.sign({ role: "customer", id: String(customer._id) }, secret, { expiresIn: "14d" });
}

export function requireCustomer(req, res, next) {
  try {
    const token = getTokenFromReq(req);
    if (!token) return res.status(401).json({ message: "Missing token" });
    const secret = process.env.JWT_SECRET;
    const decoded = jwt.verify(token, secret);
    if (decoded?.role !== "customer" || !decoded?.id) return res.status(403).json({ message: "Not authorized" });
    req.customer = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid/expired token" });
  }
}

// Optional customer: sets req.customer if valid token exists, otherwise continues.
export function optionalCustomer(req, _res, next) {
  try {
    const token = getTokenFromReq(req);
    if (!token) return next();
    const secret = process.env.JWT_SECRET;
    const decoded = jwt.verify(token, secret);
    if (decoded?.role === "customer" && decoded?.id) req.customer = decoded;
  } catch {}
  next();
}
