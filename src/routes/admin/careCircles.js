const router = require('express').Router();
const db = require('../../db');
const { logAudit } = require('../../middleware/auth');

/**
 * GET /api/admin/care-circles
 * Retrieve all care circle connections across patients, guardians, and caretakers
 */
router.get('/', async (req, res, next) => {
  try {
    const { patientId = '', memberId = '' } = req.query;

    let sqlWhere = 'WHERE 1=1';
    const params = [];

    if (patientId) {
      sqlWhere += ' AND pc.patient_id = ?';
      params.push(patientId);
    }

    if (memberId) {
      sqlWhere += ' AND pc.member_id = ?';
      params.push(memberId);
    }

    const [rows] = await db.execute(
      `SELECT 
         pc.id as connection_id,
         pc.relationship,
         pc.can_manage_meds,
         pc.can_record_doses,
         pc.created_at,
         pt.id as patient_id,
         pt.full_name as patient_name,
         pt.patient_code,
         pt.avatar_color as patient_avatar,
         m.id as member_id,
         m.full_name as member_name,
         m.role as member_role,
         m.email as member_email,
         m.phone as member_phone,
         m.avatar_color as member_avatar
       FROM patient_connections pc
       JOIN users pt ON pt.id = pc.patient_id
       JOIN users m ON m.id = pc.member_id
       ${sqlWhere}
       ORDER BY pt.full_name ASC, pc.created_at DESC`,
      params
    );

    res.json({
      connections: rows.map((r) => ({
        id: r.connection_id,
        relationship: r.relationship,
        canManageMeds: Boolean(r.can_manage_meds),
        canRecordDoses: Boolean(r.can_record_doses),
        createdAt: r.created_at,
        patient: {
          id: r.patient_id,
          name: r.patient_name,
          patientCode: r.patient_code,
          avatarColor: r.patient_avatar
        },
        member: {
          id: r.member_id,
          name: r.member_name,
          role: r.member_role,
          email: r.member_email,
          phone: r.member_phone || '—',
          avatarColor: r.member_avatar
        }
      }))
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/admin/care-circles
 * Connect a Patient to a Guardian or Caretaker
 */
router.post('/', async (req, res, next) => {
  try {
    const { patientId, memberId, relationship, canManageMeds = true, canRecordDoses = true } = req.body;

    if (!patientId || !memberId) {
      return res.status(400).json({ error: 'Both Patient and Care Circle Member are required.' });
    }

    if (Number(patientId) === Number(memberId)) {
      return res.status(400).json({ error: 'A patient cannot be connected to themselves.' });
    }

    // Verify patient role
    const [patientRows] = await db.execute('SELECT id, full_name, patient_code FROM users WHERE id = ? AND role = "patient"', [patientId]);
    if (!patientRows.length) {
      return res.status(400).json({ error: 'Selected patient account is invalid or not registered as a patient.' });
    }

    // Verify member role
    const [memberRows] = await db.execute('SELECT id, full_name, role FROM users WHERE id = ? AND role IN ("guardian", "caretaker")', [memberId]);
    if (!memberRows.length) {
      return res.status(400).json({ error: 'Selected member must be registered as a Guardian or Caretaker.' });
    }

    const patient = patientRows[0];
    const member = memberRows[0];
    const defaultRel = member.role === 'guardian' ? 'Family Guardian' : 'Assigned Nurse / Caregiver';
    const chosenRel = relationship?.trim() || defaultRel;

    const [result] = await db.execute(
      `INSERT INTO patient_connections (patient_id, member_id, relationship, can_manage_meds, can_record_doses)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE 
         relationship = VALUES(relationship),
         can_manage_meds = VALUES(can_manage_meds),
         can_record_doses = VALUES(can_record_doses)`,
      [patient.id, member.id, chosenRel, canManageMeds ? 1 : 0, canRecordDoses ? 1 : 0]
    );

    await logAudit(
      req.user.id,
      'CONNECT_CARE_CIRCLE',
      'patient_connection',
      result.insertId || '0',
      `Admin connected ${member.full_name} (${member.role}) to patient ${patient.full_name} as "${chosenRel}".`,
      req
    );

    res.status(201).json({
      message: `Connected ${member.full_name} to ${patient.full_name} successfully.`
    });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/admin/care-circles/:id
 * Disconnect care circle link
 */
router.delete('/:id', async (req, res, next) => {
  try {
    const connId = Number(req.params.id);

    const [existing] = await db.execute(
      `SELECT pc.id, pt.full_name as pt_name, m.full_name as m_name 
       FROM patient_connections pc 
       JOIN users pt ON pt.id = pc.patient_id 
       JOIN users m ON m.id = pc.member_id 
       WHERE pc.id = ?`,
      [connId]
    );

    if (!existing.length) {
      return res.status(404).json({ error: 'Care circle connection not found.' });
    }

    const info = existing[0];
    await db.execute('DELETE FROM patient_connections WHERE id = ?', [connId]);

    await logAudit(
      req.user.id,
      'DISCONNECT_CARE_CIRCLE',
      'patient_connection',
      connId,
      `Admin disconnected care circle link between ${info.m_name} and patient ${info.pt_name}.`,
      req
    );

    res.json({ message: `Care circle link between ${info.m_name} and ${info.pt_name} removed.` });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

