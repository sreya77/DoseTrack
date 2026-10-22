const jwt = require('jsonwebtoken');
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Sign in to continue.' });
  try { const p = jwt.verify(token, process.env.JWT_SECRET); req.user = { id: Number(p.sub), email: p.email }; next(); }
  catch { return res.status(401).json({ error: 'Session expired. Please sign in again.' }); }
}
module.exports = { requireAuth };
