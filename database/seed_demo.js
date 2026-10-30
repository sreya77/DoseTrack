require('dotenv').config();
const db = require('../src/db');
const bcrypt = require('bcryptjs');

async function seed() {
  console.log('[Seed] Seeding connected demo accounts...');
  const hash = await bcrypt.hash('password123', 10);

  // 1. Patient: Eleanor Vance
  await db.query(
    `INSERT INTO users (full_name, role, patient_code, email, phone, emergency_contact, avatar_color, password_hash)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE 
       full_name = VALUES(full_name),
       role = VALUES(role),
       patient_code = VALUES(patient_code),
       phone = VALUES(phone),
       emergency_contact = VALUES(emergency_contact),
       avatar_color = VALUES(avatar_color),
       password_hash = VALUES(password_hash)`,
    [
      'Eleanor Vance',
      'patient',
      'DT-PT-1001',
      'patient@dosetrack.com',
      '(555) 234-5678',
      'David Vance (Son) - (555) 876-5432',
      '#0d9488',
      hash
    ]
  );
  const [[patient]] = await db.query(`SELECT id FROM users WHERE email = 'patient@dosetrack.com'`);
  const patientId = patient.id;

  // 2. Guardian: David Vance
  await db.query(
    `INSERT INTO users (full_name, role, patient_code, email, phone, emergency_contact, avatar_color, password_hash)
     VALUES (?, ?, NULL, ?, ?, NULL, ?, ?)
     ON DUPLICATE KEY UPDATE 
       full_name = VALUES(full_name),
       role = VALUES(role),
       phone = VALUES(phone),
       avatar_color = VALUES(avatar_color),
       password_hash = VALUES(password_hash)`,
    [
      'David Vance',
      'guardian',
      'guardian@dosetrack.com',
      '(555) 876-5432',
      '#6366f1',
      hash
    ]
  );
  const [[guardian]] = await db.query(`SELECT id FROM users WHERE email = 'guardian@dosetrack.com'`);
  const guardianId = guardian.id;

  // 3. Caretaker: Nurse Sarah Miller
  await db.query(
    `INSERT INTO users (full_name, role, patient_code, email, phone, emergency_contact, avatar_color, password_hash)
     VALUES (?, ?, NULL, ?, ?, NULL, ?, ?)
     ON DUPLICATE KEY UPDATE 
       full_name = VALUES(full_name),
       role = VALUES(role),
       phone = VALUES(phone),
       avatar_color = VALUES(avatar_color),
       password_hash = VALUES(password_hash)`,
    [
      'Nurse Sarah Miller, RN',
      'caretaker',
      'caretaker@dosetrack.com',
      '(555) 998-1122',
      '#0284c7',
      hash
    ]
  );
  const [[caretaker]] = await db.query(`SELECT id FROM users WHERE email = 'caretaker@dosetrack.com'`);
  const caretakerId = caretaker.id;

  // 4. Admin: Dr. Alexander Wright
  await db.query(
    `INSERT INTO users (full_name, role, patient_code, email, phone, emergency_contact, avatar_color, is_active, password_hash)
     VALUES (?, ?, NULL, ?, ?, NULL, ?, 1, ?)
     ON DUPLICATE KEY UPDATE 
       full_name = VALUES(full_name),
       role = VALUES(role),
       phone = VALUES(phone),
       avatar_color = VALUES(avatar_color),
       is_active = 1,
       password_hash = VALUES(password_hash)`,
    [
      'Dr. Alexander Wright (Admin)',
      'admin',
      'admin@dosetrack.com',
      '(555) 000-ADMIN',
      '#f59e0b',
      hash
    ]
  );
  const [[adminUser]] = await db.query(`SELECT id FROM users WHERE email = 'admin@dosetrack.com'`);
  const adminId = adminUser?.id;

  // Ensure is_active is 1 on existing users
  await db.query(`UPDATE users SET is_active = 1 WHERE is_active IS NULL OR is_active = 0`);

  // 5. Update the legacy demo account to also be a patient
  await db.query(
    `UPDATE users SET role = 'patient', patient_code = 'DT-PT-9999' WHERE email = 'demo@dosetrack.com'`
  );

  // 5. Connect Guardian & Caretaker to Eleanor
  await db.query(
    `INSERT INTO patient_connections (patient_id, member_id, relationship)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE relationship = VALUES(relationship)`,
    [patientId, guardianId, 'Son & Primary Guardian']
  );

  await db.query(
    `INSERT INTO patient_connections (patient_id, member_id, relationship)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE relationship = VALUES(relationship)`,
    [patientId, caretakerId, 'Home Health Nurse']
  );

  // 6. Medications for Eleanor
  const meds = [
    {
      name: 'Lisinopril',
      dosage: '10mg',
      quantity: '1 tablet',
      frequency: 'Once daily',
      instructions: 'Take with a glass of water in the morning with breakfast.',
      startDate: '2026-01-01',
      times: ['08:00']
    },
    {
      name: 'Metformin',
      dosage: '500mg',
      quantity: '1 tablet',
      frequency: 'Twice daily',
      instructions: 'Take after meals to reduce stomach upset.',
      startDate: '2026-01-01',
      times: ['08:30', '19:30']
    },
    {
      name: 'Atorvastatin',
      dosage: '20mg',
      quantity: '1 tablet',
      frequency: 'Once daily',
      instructions: 'Take at night before bed.',
      startDate: '2026-01-01',
      times: ['21:00']
    }
  ];

  for (const m of meds) {
    let [[existing]] = await db.query(
      `SELECT id FROM medications WHERE user_id = ? AND name = ?`,
      [patientId, m.name]
    );
    let medId;
    if (!existing) {
      const [r] = await db.query(
        `INSERT INTO medications (user_id, name, dosage, quantity, frequency, instructions, start_date)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [patientId, m.name, m.dosage, m.quantity, m.frequency, m.instructions, m.startDate]
      );
      medId = r.insertId;
    } else {
      medId = existing.id;
    }

    for (const t of m.times) {
      await db.query(
        `INSERT INTO schedules (medication_id, user_id, dose_time, active)
         VALUES (?, ?, ?, 1)
         ON DUPLICATE KEY UPDATE active = 1`,
        [medId, patientId, t + ':00']
      );
    }
  }

  // 7. Seed Today's Doses (08:00 Taken, 08:30 Taken)
  const [schedules] = await db.query(
    `SELECT s.id, s.medication_id, s.dose_time FROM schedules s WHERE s.user_id = ?`,
    [patientId]
  );
  const todayStr = new Date().toISOString().slice(0, 10);
  for (const s of schedules) {
    const timeStr = String(s.dose_time).slice(0, 5);
    if (timeStr === '08:00' || timeStr === '08:30') {
      const scheduledFor = `${todayStr} ${timeStr}:00`;
      await db.query(
        `INSERT INTO dose_events (schedule_id, medication_id, user_id, scheduled_for, status, recorded_by_id)
         VALUES (?, ?, ?, ?, 'taken', ?)
         ON DUPLICATE KEY UPDATE status = 'taken'`,
        [s.id, s.medication_id, patientId, scheduledFor, patientId]
      );
    }
  }

  // Seed past 7 days history so adherence is high and realistic
  for (let i = 1; i <= 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    for (const s of schedules) {
      const timeStr = String(s.dose_time).slice(0, 5);
      const isMissed = (i === 3 && timeStr === '21:00'); // only 1 missed dose
      const status = isMissed ? 'missed' : 'taken';
      const scheduledFor = `${dateStr} ${timeStr}:00`;
      await db.query(
        `INSERT INTO dose_events (schedule_id, medication_id, user_id, scheduled_for, status, recorded_by_id)
         VALUES (?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE status = VALUES(status)`,
        [s.id, s.medication_id, patientId, scheduledFor, status, patientId]
      );
    }
  }

  // 8. Doctors for Eleanor
  const doctors = [
    {
      name: 'Dr. Robert Chen, MD',
      specialization: 'Cardiology',
      clinic_name: 'Hope Valley Heart Clinic',
      phone: '(555) 345-6789',
      email: 'dr.chen@hopevalley.org',
      availability: 'Mon, Wed, Fri 9am - 3pm',
      clinic_address: 'Suite 400, 100 Medical Center Way'
    },
    {
      name: 'Dr. Emily Watson, MD',
      specialization: 'Endocrinology',
      clinic_name: 'City Health Endocrinology',
      phone: '(555) 456-7890',
      email: 'dr.watson@cityhealth.org',
      availability: 'Tue, Thu 10am - 4pm',
      clinic_address: 'Bldg B, 250 Health Parkway'
    }
  ];

  for (const doc of doctors) {
    const [[existingDoc]] = await db.query(
      `SELECT id FROM doctors WHERE user_id = ? AND name = ?`,
      [patientId, doc.name]
    );
    if (!existingDoc) {
      await db.query(
        `INSERT INTO doctors (user_id, name, specialization, clinic_name, phone, email, availability, clinic_address)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [patientId, doc.name, doc.specialization, doc.clinic_name, doc.phone, doc.email, doc.availability, doc.clinic_address]
      );
    }
  }

  // Seed sample appointment requests
  const [[firstDoc]] = await db.query(`SELECT id FROM doctors WHERE user_id = ? LIMIT 1`, [patientId]);
  if (firstDoc) {
    const [appts] = await db.query(`SELECT id FROM appointment_requests WHERE user_id = ?`, [patientId]);
    if (!appts.length) {
      await db.query(
        `INSERT INTO appointment_requests (doctor_id, user_id, requested_date, message, status)
         VALUES 
           (?, ?, DATE_ADD(CURDATE(), INTERVAL 3 DAY), 'Quarterly blood pressure review and prescription renewal check.', 'requested'),
           (?, ?, DATE_SUB(CURDATE(), INTERVAL 14 DAY), 'Routine Endocrinology follow-up for A1C test review.', 'confirmed')`,
        [firstDoc.id, patientId, firstDoc.id, patientId]
      );
    }
  }

  // 9. Care Notes & Vitals logged by Nurse Sarah
  await db.query(`DELETE FROM care_notes WHERE patient_id = ?`, [patientId]);
  await db.query(
    `INSERT INTO care_notes (patient_id, author_id, note_type, content, vitals_json)
     VALUES (?, ?, 'vitals', ?, ?)`,
    [
      patientId,
      caretakerId,
      'Morning wellness check completed. Eleanor reported good sleep and took morning medications with breakfast. Vitals are stable.',
      JSON.stringify({
        blood_pressure: '122/80 mmHg',
        heart_rate: '72 bpm',
        blood_glucose: '108 mg/dL',
        oxygen_saturation: '98%'
      })
    ]
  );

  await db.query(
    `INSERT INTO care_notes (patient_id, author_id, note_type, content, vitals_json)
     VALUES (?, ?, 'general', ?, NULL)`,
    [
      patientId,
      guardianId,
      'Spoke with Mom this morning. She mentioned her Lisinopril prescription is down to 5 days remaining. Refill requested with Dr. Chen.'
    ]
  );

  // 10. Care Alerts
  await db.query(`DELETE FROM care_alerts WHERE patient_id = ?`, [patientId]);
  await db.query(
    `INSERT INTO care_alerts (patient_id, from_user_id, to_user_id, alert_type, title, message)
     VALUES (?, ?, ?, 'nudge', 'Reminder from David', 'Hi Mom! Remember to drink plenty of water after your afternoon walk.')`,
    [patientId, guardianId, patientId]
  );

  await db.query(
    `INSERT INTO care_alerts (patient_id, from_user_id, to_user_id, alert_type, title, message)
     VALUES (?, ?, ?, 'vitals_logged', 'New Vitals Recorded', 'Nurse Sarah Miller recorded morning vitals: BP 122/80, Glucose 108 mg/dL.')`,
    [patientId, caretakerId, guardianId]
  );

  await db.query(
    `INSERT INTO care_alerts (patient_id, from_user_id, to_user_id, alert_type, title, message)
     VALUES (?, ?, ?, 'dose_taken', 'Dose Completed', 'Eleanor Vance took morning Lisinopril 10mg on time.')`,
    [patientId, patientId, guardianId]
  );

  // 11. Second Patient (At-Risk Adherence Demo): Robert Fox
  await db.query(
    `INSERT INTO users (full_name, role, patient_code, email, phone, emergency_contact, avatar_color, is_active, password_hash)
     VALUES (?, 'patient', 'DT-PT-1002', ?, ?, ?, '#f97316', 1, ?)
     ON DUPLICATE KEY UPDATE 
       full_name = VALUES(full_name),
       role = 'patient',
       patient_code = 'DT-PT-1002',
       phone = VALUES(phone),
       is_active = 1,
       password_hash = VALUES(password_hash)`,
    [
      'Robert Fox',
      'robert.fox@dosetrack.com',
      '(555) 789-1234',
      'Clara Fox (Daughter) - (555) 654-3210',
      hash
    ]
  );
  const [[robert]] = await db.query(`SELECT id FROM users WHERE email = 'robert.fox@dosetrack.com'`);
  const robertId = robert.id;

  // Medications for Robert
  let [[existingAmlodipine]] = await db.query(`SELECT id FROM medications WHERE user_id = ? AND name = 'Amlodipine'`, [robertId]);
  let amlodipineId;
  if (!existingAmlodipine) {
    const [r] = await db.query(
      `INSERT INTO medications (user_id, name, dosage, quantity, frequency, instructions, start_date)
       VALUES (?, 'Amlodipine', '5mg', '1 tablet', 'Once daily', 'Take once daily in the evening', '2026-01-01')`,
      [robertId]
    );
    amlodipineId = r.insertId;
  } else {
    amlodipineId = existingAmlodipine.id;
  }

  await db.query(
    `INSERT INTO schedules (medication_id, user_id, dose_time, active)
     VALUES (?, ?, '18:00:00', 1)
     ON DUPLICATE KEY UPDATE active = 1`,
    [amlodipineId, robertId]
  );

  const [[robertSched]] = await db.query(`SELECT id FROM schedules WHERE user_id = ? AND medication_id = ?`, [robertId, amlodipineId]);
  if (robertSched) {
    // Seed 7 days for Robert with majority MISSED so his adherence is ~40% (At Risk)
    for (let i = 1; i <= 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      const status = (i % 3 === 0) ? 'taken' : 'missed'; // 2 taken, 5 missed = 28.5% adherence
      const scheduledFor = `${dateStr} 18:00:00`;
      await db.query(
        `INSERT INTO dose_events (schedule_id, medication_id, user_id, scheduled_for, status, recorded_by_id)
         VALUES (?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE status = VALUES(status)`,
        [robertSched.id, amlodipineId, robertId, scheduledFor, status, robertId]
      );
    }
  }

  // 12. Seed initial Audit Log entries for Admin
  if (adminId) {
    await db.query(
      `INSERT INTO admin_audit_log (admin_id, action, target_type, target_id, details, ip_address)
       VALUES 
         (?, 'SYSTEM_INIT', 'system', '0', 'Clinical portal initialized with HIPAA privacy compliance and adherence tracking.', '127.0.0.1'),
         (?, 'POLICY_CONFIG', 'app_settings', '1', 'Adherence risk threshold configured to 70%. Grace period set to 30 minutes.', '127.0.0.1')`,
      [adminId, adminId]
    );
  }

  console.log('[Seed] Connected demo data seeded successfully!');
}

if (require.main === module) {
  seed().then(() => process.exit(0)).catch(err => {
    console.error('[Seed] Error:', err);
    process.exit(1);
  });
}

module.exports = { seed };
