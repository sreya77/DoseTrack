const router = require('express').Router();
const db = require('../../db');
const { logAudit } = require('../../middleware/auth');

/**
 * GET /api/admin/medications
 * Cross-patient medication formulary with linked schedules and status
 */
router.get('/', async (req, res, next) => {
  try {
    const { search = '', patientId = '', status = '', page = 1, limit = 20 } = req.query;
    const offset = (Math.max(1, parseInt(page)) - 1) * parseInt(limit);
    const maxLimit = Math.min(100, Math.max(1, parseInt(limit)));

    let sqlWhere = 'WHERE 1=1';
    const params = [];

    if (search.trim()) {
      const q = `%${search.trim()}%`;
      sqlWhere += ' AND (m.name LIKE ? OR m.dosage LIKE ? OR u.full_name LIKE ? OR u.patient_code LIKE ?)';
      params.push(q, q, q, q);
    }

    if (patientId) {
      sqlWhere += ' AND m.user_id = ?';
      params.push(patientId);
    }

    if (status === 'active') {
      sqlWhere += ' AND m.is_active = 1';
    } else if (status === 'inactive') {
      sqlWhere += ' AND m.is_active = 0';
    }

    // Count total matching medications
    const [countRows] = await db.execute(
      `SELECT COUNT(DISTINCT m.id) as total 
       FROM medications m 
       JOIN users u ON u.id = m.user_id 
       ${sqlWhere}`,
      params
    );
    const total = Number(countRows[0]?.total || 0);

    // Fetch paginated medications with linked schedules
    const [rows] = await db.execute(
      `SELECT 
         m.id, 
         m.name, 
         m.dosage, 
         m.quantity, 
         m.frequency, 
         m.instructions, 
         m.start_date, 
         m.end_date, 
         m.is_active,
         m.created_at,
         u.id as patient_id, 
         u.full_name as patient_name, 
         u.patient_code, 
         u.avatar_color as patient_avatar,
         GROUP_CONCAT(TIME_FORMAT(s.dose_time, '%H:%i') ORDER BY s.dose_time SEPARATOR ', ') as dose_times,
         COUNT(s.id) as total_schedules
       FROM medications m
       JOIN users u ON u.id = m.user_id
       LEFT JOIN schedules s ON s.medication_id = m.id AND s.active = 1
       ${sqlWhere}
       GROUP BY m.id
       ORDER BY m.created_at DESC
       LIMIT ${maxLimit} OFFSET ${offset}`,
      params
    );

    res.json({
      medications: rows.map((m) => ({
        id: m.id,
        name: m.name,
        dosage: m.dosage,
        quantity: m.quantity || '—',
        frequency: m.frequency,
        instructions: m.instructions || '—',
        startDate: m.start_date,
        endDate: m.end_date || 'Ongoing',
        isActive: Boolean(m.is_active),
        createdAt: m.created_at,
        patient: {
          id: m.patient_id,
          name: m.patient_name,
          patientCode: m.patient_code,
          avatarColor: m.patient_avatar
        },
        doseTimes: m.dose_times ? m.dose_times.split(', ') : [],
        totalSchedules: Number(m.total_schedules || 0)
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
 * PATCH /api/admin/medications/:id/toggle-status
 * Toggle medication status (active/deactivated) and cascade to linked schedules
 */
router.patch('/:id/toggle-status', async (req, res, next) => {
  try {
    const medId = Number(req.params.id);
    const [rows] = await db.execute(
      `SELECT m.id, m.name, m.dosage, m.is_active, u.full_name as patient_name 
       FROM medications m 
       JOIN users u ON u.id = m.user_id 
       WHERE m.id = ?`,
      [medId]
    );

    if (!rows.length) {
      return res.status(404).json({ error: 'Medication not found.' });
    }

    const med = rows[0];
    const newStatus = med.is_active ? 0 : 1;

    // Update medication active status
    await db.execute('UPDATE medications SET is_active = ? WHERE id = ?', [newStatus, medId]);

    // Also update linked schedules active status
    await db.execute('UPDATE schedules SET active = ? WHERE medication_id = ?', [newStatus, medId]);

    const action = newStatus ? 'ACTIVATE_MEDICATION' : 'DEACTIVATE_MEDICATION';
    await logAudit(
      req.user.id,
      action,
      'medication',
      medId,
      `Admin set status to ${newStatus ? 'ACTIVE' : 'DEACTIVATED'} for medication ${med.name} ${med.dosage} (Patient: ${med.patient_name}).`,
      req
    );

    res.json({
      message: `Prescription for ${med.name} ${newStatus ? 'activated' : 'deactivated'} successfully.`,
      isActive: Boolean(newStatus)
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

