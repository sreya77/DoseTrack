-- ============================================================================
-- DoseTrack Admin Panel Database Migration
-- Adds admin role, is_active flags, admin audit log, and app settings
-- Non-destructive: preserves all existing patient, guardian, caretaker data
-- ============================================================================

-- 1. Update users table: support 'admin' role and add is_active status
ALTER TABLE users 
  MODIFY COLUMN role ENUM('patient', 'guardian', 'caretaker', 'admin') NOT NULL DEFAULT 'patient';

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE AFTER avatar_color;

-- Add index on role for fast filtering in admin panel
ALTER TABLE users
  ADD INDEX IF NOT EXISTS idx_users_role (role, is_active);

-- 2. Update medications table: add is_active status for administrative deactivation
ALTER TABLE medications
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE AFTER end_date;

ALTER TABLE medications
  ADD INDEX IF NOT EXISTS idx_med_active (user_id, is_active);

-- 3. Create Admin Audit Log table to track all administrative and sensitive access
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Create App Settings table for configurable system parameters
CREATE TABLE IF NOT EXISTS app_settings (
  id INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  setting_key VARCHAR(80) NOT NULL UNIQUE,
  setting_value VARCHAR(255) NOT NULL,
  description VARCHAR(255) NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Seed default system parameters
INSERT INTO app_settings (setting_key, setting_value, description)
VALUES 
  ('grace_period_mins', '30', 'Grace period in minutes before a scheduled dose is flagged as missed'),
  ('snooze_duration_mins', '10', 'Default snooze duration in minutes for patient reminders'),
  ('default_reminder_channel', 'dashboard', 'Default reminder delivery channel (dashboard, email, sms, push)'),
  ('adherence_risk_threshold', '70', 'Adherence percentage threshold below which a patient is flagged At Risk'),
  ('system_announcement', 'Welcome to the DoseTrack Clinical Administration Portal.', 'System banner announcement for clinical staff')
ON DUPLICATE KEY UPDATE 
  description = VALUES(description);

