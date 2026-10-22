-- Add role and profile fields to users table if not existing
ALTER TABLE users 
  ADD COLUMN IF NOT EXISTS role ENUM('patient', 'guardian', 'caretaker') NOT NULL DEFAULT 'patient' AFTER full_name,
  ADD COLUMN IF NOT EXISTS patient_code VARCHAR(20) UNIQUE NULL AFTER role,
  ADD COLUMN IF NOT EXISTS emergency_contact VARCHAR(120) NULL AFTER phone,
  ADD COLUMN IF NOT EXISTS avatar_color VARCHAR(30) DEFAULT '#0d9488' AFTER emergency_contact;

-- Table for connecting Guardians & Caretakers to Patients
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
);

-- Table for Care Notes, Vitals & Observations logged by Caretakers or Guardians
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
);

-- Table for Alerts, Nudges, Missed Doses, and Emergency SOS notifications
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
);

-- Enhance dose_events to track who recorded the dose
ALTER TABLE dose_events
  ADD COLUMN IF NOT EXISTS recorded_by_id BIGINT UNSIGNED NULL AFTER status;
