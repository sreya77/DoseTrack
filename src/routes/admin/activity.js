const router = require('express').Router();
const db = require('../../db');

const VALID_ROLES = ['patient', 'guardian', 'caretaker'];

/**
 * GET /api/admin/activity
 * System-wide activity stream covering every action performed by
 * patients, guardians and caretakers (plus registration/login events).
 */
router.get('/', async (req, res, next) => {
  try {
    const {
      search = '',
      role = '',
      action = '',
      patientId = '',
      from = '',
      to = '',
      page = 1,
      limit = 25
    } = req.query;

    const currentPage = Math.max(1, parseInt(page) || 1);
    const maxLimit = Math.min(100, Math.max(1, parseInt(limit) || 25));
    const offset = (currentPage - 1) * maxLimit;

    let where = 'WHERE 1=1';
    const params = [];

    if (search.trim()) {
      const q = `%${search.trim()}%`;
      where += ' AND (a.actor_name LIKE ? OR a.details LIKE ? OR a.action LIKE ? OR a.ip_address LIKE ? OR p.full_name LIKE ?)';
      params.push(q, q, q, q, q);
    }

    if (role && VALID_ROLES.includes(role)) {
      where += ' AND a.actor_role = ?';
      params.push(role);
    }

    if (action) {
      where += ' AND a.action = ?';
      params.push(action);
    }

    if (patientId && Number.isFinite(Number(patientId))) {
      where += ' AND a.patient_id = ?';
      params.push(Number(patientId));
    }

    if (from) {
      where += ' AND a.created_at >= ?';
      params.push(`${from} 00:00:00`);
    }

    if (to) {
      where += ' AND a.created_at <= ?';
      params.push(`${to} 23:59:59`);
    }

    const [countRows] = await db.execute(
      `SELECT COUNT(*) as total
       FROM user_activity_log a
       LEFT JOIN users p ON p.id = a.patient_id
       ${where}`,
      params
    );
    const total = Number(countRows[0]?.total || 0);

    const [rows] = await db.execute(
      `SELECT a.id, a.actor_id, a.actor_name, a.actor_role, a.action,
              a.target_type, a.target_id, a.patient_id, a.details, a.ip_address, a.created_at,
              p.full_name as patient_name, p.patient_code
       FROM user_activity_log a
       LEFT JOIN users p ON p.id = a.patient_id
       ${where}
       ORDER BY a.created_at DESC
       LIMIT ${maxLimit} OFFSET ${offset}`,
      params
    );

    const [roleSummary] = await db.execute(
      `SELECT a.actor_role as role, COUNT(*) as count
       FROM user_activity_log a
       LEFT JOIN users p ON p.id = a.patient_id
       ${where}
       GROUP BY a.actor_role`,
      params
    );

    const [actionSummary] = await db.execute(
      `SELECT a.action, COUNT(*) as count
       FROM user_activity_log a
       LEFT JOIN users p ON p.id = a.patient_id
       ${where}
       GROUP BY a.action
       ORDER BY count DESC
       LIMIT 12`,
      params
    );

    res.json({
      logs: rows.map((r) => ({
        id: r.id,
        actor: {
          id: r.actor_id,
          name: r.actor_name || 'Deleted user',
          role: r.actor_role || 'unknown'
        },
        action: r.action,
        targetType: r.target_type || '—',
        targetId: r.target_id || '—',
        patient: r.patient_id
          ? { id: r.patient_id, name: r.patient_name || 'Unknown patient', patientCode: r.patient_code || null }
          : null,
        details: r.details || '—',
        ipAddress: r.ip_address || '—',
        createdAt: r.created_at
      })),
      summary: {
        byRole: roleSummary.reduce((acc, r) => {
          acc[r.role || 'unknown'] = Number(r.count);
          return acc;
        }, {}),
        byAction: actionSummary.map((a) => ({ action: a.action, count: Number(a.count) }))
      },
      pagination: {
        total,
        page: currentPage,
        limit: maxLimit,
        pages: Math.ceil(total / maxLimit)
      }
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
