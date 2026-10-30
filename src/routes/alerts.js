const router = require('express').Router();
const db = require('../db');
const { requireAuth, logActivity } = require('../middleware/auth');

router.use(requireAuth);

// Get alerts directed to current user
router.get('/', async (req, res, next) => {
  try {
    const userId = req.user.id;
    const [alerts] = await db.execute(
      `SELECT a.id, a.patient_id, a.from_user_id, a.alert_type, a.title, a.message, a.read_status, a.created_at,
              u.full_name as sender_name, u.role as sender_role,
              p.full_name as patient_name
       FROM care_alerts a
       LEFT JOIN users u ON u.id = a.from_user_id
       LEFT JOIN users p ON p.id = a.patient_id
       WHERE a.to_user_id = ?
       ORDER BY a.created_at DESC LIMIT 30`,
      [userId]
    );

    const [unread] = await db.execute(
      `SELECT COUNT(*) as count FROM care_alerts WHERE to_user_id = ? AND read_status = FALSE`,
      [userId]
    );

    res.json({
      unreadCount: Number(unread[0]?.count || 0),
      alerts
    });
  } catch (e) {
    next(e);
  }
});

// Send a friendly nudge from Guardian/Caretaker to Patient
router.post('/nudge', async (req, res, next) => {
  try {
    const senderId = req.user.id;
    const { patientId, message } = req.body;

    if (!patientId) {
      return res.status(400).json({ error: 'Patient ID is required.' });
    }

    const [sender] = await db.execute('SELECT full_name, role FROM users WHERE id = ?', [senderId]);
    const senderName = sender[0]?.full_name || 'Caregiver';

    const nudgeText = message?.trim() || 'Friendly reminder: please check your medication schedule for today!';

    const [r] = await db.execute(
      `INSERT INTO care_alerts (patient_id, from_user_id, to_user_id, alert_type, title, message)
       VALUES (?, ?, ?, 'nudge', ?, ?)`,
      [patientId, senderId, patientId, `Reminder from ${senderName}`, nudgeText]
    );

    await logActivity(req, {
      actionType: 'NUDGE_SENT',
      entityType: 'care_alert',
      entityId: r.insertId,
      patientId,
      description: `Sent a nudge: ${nudgeText}`,
      newValue: { patientId, message: nudgeText }
    });

    res.status(201).json({
      id: r.insertId,
      message: 'Nudge sent successfully to patient.'
    });
  } catch (e) {
    next(e);
  }
});

// Patient triggers Emergency SOS Alert
router.post('/sos', async (req, res, next) => {
  try {
    const patientId = req.user.id;
    const { message } = req.body;

    const [patient] = await db.execute(
      'SELECT full_name, phone, emergency_contact FROM users WHERE id = ?',
      [patientId]
    );

    const ptName = patient[0]?.full_name || 'Patient';
    const ptPhone = patient[0]?.phone || 'Unknown phone';
    const emergencyInfo = patient[0]?.emergency_contact ? ` (Emergency Contact: ${patient[0].emergency_contact})` : '';
    const alertBody = message?.trim() || `${ptName} triggered an urgent SOS alert from DoseTrack. Please check in immediately! Patient phone: ${ptPhone}${emergencyInfo}`;

    // Find all connected guardians and caretakers
    const [team] = await db.execute(
      `SELECT member_id FROM patient_connections WHERE patient_id = ?`,
      [patientId]
    );

    if (!team.length) {
      return res.status(400).json({
        error: 'No guardian or caretaker is currently connected to your account. Please add your emergency contact.'
      });
    }

    for (const member of team) {
      await db.execute(
        `INSERT INTO care_alerts (patient_id, from_user_id, to_user_id, alert_type, title, message)
         VALUES (?, ?, ?, 'sos', ?, ?)`,
        [patientId, patientId, member.member_id, `🚨 URGENT: SOS Alert from ${ptName}`, alertBody]
      );
    }

    await logActivity(req, {
      actionType: 'EMERGENCY_SOS_TRIGGERED',
      entityType: 'care_alert',
      entityId: patientId,
      patientId,
      description: `Triggered an emergency SOS alert to ${team.length} care-circle member(s).`,
      newValue: { message: alertBody, recipientCount: team.length }
    });

    res.status(201).json({
      message: `Emergency SOS broadcasted to ${team.length} care circle member(s). Help is being alerted!`,
      recipientCount: team.length
    });
  } catch (e) {
    next(e);
  }
});

// Mark single alert as read / acknowledged
router.patch('/:id/read', async (req, res, next) => {
  try {
    const userId = req.user.id;
    const [alert] = await db.execute('SELECT * FROM care_alerts WHERE id = ? AND to_user_id = ?', [req.params.id, userId]);
    if (!alert.length) return res.status(404).json({ error: 'Alert not found.' });

    await db.execute(
      'UPDATE care_alerts SET read_status = TRUE WHERE id = ? AND to_user_id = ?',
      [req.params.id, userId]
    );

    const a = alert[0];
    const isSos = a.alert_type === 'sos';
    await logActivity(req, {
      actionType: isSos ? 'EMERGENCY_SOS_ACKNOWLEDGED' : 'ALERT_ACKNOWLEDGED',
      entityType: 'care_alert',
      entityId: a.id,
      patientId: a.patient_id,
      description: `${isSos ? 'Acknowledged emergency SOS' : 'Acknowledged alert'}: "${a.title}".`,
      newValue: { alertId: a.id, alertType: a.alert_type, readStatus: true }
    });

    res.json({ message: 'Alert acknowledged.' });
  } catch (e) {
    next(e);
  }
});

// Mark all as read
router.post('/read-all', async (req, res, next) => {
  try {
    const userId = req.user.id;
    await db.execute(
      'UPDATE care_alerts SET read_status = TRUE WHERE to_user_id = ?',
      [userId]
    );
    res.json({ message: 'All alerts marked as read.' });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
