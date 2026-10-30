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

    const newDoc = {
      name: name.trim(),
      specialization: specialization?.trim() || null,
      clinicName: clinicName?.trim() || null,
      phone: phone?.trim() || null,
      email: email?.trim() || null,
      availability: availability?.trim() || null,
      clinicAddress: clinicAddress?.trim() || null
    };

    await logActivity(req, {
      actionType: 'DOCTOR_ADD',
      entityType: 'doctor',
      entityId: r.insertId,
      patientId: targetPatientId,
      description: `Added doctor ${name.trim()}${specialization?.trim() ? ` (${specialization.trim()})` : ''}.`,
      newValue: newDoc
    });

    res.status(201).json({ id: r.insertId, message: 'Doctor contact saved.' });
  } catch (e) {
    next(e);
  }
});

// Edit Doctor Contact
router.put('/:id', async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { name, specialization, clinicName, phone, email, availability, clinicAddress } = req.body;

    const [existing] = await db.execute('SELECT * FROM doctors WHERE id = ?', [req.params.id]);
    if (!existing.length) return res.status(404).json({ error: 'Doctor not found.' });

    const oldDoc = existing[0];
    if (!(await canAccessPatient(userId, oldDoc.user_id))) {
      return res.status(403).json({ error: 'Not authorized to modify this doctor.' });
    }

    const updatedDoc = {
      name: name ? name.trim() : oldDoc.name,
      specialization: specialization !== undefined ? specialization?.trim() : oldDoc.specialization,
      clinic_name: clinicName !== undefined ? clinicName?.trim() : oldDoc.clinic_name,
      phone: phone !== undefined ? phone?.trim() : oldDoc.phone,
      email: email !== undefined ? email?.trim() : oldDoc.email,
      availability: availability !== undefined ? availability?.trim() : oldDoc.availability,
      clinic_address: clinicAddress !== undefined ? clinicAddress?.trim() : oldDoc.clinic_address
    };

    await db.execute(
      `UPDATE doctors 
       SET name = ?, specialization = ?, clinic_name = ?, phone = ?, email = ?, availability = ?, clinic_address = ?
       WHERE id = ?`,
      [
        updatedDoc.name,
        updatedDoc.specialization,
        updatedDoc.clinic_name,
        updatedDoc.phone,
        updatedDoc.email,
        updatedDoc.availability,
        updatedDoc.clinic_address,
        req.params.id
      ]
    );

    await logActivity(req, {
      actionType: 'DOCTOR_EDIT',
      entityType: 'doctor',
      entityId: req.params.id,
      patientId: oldDoc.user_id,
      description: `Updated details for doctor ${updatedDoc.name}.`,
      oldValue: oldDoc,
      newValue: updatedDoc
    });

    res.json({ message: 'Doctor details updated successfully.' });
  } catch (e) {
    next(e);
  }
});

// Delete Doctor Contact
router.delete('/:id', async (req, res, next) => {
  try {
    const userId = req.user.id;
    const [existing] = await db.execute('SELECT * FROM doctors WHERE id = ?', [req.params.id]);
    if (!existing.length) return res.status(404).json({ error: 'Doctor not found.' });

    const oldDoc = existing[0];
    if (!(await canAccessPatient(userId, oldDoc.user_id))) {
      return res.status(403).json({ error: 'Not authorized to delete this doctor.' });
    }

    await db.execute('DELETE FROM doctors WHERE id = ?', [req.params.id]);

    await logActivity(req, {
      actionType: 'DOCTOR_DELETE',
      entityType: 'doctor',
      entityId: req.params.id,
      patientId: oldDoc.user_id,
      description: `Removed doctor ${oldDoc.name} from directory.`,
      oldValue: oldDoc
    });

    res.json({ message: 'Doctor deleted.' });
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
      actionType: 'APPOINTMENT_REQUEST',
      entityType: 'appointment_request',
      entityId: r.insertId,
      patientId: targetPatientId,
      description: `Requested an appointment${req.body.requestedDate ? ` for ${req.body.requestedDate}` : ''}.`,
      newValue: { doctorId: req.params.id, requestedDate: req.body.requestedDate || null, message: req.body.message || null }
    });

    res.status(201).json({ id: r.insertId, message: 'Appointment request recorded. Please confirm directly with the clinic.' });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
