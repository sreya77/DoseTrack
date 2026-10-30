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
 * Central Activity Logging Engine (Powers Live Activity Feed, User 360, Change Tracking, Session Monitoring)
 *
 * Tracks every user-side action across:
 * - Auth (register, login success/failed, logout)
 * - Medications (add, edit with old vs new JSON, delete)
 * - Schedules (create, update, toggle)
 * - Doses (taken, missed, reminder triggered/ignored)
 * - Vitals & Care notes (logged, edited)
 * - Care Circle (connect, disconnect, invite)
 * - Doctors (added, edited, deleted, appointments)
 * - Emergency SOS (triggered, acknowledged)
 * - Profile and password updates
 */
async function logActivity(req, options = {}) {
  try {
    const actionType = options.actionType || options.action || 'UNKNOWN_ACTION';
    const entityType = options.entityType || options.targetType || null;
    const entityId = options.entityId != null ? String(options.entityId) : (options.targetId != null ? String(options.targetId) : null);
    const description = options.description || options.details || `${actionType} performed`;

    let userId = options.userId ?? options.actor?.id ?? req?.user?.id ?? null;
    let userRole = options.userRole ?? options.actor?.role ?? req?.user?.role ?? null;
    let userName = options.userName ?? options.actor?.fullName ?? req?.user?.fullName ?? null;

    if (userId && (!userRole || !userName)) {
      try {
        const [rows] = await db.execute('SELECT full_name, role FROM users WHERE id = ?', [userId]);
        if (rows.length) {
          userRole = userRole || rows[0].role;
          userName = userName || rows[0].full_name;
        }
      } catch {}
    }

    const rawIp = req ? (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || req.ip || '127.0.0.1') : '127.0.0.1';
    const ipAddress = String(rawIp).split(',')[0].trim().replace(/^::ffff:/i, '').slice(0, 45);

    const rawUa = req ? (req.headers['user-agent'] || '') : '';
    const userAgent = String(rawUa).slice(0, 255);

    let oldValueJson = null;
    if (options.oldValue !== undefined && options.oldValue !== null) {
      oldValueJson = typeof options.oldValue === 'string' ? options.oldValue : JSON.stringify(options.oldValue);
    }

    let newValueJson = null;
    if (options.newValue !== undefined && options.newValue !== null) {
      newValueJson = typeof options.newValue === 'string' ? options.newValue : JSON.stringify(options.newValue);
    }

    // 1. Primary write to activity_log table
    await db.execute(
      `INSERT INTO activity_log 
         (user_id, user_role, action_type, entity_type, entity_id, description, old_value, new_value, ip_address, user_agent)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        userRole,
        actionType,
        entityType,
        entityId,
        description,
        oldValueJson,
        newValueJson,
        ipAddress,
        userAgent
      ]
    );

    // 2. Mirror to legacy user_activity_log for backward compatibility
    try {
      const patientId = options.patientId != null ? Number(options.patientId) : (userRole === 'patient' ? userId : null);
      await db.execute(
        `INSERT INTO user_activity_log 
           (actor_id, actor_name, actor_role, action, target_type, target_id, patient_id, details, ip_address)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          userId,
          userName || (userId ? `User #${userId}` : 'Guest'),
          userRole || 'guest',
          actionType,
          entityType,
          entityId,
          patientId,
          description,
          ipAddress
        ]
      );
    } catch {}
  } catch (e) {
    console.error('[Central Activity Log Error]', e.message);
  }
}

module.exports = { requireAuth, requireAdmin, logAudit, logActivity };
