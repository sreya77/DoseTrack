const router = require('express').Router();
const db = require('../db');
const { requireAuth, logActivity } = require('../middleware/auth');

router.use(requireAuth);

// Helper to check access to patient data
async function canAccessPatient(userId, patientId) {
  if (Number(userId) === Number(patientId)) return true;
  const [u] = await db.execute('SELECT role FROM users WHERE id = ?', [userId]);
  if (u[0]?.role === 'admin') return true;
  const [rows] = await db.execute(
    'SELECT id FROM patient_connections WHERE patient_id = ? AND member_id = ?',
    [patientId, userId]
  );
  return rows.length > 0;
}

// Get care notes and vitals for a patient
router.get('/', async (req, res, next) => {
  try {
    const userId = req.user.id;
    let patientId = req.query.patientId;

    if (!patientId) {
      // If user is a patient, use their own id
      const [u] = await db.execute('SELECT role FROM users WHERE id = ?', [userId]);
      if (u[0]?.role === 'patient') {
        patientId = userId;
      } else {
        // For guardian or caretaker, pick their first connected patient
        const [conn] = await db.execute(
          'SELECT patient_id FROM patient_connections WHERE member_id = ? ORDER BY id ASC LIMIT 1',
          [userId]
        );
        if (!conn.length) return res.json({ notes: [] });
        patientId = conn[0].patient_id;
      }
    }

    if (!(await canAccessPatient(userId, patientId))) {
      return res.status(403).json({ error: 'You are not authorized to view notes for this patient.' });
    }

    const [notes] = await db.execute(
      `SELECT n.id, n.patient_id, n.note_type, n.content, n.vitals_json, n.created_at,
              u.id as author_id, u.full_name as author_name, u.role as author_role, u.avatar_color as author_avatar
       FROM care_notes n
       JOIN users u ON u.id = n.author_id
       WHERE n.patient_id = ?
       ORDER BY n.created_at DESC LIMIT 50`,
      [patientId]
    );

    res.json({
      patientId: Number(patientId),
      notes: notes.map((n) => {
        let vitals = null;
        if (n.vitals_json) {
          try {
            vitals = typeof n.vitals_json === 'string' ? JSON.parse(n.vitals_json) : n.vitals_json;
          } catch {
            vitals = null;
          }
        }
        return { ...n, vitals };
      })
    });
  } catch (e) {
    next(e);
  }
});

// Post a care note or vitals record
router.post('/', async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { patientId, noteType = 'general', content, vitals } = req.body;

    if (!patientId || !content?.trim()) {
      return res.status(400).json({ error: 'Patient ID and note description are required.' });
    }

    if (!(await canAccessPatient(userId, patientId))) {
      return res.status(403).json({ error: 'You do not have permission to post notes for this patient.' });
    }

    const [author] = await db.execute('SELECT full_name, role FROM users WHERE id = ?', [userId]);
    const authorName = author[0]?.full_name || 'Care Team';

    const vitalsJson = vitals && Object.keys(vitals).length ? JSON.stringify(vitals) : null;

    const [r] = await db.execute(
      `INSERT INTO care_notes (patient_id, author_id, note_type, content, vitals_json)
       VALUES (?, ?, ?, ?, ?)`,
      [patientId, userId, noteType, content.trim(), vitalsJson]
    );

    // Notify connected members (guardians & caretakers)
    const [connections] = await db.execute(
      `SELECT member_id FROM patient_connections WHERE patient_id = ? AND member_id != ?`,
      [patientId, userId]
    );

    const alertTitle = noteType === 'vitals' ? `Vitals Logged by ${authorName}` : `Care Note by ${authorName}`;
    const alertMsg = content.trim().length > 100 ? content.trim().slice(0, 97) + '...' : content.trim();

    // If author is not patient, also notify patient
    if (Number(userId) !== Number(patientId)) {
      await db.execute(
        `INSERT INTO care_alerts (patient_id, from_user_id, to_user_id, alert_type, title, message)
         VALUES (?, ?, ?, 'vitals_logged', ?, ?)`,
        [patientId, userId, patientId, alertTitle, alertMsg]
      );
    }

    // Notify all other members of the care circle
    for (const c of connections) {
      await db.execute(
        `INSERT INTO care_alerts (patient_id, from_user_id, to_user_id, alert_type, title, message)
         VALUES (?, ?, ?, 'vitals_logged', ?, ?)`,
        [patientId, userId, c.member_id, alertTitle, alertMsg]
      );
    }

    await logActivity(req, {
      actionType: noteType === 'vitals' ? 'VITALS_LOG' : 'CARE_NOTE_ADD',
      entityType: 'care_note',
      entityId: r.insertId,
      patientId,
      description: `${noteType === 'vitals' ? 'Logged vitals' : 'Posted care note'}: ${alertMsg}`,
      newValue: { noteType, content: content.trim(), vitals: vitals || null }
    });

    res.status(201).json({
      id: r.insertId,
      message: 'Care note recorded successfully.'
    });
  } catch (e) {
    next(e);
  }
});

// Edit a care note
router.put('/:id', async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { content, vitals } = req.body;
    const [existing] = await db.execute('SELECT * FROM care_notes WHERE id = ?', [req.params.id]);
    if (!existing.length) return res.status(404).json({ error: 'Note not found.' });

    const oldNote = existing[0];
    if (Number(oldNote.author_id) !== Number(userId) && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'You can only edit your own notes.' });
    }

    const vitalsJson = vitals ? JSON.stringify(vitals) : oldNote.vitals_json;
    await db.execute('UPDATE care_notes SET content = ?, vitals_json = ? WHERE id = ?', [content ? content.trim() : oldNote.content, vitalsJson, req.params.id]);

    await logActivity(req, {
      actionType: 'CARE_NOTE_EDIT',
      entityType: 'care_note',
      entityId: req.params.id,
      patientId: oldNote.patient_id,
      description: `Edited care note #${req.params.id}.`,
      oldValue: { content: oldNote.content, vitals: oldNote.vitals_json },
      newValue: { content: content ? content.trim() : oldNote.content, vitals }
    });

    res.json({ message: 'Care note updated.' });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
module.exports.canAccessPatient = canAccessPatient;
