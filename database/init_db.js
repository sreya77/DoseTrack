require('dotenv').config();
const db = require('../src/db');

async function init() {
  console.log('[Init] Ensuring DoseTrack tables and database schema...');

  // 1. Create Base & Relational Tables if they do not exist
  await db.query(`
    CREATE TABLE IF NOT EXISTS users (
      id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
      full_name VARCHAR(120) NOT NULL,
      role ENUM('patient', 'guardian', 'caretaker', 'admin') NOT NULL DEFAULT 'patient',
      patient_code VARCHAR(20) UNIQUE NULL,
      email VARCHAR(190) NOT NULL UNIQUE,
      phone VARCHAR(30) NULL,
      emergency_contact VARCHAR(120) NULL,
      avatar_color VARCHAR(30) DEFAULT '#0d9488',
      password_hash VARCHAR(255) NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS medications (
      id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
      user_id BIGINT UNSIGNED NOT NULL,
      name VARCHAR(160) NOT NULL,
      dosage VARCHAR(100) NOT NULL,
      quantity VARCHAR(100),
      frequency VARCHAR(100) NOT NULL,
      instructions TEXT,
      start_date DATE NOT NULL,
      end_date DATE,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      INDEX idx_med_user_dates (user_id, start_date, end_date)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS schedules (
      id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
      medication_id BIGINT UNSIGNED NOT NULL,
      user_id BIGINT UNSIGNED NOT NULL,
      dose_time TIME NOT NULL,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (medication_id) REFERENCES medications(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE KEY uq_medication_dose_time (medication_id, dose_time),
      INDEX idx_schedule_user_active (user_id, active)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS dose_events (
      id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
      schedule_id BIGINT UNSIGNED NOT NULL,
      medication_id BIGINT UNSIGNED NOT NULL,
      user_id BIGINT UNSIGNED NOT NULL,
      scheduled_for DATETIME NOT NULL,
      status ENUM('taken', 'missed') NOT NULL,
      recorded_by_id BIGINT UNSIGNED NULL,
      recorded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (schedule_id) REFERENCES schedules(id) ON DELETE CASCADE,
      FOREIGN KEY (medication_id) REFERENCES medications(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE KEY uq_dose_event (schedule_id, scheduled_for),
      INDEX idx_events_user_date (user_id, scheduled_for)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS doctors (
      id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
      user_id BIGINT UNSIGNED NOT NULL,
      name VARCHAR(160) NOT NULL,
      specialization VARCHAR(160),
      clinic_name VARCHAR(200),
      phone VARCHAR(30),
      email VARCHAR(190),
      availability VARCHAR(200),
      clinic_address TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS appointment_requests (
      id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
      doctor_id BIGINT UNSIGNED NOT NULL,
      user_id BIGINT UNSIGNED NOT NULL,
      requested_date DATE,
      message TEXT,
      status ENUM('requested', 'confirmed', 'cancelled') NOT NULL DEFAULT 'requested',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS reminder_logs (
      id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
      schedule_id BIGINT UNSIGNED NOT NULL,
      user_id BIGINT UNSIGNED NOT NULL,
      scheduled_for DATETIME NOT NULL,
      delivered_via ENUM('dashboard', 'email', 'sms', 'push') NOT NULL DEFAULT 'dashboard',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_reminder_log (schedule_id, scheduled_for, delivered_via),
      FOREIGN KEY (schedule_id) REFERENCES schedules(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS patient_connections (
      id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
      patient_id BIGINT UNSIGNED NOT NULL,
      member_id BIGINT UNSIGNED NOT NULL,
      relationship VARCHAR(80) NOT NULL,
      can_manage_meds BOOLEAN NOT NULL DEFAULT TRUE,
      can_record_doses BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (patient_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (member_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE KEY uq_patient_member (patient_id, member_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS care_notes (
      id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
      patient_id BIGINT UNSIGNED NOT NULL,
      author_id BIGINT UNSIGNED NOT NULL,
      note_type ENUM('general', 'vitals', 'symptom', 'nudge', 'alert') NOT NULL DEFAULT 'general',
      content TEXT NOT NULL,
      vitals_json JSON NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (patient_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE,
      INDEX idx_notes_patient (patient_id, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS care_alerts (
      id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
      patient_id BIGINT UNSIGNED NOT NULL,
      from_user_id BIGINT UNSIGNED NULL,
      to_user_id BIGINT UNSIGNED NOT NULL,
      alert_type ENUM('dose_missed', 'dose_taken', 'nudge', 'sos', 'med_changed', 'vitals_logged') NOT NULL,
      title VARCHAR(160) NOT NULL,
      message TEXT NOT NULL,
      read_status BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (patient_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (to_user_id) REFERENCES users(id) ON DELETE CASCADE,
      INDEX idx_alerts_user (to_user_id, read_status, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // Admin Audit Log table
  await db.query(`
    CREATE TABLE IF NOT EXISTS admin_audit_log (
      id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
      admin_id BIGINT UNSIGNED NOT NULL,
      action VARCHAR(100) NOT NULL,
      target_type VARCHAR(60) NULL,
      target_id VARCHAR(60) NULL,
      details TEXT NULL,
      ip_address VARCHAR(45) NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE CASCADE,
      INDEX idx_audit_admin (admin_id, created_at),
      INDEX idx_audit_action (action, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // System-wide activity log for ALL user roles (patient, guardian, caretaker)
  await db.query(`
    CREATE TABLE IF NOT EXISTS user_activity_log (
      id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
      actor_id BIGINT UNSIGNED NULL,
      actor_name VARCHAR(120) NULL,
      actor_role VARCHAR(20) NULL,
      action VARCHAR(80) NOT NULL,
      target_type VARCHAR(40) NULL,
      target_id VARCHAR(60) NULL,
      patient_id BIGINT UNSIGNED NULL,
      details TEXT NULL,
      ip_address VARCHAR(45) NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE SET NULL,
      INDEX idx_activity_actor (actor_id, created_at),
      INDEX idx_activity_patient (patient_id, created_at),
      INDEX idx_activity_action (action, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // Application Settings table
  await db.query(`
    CREATE TABLE IF NOT EXISTS app_settings (
      id INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
      setting_key VARCHAR(80) NOT NULL UNIQUE,
      setting_value VARCHAR(255) NOT NULL,
      description VARCHAR(255) NULL,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // Default app settings
  await db.query(`
    INSERT INTO app_settings (setting_key, setting_value, description)
    VALUES 
      ('grace_period_mins', '30', 'Grace period in minutes before a scheduled dose is flagged as missed'),
      ('snooze_duration_mins', '10', 'Default snooze duration in minutes for patient reminders'),
      ('default_reminder_channel', 'dashboard', 'Default reminder delivery channel (dashboard, email, sms, push)'),
      ('adherence_risk_threshold', '70', 'Adherence percentage threshold below which a patient is flagged At Risk'),
      ('system_announcement', 'Welcome to the DoseTrack Clinical Administration Portal.', 'System banner announcement for clinical staff')
    ON DUPLICATE KEY UPDATE description = VALUES(description)
  `);

  // 2. Helper to safely add column if missing on legacy/pre-existing tables
  async function ensureColumn(table, column, definition) {
    try {
      const [cols] = await db.query(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
        [table, column]
      );
      if (!cols.length) {
        console.log(`[Init] Adding missing column ${column} to ${table}...`);
        await db.query(`ALTER TABLE \`${table}\` ADD COLUMN ${definition}`);
      }
    } catch (e) {
      console.warn(`[Init] Note on column ${table}.${column}:`, e.message);
    }
  }

  // Ensure users columns for legacy schema migrations
  await ensureColumn('users', 'role', "role ENUM('patient', 'guardian', 'caretaker', 'admin') NOT NULL DEFAULT 'patient'");
  try {
    await db.query("ALTER TABLE users MODIFY COLUMN role ENUM('patient', 'guardian', 'caretaker', 'admin') NOT NULL DEFAULT 'patient'");
  } catch (err) {
    console.warn('[Init] Note on users.role ENUM update:', err.message);
  }
  await ensureColumn('users', 'is_active', "is_active BOOLEAN NOT NULL DEFAULT TRUE");
  await ensureColumn('users', 'patient_code', "patient_code VARCHAR(20) UNIQUE NULL");
  await ensureColumn('users', 'emergency_contact', "emergency_contact VARCHAR(120) NULL");
  await ensureColumn('users', 'avatar_color', "avatar_color VARCHAR(30) DEFAULT '#0d9488'");
  await ensureColumn('medications', 'is_active', "is_active BOOLEAN NOT NULL DEFAULT TRUE");
  await ensureColumn('dose_events', 'recorded_by_id', "recorded_by_id BIGINT UNSIGNED NULL");

  // 3. Ensure a system administrator account always exists (idempotent)
  try {
    const bcrypt = require('bcryptjs');
    const adminEmail = (process.env.ADMIN_EMAIL || 'admin@dosetrack.com').trim().toLowerCase();
    const adminPassword = process.env.ADMIN_PASSWORD || 'password123';
    const [existingAdmin] = await db.query(`SELECT id, role FROM users WHERE email = ?`, [adminEmail]);

    if (!existingAdmin.length) {
      const hash = await bcrypt.hash(adminPassword, 10);
      await db.query(
        `INSERT INTO users (full_name, role, patient_code, email, phone, emergency_contact, avatar_color, is_active, password_hash)
         VALUES (?, 'admin', NULL, ?, '(555) 000-ADMIN', NULL, '#f59e0b', 1, ?)`,
        ['Dr. Alexander Wright (Admin)', adminEmail, hash]
      );
      console.log(`[Init] Created administrator account ${adminEmail}.`);
    } else {
      if (existingAdmin[0].role !== 'admin') {
        await db.query(`UPDATE users SET role = 'admin' WHERE id = ?`, [existingAdmin[0].id]);
        console.log(`[Init] Promoted ${adminEmail} to administrator.`);
      }
      // Only reset the password when explicitly provided via env
      if (process.env.ADMIN_PASSWORD) {
        const hash = await bcrypt.hash(adminPassword, 10);
        await db.query(`UPDATE users SET password_hash = ?, is_active = 1 WHERE id = ?`, [hash, existingAdmin[0].id]);
        console.log(`[Init] Reset administrator password from ADMIN_PASSWORD env.`);
      }
    }
  } catch (adminErr) {
    console.warn('[Init] Admin account check warning:', adminErr.message);
  }

  // 4. Auto-seed demo accounts if database has 0 users
  try {
    const [rows] = await db.query(`SELECT COUNT(*) AS count FROM users`);
    if (rows && rows[0] && Number(rows[0].count) === 0) {
      console.log('[Init] Fresh database detected (0 users). Auto-seeding initial demo accounts...');
      const { seed } = require('./seed_demo');
      await seed();
      console.log('[Init] Demo accounts successfully initialized.');
    }
  } catch (seedErr) {
    console.warn('[Init] Auto-seed check warning:', seedErr.message);
  }

  console.log('[Init] Database schema verified and updated successfully.');
}

if (require.main === module) {
  init().then(() => process.exit(0)).catch(err => {
    console.error('[Init] Error:', err);
    process.exit(1);
  });
}

module.exports = { init };
