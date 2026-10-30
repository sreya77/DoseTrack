const router = require('express').Router();
const db = require('../../db');
const { logAudit } = require('../../middleware/auth');

/**
 * GET /api/admin/adherence/summary
 * Per-patient adherence rate calculations & at-risk flags
 */
router.get('/summary', async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;

    let dateClause = '';
    const dateParams = [];
    if (startDate && endDate) {
      dateClause = 'AND e.scheduled_for BETWEEN ? AND ?';
      dateParams.push(`${startDate} 00:00:00`, `${endDate} 23:59:59`);
    } else {
      // Default to last 30 days
      dateClause = 'AND e.scheduled_for >= DATE_SUB(NOW(), INTERVAL 30 DAY)';
    }

    const [rows] = await db.execute(
      `SELECT 
         u.id as patient_id, 
         u.full_name as patient_name, 
         u.patient_code,
         u.avatar_color,
         COUNT(e.id) as total_scheduled,
         SUM(CASE WHEN e.status = 'taken' THEN 1 ELSE 0 END) as taken_count,
         SUM(CASE WHEN e.status = 'missed' THEN 1 ELSE 0 END) as missed_count,
         MAX(e.scheduled_for) as latest_dose_time
       FROM users u
       JOIN dose_events e ON e.user_id = u.id
       WHERE u.role = 'patient' AND u.is_active = 1
       ${dateClause}
       GROUP BY u.id
       ORDER BY (SUM(CASE WHEN e.status = 'taken' THEN 1 ELSE 0 END) / COUNT(e.id)) ASC`,
      dateParams
    );

    const patients = rows.map((p) => {
      const scheduled = Number(p.total_scheduled || 0);
      const taken = Number(p.taken_count || 0);
      const missed = Number(p.missed_count || 0);
      const rate = scheduled > 0 ? Math.round((taken / scheduled) * 100) : 100;
      
      let riskLevel = 'optimal';
      if (rate < 70) riskLevel = 'at_risk';
      else if (rate < 85) riskLevel = 'moderate';

      return {
        patientId: p.patient_id,
        name: p.patient_name,
        patientCode: p.patient_code || '—',
        avatarColor: p.avatar_color || '#0d9488',
        totalScheduled: scheduled,
        takenCount: taken,
        missedCount: missed,
        adherenceRate: rate,
        riskLevel,
        isAtRisk: rate < 70,
        latestDoseTime: p.latest_dose_time
      };
    });

    res.json({ patients });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/admin/adherence/events
 * Read-only dose events stream with multi-parameter filtering
 * IMMUTABLE: No edit or delete routes exist for dose_events.
 */
router.get('/events', async (req, res, next) => {
  try {
    const { 
      startDate = '', 
      endDate = '', 
      patientId = '', 
      medicationId = '', 
      status = '', 
      page = 1, 
      limit = 25 
    } = req.query;

    const offset = (Math.max(1, parseInt(page)) - 1) * parseInt(limit);
    const maxLimit = Math.min(100, Math.max(1, parseInt(limit)));

    let sqlWhere = 'WHERE 1=1';
    const params = [];

    if (startDate) {
      sqlWhere += ' AND e.scheduled_for >= ?';
      params.push(`${startDate} 00:00:00`);
    }

    if (endDate) {
      sqlWhere += ' AND e.scheduled_for <= ?';
      params.push(`${endDate} 23:59:59`);
    }

    if (patientId) {
      sqlWhere += ' AND e.user_id = ?';
      params.push(patientId);
    }

    if (medicationId) {
      sqlWhere += ' AND e.medication_id = ?';
      params.push(medicationId);
    }

    if (status && ['taken', 'missed'].includes(status)) {
      sqlWhere += ' AND e.status = ?';
      params.push(status);
    }

    // Count matching
    const [countRows] = await db.execute(
      `SELECT COUNT(*) as total 
       FROM dose_events e 
       JOIN users u ON u.id = e.user_id 
       JOIN medications m ON m.id = e.medication_id 
       ${sqlWhere}`,
      params
    );
    const total = Number(countRows[0]?.total || 0);

    // Fetch paginated dose events
    const [rows] = await db.execute(
      `SELECT 
         e.id, 
         e.scheduled_for, 
         e.status, 
         e.recorded_at,
         u.id as patient_id, 
         u.full_name as patient_name, 
         u.patient_code,
         m.id as medication_id, 
         m.name as medication_name, 
         m.dosage,
         recorder.full_name as recorded_by_name,
         recorder.role as recorded_by_role
       FROM dose_events e
       JOIN users u ON u.id = e.user_id
       JOIN medications m ON m.id = e.medication_id
       LEFT JOIN users recorder ON recorder.id = e.recorded_by_id
       ${sqlWhere}
       ORDER BY e.scheduled_for DESC
       LIMIT ${maxLimit} OFFSET ${offset}`,
      params
    );

    res.json({
      events: rows.map((r) => ({
        id: r.id,
        scheduledFor: r.scheduled_for,
        status: r.status,
        recordedAt: r.recorded_at,
        patient: {
          id: r.patient_id,
          name: r.patient_name,
          patientCode: r.patient_code
        },
        medication: {
          id: r.medication_id,
          name: r.medication_name,
          dosage: r.dosage
        },
        recordedBy: r.recorded_by_name ? `${r.recorded_by_name} (${r.recorded_by_role})` : 'Self-administered'
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
 * GET /api/admin/adherence/export-csv
 * Stream/Download filtered dose events as a clean CSV file
 */
router.get('/export-csv', async (req, res, next) => {
  try {
    const { startDate = '', endDate = '', patientId = '', status = '' } = req.query;

    let sqlWhere = 'WHERE 1=1';
    const params = [];

    if (startDate) {
      sqlWhere += ' AND e.scheduled_for >= ?';
      params.push(`${startDate} 00:00:00`);
    }

    if (endDate) {
      sqlWhere += ' AND e.scheduled_for <= ?';
      params.push(`${endDate} 23:59:59`);
    }

    if (patientId) {
      sqlWhere += ' AND e.user_id = ?';
      params.push(patientId);
    }

    if (status && ['taken', 'missed'].includes(status)) {
      sqlWhere += ' AND e.status = ?';
      params.push(status);
    }

    const [rows] = await db.execute(
      `SELECT 
         e.id, 
         u.patient_code,
         u.full_name as patient_name, 
         m.name as medication_name, 
         m.dosage,
         e.scheduled_for, 
         e.status, 
         e.recorded_at,
         COALESCE(recorder.full_name, 'Self-administered') as recorded_by
       FROM dose_events e
       JOIN users u ON u.id = e.user_id
       JOIN medications m ON m.id = e.medication_id
       LEFT JOIN users recorder ON recorder.id = e.recorded_by_id
       ${sqlWhere}
       ORDER BY e.scheduled_for DESC
       LIMIT 5000`,
      params
    );

    // Build CSV
    const csvHeader = ['Event ID', 'Patient Code', 'Patient Name', 'Medication', 'Dosage', 'Scheduled For', 'Status', 'Recorded At', 'Recorded By'];
    const csvRows = [csvHeader.join(',')];

    for (const r of rows) {
      const values = [
        r.id,
        `"${String(r.patient_code || '').replace(/"/g, '""')}"`,
        `"${String(r.patient_name || '').replace(/"/g, '""')}"`,
        `"${String(r.medication_name || '').replace(/"/g, '""')}"`,
        `"${String(r.dosage || '').replace(/"/g, '""')}"`,
        `"${String(r.scheduled_for || '').replace(/"/g, '""')}"`,
        r.status.toUpperCase(),
        `"${String(r.recorded_at || '').replace(/"/g, '""')}"`,
        `"${String(r.recorded_by || '').replace(/"/g, '""')}"`
      ];
      csvRows.push(values.join(','));
    }

    // Log export to forensic audit trail
    await logAudit(
      req.user.id,
      'EXPORT_ADHERENCE_CSV',
      'dose_events',
      '0',
      `Admin exported ${rows.length} dose adherence records to CSV.`,
      req
    );

    const filename = `DoseTrack_Adherence_Export_${new Date().toISOString().slice(0, 10)}.csv`;
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csvRows.join('\r\n'));
  } catch (err) {
    next(err);
  }
});

module.exports = router;

