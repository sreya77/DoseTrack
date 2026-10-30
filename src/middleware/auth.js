const jwt = require('jsonwebtoken');
const db = require('../db');

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

async function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Access denied. Administrator privileges required.' });
  }
  try {
    const [rows] = await db.execute('SELECT is_active, role FROM users WHERE id = ?', [req.user.id]);
    if (!rows.length || rows[0].role !== 'admin' || !rows[0].is_active) {
      return res.status(403).json({ error: 'Account inactive or administrator privileges revoked.' });
    }
    next();
  } catch (err) {
    return res.status(500).json({ error: 'Failed to verify administrative authorization.' });
  }
}

/**
 * Log administrative events to admin_audit_log
 */
async function logAudit(adminId, action, targetType = null, targetId = null, details = null, req = null) {
  try {
    const rawIp = req ? (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '127.0.0.1') : '127.0.0.1';
    const ip = String(rawIp).split(',')[0].trim().replace(/^::ffff:/i, '').slice(0, 45); // clean IPv4/IPv6
    await db.execute(
      `INSERT INTO admin_audit_log (admin_id, action, target_type, target_id, details, ip_address)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [adminId, action, targetType, targetId ? String(targetId) : null, details, ip]
    );
  } catch (e) {
    console.error('[Audit Log Error]', e.message);
  }
}

/**
 * Log any user action (patient, guardian, caretaker) to the system-wide activity log.
 * This powers the administrator's "everything happening" activity stream.
 */
async function logActivity(req, { action, targetType = null, targetId = null, patientId = null, details = null, actor = null }) {
  try {
    const actorId = actor?.id ?? req?.user?.id ?? null;
    let actorName = actor?.fullName ?? req?.user?.fullName ?? null;
    let actorRole = actor?.role ?? req?.user?.role ?? null;

    if (actorId && (!actorName || !actorRole)) {
      const [rows] = await db.execute('SELECT full_name, role FROM users WHERE id = ?', [actorId]);
      actorName = actorName || rows[0]?.full_name || null;
      actorRole = actorRole || rows[0]?.role || null;
    }

    const rawIp = req ? (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '127.0.0.1') : null;
    const ip = rawIp
      ? String(rawIp).split(',')[0].trim().replace(/^::ffff:/i, '').slice(0, 45)
      : null;

    await db.execute(
      `INSERT INTO user_activity_log 
         (actor_id, actor_name, actor_role, action, target_type, target_id, patient_id, details, ip_address)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        actorId,
        actorName,
        actorRole,
        action,
        targetType,
        targetId != null ? String(targetId) : null,
        patientId != null ? Number(patientId) : null,
        details,
        ip
      ]
    );
  } catch (e) {
    console.error('[Activity Log Error]', e.message);
  }
}

module.exports = { requireAuth, requireAdmin, logAudit, logActivity };
