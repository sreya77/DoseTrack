const router = require('express').Router();
const bcrypt = require('bcryptjs');
const db = require('../../db');
const { logAudit } = require('../../middleware/auth');

// Utility to partially mask email and phone for privacy compliance in bulk lists
function maskEmail(email) {
  if (!email) return '';
  const parts = email.split('@');
  if (parts.length < 2) return '***';
  const name = parts[0];
  const domain = parts[1];
  const maskedName = name.length <= 2 ? name[0] + '***' : name[0] + '***' + name[name.length - 1];
  return `${maskedName}@${domain}`;
}

function maskPhone(phone) {
  if (!phone) return '—';
  // Keeps last 4 digits visible: (555) ***-5678
  const digits = phone.replace(/\D/g, '');
  if (digits.length <= 4) return '***';
  const visible = digits.slice(-4);
  return `(***) ***-${visible}`;
}

// Generate unique readable patient code: DT-PT-XXXX
async function generatePatientCode() {
  for (let i = 0; i < 10; i++) {
    const code = 'DT-PT-' + Math.floor(1000 + Math.random() * 9000);
    const [rows] = await db.execute('SELECT id FROM users WHERE patient_code = ?', [code]);
    if (!rows.length) return code;
  }
  return 'DT-PT-' + Date.now().toString().slice(-4);
}

/**
 * GET /api/admin/users
 * Search and filter users list (PII masked for list view privacy)
 */
router.get('/', async (req, res, next) => {
  try {
    const { search = '', role = '', status = '', page = 1, limit = 20 } = req.query;
    const offset = (Math.max(1, parseInt(page)) - 1) * parseInt(limit);
    const maxLimit = Math.min(100, Math.max(1, parseInt(limit)));

    let sqlWhere = 'WHERE 1=1';
    const params = [];

    if (search.trim()) {
      const q = `%${search.trim()}%`;
      sqlWhere += ' AND (full_name LIKE ? OR email LIKE ? OR phone LIKE ? OR patient_code LIKE ?)';
      params.push(q, q, q, q);
    }

    if (role && ['patient', 'guardian', 'caretaker', 'admin'].includes(role)) {
      sqlWhere += ' AND role = ?';
      params.push(role);
    }

    if (status === 'active') {
      sqlWhere += ' AND is_active = 1';
    } else if (status === 'inactive') {
      sqlWhere += ' AND is_active = 0';
    }

    // Get total count
    const [countRows] = await db.execute(`SELECT COUNT(*) as total FROM users ${sqlWhere}`, params);
    const total = Number(countRows[0]?.total || 0);

    // Get paginated users
    const [rows] = await db.execute(
      `SELECT id, full_name, role, patient_code, email, phone, is_active, avatar_color, created_at
       FROM users ${sqlWhere}
       ORDER BY created_at DESC
       LIMIT ${maxLimit} OFFSET ${offset}`,
      params
    );

    const users = rows.map((u) => ({
      id: u.id,
      fullName: u.full_name,
      role: u.role,
      patientCode: u.patient_code,
      maskedEmail: maskEmail(u.email),
      maskedPhone: maskPhone(u.phone),
      isActive: Boolean(u.is_active),
      avatarColor: u.avatar_color,
      createdAt: u.created_at
    }));

    res.json({
      users,
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
 * GET /api/admin/users/:id
 * Full unmasked details. Logs VIEW_PATIENT_HEALTH for clinical privacy audit.
 */
router.get('/:id', async (req, res, next) => {
  try {
    const userId = Number(req.params.id);
    const [rows] = await db.execute(
      `SELECT id, full_name, role, patient_code, email, phone, emergency_contact, is_active, avatar_color, created_at
       FROM users WHERE id = ?`,
      [userId]
    );

    if (!rows.length) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const u = rows[0];

    // Audit Log: View Sensitive Details
    if (u.role === 'patient') {
      await logAudit(
        req.user.id,
        'VIEW_PATIENT_HEALTH',
        'patient',
        u.id,
        `Admin accessed health profile and medications for patient ${u.full_name} (${u.patient_code}).`,
        req
      );
    } else {
      await logAudit(
        req.user.id,
        'VIEW_USER_DETAILS',
        'user',
        u.id,
        `Admin viewed profile details for ${u.full_name} [${u.role}].`,
        req
      );
    }

    // Additional contextual data depending on role
    let careTeam = [];
    let assignedPatients = [];
    let medications = [];
    let adherenceStats = null;

    if (u.role === 'patient') {
      // Connected Care Team
      const [team] = await db.execute(
        `SELECT pc.id as connection_id, pc.relationship, pc.can_manage_meds, pc.can_record_doses,
                m.id as member_id, m.full_name, m.role, m.email, m.phone, m.avatar_color
         FROM patient_connections pc
         JOIN users m ON m.id = pc.member_id
         WHERE pc.patient_id = ?`,
        [u.id]
      );
      careTeam = team;

      // Active Medications
      const [meds] = await db.execute(
        `SELECT m.id, m.name, m.dosage, m.frequency, m.instructions, m.start_date, m.end_date, m.is_active,
                GROUP_CONCAT(TIME_FORMAT(s.dose_time, '%H:%i') ORDER BY s.dose_time SEPARATOR ', ') as dose_times
         FROM medications m
         LEFT JOIN schedules s ON s.medication_id = m.id AND s.active = 1
         WHERE m.user_id = ?
         GROUP BY m.id`,
        [u.id]
      );
      medications = meds;

      // 30-day Adherence
      const [adh] = await db.execute(
        `SELECT 
           COUNT(*) as total,
           SUM(CASE WHEN status = 'taken' THEN 1 ELSE 0 END) as taken,
           SUM(CASE WHEN status = 'missed' THEN 1 ELSE 0 END) as missed
         FROM dose_events
         WHERE user_id = ? AND scheduled_for >= DATE_SUB(NOW(), INTERVAL 30 DAY)`,
        [u.id]
      );
      const total = Number(adh[0]?.total || 0);
      const taken = Number(adh[0]?.taken || 0);
      adherenceStats = {
        total,
        taken,
        missed: Number(adh[0]?.missed || 0),
        rate: total > 0 ? Math.round((taken / total) * 100) : 100
      };
    } else if (u.role === 'guardian' || u.role === 'caretaker') {
      const [pts] = await db.execute(
        `SELECT pc.id as connection_id, pc.relationship,
                p.id as patient_id, p.full_name, p.patient_code, p.email, p.phone, p.avatar_color
         FROM patient_connections pc
         JOIN users p ON p.id = pc.patient_id
         WHERE pc.member_id = ?`,
        [u.id]
      );
      assignedPatients = pts;
    }

    res.json({
      user: {
        id: u.id,
        fullName: u.full_name,
        role: u.role,
        patientCode: u.patient_code,
        email: u.email,
        phone: u.phone || '',
        emergencyContact: u.emergency_contact || '',
        isActive: Boolean(u.is_active),
        avatarColor: u.avatar_color,
        createdAt: u.created_at
      },
      careTeam,
      assignedPatients,
      medications,
      adherenceStats
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/admin/users
 * Add new user account (patient, guardian, caretaker, or admin)
 */
router.post('/', async (req, res, next) => {
  try {
    const { fullName, email, phone, role = 'patient', password, emergencyContact } = req.body;

    if (!fullName?.trim() || !email?.trim() || !password || password.length < 8) {
      return res.status(400).json({ error: 'Name, valid email, and password (at least 8 characters) are required.' });
    }

    const validRoles = ['patient', 'guardian', 'caretaker', 'admin'];
    const chosenRole = validRoles.includes(role) ? role : 'patient';
    const normalizedEmail = email.trim().toLowerCase();

    // Check unique email
    const [existing] = await db.execute('SELECT id FROM users WHERE email = ?', [normalizedEmail]);
    if (existing.length) {
      return res.status(409).json({ error: 'A user account with this email address already exists.' });
    }

    const hash = await bcrypt.hash(password, 10);
    const assignedPatientCode = chosenRole === 'patient' ? await generatePatientCode() : null;
    const avatarColor = chosenRole === 'patient' ? '#0d9488' : chosenRole === 'guardian' ? '#6366f1' : chosenRole === 'admin' ? '#f59e0b' : '#0284c7';

    const [result] = await db.execute(
      `INSERT INTO users (full_name, role, patient_code, email, phone, emergency_contact, avatar_color, is_active, password_hash)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)`,
      [
        fullName.trim(),
        chosenRole,
        assignedPatientCode,
        normalizedEmail,
        phone?.trim() || null,
        emergencyContact?.trim() || null,
        avatarColor,
        hash
      ]
    );

    const newUserId = result.insertId;

    // Log admin audit action
    await logAudit(
      req.user.id,
      'USER_CREATE',
      'user',
      newUserId,
      `Admin created new ${chosenRole} account for ${fullName.trim()} (${normalizedEmail}).`,
      req
    );

    res.status(201).json({
      message: 'User created successfully.',
      user: {
        id: newUserId,
        fullName: fullName.trim(),
        role: chosenRole,
        patientCode: assignedPatientCode,
        email: normalizedEmail,
        phone: phone?.trim() || '',
        isActive: true,
        avatarColor
      }
    });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/admin/users/:id
 * Edit existing user details
 */
router.put('/:id', async (req, res, next) => {
  try {
    const userId = Number(req.params.id);
    const { fullName, email, phone, role, emergencyContact } = req.body;

    if (!fullName?.trim() || !email?.trim()) {
      return res.status(400).json({ error: 'Name and email are required.' });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Check email uniqueness against other users
    const [existing] = await db.execute('SELECT id FROM users WHERE email = ? AND id != ?', [normalizedEmail, userId]);
    if (existing.length) {
      return res.status(409).json({ error: 'Another user account already uses this email address.' });
    }

    const validRoles = ['patient', 'guardian', 'caretaker', 'admin'];
    const chosenRole = validRoles.includes(role) ? role : undefined;

    let updateSql = `
      UPDATE users 
      SET full_name = ?, email = ?, phone = ?, emergency_contact = ?
    `;
    const params = [fullName.trim(), normalizedEmail, phone?.trim() || null, emergencyContact?.trim() || null];

    if (chosenRole) {
      updateSql += ', role = ?';
      params.push(chosenRole);
    }

    updateSql += ' WHERE id = ?';
    params.push(userId);

    await db.execute(updateSql, params);

    await logAudit(
      req.user.id,
      'USER_UPDATE',
      'user',
      userId,
      `Admin updated profile for user ID ${userId} (${fullName.trim()}).`,
      req
    );

    res.json({ message: 'User updated successfully.' });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/admin/users/:id/toggle-status
 * Activate or Deactivate an account
 */
router.patch('/:id/toggle-status', async (req, res, next) => {
  try {
    const userId = Number(req.params.id);

    if (userId === req.user.id) {
      return res.status(400).json({ error: 'You cannot deactivate your own active administrative account.' });
    }

    const [rows] = await db.execute('SELECT full_name, is_active FROM users WHERE id = ?', [userId]);
    if (!rows.length) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const newStatus = rows[0].is_active ? 0 : 1;
    await db.execute('UPDATE users SET is_active = ? WHERE id = ?', [newStatus, userId]);

    const action = newStatus ? 'ACTIVATE_USER' : 'DEACTIVATE_USER';
    await logAudit(
      req.user.id,
      action,
      'user',
      userId,
      `Admin changed account status to ${newStatus ? 'ACTIVE' : 'DEACTIVATED'} for ${rows[0].full_name}.`,
      req
    );

    res.json({
      message: `User ${newStatus ? 'activated' : 'deactivated'} successfully.`,
      isActive: Boolean(newStatus)
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/admin/users/:id/reset-password
 * Reset password for a user
 */
router.post('/:id/reset-password', async (req, res, next) => {
  try {
    const userId = Number(req.params.id);
    let newPassword = req.body.password;

    if (!newPassword || newPassword.trim().length < 8) {
      // Auto-generate strong 10-char password if not provided
      newPassword = Math.random().toString(36).slice(-8) + 'Aa!';
    }

    const [userRow] = await db.execute('SELECT full_name FROM users WHERE id = ?', [userId]);
    if (!userRow.length) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const hash = await bcrypt.hash(newPassword, 10);
    await db.execute('UPDATE users SET password_hash = ? WHERE id = ?', [hash, userId]);

    await logAudit(
      req.user.id,
      'RESET_PASSWORD',
      'user',
      userId,
      `Admin reset password for ${userRow[0].full_name} (ID: ${userId}).`,
      req
    );

    res.json({
      message: `Password reset successfully for ${userRow[0].full_name}.`,
      newPassword: req.body.password ? undefined : newPassword
    });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/admin/users/:id
 * Delete a user account (cascades records)
 */
router.delete('/:id', async (req, res, next) => {
  try {
    const userId = Number(req.params.id);

    if (userId === req.user.id) {
      return res.status(400).json({ error: 'Security restriction: You cannot delete your own administrative account.' });
    }

    const [userRow] = await db.execute('SELECT full_name, email, role FROM users WHERE id = ?', [userId]);
    if (!userRow.length) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const deletedUser = userRow[0];
    await db.execute('DELETE FROM users WHERE id = ?', [userId]);

    await logAudit(
      req.user.id,
      'DELETE_USER',
      'user',
      userId,
      `Admin permanently deleted ${deletedUser.role} account: ${deletedUser.full_name} (${deletedUser.email}).`,
      req
    );

    res.json({ message: `Account for ${deletedUser.full_name} deleted successfully.` });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

