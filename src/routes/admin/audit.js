const router = require('express').Router();
const bcrypt = require('bcryptjs');
const db = require('../../db');
const { logAudit } = require('../../middleware/auth');

/**
 * GET /api/admin/audit
 * Query paginated forensic audit logs with search and action filters
 */
router.get('/', async (req, res, next) => {
  try {
    const { search = '', action = '', adminId = '', page = 1, limit = 25 } = req.query;
    const offset = (Math.max(1, parseInt(page)) - 1) * parseInt(limit);
    const maxLimit = Math.min(100, Math.max(1, parseInt(limit)));

    let sqlWhere = 'WHERE 1=1';
    const params = [];

    if (search.trim()) {
      const q = `%${search.trim()}%`;
      sqlWhere += ' AND (a.action LIKE ? OR a.details LIKE ? OR a.ip_address LIKE ? OR u.full_name LIKE ?)';
      params.push(q, q, q, q);
    }

    if (action) {
      sqlWhere += ' AND a.action = ?';
      params.push(action);
    }

    if (adminId) {
      sqlWhere += ' AND a.admin_id = ?';
      params.push(adminId);
    }

    const [countRows] = await db.execute(
      `SELECT COUNT(*) as total 
       FROM admin_audit_log a
       JOIN users u ON u.id = a.admin_id
       ${sqlWhere}`,
      params
    );
    const total = Number(countRows[0]?.total || 0);

    const [rows] = await db.execute(
      `SELECT 
         a.id,
         a.action,
         a.target_type,
         a.target_id,
         a.details,
         a.ip_address,
         a.created_at,
         u.id as admin_id,
         u.full_name as admin_name,
         u.email as admin_email
       FROM admin_audit_log a
       JOIN users u ON u.id = a.admin_id
       ${sqlWhere}
       ORDER BY a.created_at DESC
       LIMIT ${maxLimit} OFFSET ${offset}`,
      params
    );

    res.json({
      logs: rows.map((r) => ({
        id: r.id,
        action: r.action,
        targetType: r.target_type || '—',
        targetId: r.target_id || '—',
        details: r.details || '—',
        ipAddress: r.ip_address || '127.0.0.1',
        createdAt: r.created_at,
        admin: {
          id: r.admin_id,
          name: r.admin_name,
          email: r.admin_email
        }
      })),
      pagination: {
        total,
        page: parseInt(page),
        limit: maxLimit,
        pages: Math.ceil(total / maxLimit)
      }
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/admin/audit/change-password
 * Change current administrator password
 */
router.post('/change-password', async (req, res, next) => {
  try {
    const adminId = req.user.id;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Both current password and new password are required.' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters long.' });
    }

    const [rows] = await db.execute('SELECT password_hash, full_name FROM users WHERE id = ?', [adminId]);
    if (!rows.length) {
      return res.status(404).json({ error: 'Administrator account not found.' });
    }

    const match = await bcrypt.compare(currentPassword, rows[0].password_hash);
    if (!match) {
      return res.status(400).json({ error: 'Incorrect current password. Please try again.' });
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    await db.execute('UPDATE users SET password_hash = ? WHERE id = ?', [newHash, adminId]);

    await logAudit(
      adminId,
      'ADMIN_CHANGE_PASSWORD',
      'user',
      adminId,
      `Administrator ${rows[0].full_name} changed account password.`,
      req
    );

    res.json({ message: 'Administrator password changed successfully.' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

