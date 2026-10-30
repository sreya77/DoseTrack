const router = require('express').Router();
const db = require('../../db');
const { logAudit } = require('../../middleware/auth');

/**
 * GET /api/admin/reminders/logs
 * Retrieve paginated reminder execution logs
 */
router.get('/logs', async (req, res, next) => {
  try {
    const { patientId = '', channel = '', page = 1, limit = 25 } = req.query;
    const offset = (Math.max(1, parseInt(page)) - 1) * parseInt(limit);
    const maxLimit = Math.min(100, Math.max(1, parseInt(limit)));

    let sqlWhere = 'WHERE 1=1';
    const params = [];

    if (patientId) {
      sqlWhere += ' AND r.user_id = ?';
      params.push(patientId);
    }

    if (channel) {
      sqlWhere += ' AND r.delivered_via = ?';
      params.push(channel);
    }

    const [countRows] = await db.execute(
      `SELECT COUNT(*) as total 
       FROM reminder_logs r 
       JOIN users u ON u.id = r.user_id 
       ${sqlWhere}`,
      params
    );
    const total = Number(countRows[0]?.total || 0);

    const [rows] = await db.execute(
      `SELECT 
         r.id,
         r.scheduled_for,
         r.delivered_via,
         r.created_at,
         u.id as patient_id,
         u.full_name as patient_name,
         u.patient_code,
         m.name as medication_name,
         m.dosage,
         TIME_FORMAT(s.dose_time, '%H:%i') as dose_time
       FROM reminder_logs r
       JOIN users u ON u.id = r.user_id
       LEFT JOIN schedules s ON s.id = r.schedule_id
       LEFT JOIN medications m ON m.id = s.medication_id
       ${sqlWhere}
       ORDER BY r.created_at DESC
       LIMIT ${maxLimit} OFFSET ${offset}`,
      params
    );

    res.json({
      logs: rows.map((r) => ({
        id: r.id,
        scheduledFor: r.scheduled_for,
        deliveredVia: r.delivered_via,
        createdAt: r.created_at,
        patient: {
          id: r.patient_id,
          name: r.patient_name,
          patientCode: r.patient_code
        },
        medicationName: r.medication_name || 'Scheduled Regimen',
        dosage: r.dosage || '—',
        doseTime: r.dose_time || '—'
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
 * GET /api/admin/reminders/settings
 * Fetch global system settings
 */
router.get('/settings', async (req, res, next) => {
  try {
    const [rows] = await db.execute('SELECT setting_key, setting_value, description, updated_at FROM app_settings');
    const settings = {};
    rows.forEach((r) => {
      settings[r.setting_key] = {
        value: r.setting_value,
        description: r.description,
        updatedAt: r.updated_at
      };
    });
    res.json({ settings });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/admin/reminders/settings
 * Update global system settings
 */
router.put('/settings', async (req, res, next) => {
  try {
    const {
      grace_period_mins = '30',
      snooze_duration_mins = '10',
      default_reminder_channel = 'dashboard',
      adherence_risk_threshold = '70',
      system_announcement = ''
    } = req.body;

    const updates = [
      ['grace_period_mins', String(grace_period_mins).trim()],
      ['snooze_duration_mins', String(snooze_duration_mins).trim()],
      ['default_reminder_channel', String(default_reminder_channel).trim()],
      ['adherence_risk_threshold', String(adherence_risk_threshold).trim()],
      ['system_announcement', String(system_announcement).trim()]
    ];

    for (const [key, val] of updates) {
      await db.execute(
        `INSERT INTO app_settings (setting_key, setting_value) 
         VALUES (?, ?) 
         ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
        [key, val]
      );
    }

    await logAudit(
      req.user.id,
      'UPDATE_APP_SETTINGS',
      'app_settings',
      '0',
      `Admin updated clinical app settings: Grace period=${grace_period_mins}m, Snooze=${snooze_duration_mins}m, Risk threshold=${adherence_risk_threshold}%.`,
      req
    );

    res.json({ message: 'System configuration settings updated successfully.' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

