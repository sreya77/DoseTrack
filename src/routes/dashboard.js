const router = require('express').Router();
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const { canAccessPatient } = require('./careNotes');

router.use(requireAuth);

router.get('/summary', async (req, res, next) => {
  try {
    const userId = req.user.id;
    let targetPatientId = req.query.patientId;

    if (!targetPatientId) {
      const [u] = await db.execute('SELECT role FROM users WHERE id = ?', [userId]);
      if (u[0]?.role === 'patient') {
        targetPatientId = userId;
      } else {
        const [conn] = await db.execute(
          'SELECT patient_id FROM patient_connections WHERE member_id = ? ORDER BY id ASC LIMIT 1',
          [userId]
        );
        if (!conn.length) {
          return res.json({
            noPatients: true,
            activeMedications: 0,
            taken: 0,
            missed: 0,
            trackedDoses: 0,
            adherence: 0,
            today: { taken: 0, missed: 0, scheduled: 0 },
            latestVitals: null,
            latestNote: null
          });
        }
        targetPatientId = conn[0].patient_id;
      }
    }

    if (!(await canAccessPatient(userId, targetPatientId))) {
      return res.status(403).json({ error: 'Not authorized to view dashboard for this patient.' });
    }

    // 30-day adherence stats
    const [c] = await db.execute(
      `SELECT SUM(status = 'taken') as taken, SUM(status = 'missed') as missed, COUNT(*) as total 
       FROM dose_events 
       WHERE user_id = ? AND scheduled_for >= DATE_SUB(NOW(), INTERVAL 30 DAY)`,
      [targetPatientId]
    );

    // Active medications count
    const [m] = await db.execute(
      `SELECT COUNT(*) as count FROM medications 
       WHERE user_id = ? AND start_date <= CURDATE() AND (end_date IS NULL OR end_date >= CURDATE())`,
      [targetPatientId]
    );

    // Today's status
    const [today] = await db.execute(
      `SELECT 
         SUM(CASE WHEN e.status = 'taken' THEN 1 ELSE 0 END) as taken,
         SUM(CASE WHEN e.status = 'missed' THEN 1 ELSE 0 END) as missed,
         COUNT(s.id) as scheduled
       FROM schedules s
       JOIN medications med ON med.id = s.medication_id
       LEFT JOIN dose_events e ON e.schedule_id = s.id AND DATE(e.scheduled_for) = CURDATE()
       WHERE s.user_id = ? AND s.active = 1 
         AND med.start_date <= CURDATE() 
         AND (med.end_date IS NULL OR med.end_date >= CURDATE())`,
      [targetPatientId]
    );

    // Latest vitals
    const [vitalsRows] = await db.execute(
      `SELECT n.content, n.vitals_json, n.created_at, u.full_name as author_name, u.role as author_role
       FROM care_notes n
       JOIN users u ON u.id = n.author_id
       WHERE n.patient_id = ? AND n.note_type = 'vitals'
       ORDER BY n.created_at DESC LIMIT 1`,
      [targetPatientId]
    );

    // Latest note
    const [noteRows] = await db.execute(
      `SELECT n.content, n.created_at, u.full_name as author_name, u.role as author_role
       FROM care_notes n
       JOIN users u ON u.id = n.author_id
       WHERE n.patient_id = ?
       ORDER BY n.created_at DESC LIMIT 1`,
      [targetPatientId]
    );

    // Patient info
    const [ptRows] = await db.execute(
      `SELECT id, full_name, email, phone, role, patient_code, emergency_contact, avatar_color 
       FROM users WHERE id = ?`,
      [targetPatientId]
    );

    // Care team count
    const [teamCount] = await db.execute(
      `SELECT COUNT(*) as count FROM patient_connections WHERE patient_id = ?`,
      [targetPatientId]
    );

    const x = c[0] || {};
    const total = Number(x.total || 0);
    const taken = Number(x.taken || 0);
    const missed = Number(x.missed || 0);

    let parsedVitals = null;
    if (vitalsRows[0]?.vitals_json) {
      try {
        parsedVitals = typeof vitalsRows[0].vitals_json === 'string'
          ? JSON.parse(vitalsRows[0].vitals_json)
          : vitalsRows[0].vitals_json;
      } catch {
        parsedVitals = null;
      }
    }

    res.json({
      patient: ptRows[0] || null,
      careTeamCount: Number(teamCount[0]?.count || 0),
      activeMedications: Number(m[0]?.count || 0),
      taken,
      missed,
      trackedDoses: total,
      adherence: total ? Math.round((taken / total) * 100) : 100,
      today: {
        taken: Number(today[0]?.taken || 0),
        missed: Number(today[0]?.missed || 0),
        scheduled: Number(today[0]?.scheduled || 0)
      },
      latestVitals: vitalsRows[0] ? { ...vitalsRows[0], vitals: parsedVitals } : null,
      latestNote: noteRows[0] || null
    });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
