const router = require('express').Router();
const db = require('../../db');
const { logAudit } = require('../../middleware/auth');

/**
 * 1. LIVE ACTIVITY FEED
 * Real-time stream of all actions by all users. Supports auto-refresh polling (every 5 seconds).
 */
router.get('/live-feed', async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 25,
      userId = '',
      role = '',
      actionType = '',
      search = '',
      dateFrom = '',
      dateTo = ''
    } = req.query;

    const parsedLimit = Math.min(100, Math.max(1, parseInt(limit)));
    const offset = (Math.max(1, parseInt(page)) - 1) * parsedLimit;

    let sqlWhere = 'WHERE 1=1';
    const params = [];

    if (userId) {
      sqlWhere += ' AND a.user_id = ?';
      params.push(userId);
    }

    if (role) {
      sqlWhere += ' AND (a.user_role = ? OR u.role = ?)';
      params.push(role, role);
    }

    if (actionType) {
      sqlWhere += ' AND a.action_type = ?';
      params.push(actionType);
    }

    if (dateFrom) {
      sqlWhere += ' AND a.created_at >= ?';
      params.push(`${dateFrom} 00:00:00`);
    }

    if (dateTo) {
      sqlWhere += ' AND a.created_at <= ?';
      params.push(`${dateTo} 23:59:59`);
    }

    if (search.trim()) {
      const q = `%${search.trim()}%`;
      sqlWhere += ' AND (a.description LIKE ? OR a.action_type LIKE ? OR u.full_name LIKE ? OR a.ip_address LIKE ?)';
      params.push(q, q, q, q);
    }

    const [countRows] = await db.execute(
      `SELECT COUNT(*) as total 
       FROM activity_log a 
       LEFT JOIN users u ON u.id = a.user_id 
       ${sqlWhere}`,
      params
    );
    const total = Number(countRows[0]?.total || 0);

    const [rows] = await db.execute(
      `SELECT 
         a.id,
         a.user_id,
         COALESCE(u.full_name, a.user_role, 'Guest User') as user_name,
         COALESCE(a.user_role, u.role, 'guest') as user_role,
         u.patient_code,
         u.avatar_color,
         a.action_type,
         a.entity_type,
         a.entity_id,
         a.description,
         a.old_value,
         a.new_value,
         a.ip_address,
         a.user_agent,
         a.created_at
       FROM activity_log a
       LEFT JOIN users u ON u.id = a.user_id
       ${sqlWhere}
       ORDER BY a.created_at DESC, a.id DESC
       LIMIT ${parsedLimit} OFFSET ${offset}`,
      params
    );

    const activities = rows.map((r) => {
      let oldValue = null;
      let newValue = null;
      try {
        oldValue = typeof r.old_value === 'string' ? JSON.parse(r.old_value) : r.old_value;
      } catch {}
      try {
        newValue = typeof r.new_value === 'string' ? JSON.parse(r.new_value) : r.new_value;
      } catch {}

      return {
        id: r.id,
        user: {
          id: r.user_id,
          name: r.user_name,
          role: r.user_role,
          patientCode: r.patient_code,
          avatarColor: r.avatar_color || '#0d9488'
        },
        actionType: r.action_type,
        entityType: r.entity_type,
        entityId: r.entity_id,
        description: r.description,
        oldValue,
        newValue,
        ipAddress: r.ip_address || '—',
        userAgent: r.user_agent || '—',
        createdAt: r.created_at
      };
    });

    res.json({
      activities,
      pagination: {
        total,
        page: parseInt(page),
        limit: parsedLimit,
        pages: Math.ceil(total / parsedLimit)
      }
    });
  } catch (err) {
    next(err);
  }
});

/**
 * 2. USER 360 VIEW
 * Comprehensive 360-degree investigation of any user:
 * Profile, role, sessions, medications, schedules, dose history, adherence %,
 * vitals & care notes, doctors saved, care circle connections, and complete personal activity timeline.
 */
router.get('/users/:id/360', async (req, res, next) => {
  try {
    const targetUserId = Number(req.params.id);

    const [userRows] = await db.execute(
      `SELECT id, full_name, email, phone, role, patient_code, emergency_contact, avatar_color, is_active, created_at
       FROM users WHERE id = ?`,
      [targetUserId]
    );

    if (!userRows.length) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const u = userRows[0];

    // Log administrative health record access (Admins are watched!)
    await logAudit(
      req.user.id,
      'VIEW_USER_360',
      'user',
      u.id,
      `Admin opened full User 360 investigation dossier for ${u.full_name} (${u.role}${u.patient_code ? `, ${u.patient_code}` : ''}).`,
      req
    );

    // 1. Session & Login Monitor Info
    const [loginRows] = await db.execute(
      `SELECT action_type, ip_address, user_agent, created_at
       FROM activity_log 
       WHERE user_id = ? AND action_type IN ('LOGIN_SUCCESS', 'LOGIN_FAILED', 'LOGOUT')
       ORDER BY created_at DESC LIMIT 10`,
      [u.id]
    );

    const [failedCountRows] = await db.execute(
      `SELECT COUNT(*) as failed_count
       FROM activity_log
       WHERE user_id = ? AND action_type = 'LOGIN_FAILED' AND created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)`,
      [u.id]
    );

    const lastLogin = loginRows.find(l => l.action_type === 'LOGIN_SUCCESS') || null;

    // 2. Medications & Linked Schedules
    const [medications] = await db.execute(
      `SELECT m.id, m.name, m.dosage, m.quantity, m.frequency, m.instructions, m.start_date, m.end_date, m.is_active,
              GROUP_CONCAT(CONCAT(s.id, ':', TIME_FORMAT(s.dose_time, '%H:%i'), ':', s.active) ORDER BY s.dose_time SEPARATOR ';') as schedules_raw
       FROM medications m
       LEFT JOIN schedules s ON s.medication_id = m.id
       WHERE m.user_id = ?
       GROUP BY m.id
       ORDER BY m.created_at DESC`,
      [u.id]
    );

    const formattedMeds = medications.map(m => {
      const schedules = (m.schedules_raw || '').split(';').filter(Boolean).map(s => {
        const [id, time, active] = s.split(':');
        return { id: Number(id), time, active: active === '1' };
      });
      return {
        id: m.id,
        name: m.name,
        dosage: m.dosage,
        quantity: m.quantity,
        frequency: m.frequency,
        instructions: m.instructions,
        startDate: m.start_date,
        endDate: m.end_date,
        isActive: Boolean(m.is_active),
        schedules
      };
    });

    // 3. Dose Events History & 30-Day Adherence Metric
    const [doses] = await db.execute(
      `SELECT e.id, e.scheduled_for, e.status, e.recorded_at,
              m.name as medication_name, m.dosage,
              recorder.full_name as recorded_by_name, recorder.role as recorded_by_role
       FROM dose_events e
       JOIN medications m ON m.id = e.medication_id
       LEFT JOIN users recorder ON recorder.id = e.recorded_by_id
       WHERE e.user_id = ?
       ORDER BY e.scheduled_for DESC LIMIT 40`,
      [u.id]
    );

    const [adherenceData] = await db.execute(
      `SELECT 
         COUNT(*) as total,
         SUM(CASE WHEN status = 'taken' THEN 1 ELSE 0 END) as taken,
         SUM(CASE WHEN status = 'missed' THEN 1 ELSE 0 END) as missed,
         MAX(CASE WHEN status = 'taken' THEN scheduled_for ELSE NULL END) as last_taken_at
       FROM dose_events
       WHERE user_id = ? AND scheduled_for >= DATE_SUB(NOW(), INTERVAL 30 DAY)`,
      [u.id]
    );

    const totalDoses = Number(adherenceData[0]?.total || 0);
    const takenDoses = Number(adherenceData[0]?.taken || 0);
    const missedDoses = Number(adherenceData[0]?.missed || 0);
    const adherenceRate = totalDoses > 0 ? Math.round((takenDoses / totalDoses) * 100) : 100;

    // Check consecutive missed doses
    let consecutiveMissed = 0;
    for (const d of doses) {
      if (d.status === 'missed') consecutiveMissed++;
      else if (d.status === 'taken') break;
    }

    // Hours since last dose event
    const [latestDose] = await db.execute(
      `SELECT recorded_at FROM dose_events WHERE user_id = ? ORDER BY recorded_at DESC LIMIT 1`,
      [u.id]
    );
    const hoursSinceLastDose = latestDose.length
      ? Math.round((Date.now() - new Date(latestDose[0].recorded_at).getTime()) / (1000 * 60 * 60))
      : null;

    // 4. Vitals & Care Notes
    const [careNotes] = await db.execute(
      `SELECT n.id, n.note_type, n.content, n.vitals_json, n.created_at,
              author.full_name as author_name, author.role as author_role
       FROM care_notes n
       JOIN users author ON author.id = n.author_id
       WHERE n.patient_id = ? OR n.author_id = ?
       ORDER BY n.created_at DESC LIMIT 20`,
      [u.id, u.id]
    );

    const formattedNotes = careNotes.map(n => {
      let vitals = null;
      if (n.vitals_json) {
        try {
          vitals = typeof n.vitals_json === 'string' ? JSON.parse(n.vitals_json) : n.vitals_json;
        } catch {}
      }
      return {
        id: n.id,
        noteType: n.note_type,
        content: n.content,
        vitals,
        author: { name: n.author_name, role: n.author_role },
        createdAt: n.created_at
      };
    });

    // 5. Doctors Directory for this user
    const [doctors] = await db.execute(
      `SELECT id, name, specialization, clinic_name, phone, email, availability, clinic_address
       FROM doctors WHERE user_id = ? ORDER BY name ASC`,
      [u.id]
    );

    // 6. Care Circle Connections (Both as patient and as member)
    const [careCircleAsPatient] = await db.execute(
      `SELECT pc.id as connection_id, pc.relationship, pc.can_manage_meds, pc.can_record_doses, pc.created_at,
              m.id as member_id, m.full_name, m.role, m.email, m.phone, m.avatar_color
       FROM patient_connections pc
       JOIN users m ON m.id = pc.member_id
       WHERE pc.patient_id = ?`,
      [u.id]
    );

    const [careCircleAsMember] = await db.execute(
      `SELECT pc.id as connection_id, pc.relationship, pc.can_manage_meds, pc.can_record_doses, pc.created_at,
              p.id as patient_id, p.full_name, p.patient_code, p.email, p.phone, p.avatar_color
       FROM patient_connections pc
       JOIN users p ON p.id = pc.patient_id
       WHERE pc.member_id = ?`,
      [u.id]
    );

    // 7. Personal Activity Timeline (Everything this user ever performed)
    const [timelineRows] = await db.execute(
      `SELECT id, action_type, entity_type, entity_id, description, old_value, new_value, ip_address, user_agent, created_at
       FROM activity_log
       WHERE user_id = ?
       ORDER BY created_at DESC LIMIT 50`,
      [u.id]
    );

    const personalTimeline = timelineRows.map(t => {
      let oldValue = null;
      let newValue = null;
      try {
        oldValue = typeof t.old_value === 'string' ? JSON.parse(t.old_value) : t.old_value;
      } catch {}
      try {
        newValue = typeof t.new_value === 'string' ? JSON.parse(t.new_value) : t.new_value;
      } catch {}
      return {
        id: t.id,
        actionType: t.action_type,
        entityType: t.entity_type,
        entityId: t.entity_id,
        description: t.description,
        oldValue,
        newValue,
        ipAddress: t.ip_address,
        userAgent: t.user_agent,
        createdAt: t.created_at
      };
    });

    res.json({
      user: {
        id: u.id,
        fullName: u.full_name,
        email: u.email,
        phone: u.phone,
        role: u.role,
        patientCode: u.patient_code,
        emergencyContact: u.emergency_contact,
        avatarColor: u.avatar_color,
        isActive: Boolean(u.is_active),
        createdAt: u.created_at
      },
      sessionInfo: {
        lastLogin: lastLogin ? {
          timestamp: lastLogin.created_at,
          ipAddress: lastLogin.ip_address,
          userAgent: lastLogin.user_agent
        } : null,
        recentSessions: loginRows,
        failedAttempts24h: Number(failedCountRows[0]?.failed_count || 0)
      },
      medications: formattedMeds,
      doseHistory: doses,
      adherence: {
        totalDoses,
        takenDoses,
        missedDoses,
        adherenceRate,
        consecutiveMissed,
        hoursSinceLastDose,
        isAtRisk: adherenceRate < 70,
        hasConsecutiveMissedRisk: consecutiveMissed >= 3,
        hasInactivityRisk: hoursSinceLastDose !== null && hoursSinceLastDose >= 48
      },
      vitalsAndNotes: formattedNotes,
      doctors,
      careCircle: {
        asPatient: careCircleAsPatient,
        asMember: careCircleAsMember
      },
      personalTimeline
    });
  } catch (err) {
    next(err);
  }
});

/**
 * 3. LOGIN AND SESSION MONITOR
 * Who is online, login history, failed login attempts, IP/device,
 * and automated detection of suspicious security flags.
 */
router.get('/sessions', async (req, res, next) => {
  try {
    // 1. Online / Active within last 30 minutes
    const [onlineUsers] = await db.execute(
      `SELECT DISTINCT u.id, u.full_name, u.role, u.patient_code, u.avatar_color,
              MAX(a.created_at) as last_seen,
              SUBSTRING_INDEX(GROUP_CONCAT(a.ip_address ORDER BY a.created_at DESC), ',', 1) as last_ip,
              SUBSTRING_INDEX(GROUP_CONCAT(a.user_agent ORDER BY a.created_at DESC), ',', 1) as last_ua
       FROM activity_log a
       JOIN users u ON u.id = a.user_id
       WHERE a.created_at >= DATE_SUB(NOW(), INTERVAL 30 MINUTE)
       GROUP BY u.id
       ORDER BY last_seen DESC`
    );

    // 2. Recent login and auth events
    const [recentAuth] = await db.execute(
      `SELECT a.id, a.user_id, COALESCE(u.full_name, a.user_role, 'Guest') as user_name,
              a.user_role, a.action_type, a.description, a.ip_address, a.user_agent, a.created_at
       FROM activity_log a
       LEFT JOIN users u ON u.id = a.user_id
       WHERE a.action_type IN ('LOGIN_SUCCESS', 'LOGIN_FAILED', 'LOGOUT', 'REGISTER', 'PASSWORD_CHANGE')
       ORDER BY a.created_at DESC LIMIT 30`
    );

    // 3. Failed attempts grouped by email / IP in past 24h
    const [failedAttempts] = await db.execute(
      `SELECT a.ip_address, a.description, COUNT(*) as count, MAX(a.created_at) as last_attempt
       FROM activity_log a
       WHERE a.action_type = 'LOGIN_FAILED' AND a.created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
       GROUP BY a.ip_address, a.description
       ORDER BY count DESC LIMIT 10`
    );

    // 4. Suspicious Flags:
    // a) Multiple failed logins (>= 5)
    const [bruteForce] = await db.execute(
      `SELECT a.ip_address, COUNT(*) as failed_count, MAX(a.created_at) as last_attempt
       FROM activity_log a
       WHERE a.action_type = 'LOGIN_FAILED' AND a.created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
       GROUP BY a.ip_address
       HAVING failed_count >= 5`
    );

    // b) Same account accessed from multiple distinct IPs in past 24h
    const [multiIpUsers] = await db.execute(
      `SELECT a.user_id, u.full_name, u.role, COUNT(DISTINCT a.ip_address) as ip_count,
              GROUP_CONCAT(DISTINCT a.ip_address SEPARATOR ', ') as ips
       FROM activity_log a
       JOIN users u ON u.id = a.user_id
       WHERE a.action_type = 'LOGIN_SUCCESS' AND a.created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
       GROUP BY a.user_id
       HAVING ip_count > 1`
    );

    res.json({
      onlineUsers: onlineUsers.map(o => ({
        id: o.id,
        fullName: o.full_name,
        role: o.role,
        patientCode: o.patient_code,
        avatarColor: o.avatar_color,
        lastSeen: o.last_seen,
        ipAddress: o.last_ip,
        userAgent: o.last_ua
      })),
      recentAuth,
      failedAttempts,
      suspiciousFlags: {
        bruteForceAlerts: bruteForce,
        multiIpAlerts: multiIpUsers
      }
    });
  } catch (err) {
    next(err);
  }
});

/**
 * 4. ADHERENCE WATCHLIST
 * System-wide dose monitoring:
 * - Adherence % = (Taken / Scheduled) x 100
 * - Flag < 70% as "At Risk"
 * - Flag >= 3 consecutive missed doses
 * - Flag inactive > 48 hours without any dose logged
 */
router.get('/adherence-watchlist', async (req, res, next) => {
  try {
    const [patients] = await db.execute(
      `SELECT u.id, u.full_name, u.patient_code, u.phone, u.avatar_color, u.created_at
       FROM users u
       WHERE u.role = 'patient' AND u.is_active = 1
       ORDER BY u.full_name ASC`
    );

    const watchlist = await Promise.all(
      patients.map(async (p) => {
        // 30-day stats
        const [stats] = await db.execute(
          `SELECT 
             COUNT(*) as scheduled,
             SUM(CASE WHEN status = 'taken' THEN 1 ELSE 0 END) as taken,
             SUM(CASE WHEN status = 'missed' THEN 1 ELSE 0 END) as missed
           FROM dose_events
           WHERE user_id = ? AND scheduled_for >= DATE_SUB(NOW(), INTERVAL 30 DAY)`,
          [p.id]
        );

        const scheduled = Number(stats[0]?.scheduled || 0);
        const taken = Number(stats[0]?.taken || 0);
        const missed = Number(stats[0]?.missed || 0);
        const rate = scheduled > 0 ? Math.round((taken / scheduled) * 100) : 100;

        // Consecutive missed check
        const [recentEvents] = await db.execute(
          `SELECT status, scheduled_for FROM dose_events WHERE user_id = ? ORDER BY scheduled_for DESC LIMIT 10`,
          [p.id]
        );

        let consecutiveMissed = 0;
        for (const e of recentEvents) {
          if (e.status === 'missed') consecutiveMissed++;
          else if (e.status === 'taken') break;
        }

        // Inactivity check (hours since last dose logged)
        const [lastDose] = await db.execute(
          `SELECT recorded_at FROM dose_events WHERE user_id = ? ORDER BY recorded_at DESC LIMIT 1`,
          [p.id]
        );

        const hoursInactive = lastDose.length
          ? Math.round((Date.now() - new Date(lastDose[0].recorded_at).getTime()) / (1000 * 60 * 60))
          : 999;

        const isAtRisk = rate < 70;
        const isConsecutiveRisk = consecutiveMissed >= 3;
        const isInactivityRisk = hoursInactive >= 48;

        return {
          id: p.id,
          fullName: p.full_name,
          patientCode: p.patient_code,
          phone: p.phone,
          avatarColor: p.avatar_color,
          scheduled,
          taken,
          missed,
          adherenceRate: rate,
          consecutiveMissed,
          hoursInactive: hoursInactive === 999 ? 'No doses yet' : hoursInactive,
          flags: {
            atRisk: isAtRisk,
            consecutiveMissed: isConsecutiveRisk,
            inactivity48h: isInactivityRisk
          },
          urgencyScore: (isAtRisk ? 3 : 0) + (isConsecutiveRisk ? 3 : 0) + (isInactivityRisk ? 2 : 0)
        };
      })
    );

    // Sort by highest urgency score first
    watchlist.sort((a, b) => b.urgencyScore - a.urgencyScore || a.adherenceRate - b.adherenceRate);

    res.json({ watchlist });
  } catch (err) {
    next(err);
  }
});

/**
 * 5. MEDICATION & SCHEDULE CHANGE TRACKER
 * Every add/edit/delete across all patients with who changed it and before vs after values.
 * Highlights unusual changes (dosage changed, deleted with pending doses).
 */
router.get('/medication-changes', async (req, res, next) => {
  try {
    const { limit = 30 } = req.query;
    const maxLimit = Math.min(100, Math.max(1, parseInt(limit)));

    const [rows] = await db.execute(
      `SELECT a.id, a.user_id, COALESCE(u.full_name, a.user_role) as actor_name, a.user_role,
              a.action_type, a.entity_id, a.description, a.old_value, a.new_value, a.ip_address, a.created_at
       FROM activity_log a
       LEFT JOIN users u ON u.id = a.user_id
       WHERE a.action_type IN ('MEDICATION_ADD', 'MEDICATION_EDIT', 'MEDICATION_DELETE', 'SCHEDULE_CREATE', 'SCHEDULE_EDIT', 'SCHEDULE_TOGGLE')
       ORDER BY a.created_at DESC
       LIMIT ${maxLimit}`
    );

    const changes = rows.map((r) => {
      let oldValue = null;
      let newValue = null;
      try {
        oldValue = typeof r.old_value === 'string' ? JSON.parse(r.old_value) : r.old_value;
      } catch {}
      try {
        newValue = typeof r.new_value === 'string' ? JSON.parse(r.new_value) : r.new_value;
      } catch {}

      // Identify unusual changes
      const isDosageChanged = oldValue && newValue && oldValue.dosage && newValue.dosage && oldValue.dosage !== newValue.dosage;
      const isDeleted = r.action_type === 'MEDICATION_DELETE';
      const isFrequencyChanged = oldValue && newValue && oldValue.frequency && newValue.frequency && oldValue.frequency !== newValue.frequency;

      return {
        id: r.id,
        actor: {
          id: r.user_id,
          name: r.actor_name,
          role: r.user_role
        },
        actionType: r.action_type,
        entityId: r.entity_id,
        description: r.description,
        oldValue,
        newValue,
        ipAddress: r.ip_address,
        createdAt: r.created_at,
        isUnusual: Boolean(isDosageChanged || isDeleted || isFrequencyChanged),
        unusualReason: isDosageChanged ? `Dosage changed from ${oldValue.dosage} to ${newValue.dosage}` :
                       isDeleted ? 'Medication regimen was deleted' :
                       isFrequencyChanged ? `Frequency altered from ${oldValue.frequency} to ${newValue.frequency}` : null
      };
    });

    res.json({ changes });
  } catch (err) {
    next(err);
  }
});

/**
 * 6. EMERGENCY AND ALERT CENTER
 * Supervise all SOS alerts, missed-dose alerts, and caretaker acknowledgements with response time.
 */
router.get('/alert-center', async (req, res, next) => {
  try {
    const [alerts] = await db.execute(
      `SELECT a.id, a.alert_type, a.title, a.message, a.read_status, a.created_at,
              pt.id as patient_id, pt.full_name as patient_name, pt.patient_code, pt.phone as patient_phone,
              sender.id as sender_id, sender.full_name as sender_name, sender.role as sender_role,
              recipient.id as recipient_id, recipient.full_name as recipient_name, recipient.role as recipient_role
       FROM care_alerts a
       JOIN users pt ON pt.id = a.patient_id
       LEFT JOIN users sender ON sender.id = a.from_user_id
       JOIN users recipient ON recipient.id = a.to_user_id
       ORDER BY a.created_at DESC LIMIT 50`
    );

    // Calculate acknowledgement response times from activity_log
    const enrichedAlerts = await Promise.all(
      alerts.map(async (a) => {
        let responseTimeMinutes = null;
        let acknowledgedBy = null;

        if (a.read_status) {
          const [ack] = await db.execute(
            `SELECT a.created_at, u.full_name 
             FROM activity_log a
             LEFT JOIN users u ON u.id = a.user_id
             WHERE a.action_type IN ('EMERGENCY_SOS_ACKNOWLEDGED', 'ALERT_ACKNOWLEDGED') 
               AND a.entity_id = ?
             ORDER BY a.created_at ASC LIMIT 1`,
            [String(a.id)]
          );

          if (ack.length) {
            const diffMs = new Date(ack[0].created_at).getTime() - new Date(a.created_at).getTime();
            responseTimeMinutes = Math.max(1, Math.round(diffMs / (1000 * 60)));
            acknowledgedBy = ack[0].full_name;
          }
        }

        const isSos = a.alert_type === 'sos';
        const isOpen = !a.read_status;

        return {
          id: a.id,
          alertType: a.alert_type,
          title: a.title,
          message: a.message,
          status: isOpen ? 'open' : 'acknowledged',
          isSos,
          isUrgent: isSos && isOpen,
          patient: {
            id: a.patient_id,
            name: a.patient_name,
            patientCode: a.patient_code,
            phone: a.patient_phone
          },
          sender: a.sender_name ? {
            id: a.sender_id,
            name: a.sender_name,
            role: a.sender_role
          } : null,
          recipient: {
            id: a.recipient_id,
            name: a.recipient_name,
            role: a.recipient_role
          },
          responseTimeMinutes,
          acknowledgedBy,
          createdAt: a.created_at
        };
      })
    );

    res.json({ alerts: enrichedAlerts });
  } catch (err) {
    next(err);
  }
});

/**
 * 7. CARE CIRCLE MAP
 * Overview of which guardians and caretakers are linked to which patients,
 * and what each caregiver has actually done for that patient.
 */
router.get('/care-circle-map', async (req, res, next) => {
  try {
    const [connections] = await db.execute(
      `SELECT pc.id, pc.relationship, pc.can_manage_meds, pc.can_record_doses, pc.created_at,
              pt.id as patient_id, pt.full_name as patient_name, pt.patient_code, pt.avatar_color as pt_avatar,
              m.id as member_id, m.full_name as member_name, m.role as member_role, m.avatar_color as member_avatar
       FROM patient_connections pc
       JOIN users pt ON pt.id = pc.patient_id
       JOIN users m ON m.id = pc.member_id
       ORDER BY pt.full_name ASC, m.full_name ASC`
    );

    const map = await Promise.all(
      connections.map(async (c) => {
        // Actions performed by this caregiver for this patient:
        const [notesCount] = await db.execute(
          `SELECT COUNT(*) as count FROM care_notes WHERE patient_id = ? AND author_id = ?`,
          [c.patient_id, c.member_id]
        );

        const [dosesMarked] = await db.execute(
          `SELECT COUNT(*) as count FROM dose_events WHERE user_id = ? AND recorded_by_id = ?`,
          [c.patient_id, c.member_id]
        );

        const [nudgesSent] = await db.execute(
          `SELECT COUNT(*) as count FROM care_alerts WHERE patient_id = ? AND from_user_id = ? AND alert_type = 'nudge'`,
          [c.patient_id, c.member_id]
        );

        const [lastAction] = await db.execute(
          `SELECT created_at FROM activity_log WHERE user_id = ? ORDER BY created_at DESC LIMIT 1`,
          [c.member_id]
        );

        return {
          connectionId: c.id,
          relationship: c.relationship,
          canManageMeds: Boolean(c.can_manage_meds),
          canRecordDoses: Boolean(c.can_record_doses),
          connectedAt: c.created_at,
          patient: {
            id: c.patient_id,
            name: c.patient_name,
            patientCode: c.patient_code,
            avatar: c.pt_avatar
          },
          caregiver: {
            id: c.member_id,
            name: c.member_name,
            role: c.member_role,
            avatar: c.member_avatar
          },
          stats: {
            notesLogged: Number(notesCount[0]?.count || 0),
            dosesSignedOff: Number(dosesMarked[0]?.count || 0),
            nudgesSent: Number(nudgesSent[0]?.count || 0),
            lastActive: lastAction[0]?.created_at || 'Never'
          }
        };
      })
    );

    res.json({ map });
  } catch (err) {
    next(err);
  }
});

/**
 * 8. DATA ACCESS AUDIT
 * "Admins are watched" — records and displays every time an administrator accesses sensitive clinical data.
 */
router.get('/data-access-audit', async (req, res, next) => {
  try {
    const { page = 1, limit = 25 } = req.query;
    const parsedLimit = Math.min(100, Math.max(1, parseInt(limit)));
    const offset = (Math.max(1, parseInt(page)) - 1) * parsedLimit;

    const [countRows] = await db.execute(
      `SELECT COUNT(*) as total 
       FROM admin_audit_log 
       WHERE action IN ('VIEW_PATIENT_HEALTH', 'VIEW_USER_360', 'VIEW_USER_DETAILS', 'EXPORT_ADHERENCE_CSV')`
    );
    const total = Number(countRows[0]?.total || 0);

    const [rows] = await db.execute(
      `SELECT a.id, a.admin_id, u.full_name as admin_name, u.email as admin_email,
              a.action, a.target_type, a.target_id, a.details, a.ip_address, a.created_at
       FROM admin_audit_log a
       JOIN users u ON u.id = a.admin_id
       WHERE a.action IN ('VIEW_PATIENT_HEALTH', 'VIEW_USER_360', 'VIEW_USER_DETAILS', 'EXPORT_ADHERENCE_CSV')
       ORDER BY a.created_at DESC
       LIMIT ${parsedLimit} OFFSET ${offset}`
    );

    res.json({
      accessLogs: rows,
      pagination: {
        total,
        page: parseInt(page),
        limit: parsedLimit,
        pages: Math.ceil(total / parsedLimit)
      }
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

