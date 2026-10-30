const router = require('express').Router();
const db = require('../db');
const { requireAuth, logActivity } = require('../middleware/auth');

router.use(requireAuth);

// Get care team members (for patient) OR assigned patients (for guardian/caretaker)
router.get('/', async (req, res, next) => {
  try {
    const userId = req.user.id;
    const [userRows] = await db.execute('SELECT role, patient_code FROM users WHERE id = ?', [userId]);
    const role = userRows[0]?.role || 'patient';

    if (role === 'patient') {
      // Return Guardians & Caretakers caring for this patient
      const [members] = await db.execute(
        `SELECT pc.id as connection_id, pc.relationship, pc.can_manage_meds, pc.can_record_doses, pc.created_at,
                u.id as member_id, u.full_name, u.role, u.email, u.phone, u.avatar_color
         FROM patient_connections pc
         JOIN users u ON u.id = pc.member_id
         WHERE pc.patient_id = ?
         ORDER BY pc.created_at ASC`,
        [userId]
      );

      return res.json({
        role: 'patient',
        patientCode: userRows[0].patient_code,
        careTeam: members
      });
    } else {
      // Guardian or Caretaker: return all connected patients with live adherence & today's status
      const [patients] = await db.execute(
        `SELECT pc.id as connection_id, pc.relationship, pc.can_manage_meds, pc.can_record_doses,
                u.id as patient_id, u.full_name, u.email, u.phone, u.emergency_contact, u.patient_code, u.avatar_color
         FROM patient_connections pc
         JOIN users u ON u.id = pc.patient_id
         WHERE pc.member_id = ?
         ORDER BY u.full_name ASC`,
        [userId]
      );

      // Fetch quick adherence & today's stats for each patient
      const enrichedPatients = await Promise.all(
        patients.map(async (p) => {
          const [medCount] = await db.execute(
            `SELECT COUNT(*) as count FROM medications 
             WHERE user_id = ? AND start_date <= CURDATE() AND (end_date IS NULL OR end_date >= CURDATE())`,
            [p.patient_id]
          );

          const [dosesToday] = await db.execute(
            `SELECT 
               SUM(CASE WHEN e.status = 'taken' THEN 1 ELSE 0 END) as taken,
               SUM(CASE WHEN e.status = 'missed' THEN 1 ELSE 0 END) as missed,
               COUNT(s.id) as scheduled
             FROM schedules s
             JOIN medications m ON m.id = s.medication_id
             LEFT JOIN dose_events e ON e.schedule_id = s.id AND DATE(e.scheduled_for) = CURDATE()
             WHERE s.user_id = ? AND s.active = 1 AND m.start_date <= CURDATE() AND (m.end_date IS NULL OR m.end_date >= CURDATE())`,
            [p.patient_id]
          );

          const [adherence] = await db.execute(
            `SELECT 
               SUM(status = 'taken') as taken,
               COUNT(*) as total
             FROM dose_events
             WHERE user_id = ? AND scheduled_for >= DATE_SUB(NOW(), INTERVAL 30 DAY)`,
            [p.patient_id]
          );

          const totalEvents = Number(adherence[0]?.total || 0);
          const takenEvents = Number(adherence[0]?.taken || 0);
          const rate = totalEvents ? Math.round((takenEvents / totalEvents) * 100) : 100;

          return {
            ...p,
            activeMeds: Number(medCount[0]?.count || 0),
            todayScheduled: Number(dosesToday[0]?.scheduled || 0),
            todayTaken: Number(dosesToday[0]?.taken || 0),
            todayMissed: Number(dosesToday[0]?.missed || 0),
            adherenceRate: rate
          };
        })
      );

      return res.json({
        role,
        patients: enrichedPatients
      });
    }
  } catch (e) {
    next(e);
  }
});

// Link Guardian/Caretaker to a Patient via Patient Code or Email
router.post('/link', async (req, res, next) => {
  try {
    const memberId = req.user.id;
    const { patientCode, patientEmail, relationship = 'Caregiver' } = req.body;

    if (!patientCode?.trim() && !patientEmail?.trim()) {
      return res.status(400).json({ error: 'Please enter the Patient Code (e.g. DT-PT-1001) or patient email address.' });
    }

    let query = 'SELECT id, full_name, email, role FROM users WHERE role = "patient" AND ';
    let param;
    if (patientCode?.trim()) {
      query += 'patient_code = ?';
      param = patientCode.trim().toUpperCase();
    } else {
      query += 'email = ?';
      param = patientEmail.trim().toLowerCase();
    }

    const [rows] = await db.execute(query, [param]);
    if (!rows.length) {
      return res.status(404).json({ error: 'No patient found with that code or email. Please verify with the patient.' });
    }

    const patient = rows[0];

    // Prevent linking self
    if (patient.id === memberId) {
      return res.status(400).json({ error: 'You cannot link to your own account as a caregiver.' });
    }

    // Insert connection
    await db.execute(
      `INSERT INTO patient_connections (patient_id, member_id, relationship)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE relationship = VALUES(relationship)`,
      [patient.id, memberId, relationship.trim()]
    );

    // Notify patient
    const [sender] = await db.execute('SELECT full_name, role FROM users WHERE id = ?', [memberId]);
    await db.execute(
      `INSERT INTO care_alerts (patient_id, from_user_id, to_user_id, alert_type, title, message)
       VALUES (?, ?, ?, 'nudge', 'Care Circle Update', ?)`,
      [patient.id, memberId, patient.id, `${sender[0].full_name} (${relationship.trim()}) is now connected to your care team.`]
    );

    await logActivity(req, {
      action: 'CARE_LINK',
      targetType: 'patient_connection',
      targetId: patient.id,
      patientId: patient.id,
      details: `Connected to patient ${patient.full_name} as ${relationship.trim()}.`
    });

    res.status(201).json({
      message: `Successfully connected to patient ${patient.full_name}.`,
      patientId: patient.id
    });
  } catch (e) {
    next(e);
  }
});

// Unlink a connection
router.delete('/:connectionId', async (req, res, next) => {
  try {
    const userId = req.user.id;
    const connId = req.params.connectionId;

    const [conn] = await db.execute(
      `SELECT * FROM patient_connections WHERE id = ? AND (patient_id = ? OR member_id = ?)`,
      [connId, userId, userId]
    );

    if (!conn.length) {
      return res.status(404).json({ error: 'Connection not found or permission denied.' });
    }

    await db.execute('DELETE FROM patient_connections WHERE id = ?', [connId]);

    await logActivity(req, {
      action: 'CARE_UNLINK',
      targetType: 'patient_connection',
      targetId: connId,
      patientId: conn[0].patient_id,
      details: `Removed a care-circle connection (${conn[0].relationship || 'caregiver'}).`
    });

    res.json({ message: 'Care connection removed.' });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
