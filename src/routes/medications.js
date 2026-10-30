const router = require('express').Router();
const db = require('../db');
const { requireAuth, logActivity } = require('../middleware/auth');
const { canAccessPatient } = require('./careNotes');

router.use(requireAuth);

// Get medications for current user or selected patient
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
        if (!conn.length) return res.json({ medications: [] });
        targetPatientId = conn[0].patient_id;
      }
    }

    if (!(await canAccessPatient(userId, targetPatientId))) {
      return res.status(403).json({ error: 'Not authorized for this patient medication list.' });
    }

    const [rows] = await db.execute(
      `SELECT m.*, 
              GROUP_CONCAT(TIME_FORMAT(s.dose_time, '%H:%i') ORDER BY s.dose_time SEPARATOR ',') as dose_times
       FROM medications m
       LEFT JOIN schedules s ON s.medication_id = m.id AND s.active = 1
       WHERE m.user_id = ?
       GROUP BY m.id
       ORDER BY m.created_at DESC`,
      [targetPatientId]
    );

    res.json({
      patientId: Number(targetPatientId),
      medications: rows.map((m) => ({
        ...m,
        dose_times: m.dose_times ? m.dose_times.split(',') : []
      }))
    });
  } catch (e) {
    next(e);
  }
});

// Create medication
router.post('/', async (req, res, next) => {
  const userId = req.user.id;
  const {
    name,
    dosage,
    quantity,
    frequency,
    instructions,
    startDate,
    endDate,
    doseTimes = [],
    patientId: requestedPatientId
  } = req.body;

  let targetPatientId = requestedPatientId || userId;

  if (!name?.trim() || !dosage?.trim() || !frequency?.trim() || !startDate) {
    return res.status(400).json({ error: 'Medicine name, dosage, frequency, and start date are required.' });
  }

  if (!(await canAccessPatient(userId, targetPatientId))) {
    return res.status(403).json({ error: 'Not authorized to add medications for this patient.' });
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [r] = await conn.execute(
      `INSERT INTO medications (user_id, name, dosage, quantity, frequency, instructions, start_date, end_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        targetPatientId,
        name.trim(),
        dosage.trim(),
        quantity?.trim() || null,
        frequency,
        instructions?.trim() || null,
        startDate,
        endDate || null
      ]
    );

    const medId = r.insertId;

    const validTimes = [...new Set(doseTimes)].filter((t) => /^\d{2}:\d{2}$/.test(t));
    for (const t of validTimes) {
      await conn.execute(
        `INSERT INTO schedules (medication_id, user_id, dose_time) VALUES (?, ?, ?)`,
        [medId, targetPatientId, t + ':00']
      );
    }

    await conn.commit();

    // Alert if someone else added it
    if (Number(userId) !== Number(targetPatientId)) {
      const [actor] = await db.execute('SELECT full_name, role FROM users WHERE id = ?', [userId]);
      await db.execute(
        `INSERT INTO care_alerts (patient_id, from_user_id, to_user_id, alert_type, title, message)
         VALUES (?, ?, ?, 'med_changed', 'New Medication Added', ?)`,
        [
          targetPatientId,
          userId,
          targetPatientId,
          `${actor[0]?.full_name} (${actor[0]?.role}) added ${name.trim()} (${dosage.trim()}) to your medication plan.`
        ]
      );
    }

    await logActivity(req, {
      action: 'MEDICATION_ADD',
      targetType: 'medication',
      targetId: medId,
      patientId: targetPatientId,
      details: `${Number(userId) !== Number(targetPatientId) ? 'Added on behalf of patient' : 'Added'} medication ${name.trim()} (${dosage.trim()}).`
    });

    res.status(201).json({ id: medId, message: 'Medication saved successfully.' });
  } catch (e) {
    await conn.rollback();
    next(e);
  } finally {
    conn.release();
  }
});

// Update medication
router.put('/:id', async (req, res, next) => {
  const userId = req.user.id;
  const {
    name,
    dosage,
    quantity,
    frequency,
    instructions,
    startDate,
    endDate,
    doseTimes = []
  } = req.body;

  const [existing] = await db.execute('SELECT user_id, name FROM medications WHERE id = ?', [req.params.id]);
  if (!existing.length) return res.status(404).json({ error: 'Medication not found.' });

  const targetPatientId = existing[0].user_id;
  if (!(await canAccessPatient(userId, targetPatientId))) {
    return res.status(403).json({ error: 'Not authorized to modify this medication.' });
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    await conn.execute(
      `UPDATE medications 
       SET name = ?, dosage = ?, quantity = ?, frequency = ?, instructions = ?, start_date = ?, end_date = ?
       WHERE id = ?`,
      [
        name.trim(),
        dosage.trim(),
        quantity?.trim() || null,
        frequency,
        instructions?.trim() || null,
        startDate,
        endDate || null,
        req.params.id
      ]
    );

    await conn.execute('DELETE FROM schedules WHERE medication_id = ?', [req.params.id]);

    const validTimes = [...new Set(doseTimes)].filter((t) => /^\d{2}:\d{2}$/.test(t));
    for (const t of validTimes) {
      await conn.execute(
        `INSERT INTO schedules (medication_id, user_id, dose_time) VALUES (?, ?, ?)`,
        [req.params.id, targetPatientId, t + ':00']
      );
    }

    await conn.commit();

    await logActivity(req, {
      action: 'MEDICATION_UPDATE',
      targetType: 'medication',
      targetId: req.params.id,
      patientId: targetPatientId,
      details: `Updated medication ${name.trim()} (${dosage.trim()}).`
    });

    res.json({ message: 'Medication updated successfully.' });
  } catch (e) {
    await conn.rollback();
    next(e);
  } finally {
    conn.release();
  }
});

// Delete medication
router.delete('/:id', async (req, res, next) => {
  try {
    const userId = req.user.id;
    const [existing] = await db.execute('SELECT user_id, name FROM medications WHERE id = ?', [req.params.id]);
    if (!existing.length) return res.status(404).json({ error: 'Medication not found.' });

    const targetPatientId = existing[0].user_id;
    if (!(await canAccessPatient(userId, targetPatientId))) {
      return res.status(403).json({ error: 'Not authorized to delete this medication.' });
    }

    await db.execute('DELETE FROM medications WHERE id = ?', [req.params.id]);

    await logActivity(req, {
      action: 'MEDICATION_DELETE',
      targetType: 'medication',
      targetId: req.params.id,
      patientId: targetPatientId,
      details: `Deleted medication ${existing[0].name}.`
    });

    res.json({ message: 'Medication deleted.' });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
