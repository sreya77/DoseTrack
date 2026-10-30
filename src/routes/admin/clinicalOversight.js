const router = require('express').Router();
const db = require('../../db');
const { logAudit } = require('../../middleware/auth');

/**
 * GET /api/admin/clinical-oversight/notes
 * Oversee all Care Notes, Vitals, and Observations logged by Caretakers, Guardians, and Patients
 */
router.get('/notes', async (req, res, next) => {
  try {
    const { search = '', patientId = '', authorRole = '', noteType = '', page = 1, limit = 20 } = req.query;
    const offset = (Math.max(1, parseInt(page)) - 1) * parseInt(limit);
    const maxLimit = Math.min(100, Math.max(1, parseInt(limit)));

    let sqlWhere = 'WHERE 1=1';
    const params = [];

    if (search.trim()) {
      const q = `%${search.trim()}%`;
      sqlWhere += ' AND (n.content LIKE ? OR pt.full_name LIKE ? OR author.full_name LIKE ?)';
      params.push(q, q, q);
    }

    if (patientId) {
      sqlWhere += ' AND n.patient_id = ?';
      params.push(patientId);
    }

    if (authorRole) {
      sqlWhere += ' AND author.role = ?';
      params.push(authorRole);
    }

    if (noteType) {
      sqlWhere += ' AND n.note_type = ?';
      params.push(noteType);
    }

    const [countRows] = await db.execute(
      `SELECT COUNT(*) as total 
       FROM care_notes n
       JOIN users pt ON pt.id = n.patient_id
       JOIN users author ON author.id = n.author_id
       ${sqlWhere}`,
      params
    );
    const total = Number(countRows[0]?.total || 0);

    const [rows] = await db.execute(
      `SELECT 
         n.id, 
         n.patient_id, 
         n.author_id, 
         n.note_type, 
         n.content, 
         n.vitals_json, 
         n.created_at,
         pt.full_name as patient_name,
         pt.patient_code,
         pt.avatar_color as patient_avatar,
         author.full_name as author_name,
         author.role as author_role,
         author.avatar_color as author_avatar
       FROM care_notes n
       JOIN users pt ON pt.id = n.patient_id
       JOIN users author ON author.id = n.author_id
       ${sqlWhere}
       ORDER BY n.created_at DESC
       LIMIT ${maxLimit} OFFSET ${offset}`,
      params
    );

    const notes = rows.map((r) => {
      let vitals = null;
      if (r.vitals_json) {
        try {
          vitals = typeof r.vitals_json === 'string' ? JSON.parse(r.vitals_json) : r.vitals_json;
        } catch {
          vitals = null;
        }
      }
      return {
        id: r.id,
        noteType: r.note_type,
        content: r.content,
        vitals,
        createdAt: r.created_at,
        patient: {
          id: r.patient_id,
          name: r.patient_name,
          patientCode: r.patient_code,
          avatarColor: r.patient_avatar
        },
        author: {
          id: r.author_id,
          name: r.author_name,
          role: r.author_role,
          avatarColor: r.author_avatar
        }
      };
    });

    res.json({
      notes,
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
 * GET /api/admin/clinical-oversight/alerts
 * Oversee all Care Alerts, SOS Emergencies, Missed Doses, and Nudges across the entire care network
 */
router.get('/alerts', async (req, res, next) => {
  try {
    const { search = '', patientId = '', alertType = '', readStatus = '', page = 1, limit = 25 } = req.query;
    const offset = (Math.max(1, parseInt(page)) - 1) * parseInt(limit);
    const maxLimit = Math.min(100, Math.max(1, parseInt(limit)));

    let sqlWhere = 'WHERE 1=1';
    const params = [];

    if (search.trim()) {
      const q = `%${search.trim()}%`;
      sqlWhere += ' AND (a.title LIKE ? OR a.message LIKE ? OR pt.full_name LIKE ? OR sender.full_name LIKE ?)';
      params.push(q, q, q, q);
    }

    if (patientId) {
      sqlWhere += ' AND a.patient_id = ?';
      params.push(patientId);
    }

    if (alertType) {
      sqlWhere += ' AND a.alert_type = ?';
      params.push(alertType);
    }

    if (readStatus !== '') {
      sqlWhere += ' AND a.read_status = ?';
      params.push(readStatus === '1' || readStatus === 'true' ? 1 : 0);
    }

    const [countRows] = await db.execute(
      `SELECT COUNT(*) as total 
       FROM care_alerts a
       JOIN users pt ON pt.id = a.patient_id
       LEFT JOIN users sender ON sender.id = a.from_user_id
       JOIN users recipient ON recipient.id = a.to_user_id
       ${sqlWhere}`,
      params
    );
    const total = Number(countRows[0]?.total || 0);

    const [rows] = await db.execute(
      `SELECT 
         a.id, 
         a.patient_id, 
         a.from_user_id, 
         a.to_user_id, 
         a.alert_type, 
         a.title, 
         a.message, 
         a.read_status, 
         a.created_at,
         pt.full_name as patient_name,
         pt.patient_code,
         sender.full_name as sender_name,
         sender.role as sender_role,
         recipient.full_name as recipient_name,
         recipient.role as recipient_role
       FROM care_alerts a
       JOIN users pt ON pt.id = a.patient_id
       LEFT JOIN users sender ON sender.id = a.from_user_id
       JOIN users recipient ON recipient.id = a.to_user_id
       ${sqlWhere}
       ORDER BY a.created_at DESC
       LIMIT ${maxLimit} OFFSET ${offset}`,
      params
    );

    res.json({
      alerts: rows.map((r) => ({
        id: r.id,
        alertType: r.alert_type,
        title: r.title,
        message: r.message,
        readStatus: Boolean(r.read_status),
        createdAt: r.created_at,
        patient: {
          id: r.patient_id,
          name: r.patient_name,
          patientCode: r.patient_code
        },
        sender: r.sender_name ? {
          id: r.from_user_id,
          name: r.sender_name,
          role: r.sender_role
        } : null,
        recipient: {
          id: r.to_user_id,
          name: r.recipient_name,
          role: r.recipient_role
        }
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
 * GET /api/admin/clinical-oversight/appointments
 * Oversee all Doctor Appointment Requests submitted by Patients and Guardians
 */
router.get('/appointments', async (req, res, next) => {
  try {
    const { status = '', doctorId = '', patientId = '', page = 1, limit = 20 } = req.query;
    const offset = (Math.max(1, parseInt(page)) - 1) * parseInt(limit);
    const maxLimit = Math.min(100, Math.max(1, parseInt(limit)));

    let sqlWhere = 'WHERE 1=1';
    const params = [];

    if (status) {
      sqlWhere += ' AND ar.status = ?';
      params.push(status);
    }

    if (doctorId) {
      sqlWhere += ' AND ar.doctor_id = ?';
      params.push(doctorId);
    }

    if (patientId) {
      sqlWhere += ' AND ar.user_id = ?';
      params.push(patientId);
    }

    const [countRows] = await db.execute(
      `SELECT COUNT(*) as total 
       FROM appointment_requests ar
       JOIN doctors d ON d.id = ar.doctor_id
       JOIN users u ON u.id = ar.user_id
       ${sqlWhere}`,
      params
    );
    const total = Number(countRows[0]?.total || 0);

    const [rows] = await db.execute(
      `SELECT 
         ar.id, 
         ar.requested_date, 
         ar.message, 
         ar.status, 
         ar.created_at,
         d.id as doctor_id, 
         d.name as doctor_name, 
         d.specialization, 
         d.clinic_name,
         u.id as patient_id, 
         u.full_name as patient_name, 
         u.patient_code,
         u.phone as patient_phone
       FROM appointment_requests ar
       JOIN doctors d ON d.id = ar.doctor_id
       JOIN users u ON u.id = ar.user_id
       ${sqlWhere}
       ORDER BY ar.created_at DESC
       LIMIT ${maxLimit} OFFSET ${offset}`,
      params
    );

    res.json({
      appointments: rows.map((r) => ({
        id: r.id,
        requestedDate: r.requested_date,
        message: r.message,
        status: r.status,
        createdAt: r.created_at,
        doctor: {
          id: r.doctor_id,
          name: r.doctor_name,
          specialization: r.specialization,
          clinicName: r.clinic_name
        },
        patient: {
          id: r.patient_id,
          name: r.patient_name,
          patientCode: r.patient_code,
          phone: r.patient_phone
        }
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
 * PATCH /api/admin/clinical-oversight/appointments/:id/status
 * Update appointment status (confirm or cancel)
 */
router.patch('/appointments/:id/status', async (req, res, next) => {
  try {
    const apptId = Number(req.params.id);
    const { status } = req.body;

    if (!['requested', 'confirmed', 'cancelled'].includes(status)) {
      return res.status(400).json({ error: 'Status must be requested, confirmed, or cancelled.' });
    }

    const [existing] = await db.execute(
      `SELECT ar.id, d.name as doc_name, u.full_name as pt_name 
       FROM appointment_requests ar
       JOIN doctors d ON d.id = ar.doctor_id
       JOIN users u ON u.id = ar.user_id
       WHERE ar.id = ?`,
      [apptId]
    );

    if (!existing.length) {
      return res.status(404).json({ error: 'Appointment request not found.' });
    }

    await db.execute('UPDATE appointment_requests SET status = ? WHERE id = ?', [status, apptId]);

    await logAudit(
      req.user.id,
      'UPDATE_APPOINTMENT_STATUS',
      'appointment_request',
      apptId,
      `Admin updated appointment status to "${status.toUpperCase()}" for patient ${existing[0].pt_name} with ${existing[0].doc_name}.`,
      req
    );

    res.json({ message: `Appointment request status updated to ${status}.` });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/admin/clinical-oversight/omni-feed
 * Unified 360-degree timeline of whatever was done by Patient, Caretaker, or Guardian
 */
router.get('/omni-feed', async (req, res, next) => {
  try {
    const { limit = 20 } = req.query;
    const maxLimit = Math.min(50, Math.max(5, parseInt(limit)));

    // 1. Doses
    const [doses] = await db.execute(
      `SELECT 
         'dose' as event_type,
         e.id,
         e.status as outcome,
         e.scheduled_for as event_time,
         e.recorded_at as logged_at,
         u.full_name as patient_name,
         u.patient_code,
         m.name as item_name,
         m.dosage as item_sub,
         COALESCE(recorder.full_name, u.full_name) as actor_name,
         COALESCE(recorder.role, 'patient') as actor_role
       FROM dose_events e
       JOIN users u ON u.id = e.user_id
       JOIN medications m ON m.id = e.medication_id
       LEFT JOIN users recorder ON recorder.id = e.recorded_by_id
       ORDER BY e.recorded_at DESC
       LIMIT ${maxLimit}`
    );

    // 2. Care Notes & Vitals
    const [notes] = await db.execute(
      `SELECT 
         'note' as event_type,
         n.id,
         n.note_type as outcome,
         n.created_at as event_time,
         n.created_at as logged_at,
         pt.full_name as patient_name,
         pt.patient_code,
         n.content as item_name,
         n.vitals_json as item_sub,
         author.full_name as actor_name,
         author.role as actor_role
       FROM care_notes n
       JOIN users pt ON pt.id = n.patient_id
       JOIN users author ON author.id = n.author_id
       ORDER BY n.created_at DESC
       LIMIT ${maxLimit}`
    );

    // 3. Alerts & Nudges
    const [alerts] = await db.execute(
      `SELECT 
         'alert' as event_type,
         a.id,
         a.alert_type as outcome,
         a.created_at as event_time,
         a.created_at as logged_at,
         pt.full_name as patient_name,
         pt.patient_code,
         a.title as item_name,
         a.message as item_sub,
         COALESCE(sender.full_name, 'System Engine') as actor_name,
         COALESCE(sender.role, 'system') as actor_role
       FROM care_alerts a
       JOIN users pt ON pt.id = a.patient_id
       LEFT JOIN users sender ON sender.id = a.from_user_id
       ORDER BY a.created_at DESC
       LIMIT ${maxLimit}`
    );

    // 4. Appointment Requests
    const [appts] = await db.execute(
      `SELECT 
         'appointment' as event_type,
         ar.id,
         ar.status as outcome,
         ar.created_at as event_time,
         ar.created_at as logged_at,
         u.full_name as patient_name,
         u.patient_code,
         CONCAT('Appointment with ', d.name, ' (', COALESCE(d.specialization, 'General'), ')') as item_name,
         ar.message as item_sub,
         u.full_name as actor_name,
         u.role as actor_role
       FROM appointment_requests ar
       JOIN doctors d ON d.id = ar.doctor_id
       JOIN users u ON u.id = ar.user_id
       ORDER BY ar.created_at DESC
       LIMIT ${maxLimit}`
    );

    // Combine and sort by logged_at descending
    const allEvents = [...doses, ...notes, ...alerts, ...appts];
    allEvents.sort((a, b) => new Date(b.logged_at) - new Date(a.logged_at));

    const feed = allEvents.slice(0, maxLimit).map((r) => ({
      id: r.id,
      type: r.event_type,
      outcome: r.outcome,
      timestamp: r.logged_at,
      summary: r.item_name,
      details: r.item_sub,
      patient: {
        name: r.patient_name,
        patientCode: r.patient_code
      },
      actor: {
        name: r.actor_name,
        role: r.actor_role
      }
    }));

    res.json({ feed });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
