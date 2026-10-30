const router = require('express').Router();
const db = require('../../db');
const { logAudit } = require('../../middleware/auth');

/**
 * GET /api/admin/doctors
 * Searchable list of doctors & clinics
 */
router.get('/', async (req, res, next) => {
  try {
    const { search = '', patientId = '' } = req.query;

    let sqlWhere = 'WHERE 1=1';
    const params = [];

    if (search.trim()) {
      const q = `%${search.trim()}%`;
      sqlWhere += ' AND (d.name LIKE ? OR d.specialization LIKE ? OR d.clinic_name LIKE ? OR d.phone LIKE ? OR d.email LIKE ?)';
      params.push(q, q, q, q, q);
    }

    if (patientId) {
      sqlWhere += ' AND d.user_id = ?';
      params.push(patientId);
    }

    const [rows] = await db.execute(
      `SELECT d.*, u.full_name as patient_name, u.patient_code 
       FROM doctors d
       LEFT JOIN users u ON u.id = d.user_id
       ${sqlWhere}
       ORDER BY d.name ASC`,
      params
    );

    res.json({
      doctors: rows.map((d) => ({
        id: d.id,
        name: d.name,
        specialization: d.specialization || 'General Practice',
        clinicName: d.clinic_name || '—',
        phone: d.phone || '—',
        email: d.email || '—',
        availability: d.availability || 'By appointment',
        clinicAddress: d.clinic_address || '—',
        createdAt: d.created_at,
        linkedPatient: d.user_id ? {
          id: d.user_id,
          name: d.patient_name,
          patientCode: d.patient_code
        } : null
      }))
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/admin/doctors/:id
 * Retrieve single doctor details
 */
router.get('/:id', async (req, res, next) => {
  try {
    const [rows] = await db.execute(
      `SELECT d.*, u.full_name as patient_name, u.patient_code 
       FROM doctors d
       LEFT JOIN users u ON u.id = d.user_id
       WHERE d.id = ?`,
      [req.params.id]
    );

    if (!rows.length) {
      return res.status(404).json({ error: 'Doctor not found.' });
    }

    const d = rows[0];
    res.json({
      doctor: {
        id: d.id,
        name: d.name,
        specialization: d.specialization,
        clinicName: d.clinic_name,
        phone: d.phone,
        email: d.email,
        availability: d.availability,
        clinicAddress: d.clinic_address,
        userId: d.user_id,
        linkedPatient: d.user_id ? { id: d.user_id, name: d.patient_name, patientCode: d.patient_code } : null
      }
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/admin/doctors
 * Add new doctor entry
 */
router.post('/', async (req, res, next) => {
  try {
    const { name, specialization, clinicName, phone, email, availability, clinicAddress, userId } = req.body;

    if (!name?.trim()) {
      return res.status(400).json({ error: 'Doctor full name is required.' });
    }

    // Default to admin user id if no patient user_id is provided
    const targetUserId = userId || req.user.id;

    const [result] = await db.execute(
      `INSERT INTO doctors (user_id, name, specialization, clinic_name, phone, email, availability, clinic_address)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        targetUserId,
        name.trim(),
        specialization?.trim() || 'General Medicine',
        clinicName?.trim() || null,
        phone?.trim() || null,
        email?.trim() || null,
        availability?.trim() || 'Regular Clinic Hours',
        clinicAddress?.trim() || null
      ]
    );

    const newId = result.insertId;

    await logAudit(
      req.user.id,
      'CREATE_DOCTOR',
      'doctor',
      newId,
      `Admin added doctor directory entry: ${name.trim()} (${specialization?.trim() || 'General'}).`,
      req
    );

    res.status(201).json({
      message: 'Doctor added successfully.',
      doctorId: newId
    });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/admin/doctors/:id
 * Update doctor details
 */
router.put('/:id', async (req, res, next) => {
  try {
    const docId = Number(req.params.id);
    const { name, specialization, clinicName, phone, email, availability, clinicAddress, userId } = req.body;

    if (!name?.trim()) {
      return res.status(400).json({ error: 'Doctor name is required.' });
    }

    const [existing] = await db.execute('SELECT id, name FROM doctors WHERE id = ?', [docId]);
    if (!existing.length) {
      return res.status(404).json({ error: 'Doctor not found.' });
    }

    await db.execute(
      `UPDATE doctors 
       SET name = ?, specialization = ?, clinic_name = ?, phone = ?, email = ?, availability = ?, clinic_address = ?
       WHERE id = ?`,
      [
        name.trim(),
        specialization?.trim() || null,
        clinicName?.trim() || null,
        phone?.trim() || null,
        email?.trim() || null,
        availability?.trim() || null,
        clinicAddress?.trim() || null,
        docId
      ]
    );

    await logAudit(
      req.user.id,
      'UPDATE_DOCTOR',
      'doctor',
      docId,
      `Admin updated doctor record for ${name.trim()} (ID: ${docId}).`,
      req
    );

    res.json({ message: 'Doctor details updated successfully.' });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/admin/doctors/:id
 * Delete doctor entry
 */
router.delete('/:id', async (req, res, next) => {
  try {
    const docId = Number(req.params.id);
    const [existing] = await db.execute('SELECT id, name FROM doctors WHERE id = ?', [docId]);

    if (!existing.length) {
      return res.status(404).json({ error: 'Doctor not found.' });
    }

    const docName = existing[0].name;
    await db.execute('DELETE FROM doctors WHERE id = ?', [docId]);

    await logAudit(
      req.user.id,
      'DELETE_DOCTOR',
      'doctor',
      docId,
      `Admin deleted doctor directory record for ${docName} (ID: ${docId}).`,
      req
    );

    res.json({ message: `Doctor ${docName} removed from directory.` });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

