const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { requireAuth, logActivity } = require('../middleware/auth');

const JWT_SECRET = process.env.JWT_SECRET || 'dosetrack_super_secret_jwt_key_2026_secure';

const tokenFor = (u) =>
  jwt.sign(
    { sub: u.id, email: u.email, role: u.role, fullName: u.full_name },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

// Generate unique readable patient code: DT-PT-XXXX
async function generatePatientCode() {
  for (let i = 0; i < 10; i++) {
    const code = 'DT-PT-' + Math.floor(1000 + Math.random() * 9000);
    const [rows] = await db.execute('SELECT id FROM users WHERE patient_code = ?', [code]);
    if (!rows.length) return code;
  }
  return 'DT-PT-' + Date.now().toString().slice(-4);
}

// Register
router.post('/register', async (req, res, next) => {
  try {
    const { fullName, email, phone, password, role = 'patient', emergencyContact, patientCodeToLink, relationship } = req.body;
    if (!fullName?.trim() || !email?.trim() || !password || password.length < 8) {
      return res.status(400).json({ error: 'Name, valid email, and password (at least 8 characters) are required.' });
    }

    const validRoles = ['patient', 'guardian', 'caretaker', 'admin'];
    const chosenRole = validRoles.includes(role) ? role : 'patient';
    const normalizedEmail = email.trim().toLowerCase();

    // Enforce unique email check
    const [existing] = await db.execute('SELECT id FROM users WHERE email = ?', [normalizedEmail]);
    if (existing.length) {
      return res.status(409).json({ error: 'An account with this email address already exists. Each email must have its own unique account.' });
    }

    const hash = await bcrypt.hash(password, 10);
    const assignedPatientCode = chosenRole === 'patient' ? await generatePatientCode() : null;
    const avatarColor = chosenRole === 'patient' ? '#0d9488' : chosenRole === 'guardian' ? '#6366f1' : chosenRole === 'admin' ? '#f59e0b' : '#0284c7';

    const [r] = await db.execute(
      `INSERT INTO users (full_name, role, patient_code, email, phone, emergency_contact, avatar_color, password_hash)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
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

    const newUserId = r.insertId;

    // If guardian or caretaker supplied a patient code to link right away
    if (chosenRole !== 'patient' && patientCodeToLink?.trim()) {
      const code = patientCodeToLink.trim().toUpperCase();
      const [ptRows] = await db.execute('SELECT id, full_name FROM users WHERE patient_code = ? AND role = "patient"', [code]);
      if (ptRows.length) {
        await db.execute(
          `INSERT INTO patient_connections (patient_id, member_id, relationship)
           VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE relationship = VALUES(relationship)`,
          [ptRows[0].id, newUserId, relationship?.trim() || (chosenRole === 'guardian' ? 'Family Guardian' : 'Assigned Caretaker')]
        );
        await db.execute(
          `INSERT INTO care_alerts (patient_id, from_user_id, to_user_id, alert_type, title, message)
           VALUES (?, ?, ?, 'nudge', 'Care Team Connected', ?)`,
          [ptRows[0].id, newUserId, ptRows[0].id, `${fullName.trim()} joined your care circle as ${chosenRole}.`]
        );
      }
    }

    const user = {
      id: newUserId,
      fullName: fullName.trim(),
      email: normalizedEmail,
      phone: phone?.trim() || '',
      role: chosenRole,
      patientCode: assignedPatientCode,
      emergencyContact: emergencyContact?.trim() || '',
      avatarColor
    };

    await logActivity(req, {
      actionType: 'REGISTER',
      entityType: 'user',
      entityId: newUserId,
      userId: newUserId,
      userRole: chosenRole,
      description: `${fullName.trim()} registered a new ${chosenRole} account.`,
      newValue: { fullName: fullName.trim(), email: normalizedEmail, role: chosenRole, patientCode: assignedPatientCode }
    });

    res.status(201).json({
      token: tokenFor(user),
      user
    });
  } catch (e) {
    next(e);
  }
});

// Login
router.post('/login', async (req, res, next) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = req.body.password || '';

    if (!email || !password) {
      return res.status(400).json({ error: 'Please enter both email and password.' });
    }

    const [rows] = await db.execute(
      `SELECT id, full_name, email, phone, role, patient_code, emergency_contact, avatar_color, is_active, password_hash 
       FROM users WHERE email = ?`,
      [email]
    );

    if (!rows.length || !(await bcrypt.compare(password, rows[0].password_hash))) {
      await logActivity(req, {
        actionType: 'LOGIN_FAILED',
        entityType: 'user',
        entityId: rows[0]?.id || null,
        userId: rows[0]?.id || null,
        userRole: rows[0]?.role || 'unknown',
        description: `Failed login attempt for email: ${email}`,
        newValue: { emailAttempted: email, failureReason: !rows.length ? 'User not found' : 'Incorrect password' }
      });
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const u = rows[0];

    if (u.is_active === 0 || u.is_active === false) {
      return res.status(403).json({ error: 'Your account has been deactivated. Please contact an administrator.' });
    }
    const user = {
      id: u.id,
      fullName: u.full_name,
      email: u.email,
      phone: u.phone || '',
      role: u.role || 'patient',
      patientCode: u.patient_code,
      emergencyContact: u.emergency_contact || '',
      avatarColor: u.avatar_color || '#0d9488'
    };

    await logActivity(req, {
      actionType: 'LOGIN_SUCCESS',
      entityType: 'user',
      entityId: user.id,
      userId: user.id,
      userRole: user.role,
      description: `${user.fullName} (${user.role}) successfully logged in.`,
      newValue: { email: user.email, role: user.role, fullName: user.fullName }
    });

    res.json({
      token: tokenFor(user),
      user
    });
  } catch (e) {
    next(e);
  }
});

// Logout
router.post('/logout', requireAuth, async (req, res) => {
  try {
    await logActivity(req, {
      actionType: 'LOGOUT',
      entityType: 'user',
      entityId: req.user.id,
      userId: req.user.id,
      userRole: req.user.role,
      description: `${req.user.fullName || 'User'} logged out.`
    });
    res.json({ message: 'Logged out successfully.' });
  } catch {
    res.json({ message: 'Logged out.' });
  }
});

// Update Profile
router.put('/profile', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { fullName, phone, emergencyContact } = req.body;

    const [oldRows] = await db.execute(
      'SELECT full_name, phone, emergency_contact FROM users WHERE id = ?',
      [userId]
    );
    if (!oldRows.length) return res.status(404).json({ error: 'User not found.' });

    const oldValue = oldRows[0];
    const newValue = {
      full_name: fullName ? fullName.trim() : oldValue.full_name,
      phone: phone !== undefined ? phone.trim() : oldValue.phone,
      emergency_contact: emergencyContact !== undefined ? emergencyContact.trim() : oldValue.emergency_contact
    };

    await db.execute(
      'UPDATE users SET full_name = ?, phone = ?, emergency_contact = ? WHERE id = ?',
      [newValue.full_name, newValue.phone, newValue.emergency_contact, userId]
    );

    await logActivity(req, {
      actionType: 'PROFILE_UPDATE',
      entityType: 'user',
      entityId: userId,
      userId,
      userRole: req.user.role,
      description: `${newValue.full_name} updated their profile information.`,
      oldValue,
      newValue
    });

    res.json({ message: 'Profile updated successfully.', user: newValue });
  } catch (e) {
    next(e);
  }
});

// Change Password
router.post('/change-password', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword || newPassword.length < 8) {
      return res.status(400).json({ error: 'Current password and new password (min 8 chars) are required.' });
    }

    const [rows] = await db.execute('SELECT password_hash, full_name, role FROM users WHERE id = ?', [userId]);
    if (!rows.length || !(await bcrypt.compare(currentPassword, rows[0].password_hash))) {
      return res.status(401).json({ error: 'Incorrect current password.' });
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    await db.execute('UPDATE users SET password_hash = ? WHERE id = ?', [newHash, userId]);

    await logActivity(req, {
      actionType: 'PASSWORD_CHANGE',
      entityType: 'user',
      entityId: userId,
      userId,
      userRole: rows[0].role,
      description: `${rows[0].full_name} changed their password.`,
      newValue: { passwordChanged: true, timestamp: new Date().toISOString() }
    });

    res.json({ message: 'Password changed successfully.' });
  } catch (e) {
    next(e);
  }
});

// Get current user profile
router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const [rows] = await db.execute(
      `SELECT id, full_name, email, phone, role, patient_code, emergency_contact, avatar_color 
       FROM users WHERE id = ?`,
      [req.user.id]
    );

    if (!rows.length) return res.status(404).json({ error: 'Account not found.' });

    const u = rows[0];
    res.json({
      user: {
        id: u.id,
        fullName: u.full_name,
        email: u.email,
        phone: u.phone || '',
        role: u.role || 'patient',
        patientCode: u.patient_code,
        emergencyContact: u.emergency_contact || '',
        avatarColor: u.avatar_color || '#0d9488'
      }
    });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
