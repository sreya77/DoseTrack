const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'dosetrack_super_secret_jwt_key_2026_secure';

function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Sign in to continue.' });
  try {
    const p = jwt.verify(token, JWT_SECRET);
    req.user = { id: Number(p.sub), email: p.email, role: p.role, fullName: p.fullName };
    next();
  } catch {
    return res.status(401).json({ error: 'Session expired. Please sign in again.' });
  }
}
module.exports = { requireAuth };
