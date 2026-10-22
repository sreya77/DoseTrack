const router = require('express').Router();
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const { canAccessPatient } = require('./careNotes');

router.use(requireAuth);

// Get today's doses for current patient OR specified patient (for guardian/caretaker)
router.get('/today', async (req, res, next) => {
  try {
    const userId = req.user.id;
    let targetPatientId = req.query.patientId;

    if (!targetPatientId) {
      const [u] = await db.execute('SELECT role FROM users WHERE id = ?', [userId]);
      if (u[0]?.role === 'patient') {
        targetPatientId = userId;
      } else {
        // Default to first connected patient
        const [conn] = await db.execute(
          'SELECT patient_id FROM patient_connections WHERE member_id = ? ORDER BY id ASC LIMIT 1',
          [userId]
        );
        if (!conn.length) return res.json({ doses: [], patient: null });
        targetPatientId = conn[0].patient_id;
      }
    }

    if (!(await canAccessPatient(userId, targetPatientId))) {
      return res.status(403).json({ error: 'Not authorized for this patient schedule.' });
    }

    const [ptRows] = await db.execute(
      'SELECT id, full_name, role, patient_code, emergency_contact, avatar_color FROM users WHERE id = ?',
      [targetPatientId]
    );

    const [rows] = await db.execute(
      `SELECT s.id as schedule_id, m.id as medication_id, m.name, m.dosage, m.instructions, m.quantity,
              TIME_FORMAT(s.dose_time, '%H:%i') as dose_time,
              CONCAT(CURDATE(), ' ', TIME_FORMAT(s.dose_time, '%H:%i:%s')) as scheduled_for,
              e.status, e.recorded_at,
              recorder.full_name as recorded_by_name, recorder.role as recorded_by_role
       FROM schedules s
       JOIN medications m ON m.id = s.medication_id
       LEFT JOIN dose_events e ON e.schedule_id = s.id AND DATE(e.scheduled_for) = CURDATE()
       LEFT JOIN users recorder ON recorder.id = e.recorded_by_id
       WHERE s.user_id = ? AND s.active = 1 
         AND m.start_date <= CURDATE() 
         AND (m.end_date IS NULL OR m.end_date >= CURDATE())
       ORDER BY s.dose_time ASC`,
      [targetPatientId]
    );

    res.json({
      patient: ptRows[0] || null,
      doses: rows
    });
  } catch (e) {
    next(e);
  }
});

// Caretaker medication rounds view (all assigned patients in one combined round)
router.get('/rounds', async (req, res, next) => {
  try {
    const caretakerId = req.user.id;
    const [rows] = await db.execute(
      `SELECT s.id as schedule_id, m.id as medication_id, m.name, m.dosage, m.instructions,
              TIME_FORMAT(s.dose_time, '%H:%i') as dose_time,
              CONCAT(CURDATE(), ' ', TIME_FORMAT(s.dose_time, '%H:%i:%s')) as scheduled_for,
              e.status, e.recorded_at,
              pt.id as patient_id, pt.full_name as patient_name, pt.avatar_color as patient_avatar
       FROM patient_connections pc
       JOIN users pt ON pt.id = pc.patient_id
       JOIN schedules s ON s.user_id = pt.id AND s.active = 1
       JOIN medications m ON m.id = s.medication_id
       LEFT JOIN dose_events e ON e.schedule_id = s.id AND DATE(e.scheduled_for) = CURDATE()
       WHERE pc.member_id = ? 
         AND m.start_date <= CURDATE() 
         AND (m.end_date IS NULL OR m.end_date >= CURDATE())
       ORDER BY s.dose_time ASC, pt.full_name ASC`,
      [caretakerId]
    );

    res.json({ rounds: rows });
  } catch (e) {
    next(e);
  }
});

// Mark dose status (Taken or Missed) - patient or caretaker/guardian
router.post('/:scheduleId/status', async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { status, scheduledFor: rawScheduledFor } = req.body;

    if (!['taken', 'missed'].includes(status)) {
      return res.status(400).json({ error: 'Status must be taken or missed.' });
    }

    // Find schedule and verify permission
    const [schedRows] = await db.execute(
      `SELECT s.id, s.user_id as patient_id, m.id as medication_id, m.name as med_name, m.dosage, s.dose_time
       FROM schedules s
       JOIN medications m ON m.id = s.medication_id
       WHERE s.id = ? AND s.active = 1`,
      [req.params.scheduleId]
    );

    if (!schedRows.length) {
      return res.status(404).json({ error: 'Dose schedule not found.' });
    }

    const sched = schedRows[0];
    const patientId = sched.patient_id;

    if (!(await canAccessPatient(userId, patientId))) {
      return res.status(403).json({ error: 'Not authorized to record doses for this patient.' });
    }

    const scheduledFor = rawScheduledFor || new Date().toISOString().slice(0, 19).replace('T', ' ');

    await db.execute(
      `INSERT INTO dose_events (schedule_id, medication_id, user_id, scheduled_for, status, recorded_by_id)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE status = VALUES(status), recorded_by_id = VALUES(recorded_by_id), recorded_at = CURRENT_TIMESTAMP`,
      [sched.id, sched.medication_id, patientId, scheduledFor, status, userId]
    );

    // Fetch actor name
    const [actor] = await db.execute('SELECT full_name, role FROM users WHERE id = ?', [userId]);
    const [patient] = await db.execute('SELECT full_name FROM users WHERE id = ?', [patientId]);
    const actorName = actor[0]?.full_name || 'User';
    const patientName = patient[0]?.full_name || 'Patient';

    const isSelf = Number(userId) === Number(patientId);
    const doseDesc = `${sched.med_name} (${sched.dosage})`;

    // Notify connected care team members
    const [team] = await db.execute(
      'SELECT member_id FROM patient_connections WHERE patient_id = ? AND member_id != ?',
      [patientId, userId]
    );

    const alertType = status === 'taken' ? 'dose_taken' : 'dose_missed';
    const alertTitle = status === 'taken' 
      ? `✓ Dose Taken: ${sched.med_name}`
      : `⚠️ Missed Dose Alert: ${sched.med_name}`;

    const alertMessage = isSelf
      ? `${patientName} recorded ${doseDesc} as ${status}.`
      : `${actorName} (${actor[0]?.role}) marked ${doseDesc} as ${status} for ${patientName}.`;

    for (const m of team) {
      await db.execute(
        `INSERT INTO care_alerts (patient_id, from_user_id, to_user_id, alert_type, title, message)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [patientId, userId, m.member_id, alertType, alertTitle, alertMessage]
      );
    }

    // If caretaker or guardian marked on behalf of patient, notify patient as well
    if (!isSelf) {
      await db.execute(
        `INSERT INTO care_alerts (patient_id, from_user_id, to_user_id, alert_type, title, message)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [patientId, userId, patientId, alertTitle, alertMessage]
      );
    }

    res.json({
      message: `Dose marked ${status}.`,
      status,
      doseDesc
    });
  } catch (e) {
    next(e);
  }
});

// Get dose history
router.get('/history', async (req, res, next) => {
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
        if (!conn.length) return res.json({ history: [] });
        targetPatientId = conn[0].patient_id;
      }
    }

    if (!(await canAccessPatient(userId, targetPatientId))) {
      return res.status(403).json({ error: 'Not authorized for this patient history.' });
    }

    const [history] = await db.execute(
      `SELECT e.id, e.scheduled_for, e.status, e.recorded_at,
              m.name, m.dosage, TIME_FORMAT(s.dose_time, '%H:%i') as dose_time,
              recorder.full_name as recorded_by_name, recorder.role as recorded_by_role
       FROM dose_events e
       JOIN medications m ON m.id = e.medication_id
       JOIN schedules s ON s.id = e.schedule_id
       LEFT JOIN users recorder ON recorder.id = e.recorded_by_id
       WHERE e.user_id = ?
       ORDER BY e.scheduled_for DESC LIMIT 100`,
      [targetPatientId]
    );

    res.json({ history });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
