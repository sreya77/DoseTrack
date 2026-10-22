require('dotenv').config();
const db = require('../src/db');
const bcrypt = require('bcryptjs');

async function init() {
  console.log('[Init] Checking and updating database schema...');

  // Helper to safely add column if missing
  async function ensureColumn(table, column, definition) {
    const [cols] = await db.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
      [table, column]
    );
    if (!cols.length) {
      console.log(`[Init] Adding column ${column} to ${table}...`);
      await db.query(`ALTER TABLE \`${table}\` ADD COLUMN ${definition}`);
    }
  }

  // Ensure users columns
  await ensureColumn('users', 'role', "role ENUM('patient', 'guardian', 'caretaker') NOT NULL DEFAULT 'patient'");
  await ensureColumn('users', 'patient_code', "patient_code VARCHAR(20) UNIQUE NULL");
  await ensureColumn('users', 'emergency_contact', "emergency_contact VARCHAR(120) NULL");
  await ensureColumn('users', 'avatar_color', "avatar_color VARCHAR(30) DEFAULT '#0d9488'");

  // Ensure connections table
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
    )
  `);

  // Ensure care_notes table
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
    )
  `);

  // Ensure care_alerts table
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
    )
  `);

  // Ensure recorded_by_id on dose_events
  await ensureColumn('dose_events', 'recorded_by_id', "recorded_by_id BIGINT UNSIGNED NULL");

  console.log('[Init] Database schema verified and updated successfully.');
}

if (require.main === module) {
  init().then(() => process.exit(0)).catch(err => {
    console.error('[Init] Error:', err);
    process.exit(1);
  });
}

module.exports = { init };
