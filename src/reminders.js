const cron = require('node-cron');
const db = require('./db');
const { logActivity } = require('./middleware/auth');

function startReminderJob() {
  cron.schedule('* * * * *', async () => {
    try {
      const [rows] = await db.execute(`
        SELECT s.id as schedule_id, s.user_id, m.name as med_name, m.dosage,
               CONCAT(CURDATE(), ' ', TIME_FORMAT(s.dose_time, '%H:%i:%s')) as scheduled_for
        FROM schedules s
        JOIN medications m ON m.id = s.medication_id
        WHERE s.active = 1 
          AND TIME_FORMAT(s.dose_time, '%H:%i') = TIME_FORMAT(NOW(), '%H:%i')
          AND m.start_date <= CURDATE() 
          AND (m.end_date IS NULL OR m.end_date >= CURDATE())
      `);

      for (const r of rows) {
        const [res] = await db.execute(
          `INSERT IGNORE INTO reminder_logs (schedule_id, user_id, scheduled_for, delivered_via)
           VALUES (?, ?, ?, 'dashboard')`,
          [r.schedule_id, r.user_id, r.scheduled_for]
        );

        if (res.affectedRows > 0) {
          await logActivity(null, {
            actionType: 'REMINDER_TRIGGERED',
            entityType: 'schedule',
            entityId: r.schedule_id,
            userId: r.user_id,
            userRole: 'patient',
            description: `Automated dose reminder triggered for ${r.med_name} (${r.dosage}).`,
            newValue: { scheduleId: r.schedule_id, scheduledFor: r.scheduled_for, medicationName: r.med_name, dosage: r.dosage }
          });
        }
      }

      if (rows.length) {
        console.log(`[DoseTrack] Recorded ${rows.length} due reminder(s).`);
      }
    } catch (e) {
      console.error('[DoseTrack] Reminder job failed:', e.message);
    }
  });
}

module.exports = { startReminderJob };
