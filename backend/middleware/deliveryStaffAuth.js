import jwt from 'jsonwebtoken';

function getTokenFromReq(req) {
  const h = req.headers.authorization || '';
  if (!h.toLowerCase().startsWith('bearer ')) return null;
  return h.slice(7).trim();
}

export function signDeliveryStaffToken(staff) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET missing in .env');
  return jwt.sign(
    {
      role: 'delivery_staff',
      id: String(staff._id),
      username: String(staff.username || '').toLowerCase(),
    },
    secret,
    { expiresIn: '7d' }
  );
}

export function requireDeliveryStaff(req, res, next) {
  try {
    const token = getTokenFromReq(req);
    if (!token) return res.status(401).json({ message: 'Missing token' });
    const secret = process.env.JWT_SECRET;
    const decoded = jwt.verify(token, secret);
    if (decoded?.role !== 'delivery_staff' || !decoded?.id) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    req.deliveryStaff = decoded;
    next();
  } catch {
    return res.status(401).json({ message: 'Invalid/expired token' });
  }
}

export function optionalDeliveryStaff(req, _res, next) {
  try {
    const token = getTokenFromReq(req);
    if (!token) return next();
    const secret = process.env.JWT_SECRET;
    const decoded = jwt.verify(token, secret);
    if (decoded?.role === 'delivery_staff' && decoded?.id) {
      req.deliveryStaff = decoded;
    }
  } catch {
    // ignore invalid optional token
  }
  next();
}
