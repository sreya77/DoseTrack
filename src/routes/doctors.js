const router = require('express').Router();
const db = require('../db');
const { requireAuth, logActivity } = require('../middleware/auth');
const { canAccessPatient } = require('./careNotes');

router.use(requireAuth);

router.get('/', async (req, res, next) => {
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
        if (!conn.length) return res.json({ doctors: [] });
        targetPatientId = conn[0].patient_id;
      }
    }

    if (!(await canAccessPatient(userId, targetPatientId))) {
      return res.status(403).json({ error: 'Not authorized for this patient.' });
    }

    const [doctors] = await db.execute('SELECT * FROM doctors WHERE user_id = ? ORDER BY name', [targetPatientId]);
    res.json({ doctors });
  } catch (e) {
    next(e);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { name, specialization, clinicName, phone, email, availability, clinicAddress, patientId: reqPatientId } = req.body;
    let targetPatientId = reqPatientId || userId;

    if (!name?.trim()) return res.status(400).json({ error: 'Doctor name is required.' });

    if (!(await canAccessPatient(userId, targetPatientId))) {
      return res.status(403).json({ error: 'Not authorized for this patient.' });
    }

    const [r] = await db.execute(
      `INSERT INTO doctors (user_id, name, specialization, clinic_name, phone, email, availability, clinic_address) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        targetPatientId,
        name.trim(),
        specialization?.trim() || null,
        clinicName?.trim() || null,
        phone?.trim() || null,
        email?.trim() || null,
        availability?.trim() || null,
        clinicAddress?.trim() || null
      ]
    );

    await logActivity(req, {
      action: 'DOCTOR_ADD',
      targetType: 'doctor',
      targetId: r.insertId,
      patientId: targetPatientId,
      details: `Added doctor ${name.trim()}${specialization?.trim() ? ` (${specialization.trim()})` : ''}.`
    });

    res.status(201).json({ id: r.insertId, message: 'Doctor contact saved.' });
  } catch (e) {
    next(e);
  }
});

router.post('/:id/appointment-requests', async (req, res, next) => {
  try {
    const userId = req.user.id;
    const [d] = await db.execute('SELECT id, user_id FROM doctors WHERE id = ?', [req.params.id]);
    if (!d.length) return res.status(404).json({ error: 'Doctor not found.' });

    const targetPatientId = d[0].user_id;
    if (!(await canAccessPatient(userId, targetPatientId))) {
      return res.status(403).json({ error: 'Not authorized for this patient appointment.' });
    }

    const [r] = await db.execute(
      `INSERT INTO appointment_requests (doctor_id, user_id, requested_date, message) VALUES (?, ?, ?, ?)`,
      [req.params.id, targetPatientId, req.body.requestedDate || null, req.body.message || null]
    );

    await logActivity(req, {
      action: 'APPOINTMENT_REQUEST',
      targetType: 'appointment_request',
      targetId: r.insertId,
      patientId: targetPatientId,
      details: `Requested an appointment${req.body.requestedDate ? ` for ${req.body.requestedDate}` : ''}.`
    });

    res.status(201).json({ id: r.insertId, message: 'Appointment request recorded. Please confirm directly with the clinic.' });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
