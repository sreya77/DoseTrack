const router = require('express').Router();
const db = require('../../db');
const { logAudit } = require('../../middleware/auth');

/**
 * GET /api/admin/reports/adherence
 * Comprehensive adherence & compliance report data
 */
router.get('/adherence', async (req, res, next) => {
  try {
    const { startDate, endDate, patientId } = req.query;

    let dateWhere = '';
    const params = [];

    if (startDate && endDate) {
      dateWhere += ' AND e.scheduled_for BETWEEN ? AND ?';
      params.push(`${startDate} 00:00:00`, `${endDate} 23:59:59`);
    } else {
      dateWhere += ' AND e.scheduled_for >= DATE_SUB(NOW(), INTERVAL 30 DAY)';
    }

    if (patientId) {
      dateWhere += ' AND e.user_id = ?';
      params.push(patientId);
    }

    // 1. Overall Aggregates
    const [totals] = await db.execute(
      `SELECT 
         COUNT(*) as total_scheduled,
         SUM(CASE WHEN e.status = 'taken' THEN 1 ELSE 0 END) as total_taken,
         SUM(CASE WHEN e.status = 'missed' THEN 1 ELSE 0 END) as total_missed
       FROM dose_events e
       JOIN users u ON u.id = e.user_id
       WHERE u.is_active = 1 ${dateWhere}`,
      params
    );

    const totalScheduled = Number(totals[0]?.total_scheduled || 0);
    const totalTaken = Number(totals[0]?.total_taken || 0);
    const totalMissed = Number(totals[0]?.total_missed || 0);
    const overallRate = totalScheduled > 0 ? Math.round((totalTaken / totalScheduled) * 100) : 100;

    // 2. Per-Patient Breakdown
    const [patientRows] = await db.execute(
      `SELECT 
         u.id as patient_id,
         u.full_name as patient_name,
         u.patient_code,
         COUNT(e.id) as scheduled,
         SUM(CASE WHEN e.status = 'taken' THEN 1 ELSE 0 END) as taken,
         SUM(CASE WHEN e.status = 'missed' THEN 1 ELSE 0 END) as missed
       FROM users u
       JOIN dose_events e ON e.user_id = u.id
       WHERE u.role = 'patient' AND u.is_active = 1 ${dateWhere}
       GROUP BY u.id
       ORDER BY (SUM(CASE WHEN e.status = 'taken' THEN 1 ELSE 0 END) / COUNT(e.id)) ASC`,
      params
    );

    const patientBreakdown = patientRows.map((p) => {
      const sch = Number(p.scheduled || 0);
      const tkn = Number(p.taken || 0);
      const msd = Number(p.missed || 0);
      const rate = sch > 0 ? Math.round((tkn / sch) * 100) : 100;
      return {
        id: p.patient_id,
        name: p.patient_name,
        patientCode: p.patient_code || '—',
        scheduled: sch,
        taken: tkn,
        missed: msd,
        adherenceRate: rate,
        isAtRisk: rate < 70
      };
    });

    // 3. Top Missed Medications
    const [missedMeds] = await db.execute(
      `SELECT 
         m.name as medication_name,
         m.dosage,
         COUNT(e.id) as missed_count
       FROM dose_events e
       JOIN medications m ON m.id = e.medication_id
       WHERE e.status = 'missed' ${dateWhere}
       GROUP BY m.id
       ORDER BY missed_count DESC
       LIMIT 5`,
      params
    );

    await logAudit(
      req.user.id,
      'GENERATE_REPORT',
      'report',
      'adherence',
      `Admin generated compliance report for date range ${startDate || 'Last 30d'} to ${endDate || 'Now'}.`,
      req
    );

    res.json({
      dateRange: {
        startDate: startDate || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10),
        endDate: endDate || new Date().toISOString().slice(0, 10)
      },
      summary: {
        totalScheduled,
        totalTaken,
        totalMissed,
        overallRate,
        atRiskPatientsCount: patientBreakdown.filter(p => p.isAtRisk).length
      },
      patientBreakdown,
      topMissedMeds: missedMeds
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/admin/reports/print-view
 * Returns a printable, clinical-grade HTML report suitable for browser Print to PDF
 */
router.get('/print-view', async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    const start = startDate || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    const end = endDate || new Date().toISOString().slice(0, 10);

    const [totals] = await db.execute(
      `SELECT 
         COUNT(*) as total_scheduled,
         SUM(CASE WHEN e.status = 'taken' THEN 1 ELSE 0 END) as total_taken,
         SUM(CASE WHEN e.status = 'missed' THEN 1 ELSE 0 END) as total_missed
       FROM dose_events e
       JOIN users u ON u.id = e.user_id
       WHERE u.is_active = 1 AND e.scheduled_for BETWEEN ? AND ?`,
      [`${start} 00:00:00`, `${end} 23:59:59`]
    );

    const scheduled = Number(totals[0]?.total_scheduled || 0);
    const taken = Number(totals[0]?.total_taken || 0);
    const missed = Number(totals[0]?.total_missed || 0);
    const rate = scheduled > 0 ? Math.round((taken / scheduled) * 100) : 100;

    const [patients] = await db.execute(
      `SELECT 
         u.full_name as name,
         u.patient_code,
         COUNT(e.id) as scheduled,
         SUM(CASE WHEN e.status = 'taken' THEN 1 ELSE 0 END) as taken,
         SUM(CASE WHEN e.status = 'missed' THEN 1 ELSE 0 END) as missed
       FROM users u
       JOIN dose_events e ON e.user_id = u.id
       WHERE u.role = 'patient' AND u.is_active = 1 AND e.scheduled_for BETWEEN ? AND ?
       GROUP BY u.id
       ORDER BY (SUM(CASE WHEN e.status = 'taken' THEN 1 ELSE 0 END) / COUNT(e.id)) ASC`,
      [`${start} 00:00:00`, `${end} 23:59:59`]
    );

    const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>DoseTrack Clinical Compliance Report</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 32px; color: #0f172a; line-height: 1.5; font-size: 13px; }
    .header { border-bottom: 2px solid #0d9488; padding-bottom: 16px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: flex-start; }
    .header h1 { margin: 0 0 4px 0; color: #0f172a; font-size: 22px; }
    .header p { margin: 0; color: #64748b; font-size: 12px; }
    .kpi-row { display: flex; gap: 16px; margin-bottom: 24px; }
    .kpi-box { flex: 1; border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px; background: #f8fafc; }
    .kpi-box .val { font-size: 22px; font-weight: bold; color: #0f172a; }
    .kpi-box .lbl { font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: bold; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 12.5px; }
    th, td { border: 1px solid #cbd5e1; padding: 8px 12px; text-align: left; }
    th { background: #f1f5f9; font-weight: bold; color: #334155; }
    .badge-risk { font-weight: bold; color: #b91c1c; }
    .badge-opt { font-weight: bold; color: #059669; }
    .footer { margin-top: 40px; border-top: 1px solid #cbd5e1; padding-top: 16px; font-size: 11px; color: #64748b; }
    .sig-block { margin-top: 36px; display: flex; justify-content: space-between; }
    .sig-line { width: 200px; border-top: 1px solid #0f172a; text-align: center; padding-top: 4px; font-size: 11px; }
    @media print {
      body { padding: 0; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="no-print" style="margin-bottom: 16px; text-align: right;">
    <button onclick="window.print()" style="padding: 8px 16px; background: #0d9488; color: white; border: none; border-radius: 4px; font-weight: bold; cursor: pointer;">
      🖨️ Print or Save as PDF
    </button>
  </div>

  <div class="header">
    <div>
      <h1>✚ DoseTrack Clinical Adherence Report</h1>
      <p>BCA S5 Mini Project · KMCT IETM, APJ Abdul Kalam Technological University (KTU)</p>
    </div>
    <div style="text-align: right;">
      <p><strong>Evaluation Window:</strong> ${start} to ${end}</p>
      <p><strong>Generated On:</strong> ${new Date().toLocaleString()}</p>
      <p><strong>Audited By:</strong> Administrator (ID: ${req.user.id})</p>
    </div>
  </div>

  <div class="kpi-row">
    <div class="kpi-box">
      <div class="lbl">Population Adherence</div>
      <div class="val" style="color:${rate < 70 ? '#b91c1c' : '#0d9488'};">${rate}%</div>
    </div>
    <div class="kpi-box">
      <div class="lbl">Total Scheduled</div>
      <div class="val">${scheduled}</div>
    </div>
    <div class="kpi-box">
      <div class="lbl">Verified Taken</div>
      <div class="val" style="color:#059669;">${taken}</div>
    </div>
    <div class="kpi-box">
      <div class="lbl">Missed Doses</div>
      <div class="val" style="color:#dc2626;">${missed}</div>
    </div>
  </div>

  <h3>Patient Compliance Breakdown</h3>
  <table>
    <thead>
      <tr>
        <th>Patient Name</th>
        <th>Patient Code</th>
        <th>Scheduled Doses</th>
        <th>Taken Doses</th>
        <th>Missed Doses</th>
        <th>Adherence Rate</th>
        <th>Clinical Assessment</th>
      </tr>
    </thead>
    <tbody>
      ${patients.map(p => {
        const pSch = Number(p.scheduled || 0);
        const pTkn = Number(p.taken || 0);
        const pRate = pSch > 0 ? Math.round((pTkn / pSch) * 100) : 100;
        const isAtRisk = pRate < 70;
        return `
          <tr>
            <td><strong>${p.name}</strong></td>
            <td><code>${p.patient_code || '—'}</code></td>
            <td>${pSch}</td>
            <td>${pTkn}</td>
            <td>${p.missed}</td>
            <td><strong>${pRate}%</strong></td>
            <td>${isAtRisk ? '<span class="badge-risk">⚠️ AT RISK (&lt;70%)</span>' : '<span class="badge-opt">✓ OPTIMAL</span>'}</td>
          </tr>
        `;
      }).join('')}
    </tbody>
  </table>

  <div class="sig-block">
    <div class="sig-line">Reviewing Pharmacist / Clinician</div>
    <div class="sig-line">System Administrator Sign-off</div>
  </div>

  <div class="footer">
    <p><strong>Forensic Notice:</strong> This document was generated from the DoseTrack tamper-evident adherence ledger. DoseTrack does not diagnose, prescribe or provide medical advice. Always consult a licensed clinician.</p>
  </div>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (err) {
    next(err);
  }
});

module.exports = router;

