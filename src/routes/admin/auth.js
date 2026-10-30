const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../../db');
const { requireAuth, requireAdmin, logAudit } = require('../../middleware/auth');

const JWT_SECRET = process.env.JWT_SECRET || 'dosetrack_super_secret_jwt_key_2026_secure';

const tokenFor = (u) =>
  jwt.sign(
    { sub: u.id, email: u.email, role: u.role, fullName: u.full_name },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

// POST /api/admin/auth/login
router.post('/login', async (req, res, next) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = req.body.password || '';

    if (!email || !password) {
      return res.status(400).json({ error: 'Please enter both administrator email and password.' });
    }

    const [rows] = await db.execute(
      `SELECT id, full_name, email, phone, role, is_active, avatar_color, password_hash 
       FROM users WHERE email = ?`,
      [email]
    );

    if (!rows.length || !(await bcrypt.compare(password, rows[0].password_hash))) {
      return res.status(401).json({ error: 'Invalid administrator email or password.' });
    }

    const u = rows[0];

    // Enforce role check: non-admins must be blocked
    if (u.role !== 'admin') {
      return res.status(403).json({
        error: `Access Denied: Account role "${u.role}" is not authorized for the Administrator Portal. Please use the Patient / Guardian login.`
      });
    }

    // Enforce is_active check
    if (!u.is_active) {
      return res.status(403).json({
        error: 'Administrator account has been deactivated. Please contact the system administrator.'
      });
    }

    // Log successful admin login to audit trail
    await logAudit(u.id, 'LOGIN', 'user', u.id, `Admin ${u.full_name} signed in successfully.`, req);

    const user = {
      id: u.id,
      fullName: u.full_name,
      email: u.email,
      phone: u.phone || '',
      role: 'admin',
      avatarColor: u.avatar_color || '#f59e0b'
    };

    res.json({
      token: tokenFor(u),
      user
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/auth/me
router.get('/me', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const [rows] = await db.execute(
      `SELECT id, full_name, email, phone, role, is_active, avatar_color, created_at 
       FROM users WHERE id = ?`,
      [req.user.id]
    );

    if (!rows.length) {
      return res.status(404).json({ error: 'Administrator profile not found.' });
    }

    const u = rows[0];
    res.json({
      user: {
        id: u.id,
        fullName: u.full_name,
        email: u.email,
        phone: u.phone || '',
        role: u.role,
        isActive: !!u.is_active,
        avatarColor: u.avatar_color || '#f59e0b',
        createdAt: u.created_at
      }
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/auth/logout
router.post('/logout', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    await logAudit(req.user.id, 'LOGOUT', 'user', req.user.id, `Admin signed out.`, req);
    res.json({ message: 'Signed out successfully.' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

