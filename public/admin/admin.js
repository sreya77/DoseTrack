/**
 * DoseTrack Clinical Administrator Console
 * Client Application - Phase 2 (Dashboard & User Management)
 */

// Global Admin State
const AdminState = {
  token: localStorage.getItem('dosetrack_admin_token'),
  user: null,
  activeTab: 'dashboard',
  usersPage: 1,
  usersLimit: 15,
  usersTotal: 0,
  usersSearch: '',
  usersRole: '',
  usersStatus: '',
  targetDeleteUserId: null
};

// Utilities
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[c]));

async function adminApi(endpoint, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };
  if (AdminState.token) {
    headers.Authorization = `Bearer ${AdminState.token}`;
  }

  const res = await fetch('/api/admin' + endpoint, {
    ...options,
    headers
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      if (res.status === 403 && data.error && !data.error.includes('privileges')) {
        // Business logic 403, e.g. self-deactivation or self-deletion
        throw new Error(data.error);
      }
      localStorage.removeItem('dosetrack_admin_token');
      localStorage.removeItem('dosetrack_admin_user');
      window.location.href = '/admin/login';
      return null;
    }
    throw new Error(data.error || data.message || `Request failed (${res.status})`);
  }
  return data;
}

function showToast(msg, isError = false) {
  const t = $('adminToast');
  if (!t) return;
  t.textContent = msg;
  t.className = 'alert-box ' + (isError ? 'alert-danger' : 'alert-success');
  t.classList.remove('hide');
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => t.classList.add('hide'), 4000);
}

// Modal Helpers
function openModal(id) {
  const el = $(id);
  if (el) el.classList.remove('hide');
}

function closeModal(id) {
  const el = $(id);
  if (el) el.classList.add('hide');
}

document.querySelectorAll('[data-close]').forEach((btn) => {
  btn.addEventListener('click', () => closeModal(btn.dataset.close));
});

// Close modal when clicking on backdrop
document.querySelectorAll('.admin-modal-backdrop').forEach((modal) => {
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.classList.add('hide');
  });
});

// ================= TAB SWITCHING =================
function switchTab(tabId) {
  AdminState.activeTab = tabId;

  document.querySelectorAll('#adminSidebarNav .admin-nav-item').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.tab === tabId);
  });

  document.querySelectorAll('.tab-view').forEach((view) => {
    view.classList.toggle('hide', view.id !== `tab-${tabId}`);
    view.classList.toggle('active', view.id === `tab-${tabId}`);
  });

  const titles = {
    // Existing titles (kept for backward compatibility)
    'dashboard': 'Clinical Overview & Dashboard',
    'users': 'User Directory',
    // New monitoring & oversight modules
    'live-feed': 'Live Activity Feed — Real-Time System Monitor',
    'user-360': 'User 360° Investigation Dossier',
    'session-monitor': 'Login & Session Monitor',
    'adherence-watchlist': 'Adherence Watchlist — Clinical Compliance Monitoring',
    'medication-changes': 'Medication & Schedule Change Tracker',
    'alert-center': 'Emergency & Alert Center',
    'care-circle-map': 'Care Circle Relationship Matrix',
    'data-access-audit': 'Administrative Data Access Audit Ledger',
    // Retain other legacy titles
    'medications': 'Cross-Patient Medication Formulary',
    'adherence': 'Dose Adherence & At-Risk Monitoring',
    'doctors': 'Doctor & Clinical Directory',
    'care-circles': 'Care Circle & Family Connections',
    'clinical-oversight': 'Clinical Oversight & Care Team Observations',
    'reminders': 'Reminder Logs & System Configuration',
    'reports': 'Regulatory & Adherence Compliance Reports',
    'activity': 'System-Wide User Activity Stream',
    'audit': 'Forensic Audit Log & Administrator Profile'
  };
  if ($('currentTabTitle')) {
    $('currentTabTitle').textContent = titles[tabId] || 'Administrator Console';
  }

  // Load appropriate module
  if (tabId === 'dashboard') {
    loadDashboard();
  } else if (tabId === 'users') {
    loadUsers();
  } else if (tabId === 'medications') {
    loadMedications();
  } else if (tabId === 'adherence') {
    loadAdherence();
  } else if (tabId === 'doctors') {
    loadDoctors();
  } else if (tabId === 'care-circles') {
    loadCareCircles();
  } else if (tabId === 'clinical-oversight') {
    loadClinicalOversight();
  } else if (tabId === 'reminders') {
    loadReminders();
  } else if (tabId === 'reports') {
    initReports();
  } else if (tabId === 'activity') {
    loadActivity();
  } else if (tabId === 'audit') {
    loadAuditLog();
  } else if (tabId === 'live-feed') {
    loadLiveFeed();
  } else if (tabId === 'user-360') {
    initUser360();
  } else if (tabId === 'session-monitor') {
    loadSessionMonitor();
  } else if (tabId === 'adherence-watchlist') {
    loadAdherenceWatchlist();
  } else if (tabId === 'medication-changes') {
    loadMedicationChanges();
  } else if (tabId === 'alert-center') {
    loadAlertCenter();
  } else if (tabId === 'care-circle-map') {
    loadCareCircleMap();
  } else if (tabId === 'data-access-audit') {
    loadDataAccessAudit();
  }
}

document.querySelectorAll('#adminSidebarNav .admin-nav-item').forEach((btn) => {
  btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});

// Admin Sign Out
if ($('btnAdminSignOut')) {
  $('btnAdminSignOut').addEventListener('click', async () => {
    try {
      await adminApi('/auth/logout', { method: 'POST' });
    } catch {}
    localStorage.removeItem('dosetrack_admin_token');
    localStorage.removeItem('dosetrack_admin_user');
    window.location.href = '/admin/login';
  });
}

// Date in Topbar
if ($('adminDateLabel')) {
  $('adminDateLabel').textContent = new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }).format(new Date()).toUpperCase();
}

// ================= DASHBOARD MODULE =================
async function loadDashboard() {
  try {
    const data = await adminApi('/dashboard/stats');
    if (!data) return;

    const { kpis, charts, recentActivity } = data;

    // 1. KPI Cards
    if ($('kpiTotalUsers')) $('kpiTotalUsers').textContent = kpis.usersByRole.totalUsers || 0;
    if ($('kpiUsersBreakdown')) {
      $('kpiUsersBreakdown').textContent = 
        `${kpis.usersByRole.patient} Patients · ${kpis.usersByRole.guardian} Guardians · ${kpis.usersByRole.caretaker} Nurses`;
    }
    if ($('kpiActiveMeds')) $('kpiActiveMeds').textContent = kpis.activeMedications || 0;
    if ($('kpiDosesToday')) {
      $('kpiDosesToday').textContent = `${kpis.dosesToday.taken} / ${kpis.dosesToday.scheduled}`;
    }
    if ($('kpiDosesSub')) {
      $('kpiDosesSub').textContent = `${kpis.dosesToday.missed} missed · ${kpis.dosesToday.pending} upcoming`;
    }
    if ($('kpiAdherenceRate')) $('kpiAdherenceRate').textContent = `${kpis.adherenceRate}%`;
    if ($('kpiAdherenceSub')) {
      $('kpiAdherenceSub').textContent = `${kpis.taken30d} taken / ${kpis.total30d} recorded (30d)`;
    }
    if ($('kpiMissedToday')) $('kpiMissedToday').textContent = kpis.dosesToday.missed;
    if ($('kpiAtRiskCount')) $('kpiAtRiskCount').textContent = kpis.atRiskCount;

    // 2. Charts
    drawAdherenceTrendChart($('chartAdherenceTrend'), charts.dailyTrend || []);
    drawDonutChart($('chartDoseDonut'), charts.donut.taken, charts.donut.missed);

    // 3. Recent Activity Lists
    renderRecentDoses(recentActivity.doses || []);
    renderRecentAudit(recentActivity.auditLogs || []);

    // 4. Unified 360-degree Omni Care Feed
    loadDashboardOmniFeed();
  } catch (err) {
    showToast('Failed to load dashboard statistics: ' + err.message, true);
  }
}

async function loadDashboardOmniFeed() {
  const container = $('dashboardOmniFeed');
  if (!container) return;

  try {
    const data = await adminApi('/clinical-oversight/omni-feed?limit=6');
    if (!data || !data.feed || !data.feed.length) {
      container.innerHTML = '<div style="color:var(--ink-400); font-size:13px; padding:12px;">No care activities recorded yet.</div>';
      return;
    }

    const typeIcons = {
      dose: '💊',
      note: '📝',
      alert: '🚨',
      appointment: '📅'
    };

    const roleColors = {
      patient: '#0f766e',
      guardian: '#4338ca',
      caretaker: '#0369a1',
      system: '#b45309'
    };

    container.innerHTML = data.feed.map((item) => {
      const icon = typeIcons[item.type] || '📌';
      const rColor = roleColors[item.actor.role] || '#475569';
      return `
        <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:8px; padding:12px; font-size:12.5px; box-shadow:0 1px 2px rgba(0,0,0,0.03);">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
            <span style="font-weight:700; color:${rColor}; display:flex; align-items:center; gap:4px;">
              <span>${icon}</span> ${esc(item.actor.name)}
              <small style="background:#f1f5f9; color:#475569; padding:1px 5px; border-radius:3px; font-size:10px; text-transform:uppercase;">${esc(item.actor.role)}</small>
            </span>
            <small style="color:var(--ink-400); font-size:11px;">${esc(String(item.timestamp || '').slice(11, 16) || '')}</small>
          </div>
          <div style="color:var(--ink-800); font-weight:600; font-size:12.5px; margin-bottom:4px;">
            ${esc(item.summary)}
          </div>
          <div style="display:flex; justify-content:space-between; align-items:center; font-size:11px; color:var(--ink-500); border-top:1px dashed #f1f5f9; padding-top:6px; margin-top:6px;">
            <span>Patient: <strong>${esc(item.patient.name)}</strong> (${esc(item.patient.patientCode || 'PT')})</span>
            <span style="font-weight:700; text-transform:capitalize; color:#0d9488;">${esc(item.outcome)}</span>
          </div>
        </div>
      `;
    }).join('');
  } catch (err) {
    container.innerHTML = '<div style="color:var(--ink-400); font-size:12px; padding:10px;">Unable to load omni-feed.</div>';
  }
}

if ($('btnGoToClinicalOversight')) {
  $('btnGoToClinicalOversight').addEventListener('click', () => switchTab('clinical-oversight'));
}

function renderRecentDoses(doses) {
  const container = $('recentDosesList');
  if (!container) return;

  if (!doses.length) {
    container.innerHTML = '<div style="color:var(--ink-400); font-size:13px; padding:10px;">No dose events recorded yet.</div>';
    return;
  }

  container.innerHTML = doses.map((d) => {
    const isTaken = d.status === 'taken';
    const dotClass = isTaken ? 'dot-taken' : 'dot-missed';
    const statusText = isTaken ? 'Taken' : 'Missed';
    const statusColor = isTaken ? '#059669' : '#dc2626';

    return `
      <div class="activity-item">
        <span class="activity-dot ${dotClass}"></span>
        <div class="activity-content">
          <div><strong>${esc(d.patient_name)}</strong> (${esc(d.patient_code || 'PT')})</div>
          <div style="font-size:12px; color:var(--ink-700);">
            <span style="font-weight:700; color:${statusColor};">${statusText}:</span> ${esc(d.medication_name)} ${esc(d.dosage)}
          </div>
          <div class="activity-meta">Scheduled: ${esc(d.scheduled_for)}</div>
        </div>
      </div>
    `;
  }).join('');
}

function renderRecentAudit(logs) {
  const container = $('recentAuditList');
  if (!container) return;

  if (!logs.length) {
    container.innerHTML = '<div style="color:var(--ink-400); font-size:13px; padding:10px;">No audit events logged yet.</div>';
    return;
  }

  container.innerHTML = logs.map((l) => `
    <div class="activity-item">
      <span class="activity-dot dot-audit"></span>
      <div class="activity-content">
        <div><strong>${esc(l.action)}</strong> by ${esc(l.admin_name)}</div>
        <div style="font-size:12px; color:var(--ink-600);">${esc(l.details)}</div>
        <div class="activity-meta">${esc(l.created_at)}</div>
      </div>
    </div>
  `).join('');
}

// Canvas Line Chart (Smooth 30-Day Adherence Trend)
function drawAdherenceTrendChart(canvas, data) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const w = rect.width || 500;
  const h = 220;

  canvas.width = w * dpr;
  canvas.height = h * dpr;
  ctx.scale(dpr, dpr);

  ctx.clearRect(0, 0, w, h);

  const padLeft = 40;
  const padRight = 20;
  const padTop = 20;
  const padBottom = 30;
  const plotW = w - padLeft - padRight;
  const plotH = h - padTop - padBottom;

  // Grid lines (0, 25, 50, 75, 100%)
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 1;
  ctx.fillStyle = '#94a3b8';
  ctx.font = '10px -apple-system, sans-serif';
  ctx.textAlign = 'right';

  [0, 25, 50, 75, 100].forEach((val) => {
    const y = padTop + plotH - (val / 100) * plotH;
    ctx.beginPath();
    ctx.moveTo(padLeft, y);
    ctx.lineTo(w - padRight, y);
    ctx.stroke();
    ctx.fillText(`${val}%`, padLeft - 6, y + 3);
  });

  if (!data || data.length < 2) return;

  const points = data.map((d, i) => {
    const x = padLeft + (i / (data.length - 1)) * plotW;
    const rate = d.adherenceRate != null ? d.adherenceRate : 100;
    const y = padTop + plotH - (rate / 100) * plotH;
    return { x, y, rate, label: d.label, hasData: d.total > 0 };
  });

  // Area gradient
  const grad = ctx.createLinearGradient(0, padTop, 0, padTop + plotH);
  grad.addColorStop(0, 'rgba(13, 148, 136, 0.28)');
  grad.addColorStop(1, 'rgba(13, 148, 136, 0.0)');

  ctx.beginPath();
  ctx.moveTo(points[0].x, padTop + plotH);
  ctx.lineTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    const xc = (points[i - 1].x + points[i].x) / 2;
    const yc = (points[i - 1].y + points[i].y) / 2;
    ctx.quadraticCurveTo(points[i - 1].x, points[i - 1].y, xc, yc);
  }
  ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
  ctx.lineTo(points[points.length - 1].x, padTop + plotH);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  // Line
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    const xc = (points[i - 1].x + points[i].x) / 2;
    const yc = (points[i - 1].y + points[i].y) / 2;
    ctx.quadraticCurveTo(points[i - 1].x, points[i - 1].y, xc, yc);
  }
  ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
  ctx.strokeStyle = '#0d9488';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // Draw points
  points.forEach((p, idx) => {
    if (p.hasData || idx % 5 === 0) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.hasData ? 4 : 2, 0, Math.PI * 2);
      ctx.fillStyle = p.hasData ? '#0f766e' : '#cbd5e1';
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  });

  // X Axis Date Labels (every 5th day)
  ctx.fillStyle = '#64748b';
  ctx.textAlign = 'center';
  points.forEach((p, idx) => {
    if (idx % 6 === 0 || idx === points.length - 1) {
      ctx.fillText(p.label, p.x, h - 8);
    }
  });
}

// Canvas Donut Chart (Taken vs Missed)
function drawDonutChart(canvas, taken = 0, missed = 0) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const w = rect.width || 280;
  const h = 220;

  canvas.width = w * dpr;
  canvas.height = h * dpr;
  ctx.scale(dpr, dpr);

  ctx.clearRect(0, 0, w, h);

  const total = taken + missed;
  const cx = w / 2;
  const cy = h / 2 - 10;
  const radius = Math.min(cx, cy) - 20;
  const innerRadius = radius * 0.62;

  if (total === 0) {
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 22;
    ctx.stroke();

    ctx.fillStyle = '#94a3b8';
    ctx.font = '12px -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('No data', cx, cy + 4);
    return;
  }

  const takenAngle = (taken / total) * Math.PI * 2;
  const missedAngle = (missed / total) * Math.PI * 2;

  // Arc 1: Taken (Emerald)
  ctx.beginPath();
  ctx.arc(cx, cy, radius, -Math.PI / 2, -Math.PI / 2 + takenAngle, false);
  ctx.strokeStyle = '#10b981';
  ctx.lineWidth = 24;
  ctx.lineCap = 'round';
  ctx.stroke();

  // Arc 2: Missed (Rose)
  if (missed > 0) {
    ctx.beginPath();
    ctx.arc(cx, cy, radius, -Math.PI / 2 + takenAngle, -Math.PI / 2 + takenAngle + missedAngle, false);
    ctx.strokeStyle = '#e11d48';
    ctx.lineWidth = 24;
    ctx.lineCap = 'round';
    ctx.stroke();
  }

  // Center text
  const pct = Math.round((taken / total) * 100);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 22px Outfit, sans-serif';
  ctx.fillText(`${pct}%`, cx, cy + 3);

  ctx.fillStyle = '#64748b';
  ctx.font = '10px -apple-system, sans-serif';
  ctx.fillText('TAKEN RATE', cx, cy + 18);

  // Bottom Legend
  ctx.font = '11px -apple-system, sans-serif';
  ctx.fillStyle = '#10b981';
  ctx.fillText(`● Taken: ${taken}`, cx - 50, h - 10);
  ctx.fillStyle = '#e11d48';
  ctx.fillText(`● Missed: ${missed}`, cx + 50, h - 10);
}

// ================= USER MANAGEMENT MODULE =================
async function loadUsers() {
  try {
    const tbody = $('usersTableBody');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:32px; color:var(--ink-400);">Loading users...</td></tr>';

    const params = new URLSearchParams({
      page: AdminState.usersPage,
      limit: AdminState.usersLimit,
      search: AdminState.usersSearch,
      role: AdminState.usersRole,
      status: AdminState.usersStatus
    });

    const data = await adminApi('/users?' + params.toString());
    if (!data) return;

    AdminState.usersTotal = data.pagination.total;
    renderUsersTable(data.users);
    updateUsersPagination(data.pagination);
  } catch (err) {
    showToast('Failed to load users: ' + err.message, true);
  }
}

function renderUsersTable(users) {
  const tbody = $('usersTableBody');
  if (!tbody) return;

  if (!users.length) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:32px; color:var(--ink-400);">No user accounts match current filters.</td></tr>';
    return;
  }

  tbody.innerHTML = users.map((u) => {
    const avatarLetter = (u.fullName || 'U').charAt(0).toUpperCase();
    const avatarBg = u.avatarColor || '#0d9488';
    const roleBadgeClass = `badge-role badge-role-${u.role}`;
    const statusBadgeClass = u.isActive ? 'badge-status badge-status-active' : 'badge-status badge-status-inactive';
    const statusText = u.isActive ? '● Active' : '● Inactive';
    const toggleTitle = u.isActive ? 'Deactivate account' : 'Activate account';
    const isSelf = AdminState.user && AdminState.user.id === u.id;

    return `
      <tr>
        <td>
          <div class="user-cell">
            <div class="user-avatar-sm" style="background:${avatarBg};">${avatarLetter}</div>
            <div class="user-cell-meta">
              <strong>${esc(u.fullName)} ${isSelf ? '<span style="font-size:10px; color:#b45309; background:#fef3c7; padding:1px 5px; border-radius:3px;">YOU</span>' : ''}</strong>
              <small>ID: #${u.id}</small>
            </div>
          </div>
        </td>
        <td><span class="${roleBadgeClass}">${esc(u.role)}</span></td>
        <td><code>${esc(u.patientCode || '—')}</code></td>
        <td><span title="Privacy protected (Partially masked)">${esc(u.maskedEmail)}</span></td>
        <td>${esc(u.maskedPhone)}</td>
        <td><span class="${statusBadgeClass}">${statusText}</span></td>
        <td><small style="color:var(--ink-600);">${esc(String(u.createdAt || '').slice(0, 10))}</small></td>
        <td>
          <div class="table-actions">
            <button type="button" class="btn-action-icon btn-view-user" data-id="${u.id}" title="View Full Clinical Profile & Dossier">👁️</button>
            <button type="button" class="btn-action-icon btn-edit-user" data-id="${u.id}" title="Edit Profile Details">✏️</button>
            ${!isSelf ? `
              <button type="button" class="btn-action-icon btn-toggle-user" data-id="${u.id}" title="${toggleTitle}">
                ${u.isActive ? '⏸️' : '▶️'}
              </button>
            ` : ''}
            <button type="button" class="btn-action-icon btn-reset-pwd" data-id="${u.id}" data-name="${esc(u.fullName)}" title="Reset Password">🔑</button>
            ${!isSelf ? `
              <button type="button" class="btn-action-icon btn-action-danger btn-delete-user" data-id="${u.id}" data-name="${esc(u.fullName)}" title="Delete User">🗑️</button>
            ` : ''}
          </div>
        </td>
      </tr>
    `;
  }).join('');

  // Attach row action listeners
  tbody.querySelectorAll('.btn-view-user').forEach((btn) => {
    btn.addEventListener('click', () => viewUserDetails(btn.dataset.id));
  });

  tbody.querySelectorAll('.btn-edit-user').forEach((btn) => {
    btn.addEventListener('click', () => openEditUserModal(btn.dataset.id));
  });

  tbody.querySelectorAll('.btn-toggle-user').forEach((btn) => {
    btn.addEventListener('click', () => toggleUserStatus(btn.dataset.id));
  });

  tbody.querySelectorAll('.btn-reset-pwd').forEach((btn) => {
    btn.addEventListener('click', () => openResetPasswordModal(btn.dataset.id, btn.dataset.name));
  });

  tbody.querySelectorAll('.btn-delete-user').forEach((btn) => {
    btn.addEventListener('click', () => openDeleteUserModal(btn.dataset.id, btn.dataset.name));
  });
}

function updateUsersPagination(p) {
  if ($('usersPaginationInfo')) {
    const start = (p.page - 1) * p.limit + 1;
    const end = Math.min(p.total, p.page * p.limit);
    $('usersPaginationInfo').textContent = p.total > 0 ? `Showing ${start}-${end} of ${p.total} users` : 'No users found';
  }

  if ($('usersPageCurrent')) $('usersPageCurrent').textContent = p.page;
  if ($('btnPrevUsersPage')) $('btnPrevUsersPage').disabled = p.page <= 1;
  if ($('btnNextUsersPage')) $('btnNextUsersPage').disabled = p.page >= p.pages;
}

// User Filter & Pagination Handlers
if ($('userSearchInput')) {
  let searchTimer;
  $('userSearchInput').addEventListener('input', (e) => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      AdminState.usersSearch = e.target.value;
      AdminState.usersPage = 1;
      loadUsers();
    }, 300);
  });
}

if ($('userRoleFilter')) {
  $('userRoleFilter').addEventListener('change', (e) => {
    AdminState.usersRole = e.target.value;
    AdminState.usersPage = 1;
    loadUsers();
  });
}

if ($('userStatusFilter')) {
  $('userStatusFilter').addEventListener('change', (e) => {
    AdminState.usersStatus = e.target.value;
    AdminState.usersPage = 1;
    loadUsers();
  });
}

if ($('btnPrevUsersPage')) {
  $('btnPrevUsersPage').addEventListener('click', () => {
    if (AdminState.usersPage > 1) {
      AdminState.usersPage--;
      loadUsers();
    }
  });
}

if ($('btnNextUsersPage')) {
  $('btnNextUsersPage').addEventListener('click', () => {
    AdminState.usersPage++;
    loadUsers();
  });
}

// ================= USER MODAL ACTIONS =================

// 1. Add User
if ($('btnOpenAddUser')) {
  $('btnOpenAddUser').addEventListener('click', () => {
    $('formAddUser').reset();
    $('newPassword').value = 'password123';
    openModal('modalAddUser');
  });
}

if ($('newRole')) {
  $('newRole').addEventListener('change', (e) => {
    const isPatient = e.target.value === 'patient';
    $('wrapNewEmergency').style.display = isPatient ? 'block' : 'none';
  });
}

if ($('formAddUser')) {
  $('formAddUser').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const payload = {
        fullName: $('newFullName').value.trim(),
        role: $('newRole').value,
        email: $('newEmail').value.trim(),
        phone: $('newPhone').value.trim(),
        password: $('newPassword').value,
        emergencyContact: $('newEmergency').value.trim()
      };

      const res = await adminApi('/users', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      showToast(`User ${payload.fullName} created successfully.`);
      closeModal('modalAddUser');
      loadUsers();
    } catch (err) {
      showToast(err.message, true);
    }
  });
}

// 2. View User Details & Clinical Dossier
async function viewUserDetails(userId) {
  try {
    const content = $('userDetailsContent');
    content.innerHTML = '<div style="text-align:center; padding:30px; color:var(--ink-400);">Loading dossier & recording audit log...</div>';
    openModal('modalUserDetails');

    const data = await adminApi(`/users/${userId}`);
    if (!data) return;

    const { user, careTeam, assignedPatients, medications, adherenceStats, recentNotes, recentAlerts } = data;

    let roleSpecificHtml = '';

    if (user.role === 'patient') {
      const rate = adherenceStats?.rate ?? 100;
      const riskBadge = rate < 70
        ? '<span class="badge-risk badge-risk-danger">AT RISK (&lt;70%)</span>'
        : rate < 85
        ? '<span class="badge-risk badge-risk-warning">MODERATE (70-85%)</span>'
        : '<span class="badge-risk badge-risk-success">OPTIMAL (&gt;85%)</span>';

      roleSpecificHtml = `
        <div style="margin-top:18px; padding-top:16px; border-top:1px solid #e2e8f0;">
          <h4 style="font-size:14px; margin-bottom:10px;">📈 30-Day Adherence Metric</h4>
          <div style="background:#f8fafc; padding:12px; border-radius:8px; border:1px solid #e2e8f0; display:flex; align-items:center; justify-content:space-between;">
            <div>
              <div style="font-size:22px; font-weight:800; color:#0f172a;">${rate}%</div>
              <small style="color:var(--ink-600);">${adherenceStats?.taken || 0} Taken / ${adherenceStats?.total || 0} Scheduled doses</small>
            </div>
            <div>${riskBadge}</div>
          </div>
        </div>

        <div style="margin-top:18px;">
          <h4 style="font-size:14px; margin-bottom:10px;">💊 Active Medications (${medications?.length || 0})</h4>
          ${medications?.length ? `
            <div style="display:flex; flex-direction:column; gap:6px;">
              ${medications.map(m => `
                <div style="background:#ffffff; border:1px solid #e2e8f0; padding:10px; border-radius:6px; font-size:13px;">
                  <div style="display:flex; justify-content:space-between;">
                    <strong>${esc(m.name)} ${esc(m.dosage)}</strong>
                    <span style="font-size:11px; color:#0d9488; font-weight:700;">${esc(m.frequency)}</span>
                  </div>
                  <div style="font-size:11.5px; color:var(--ink-600); margin-top:2px;">
                    Times: ${esc(m.dose_times || 'No set times')}
                  </div>
                </div>
              `).join('')}
            </div>
          ` : '<p style="font-size:12px; color:var(--ink-400);">No medications registered.</p>'}
        </div>

        <div style="margin-top:18px;">
          <h4 style="font-size:14px; margin-bottom:10px;">⭕ Care Circle Members</h4>
          ${careTeam?.length ? `
            <div style="display:flex; flex-direction:column; gap:6px;">
              ${careTeam.map(c => `
                <div style="background:#f8fafc; border:1px solid #e2e8f0; padding:8px 12px; border-radius:6px; font-size:12.5px; display:flex; justify-content:space-between; align-items:center;">
                  <div>
                    <strong>${esc(c.full_name)}</strong> (${esc(c.role)})
                    <div style="font-size:11px; color:var(--ink-400);">${esc(c.relationship)} · ${esc(c.phone || c.email)}</div>
                  </div>
                </div>
              `).join('')}
            </div>
          ` : '<p style="font-size:12px; color:var(--ink-400);">No connected care team members.</p>'}
        </div>

        ${recentNotes?.length ? `
          <div style="margin-top:18px;">
            <h4 style="font-size:14px; margin-bottom:10px;">📋 Recent Care Notes & Observations (${recentNotes.length})</h4>
            <div style="display:flex; flex-direction:column; gap:6px;">
              ${recentNotes.map(n => `
                <div style="background:#ffffff; border:1px solid #e2e8f0; padding:10px; border-radius:6px; font-size:12.5px;">
                  <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                    <span style="font-weight:700; color:#0f766e;">${esc(n.author_name || 'Care Team')} (${esc(n.author_role || '')})</span>
                    <span style="font-size:11px; color:var(--ink-400);">${esc(String(n.created_at || '').slice(0, 16))}</span>
                  </div>
                  <div style="color:var(--ink-800);">${esc(n.content)}</div>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}

        ${recentAlerts?.length ? `
          <div style="margin-top:18px;">
            <h4 style="font-size:14px; margin-bottom:10px;">🚨 Recent Care Alerts (${recentAlerts.length})</h4>
            <div style="display:flex; flex-direction:column; gap:6px;">
              ${recentAlerts.map(a => `
                <div style="background:#fff7ed; border:1px solid #ffedd5; padding:8px 12px; border-radius:6px; font-size:12px; display:flex; justify-content:space-between;">
                  <div>
                    <strong>${esc(a.title)}:</strong> ${esc(a.message)}
                  </div>
                  <span style="font-size:11px; color:#c2410c;">${esc(String(a.created_at || '').slice(0, 16))}</span>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}
      `;
    } else if (user.role === 'guardian' || user.role === 'caretaker') {
      roleSpecificHtml = `
        <div style="margin-top:18px;">
          <h4 style="font-size:14px; margin-bottom:10px;">👥 Assigned Patients (${assignedPatients?.length || 0})</h4>
          ${assignedPatients?.length ? `
            <div style="display:flex; flex-direction:column; gap:6px;">
              ${assignedPatients.map(p => `
                <div style="background:#f8fafc; border:1px solid #e2e8f0; padding:8px 12px; border-radius:6px; font-size:12.5px; display:flex; justify-content:space-between; align-items:center;">
                  <div>
                    <strong>${esc(p.full_name)}</strong> [<code>${esc(p.patient_code)}</code>]
                    <div style="font-size:11px; color:var(--ink-400);">${esc(p.relationship)} · Phone: ${esc(p.phone || '—')}</div>
                  </div>
                </div>
              `).join('')}
            </div>
          ` : '<p style="font-size:12px; color:var(--ink-400);">No connected patients assigned.</p>'}
        </div>

        ${recentNotes?.length ? `
          <div style="margin-top:18px;">
            <h4 style="font-size:14px; margin-bottom:10px;">📝 Notes Authored for Patients (${recentNotes.length})</h4>
            <div style="display:flex; flex-direction:column; gap:6px;">
              ${recentNotes.map(n => `
                <div style="background:#ffffff; border:1px solid #e2e8f0; padding:10px; border-radius:6px; font-size:12.5px;">
                  <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                    <span style="font-weight:700; color:#0f766e;">For: ${esc(n.patient_name || 'Patient')} [<code>${esc(n.patient_code || '')}</code>]</span>
                    <span style="font-size:11px; color:var(--ink-400);">${esc(String(n.created_at || '').slice(0, 16))}</span>
                  </div>
                  <div style="color:var(--ink-800);">${esc(n.content)}</div>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}
      `;
    }

    content.innerHTML = `
      <div style="display:flex; align-items:center; gap:14px; margin-bottom:16px;">
        <div class="user-avatar-sm" style="width:48px; height:48px; font-size:18px; background:${user.avatarColor || '#0d9488'};">
          ${(user.fullName || 'U').charAt(0).toUpperCase()}
        </div>
        <div>
          <h3 style="font-size:18px; color:var(--ink-900); margin-bottom:2px;">${esc(user.fullName)}</h3>
          <div style="display:flex; gap:8px; align-items:center;">
            <span class="badge-role badge-role-${user.role}">${esc(user.role)}</span>
            <span class="badge-status ${user.isActive ? 'badge-status-active' : 'badge-status-inactive'}">
              ${user.isActive ? 'Active' : 'Inactive'}
            </span>
            ${user.patientCode ? `<code>${esc(user.patientCode)}</code>` : ''}
          </div>
        </div>
      </div>

      <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:14px; font-size:13px; display:grid; grid-template-columns:1fr 1fr; gap:10px;">
        <div><strong>Unmasked Email:</strong> <br>${esc(user.email)}</div>
        <div><strong>Direct Phone:</strong> <br>${esc(user.phone || '—')}</div>
        <div><strong>Emergency Contact:</strong> <br>${esc(user.emergencyContact || '—')}</div>
        <div><strong>Registered Date:</strong> <br>${esc(user.createdAt)}</div>
      </div>

      ${roleSpecificHtml}

      <div style="margin-top:20px; padding:10px; background:#fef3c7; border:1px solid #fde68a; border-radius:6px; font-size:11px; color:#92400e;">
        🛡️ <strong>Compliance Audit Notice:</strong> Access to this unmasked medical record was recorded in the forensic audit log under administrator ID #${AdminState.user?.id}.
      </div>
    `;
  } catch (err) {
    showToast('Failed to load user details: ' + err.message, true);
  }
}

// 3. Edit User
async function openEditUserModal(userId) {
  try {
    const data = await adminApi(`/users/${userId}`);
    if (!data || !data.user) return;
    const u = data.user;

    $('editUserId').value = u.id;
    $('editFullName').value = u.fullName;
    $('editRole').value = u.role;
    $('editEmail').value = u.email;
    $('editPhone').value = u.phone;
    $('editEmergency').value = u.emergencyContact;

    openModal('modalEditUser');
  } catch (err) {
    showToast('Failed to load user for editing: ' + err.message, true);
  }
}

if ($('formEditUser')) {
  $('formEditUser').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const userId = $('editUserId').value;
      const payload = {
        fullName: $('editFullName').value.trim(),
        role: $('editRole').value,
        email: $('editEmail').value.trim(),
        phone: $('editPhone').value.trim(),
        emergencyContact: $('editEmergency').value.trim()
      };

      await adminApi(`/users/${userId}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      });

      showToast('User profile updated successfully.');
      closeModal('modalEditUser');
      loadUsers();
    } catch (err) {
      showToast(err.message, true);
    }
  });
}

// 4. Toggle Status (Activate / Deactivate)
async function toggleUserStatus(userId) {
  try {
    const res = await adminApi(`/users/${userId}/toggle-status`, {
      method: 'PATCH'
    });
    if (res) {
      showToast(res.message);
      loadUsers();
    }
  } catch (err) {
    showToast(err.message, true);
  }
}

// 5. Reset Password
function openResetPasswordModal(userId, fullName) {
  $('resetUserId').value = userId;
  $('resetUserPrompt').innerHTML = `Reset password for <strong>${esc(fullName)}</strong>:`;
  $('newResetPassword').value = '';
  openModal('modalResetPassword');
}

if ($('formResetPassword')) {
  $('formResetPassword').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const userId = $('resetUserId').value;
      const password = $('newResetPassword').value.trim();

      const res = await adminApi(`/users/${userId}/reset-password`, {
        method: 'POST',
        body: JSON.stringify({ password: password || undefined })
      });

      if (res.newPassword) {
        alert(`Password reset successfully!\n\nNew Temporary Password: ${res.newPassword}\n\nPlease communicate this securely to the user.`);
      } else {
        showToast(res.message);
      }

      closeModal('modalResetPassword');
    } catch (err) {
      showToast(err.message, true);
    }
  });
}

// 6. Delete User
function openDeleteUserModal(userId, fullName) {
  AdminState.targetDeleteUserId = userId;
  $('deleteUserPrompt').innerHTML = `Are you sure you want to permanently delete user account <strong>${esc(fullName)}</strong>?`;
  openModal('modalDeleteUser');
}

if ($('btnConfirmDeleteUser')) {
  $('btnConfirmDeleteUser').addEventListener('click', async () => {
    if (!AdminState.targetDeleteUserId) return;
    try {
      const res = await adminApi(`/users/${AdminState.targetDeleteUserId}`, {
        method: 'DELETE'
      });
      showToast(res.message);
      closeModal('modalDeleteUser');
      AdminState.targetDeleteUserId = null;
      loadUsers();
    } catch (err) {
      showToast(err.message, true);
    }
  });
}

// ================= PATIENT FILTERS POPULATOR =================
let _cachedPatients = null;
async function populatePatientFilters() {
  if (_cachedPatients) return;
  try {
    const data = await adminApi('/users?role=patient&limit=100');
    if (!data || !data.users) return;
    _cachedPatients = data.users;

    const optionsHtml = '<option value="">All Patients</option>' +
      _cachedPatients.map(p => `<option value="${p.id}">${esc(p.fullName)} (${esc(p.patientCode || 'PT')})</option>`).join('');

    if ($('medPatientFilter')) $('medPatientFilter').innerHTML = optionsHtml;
    if ($('adhPatientFilter')) $('adhPatientFilter').innerHTML = optionsHtml;
    if ($('docPatientSelect')) {
      $('docPatientSelect').innerHTML = '<option value="">General Clinical Directory (All Patients)</option>' +
        _cachedPatients.map(p => `<option value="${p.id}">${esc(p.fullName)} (${esc(p.patientCode || 'PT')})</option>`).join('');
    }
  } catch (e) {
    console.warn('Could not populate patient filters:', e);
  }
}

// ================= MEDICATIONS MODULE =================
AdminState.medsPage = 1;
AdminState.medsLimit = 15;
AdminState.medsSearch = '';
AdminState.medsPatient = '';
AdminState.medsStatus = '';

async function loadMedications() {
  try {
    await populatePatientFilters();
    const tbody = $('medsTableBody');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:32px; color:var(--ink-400);">Loading medications...</td></tr>';

    const params = new URLSearchParams({
      page: AdminState.medsPage,
      limit: AdminState.medsLimit,
      search: AdminState.medsSearch,
      patientId: AdminState.medsPatient,
      status: AdminState.medsStatus
    });

    const data = await adminApi('/medications?' + params.toString());
    if (!data) return;

    renderMedicationsTable(data.medications);
    updateMedsPagination(data.pagination);
  } catch (err) {
    showToast('Failed to load medications: ' + err.message, true);
  }
}

function renderMedicationsTable(meds) {
  const tbody = $('medsTableBody');
  if (!tbody) return;

  if (!meds.length) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:32px; color:var(--ink-400);">No prescriptions found matching filters.</td></tr>';
    return;
  }

  tbody.innerHTML = meds.map((m) => {
    const statusBadge = m.isActive
      ? '<span class="badge-status badge-status-active">Active</span>'
      : '<span class="badge-status badge-status-inactive">Paused / Inactive</span>';

    const timesHtml = m.doseTimes?.length
      ? m.doseTimes.map(t => `<span class="time-pill">⏰ ${esc(t)}</span>`).join(' ')
      : '<span style="color:var(--ink-400); font-size:11px;">No active times</span>';

    const toggleBtnText = m.isActive ? '⏸️ Deactivate' : '▶️ Activate';
    const toggleTitle = m.isActive ? 'Pause prescription and linked schedules' : 'Resume prescription and linked schedules';

    return `
      <tr>
        <td>
          <strong style="color:var(--ink-900); font-size:14px;">${esc(m.name)}</strong>
          <div style="font-size:12px; color:var(--ink-600);">${esc(m.dosage)} · ${esc(m.quantity)}</div>
        </td>
        <td>
          <div style="font-weight:600; color:var(--ink-900);">${esc(m.patient.name)}</div>
          <code>${esc(m.patient.patientCode || 'PT')}</code>
        </td>
        <td>
          <div style="font-weight:600; color:#0d9488;">${esc(m.frequency)}</div>
          <small style="color:var(--ink-600);">${esc(m.instructions)}</small>
        </td>
        <td>${timesHtml}</td>
        <td>
          <small style="color:var(--ink-700);">${esc(m.startDate)}<br>to ${esc(m.endDate)}</small>
        </td>
        <td>${statusBadge}</td>
        <td>
          <button type="button" class="btn-action-icon btn-toggle-med" data-id="${m.id}" title="${toggleTitle}">
            ${toggleBtnText}
          </button>
        </td>
      </tr>
    `;
  }).join('');

  tbody.querySelectorAll('.btn-toggle-med').forEach((btn) => {
    btn.addEventListener('click', () => toggleMedicationStatus(btn.dataset.id));
  });
}

function updateMedsPagination(p) {
  if ($('medsPaginationInfo')) {
    const start = (p.page - 1) * p.limit + 1;
    const end = Math.min(p.total, p.page * p.limit);
    $('medsPaginationInfo').textContent = p.total > 0 ? `Showing ${start}-${end} of ${p.total} medications` : 'No records';
  }
  if ($('medsPageCurrent')) $('medsPageCurrent').textContent = p.page;
  if ($('btnPrevMedsPage')) $('btnPrevMedsPage').disabled = p.page <= 1;
  if ($('btnNextMedsPage')) $('btnNextMedsPage').disabled = p.page >= p.pages;
}

async function toggleMedicationStatus(medId) {
  try {
    const res = await adminApi(`/medications/${medId}/toggle-status`, { method: 'PATCH' });
    if (res) {
      showToast(res.message);
      loadMedications();
    }
  } catch (err) {
    showToast(err.message, true);
  }
}

// Medication Filter Listeners
if ($('medSearchInput')) {
  let mSearchTimer;
  $('medSearchInput').addEventListener('input', (e) => {
    clearTimeout(mSearchTimer);
    mSearchTimer = setTimeout(() => {
      AdminState.medsSearch = e.target.value;
      AdminState.medsPage = 1;
      loadMedications();
    }, 300);
  });
}

if ($('medPatientFilter')) {
  $('medPatientFilter').addEventListener('change', (e) => {
    AdminState.medsPatient = e.target.value;
    AdminState.medsPage = 1;
    loadMedications();
  });
}

if ($('medStatusFilter')) {
  $('medStatusFilter').addEventListener('change', (e) => {
    AdminState.medsStatus = e.target.value;
    AdminState.medsPage = 1;
    loadMedications();
  });
}

if ($('btnPrevMedsPage')) {
  $('btnPrevMedsPage').addEventListener('click', () => {
    if (AdminState.medsPage > 1) {
      AdminState.medsPage--;
      loadMedications();
    }
  });
}

if ($('btnNextMedsPage')) {
  $('btnNextMedsPage').addEventListener('click', () => {
    AdminState.medsPage++;
    loadMedications();
  });
}

// ================= ADHERENCE MONITORING MODULE =================
AdminState.adhPage = 1;
AdminState.adhLimit = 25;
AdminState.adhStartDate = '';
AdminState.adhEndDate = '';
AdminState.adhPatient = '';
AdminState.adhStatus = '';

async function loadAdherence() {
  await populatePatientFilters();
  loadAdherenceSummary();
  loadAdherenceEvents();
}

async function loadAdherenceSummary() {
  try {
    const grid = $('adherenceSummaryGrid');
    if (!grid) return;

    const params = new URLSearchParams();
    if (AdminState.adhStartDate) params.set('startDate', AdminState.adhStartDate);
    if (AdminState.adhEndDate) params.set('endDate', AdminState.adhEndDate);

    const data = await adminApi('/adherence/summary?' + params.toString());
    if (!data || !data.patients) return;

    if (!data.patients.length) {
      grid.innerHTML = '<div style="color:var(--ink-400); font-size:13px;">No patient adherence records found.</div>';
      return;
    }

    grid.innerHTML = data.patients.map((p) => {
      let riskBadge = '<span class="badge-risk badge-risk-success">OPTIMAL (&gt;85%)</span>';
      let borderStyle = 'border-color:#e2e8f0;';
      if (p.isAtRisk) {
        riskBadge = '<span class="badge-risk badge-risk-danger">AT RISK (&lt;70%)</span>';
        borderStyle = 'border-color:#fca5a5; background:#fff5f5;';
      } else if (p.riskLevel === 'moderate') {
        riskBadge = '<span class="badge-risk badge-risk-warning">MODERATE (70-85%)</span>';
      }

      return `
        <div class="adherence-patient-card" style="${borderStyle}">
          <div>
            <div style="display:flex; align-items:center; gap:8px;">
              <strong style="color:var(--ink-900); font-size:14px;">${esc(p.name)}</strong>
              <code>${esc(p.patientCode)}</code>
            </div>
            <div style="font-size:12px; color:var(--ink-600); margin-top:4px;">
              ${p.takenCount} Taken · ${p.missedCount} Missed · ${p.totalScheduled} Total
            </div>
          </div>
          <div style="text-align:right;">
            <div style="font-family:var(--font-heading); font-size:20px; font-weight:800; color:${p.isAtRisk ? '#b91c1c' : '#0f766e'};">
              ${p.adherenceRate}%
            </div>
            <div>${riskBadge}</div>
          </div>
        </div>
      `;
    }).join('');
  } catch (err) {
    showToast('Failed to load adherence summary: ' + err.message, true);
  }
}

async function loadAdherenceEvents() {
  try {
    const tbody = $('adherenceTableBody');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:32px; color:var(--ink-400);">Loading dose events...</td></tr>';

    const params = new URLSearchParams({
      page: AdminState.adhPage,
      limit: AdminState.adhLimit,
      startDate: AdminState.adhStartDate,
      endDate: AdminState.adhEndDate,
      patientId: AdminState.adhPatient,
      status: AdminState.adhStatus
    });

    const data = await adminApi('/adherence/events?' + params.toString());
    if (!data) return;

    if ($('adherenceRecordCount')) {
      $('adherenceRecordCount').textContent = `${data.pagination.total} total verified events`;
    }

    renderAdherenceEventsTable(data.events);
    updateAdherencePagination(data.pagination);
  } catch (err) {
    showToast('Failed to load adherence events: ' + err.message, true);
  }
}

function renderAdherenceEventsTable(events) {
  const tbody = $('adherenceTableBody');
  if (!tbody) return;

  if (!events.length) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:32px; color:var(--ink-400);">No dose events matching current criteria.</td></tr>';
    return;
  }

  tbody.innerHTML = events.map((e) => {
    const isTaken = e.status === 'taken';
    const statusPill = isTaken
      ? '<span class="badge-status badge-status-active">● Verified Taken</span>'
      : '<span class="badge-status badge-status-inactive">● Missed Dose</span>';

    return `
      <tr>
        <td><code>#${e.id}</code></td>
        <td><strong>${esc(e.scheduledFor)}</strong></td>
        <td>
          <div style="font-weight:600; color:var(--ink-900);">${esc(e.patient.name)}</div>
          <code>${esc(e.patient.patientCode || 'PT')}</code>
        </td>
        <td>
          <strong>${esc(e.medication.name)}</strong>
          <small style="color:var(--ink-600); display:block;">${esc(e.medication.dosage)}</small>
        </td>
        <td>${statusPill}</td>
        <td><small style="color:var(--ink-600);">${esc(e.recordedAt)}</small></td>
        <td><small style="color:var(--ink-800); font-weight:600;">${esc(e.recordedBy)}</small></td>
      </tr>
    `;
  }).join('');
}

function updateAdherencePagination(p) {
  if ($('adherencePaginationInfo')) {
    const start = (p.page - 1) * p.limit + 1;
    const end = Math.min(p.total, p.page * p.limit);
    $('adherencePaginationInfo').textContent = p.total > 0 ? `Showing ${start}-${end} of ${p.total} events` : 'No events';
  }
  if ($('adhPageCurrent')) $('adhPageCurrent').textContent = p.page;
  if ($('btnPrevAdhPage')) $('btnPrevAdhPage').disabled = p.page <= 1;
  if ($('btnNextAdhPage')) $('btnNextAdhPage').disabled = p.page >= p.pages;
}

// Adherence Filter Handlers
if ($('btnFilterAdherence')) {
  $('btnFilterAdherence').addEventListener('click', () => {
    AdminState.adhStartDate = $('adhStartDate').value;
    AdminState.adhEndDate = $('adhEndDate').value;
    AdminState.adhPatient = $('adhPatientFilter').value;
    AdminState.adhStatus = $('adhStatusFilter').value;
    AdminState.adhPage = 1;
    loadAdherenceSummary();
    loadAdherenceEvents();
  });
}

if ($('btnResetAdherence')) {
  $('btnResetAdherence').addEventListener('click', () => {
    $('adhStartDate').value = '';
    $('adhEndDate').value = '';
    $('adhPatientFilter').value = '';
    $('adhStatusFilter').value = '';
    AdminState.adhStartDate = '';
    AdminState.adhEndDate = '';
    AdminState.adhPatient = '';
    AdminState.adhStatus = '';
    AdminState.adhPage = 1;
    loadAdherenceSummary();
    loadAdherenceEvents();
  });
}

if ($('btnPrevAdhPage')) {
  $('btnPrevAdhPage').addEventListener('click', () => {
    if (AdminState.adhPage > 1) {
      AdminState.adhPage--;
      loadAdherenceEvents();
    }
  });
}

if ($('btnNextAdhPage')) {
  $('btnNextAdhPage').addEventListener('click', () => {
    AdminState.adhPage++;
    loadAdherenceEvents();
  });
}

// Export CSV
if ($('btnExportAdherenceCsv')) {
  $('btnExportAdherenceCsv').addEventListener('click', () => {
    const params = new URLSearchParams({
      startDate: AdminState.adhStartDate,
      endDate: AdminState.adhEndDate,
      patientId: AdminState.adhPatient,
      status: AdminState.adhStatus
    });

    const exportUrl = '/api/admin/adherence/export-csv?' + params.toString();
    // Fetch with Bearer token and trigger download
    fetch(exportUrl, {
      headers: { 'Authorization': `Bearer ${AdminState.token}` }
    })
      .then(res => {
        if (!res.ok) throw new Error('CSV generation failed');
        return res.blob();
      })
      .then(blob => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `DoseTrack_Adherence_Report_${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        showToast('Adherence CSV exported and audit logged successfully.');
      })
      .catch(err => showToast(err.message, true));
  });
}

// ================= DOCTORS & CLINIC DIRECTORY =================
AdminState.docSearch = '';
AdminState.targetDeleteDocId = null;

async function loadDoctors() {
  await populatePatientFilters();
  try {
    const grid = $('doctorsGrid');
    if (!grid) return;

    grid.innerHTML = '<div style="color:var(--ink-400); font-size:13px;">Loading doctors directory...</div>';

    const params = new URLSearchParams();
    if (AdminState.docSearch) params.set('search', AdminState.docSearch);

    const data = await adminApi('/doctors?' + params.toString());
    if (!data || !data.doctors) return;

    if (!data.doctors.length) {
      grid.innerHTML = '<div style="color:var(--ink-400); font-size:13px; grid-column:1/-1;">No doctors found matching query. Click "Add Doctor" to create an entry.</div>';
      return;
    }

    grid.innerHTML = data.doctors.map((d) => `
      <div class="doctor-card">
        <div>
          <div class="doctor-card-top">
            <div>
              <div class="doctor-name-title">${esc(d.name)}</div>
              <span class="doctor-spec-pill">${esc(d.specialization)}</span>
            </div>
            <div class="table-actions">
              <button type="button" class="btn-action-icon btn-edit-doc" data-id="${d.id}" title="Edit Doctor Details">✏️</button>
              <button type="button" class="btn-action-icon btn-action-danger btn-delete-doc" data-id="${d.id}" data-name="${esc(d.name)}" title="Delete Doctor">🗑️</button>
            </div>
          </div>

          <div class="doctor-details-list">
            <div class="doctor-detail-row">
              <span class="doctor-detail-icon">🏥</span>
              <span><strong>${esc(d.clinicName)}</strong></span>
            </div>
            <div class="doctor-detail-row">
              <span class="doctor-detail-icon">📞</span>
              <span>${esc(d.phone)}</span>
            </div>
            <div class="doctor-detail-row">
              <span class="doctor-detail-icon">✉️</span>
              <span>${esc(d.email)}</span>
            </div>
            <div class="doctor-detail-row">
              <span class="doctor-detail-icon">🕒</span>
              <span>${esc(d.availability)}</span>
            </div>
            <div class="doctor-detail-row">
              <span class="doctor-detail-icon">📍</span>
              <span style="font-size:11.5px; color:var(--ink-600);">${esc(d.clinicAddress)}</span>
            </div>
          </div>
        </div>

        <div style="font-size:11px; padding-top:10px; border-top:1px solid #f1f5f9; color:var(--ink-400); display:flex; justify-content:space-between;">
          <span>${d.linkedPatient ? `Assigned to: ${esc(d.linkedPatient.name)}` : 'General Clinic Roster'}</span>
          <span>#DOC-${d.id}</span>
        </div>
      </div>
    `).join('');

    grid.querySelectorAll('.btn-edit-doc').forEach((btn) => {
      btn.addEventListener('click', () => openEditDoctorModal(btn.dataset.id));
    });

    grid.querySelectorAll('.btn-delete-doc').forEach((btn) => {
      btn.addEventListener('click', () => openDeleteDoctorModal(btn.dataset.id, btn.dataset.name));
    });
  } catch (err) {
    showToast('Failed to load doctors: ' + err.message, true);
  }
}

// Doctor Search
if ($('docSearchInput')) {
  let docTimer;
  $('docSearchInput').addEventListener('input', (e) => {
    clearTimeout(docTimer);
    docTimer = setTimeout(() => {
      AdminState.docSearch = e.target.value.trim();
      loadDoctors();
    }, 300);
  });
}

// Add Doctor
if ($('btnOpenAddDoctor')) {
  $('btnOpenAddDoctor').addEventListener('click', () => {
    $('formAddDoctor').reset();
    openModal('modalAddDoctor');
  });
}

if ($('formAddDoctor')) {
  $('formAddDoctor').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const payload = {
        name: $('docName').value.trim(),
        specialization: $('docSpecialization').value.trim(),
        clinicName: $('docClinicName').value.trim(),
        phone: $('docPhone').value.trim(),
        email: $('docEmail').value.trim(),
        availability: $('docAvailability').value.trim(),
        clinicAddress: $('docAddress').value.trim(),
        userId: $('docPatientSelect').value || undefined
      };

      await adminApi('/doctors', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      showToast(`Doctor ${payload.name} added successfully.`);
      closeModal('modalAddDoctor');
      loadDoctors();
    } catch (err) {
      showToast(err.message, true);
    }
  });
}

// Edit Doctor
async function openEditDoctorModal(docId) {
  try {
    const data = await adminApi(`/doctors/${docId}`);
    if (!data || !data.doctor) return;
    const d = data.doctor;

    $('editDocId').value = d.id;
    $('editDocName').value = d.name || '';
    $('editDocSpecialization').value = d.specialization || '';
    $('editDocClinicName').value = d.clinicName || '';
    $('editDocPhone').value = d.phone || '';
    $('editDocEmail').value = d.email || '';
    $('editDocAvailability').value = d.availability || '';
    $('editDocAddress').value = d.clinicAddress || '';

    openModal('modalEditDoctor');
  } catch (err) {
    showToast('Failed to load doctor details: ' + err.message, true);
  }
}

if ($('formEditDoctor')) {
  $('formEditDoctor').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const docId = $('editDocId').value;
      const payload = {
        name: $('editDocName').value.trim(),
        specialization: $('editDocSpecialization').value.trim(),
        clinicName: $('editDocClinicName').value.trim(),
        phone: $('editDocPhone').value.trim(),
        email: $('editDocEmail').value.trim(),
        availability: $('editDocAvailability').value.trim(),
        clinicAddress: $('editDocAddress').value.trim()
      };

      await adminApi(`/doctors/${docId}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      });

      showToast('Doctor details updated successfully.');
      closeModal('modalEditDoctor');
      loadDoctors();
    } catch (err) {
      showToast(err.message, true);
    }
  });
}

// Delete Doctor
function openDeleteDoctorModal(docId, docName) {
  AdminState.targetDeleteDocId = docId;
  $('deleteDocPrompt').innerHTML = `Are you sure you want to remove <strong>${esc(docName)}</strong> from the clinical directory?`;
  openModal('modalDeleteDoctor');
}

if ($('btnConfirmDeleteDoctor')) {
  $('btnConfirmDeleteDoctor').addEventListener('click', async () => {
    if (!AdminState.targetDeleteDocId) return;
    try {
      const res = await adminApi(`/doctors/${AdminState.targetDeleteDocId}`, {
        method: 'DELETE'
      });
      showToast(res.message);
      closeModal('modalDeleteDoctor');
      AdminState.targetDeleteDocId = null;
      loadDoctors();
    } catch (err) {
      showToast(err.message, true);
    }
  });
}
// ================= CARE CIRCLES MODULE =================
AdminState.circlePatient = '';

async function loadCareCircles() {
  await populatePatientFilters();
  try {
    const tbody = $('careCirclesTableBody');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:32px; color:var(--ink-400);">Loading care circle connections...</td></tr>';

    const params = new URLSearchParams();
    if (AdminState.circlePatient) params.set('patientId', AdminState.circlePatient);

    const data = await adminApi('/care-circles?' + params.toString());
    if (!data || !data.connections) return;

    if (!data.connections.length) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:32px; color:var(--ink-400);">No care circle connections found. Click "Connect Care Circle Member" to link a Guardian or Nurse.</td></tr>';
      return;
    }

    tbody.innerHTML = data.connections.map((c) => {
      const perms = [];
      if (c.canManageMeds) perms.push('<span style="font-size:11px; background:#e0f2fe; color:#0369a1; padding:2px 6px; border-radius:3px;">Manage Meds</span>');
      if (c.canRecordDoses) perms.push('<span style="font-size:11px; background:#dcfce7; color:#15803d; padding:2px 6px; border-radius:3px;">Sign Doses</span>');

      return `
        <tr>
          <td>
            <div style="font-weight:700; color:var(--ink-900); font-size:13.5px;">${esc(c.patient.name)}</div>
            <code>${esc(c.patient.patientCode || 'PT')}</code>
          </td>
          <td>
            <div style="font-weight:700; color:var(--ink-900);">${esc(c.member.name)}</div>
            <small style="color:var(--ink-600);">${esc(c.member.email)} · ${esc(c.member.phone)}</small>
          </td>
          <td><span class="badge-role badge-role-${c.member.role}">${esc(c.member.role)}</span></td>
          <td><strong>${esc(c.relationship)}</strong></td>
          <td>${perms.join(' ')}</td>
          <td><small style="color:var(--ink-600);">${esc(String(c.createdAt || '').slice(0, 10))}</small></td>
          <td>
            <button type="button" class="btn-action-icon btn-action-danger btn-disconnect-circle" data-id="${c.id}" data-pt="${esc(c.patient.name)}" data-mem="${esc(c.member.name)}" title="Disconnect Care Circle Link">
              Disconnect
            </button>
          </td>
        </tr>
      `;
    }).join('');

    tbody.querySelectorAll('.btn-disconnect-circle').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (confirm(`Are you sure you want to disconnect ${btn.dataset.mem} from patient ${btn.dataset.pt}?`)) {
          disconnectCareCircle(btn.dataset.id);
        }
      });
    });
  } catch (err) {
    showToast('Failed to load care circles: ' + err.message, true);
  }
}

async function disconnectCareCircle(connId) {
  try {
    const res = await adminApi(`/care-circles/${connId}`, { method: 'DELETE' });
    showToast(res.message);
    loadCareCircles();
  } catch (err) {
    showToast(err.message, true);
  }
}

if ($('circlePatientFilter')) {
  $('circlePatientFilter').addEventListener('change', (e) => {
    AdminState.circlePatient = e.target.value;
    loadCareCircles();
  });
}

// Connect Care Circle Modal
if ($('btnOpenConnectCircle')) {
  $('btnOpenConnectCircle').addEventListener('click', async () => {
    $('formConnectCareCircle').reset();
    openModal('modalConnectCareCircle');

    // Populate Patients
    await populatePatientFilters();
    if ($('circleSelectPatient') && _cachedPatients) {
      $('circleSelectPatient').innerHTML = '<option value="">Select Patient...</option>' +
        _cachedPatients.map(p => `<option value="${p.id}">${esc(p.fullName)} (${esc(p.patientCode || 'PT')})</option>`).join('');
    }

    // Populate Guardians and Caretakers
    try {
      const gData = await adminApi('/users?role=guardian&limit=50');
      const cData = await adminApi('/users?role=caretaker&limit=50');
      const allMembers = [...(gData?.users || []), ...(cData?.users || [])];

      if ($('circleSelectMember')) {
        $('circleSelectMember').innerHTML = '<option value="">Select Guardian or Nurse...</option>' +
          allMembers.map(m => `<option value="${m.id}">${esc(m.fullName)} [${esc(m.role.toUpperCase())}]</option>`).join('');
      }
    } catch {}
  });
}

if ($('formConnectCareCircle')) {
  $('formConnectCareCircle').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const payload = {
        patientId: $('circleSelectPatient').value,
        memberId: $('circleSelectMember').value,
        relationship: $('circleRelationship').value.trim(),
        canManageMeds: $('circlePermManageMeds').checked,
        canRecordDoses: $('circlePermRecordDoses').checked
      };

      const res = await adminApi('/care-circles', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      showToast(res.message);
      closeModal('modalConnectCareCircle');
      loadCareCircles();
    } catch (err) {
      showToast(err.message, true);
    }
  });
}

// ================= REMINDERS & CONFIG MODULE =================
AdminState.remPage = 1;
AdminState.remLimit = 20;
AdminState.remChannel = '';

async function loadReminders() {
  loadAppSettings();
  loadReminderLogs();
}

async function loadAppSettings() {
  try {
    const data = await adminApi('/reminders/settings');
    if (!data || !data.settings) return;
    const s = data.settings;

    if ($('setGracePeriod') && s.grace_period_mins) $('setGracePeriod').value = s.grace_period_mins.value;
    if ($('setSnooze') && s.snooze_duration_mins) $('setSnooze').value = s.snooze_duration_mins.value;
    if ($('setRiskThreshold') && s.adherence_risk_threshold) $('setRiskThreshold').value = s.adherence_risk_threshold.value;
    if ($('setDefaultChannel') && s.default_reminder_channel) $('setDefaultChannel').value = s.default_reminder_channel.value;
    if ($('setAnnouncement') && s.system_announcement) $('setAnnouncement').value = s.system_announcement.value;
  } catch (err) {
    console.warn('Could not load app settings:', err);
  }
}

if ($('formAppSettings')) {
  $('formAppSettings').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const payload = {
        grace_period_mins: $('setGracePeriod').value,
        snooze_duration_mins: $('setSnooze').value,
        adherence_risk_threshold: $('setRiskThreshold').value,
        default_reminder_channel: $('setDefaultChannel').value,
        system_announcement: $('setAnnouncement').value
      };

      const res = await adminApi('/reminders/settings', {
        method: 'PUT',
        body: JSON.stringify(payload)
      });

      showToast(res.message);
    } catch (err) {
      showToast(err.message, true);
    }
  });
}

async function loadReminderLogs() {
  try {
    const tbody = $('remindersTableBody');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:32px; color:var(--ink-400);">Loading reminder logs...</td></tr>';

    const params = new URLSearchParams({
      page: AdminState.remPage,
      limit: AdminState.remLimit,
      channel: AdminState.remChannel
    });

    const data = await adminApi('/reminders/logs?' + params.toString());
    if (!data) return;

    if (!data.logs.length) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:32px; color:var(--ink-400);">No reminder logs recorded yet. Reminders are generated automatically on dose due times.</td></tr>';
      return;
    }

    tbody.innerHTML = data.logs.map((r) => `
      <tr>
        <td><code>#${r.id}</code></td>
        <td><strong>${esc(r.scheduledFor)}</strong></td>
        <td>
          <div style="font-weight:700; color:var(--ink-900);">${esc(r.patient.name)}</div>
          <code>${esc(r.patient.patientCode || 'PT')}</code>
        </td>
        <td>
          <strong>${esc(r.medicationName)}</strong>
          <small style="color:var(--ink-600); display:block;">${esc(r.dosage)} (Time: ${esc(r.doseTime)})</small>
        </td>
        <td>
          <span style="background:#e0f2fe; color:#0369a1; font-weight:700; font-size:11px; padding:3px 8px; border-radius:4px; text-transform:uppercase;">
            ${esc(r.deliveredVia)}
          </span>
        </td>
        <td><small style="color:var(--ink-600);">${esc(r.createdAt)}</small></td>
      </tr>
    `).join('');

    updateRemindersPagination(data.pagination);
  } catch (err) {
    showToast('Failed to load reminder logs: ' + err.message, true);
  }
}

function updateRemindersPagination(p) {
  if ($('remindersPaginationInfo')) {
    const start = (p.page - 1) * p.limit + 1;
    const end = Math.min(p.total, p.page * p.limit);
    $('remindersPaginationInfo').textContent = p.total > 0 ? `Showing ${start}-${end} of ${p.total} reminder logs` : 'No logs';
  }
  if ($('remPageCurrent')) $('remPageCurrent').textContent = p.page;
  if ($('btnPrevRemPage')) $('btnPrevRemPage').disabled = p.page <= 1;
  if ($('btnNextRemPage')) $('btnNextRemPage').disabled = p.page >= p.pages;
}

if ($('remindersChannelFilter')) {
  $('remindersChannelFilter').addEventListener('change', (e) => {
    AdminState.remChannel = e.target.value;
    AdminState.remPage = 1;
    loadReminderLogs();
  });
}

if ($('btnRefreshReminders')) {
  $('btnRefreshReminders').addEventListener('click', () => loadReminderLogs());
}

if ($('btnPrevRemPage')) {
  $('btnPrevRemPage').addEventListener('click', () => {
    if (AdminState.remPage > 1) {
      AdminState.remPage--;
      loadReminderLogs();
    }
  });
}

if ($('btnNextRemPage')) {
  $('btnNextRemPage').addEventListener('click', () => {
    AdminState.remPage++;
    loadReminderLogs();
  });
}

// ================= COMPLIANCE REPORTS MODULE =================
function initReports() {
  populatePatientFilters();
  const today = new Date();
  const past30 = new Date(Date.now() - 30 * 86400000);

  if ($('repStartDate') && !$('repStartDate').value) {
    $('repStartDate').value = past30.toISOString().slice(0, 10);
  }
  if ($('repEndDate') && !$('repEndDate').value) {
    $('repEndDate').value = today.toISOString().slice(0, 10);
  }

  if ($('repPatientFilter') && _cachedPatients) {
    $('repPatientFilter').innerHTML = '<option value="">All Patients (Population Summary)</option>' +
      _cachedPatients.map(p => `<option value="${p.id}">${esc(p.fullName)} (${esc(p.patientCode || 'PT')})</option>`).join('');
  }
}

if ($('btnGenerateReport')) {
  $('btnGenerateReport').addEventListener('click', async () => {
    const container = $('reportOutputContainer');
    if (!container) return;

    container.innerHTML = '<div style="text-align:center; padding:40px; color:var(--ink-400);">Compiling clinical adherence compliance report...</div>';

    try {
      const params = new URLSearchParams({
        startDate: $('repStartDate').value,
        endDate: $('repEndDate').value,
        patientId: $('repPatientFilter').value
      });

      const data = await adminApi('/reports/adherence?' + params.toString());
      if (!data) return;

      const { summary, patientBreakdown, topMissedMeds, dateRange } = data;

      container.innerHTML = `
        <div style="border-bottom:2px solid #0d9488; padding-bottom:14px; margin-bottom:20px; display:flex; justify-content:space-between; align-items:flex-end; flex-wrap:wrap; gap:12px;">
          <div>
            <h3 style="font-size:20px; color:var(--ink-900);">Clinical Adherence Compliance Dossier</h3>
            <p style="font-size:12px; color:var(--ink-400); margin:0;">
              Evaluation Window: <strong>${dateRange.startDate}</strong> to <strong>${dateRange.endDate}</strong>
            </p>
          </div>
          <div style="font-size:11.5px; color:var(--ink-600); background:#f1f5f9; padding:4px 10px; border-radius:4px;">
            Audited via DoseTrack Forensic Engine
          </div>
        </div>

        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:14px; margin-bottom:24px;">
          <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:14px;">
            <small style="color:var(--ink-400); font-weight:700; font-size:11px; text-transform:uppercase;">Overall Adherence</small>
            <div style="font-size:24px; font-weight:800; color:${summary.overallRate < 70 ? '#b91c1c' : '#0d9488'};">${summary.overallRate}%</div>
          </div>
          <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:14px;">
            <small style="color:var(--ink-400); font-weight:700; font-size:11px; text-transform:uppercase;">Total Doses Evaluated</small>
            <div style="font-size:24px; font-weight:800; color:var(--ink-900);">${summary.totalScheduled}</div>
          </div>
          <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:14px;">
            <small style="color:var(--ink-400); font-weight:700; font-size:11px; text-transform:uppercase;">Verified Taken</small>
            <div style="font-size:24px; font-weight:800; color:#059669;">${summary.totalTaken}</div>
          </div>
          <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:14px;">
            <small style="color:var(--ink-400); font-weight:700; font-size:11px; text-transform:uppercase;">Missed Doses</small>
            <div style="font-size:24px; font-weight:800; color:#dc2626;">${summary.totalMissed}</div>
          </div>
          <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:14px;">
            <small style="color:var(--ink-400); font-weight:700; font-size:11px; text-transform:uppercase;">At-Risk Patients (&lt;70%)</small>
            <div style="font-size:24px; font-weight:800; color:${summary.atRiskPatientsCount > 0 ? '#b91c1c' : '#059669'};">${summary.atRiskPatientsCount}</div>
          </div>
        </div>

        <h4 style="font-size:15px; margin-bottom:12px;">Patient Compliance Breakdown</h4>
        <div class="admin-table-wrap" style="margin-bottom:24px;">
          <table class="admin-table">
            <thead>
              <tr>
                <th>Patient</th>
                <th>Patient Code</th>
                <th>Scheduled</th>
                <th>Taken</th>
                <th>Missed</th>
                <th>Adherence Rate</th>
                <th>Clinical Classification</th>
              </tr>
            </thead>
            <tbody>
              ${patientBreakdown.map(p => `
                <tr>
                  <td><strong>${esc(p.name)}</strong></td>
                  <td><code>${esc(p.patientCode)}</code></td>
                  <td>${p.scheduled}</td>
                  <td><span style="color:#059669; font-weight:700;">${p.taken}</span></td>
                  <td><span style="color:#dc2626; font-weight:700;">${p.missed}</span></td>
                  <td><strong>${p.adherenceRate}%</strong></td>
                  <td>
                    ${p.isAtRisk 
                      ? '<span class="badge-risk badge-risk-danger">⚠️ AT RISK (&lt;70%)</span>' 
                      : (p.adherenceRate < 85 ? '<span class="badge-risk badge-risk-warning">MODERATE</span>' : '<span class="badge-risk badge-risk-success">✓ OPTIMAL</span>')}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        ${topMissedMeds?.length ? `
          <h4 style="font-size:15px; margin-bottom:12px;">Top Missed Medications Regimens</h4>
          <div style="display:flex; gap:12px; flex-wrap:wrap; margin-bottom:20px;">
            ${topMissedMeds.map(m => `
              <div style="background:#fff1f2; border:1px solid #fecdd3; padding:10px 14px; border-radius:6px; font-size:13px;">
                <strong style="color:#9f1239;">${esc(m.medication_name)} ${esc(m.dosage)}</strong>
                <div style="color:#e11d48; font-size:12px; margin-top:2px;">${m.missed_count} missed doses</div>
              </div>
            `).join('')}
          </div>
        ` : ''}

        <div style="padding:12px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:6px; font-size:11.5px; color:var(--ink-400);">
          ⚖️ <strong>Regulatory Disclaimer:</strong> DoseTrack does not diagnose, prescribe or provide medical advice. Always consult a licensed clinician.
        </div>
      `;
    } catch (err) {
      container.innerHTML = `<div style="color:#dc2626; padding:20px;">Error generating report: ${esc(err.message)}</div>`;
    }
  });
}

// Print Report View
if ($('btnPrintReport')) {
  $('btnPrintReport').addEventListener('click', () => {
    const s = $('repStartDate')?.value || '';
    const e = $('repEndDate')?.value || '';
    const p = $('repPatientFilter')?.value || '';
    const printUrl = `/api/admin/reports/print-view?startDate=${s}&endDate=${e}&patientId=${p}`;
    window.open(printUrl, '_blank');
  });
}

// ================= CLINICAL OVERSIGHT MODULE =================
AdminState.clinicalSub = 'notes';
AdminState.notesPage = 1;
AdminState.notesLimit = 20;
AdminState.notesSearch = '';
AdminState.notesType = '';
AdminState.notesRole = '';

AdminState.alertsPage = 1;
AdminState.alertsLimit = 25;
AdminState.alertsSearch = '';
AdminState.alertsType = '';

AdminState.appointmentsPage = 1;
AdminState.appointmentsLimit = 20;
AdminState.appointmentsStatus = '';

function switchClinicalSubView(sub) {
  AdminState.clinicalSub = sub;
  const buttons = {
    notes: $('subBtnNotes'),
    alerts: $('subBtnAlerts'),
    appointments: $('subBtnAppointments')
  };
  const views = {
    notes: $('subViewNotes'),
    alerts: $('subViewAlerts'),
    appointments: $('subViewAppointments')
  };

  Object.entries(buttons).forEach(([key, btn]) => {
    if (!btn) return;
    const isActive = key === sub;
    btn.style.background = isActive ? '#0d9488' : 'transparent';
    btn.style.color = isActive ? '#ffffff' : 'var(--ink-700)';
    btn.style.fontWeight = isActive ? '700' : '600';
  });

  Object.entries(views).forEach(([key, v]) => {
    if (!v) return;
    v.classList.toggle('hide', key !== sub);
  });

  if (sub === 'notes') loadClinicalNotes();
  else if (sub === 'alerts') loadClinicalAlerts();
  else if (sub === 'appointments') loadClinicalAppointments();
}

if ($('clinicalSubNav')) {
  $('clinicalSubNav').querySelectorAll('button[data-sub]').forEach((btn) => {
    btn.addEventListener('click', () => switchClinicalSubView(btn.dataset.sub));
  });
}

async function loadClinicalOversight() {
  switchClinicalSubView(AdminState.clinicalSub || 'notes');
}

// 1. Care Notes & Vitals
async function loadClinicalNotes() {
  const tbody = $('notesTableBody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:32px; color:var(--ink-400);">Loading care notes & vitals...</td></tr>';

  try {
    const params = new URLSearchParams({
      page: AdminState.notesPage,
      limit: AdminState.notesLimit,
      search: AdminState.notesSearch,
      noteType: AdminState.notesType,
      authorRole: AdminState.notesRole
    });

    const data = await adminApi('/clinical-oversight/notes?' + params.toString());
    if (!data) return;

    if (!data.notes.length) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:32px; color:var(--ink-400);">No care notes or vitals found matching criteria.</td></tr>';
      updateNotesPagination(data.pagination);
      return;
    }

    const typeBadges = {
      vitals: '<span style="background:#e0f2fe; color:#0369a1; font-weight:700; font-size:11px; padding:3px 7px; border-radius:4px;">💓 Vitals</span>',
      symptom: '<span style="background:#fef3c7; color:#92400e; font-weight:700; font-size:11px; padding:3px 7px; border-radius:4px;">⚠️ Symptom</span>',
      alert: '<span style="background:#fee2e2; color:#b91c1c; font-weight:700; font-size:11px; padding:3px 7px; border-radius:4px;">🚨 Alert</span>',
      general: '<span style="background:#f1f5f9; color:#475569; font-weight:700; font-size:11px; padding:3px 7px; border-radius:4px;">📝 General</span>'
    };

    tbody.innerHTML = data.notes.map((n) => {
      let vitalsHtml = '<span style="color:var(--ink-400); font-size:12px;">—</span>';
      if (n.vitals && typeof n.vitals === 'object') {
        const vBadges = [];
        const bp = n.vitals.blood_pressure;
        const hr = n.vitals.heart_rate || n.vitals.pulse;
        const glu = n.vitals.blood_sugar || n.vitals.blood_glucose;
        const o2 = n.vitals.spo2 || n.vitals.oxygen_saturation;
        const temp = n.vitals.temperature;
        const mood = n.vitals.mood;

        if (bp) vBadges.push(`<strong>BP:</strong> ${esc(bp)}${String(bp).includes('mmHg') ? '' : ' mmHg'}`);
        if (hr) vBadges.push(`<strong>Pulse:</strong> ${esc(hr)}${String(hr).includes('bpm') ? '' : ' bpm'}`);
        if (glu) vBadges.push(`<strong>Glucose:</strong> ${esc(glu)}${String(glu).includes('mg/dL') ? '' : ' mg/dL'}`);
        if (o2) vBadges.push(`<strong>SpO2:</strong> ${esc(o2)}${String(o2).includes('%') ? '' : '%'}`);
        if (temp) vBadges.push(`<strong>Temp:</strong> ${esc(temp)}${String(temp).includes('°') ? '' : '°F'}`);
        if (mood) vBadges.push(`<strong>Mood:</strong> ${esc(mood)}`);

        if (vBadges.length) {
          vitalsHtml = `<div style="display:flex; flex-wrap:wrap; gap:4px; font-size:11.5px;">${vBadges.map(b => `<span style="background:#f0fdfa; border:1px solid #ccfbf1; color:#0f766e; padding:2px 6px; border-radius:4px;">${b}</span>`).join('')}</div>`;
        }
      }

      return `
        <tr>
          <td><code>#${n.id}</code></td>
          <td>
            <strong>${esc(n.patient.name)}</strong>
            <small style="color:var(--ink-400); display:block;"><code>${esc(n.patient.patientCode || 'PT')}</code></small>
          </td>
          <td>
            <strong>${esc(n.author.name)}</strong>
            <small style="color:var(--ink-400); display:block; text-transform:capitalize;">${esc(n.author.role)}</small>
          </td>
          <td>${typeBadges[n.noteType] || esc(n.noteType)}</td>
          <td style="max-width:320px;">
            <div style="font-size:12.5px; color:var(--ink-900); line-height:1.4;">${esc(n.content)}</div>
          </td>
          <td style="max-width:260px;">${vitalsHtml}</td>
          <td><small style="color:var(--ink-600);">${esc(String(n.createdAt || '').slice(0, 16))}</small></td>
        </tr>
      `;
    }).join('');

    updateNotesPagination(data.pagination);
  } catch (err) {
    showToast('Failed to load care notes: ' + err.message, true);
  }
}

function updateNotesPagination(p) {
  if ($('notesPaginationInfo')) {
    const start = (p.page - 1) * p.limit + 1;
    const end = Math.min(p.total, p.page * p.limit);
    $('notesPaginationInfo').textContent = p.total > 0 ? `Showing ${start}-${end} of ${p.total} notes` : 'No care notes';
  }
  if ($('notesPageCurrent')) $('notesPageCurrent').textContent = p.page;
  if ($('btnPrevNotesPage')) $('btnPrevNotesPage').disabled = p.page <= 1;
  if ($('btnNextNotesPage')) $('btnNextNotesPage').disabled = p.page >= p.pages;
}

if ($('notesSearchInput')) {
  let notesTimer;
  $('notesSearchInput').addEventListener('input', (e) => {
    clearTimeout(notesTimer);
    notesTimer = setTimeout(() => {
      AdminState.notesSearch = e.target.value.trim();
      AdminState.notesPage = 1;
      loadClinicalNotes();
    }, 300);
  });
}

if ($('notesTypeFilter')) {
  $('notesTypeFilter').addEventListener('change', (e) => {
    AdminState.notesType = e.target.value;
    AdminState.notesPage = 1;
    loadClinicalNotes();
  });
}

if ($('notesAuthorRoleFilter')) {
  $('notesAuthorRoleFilter').addEventListener('change', (e) => {
    AdminState.notesRole = e.target.value;
    AdminState.notesPage = 1;
    loadClinicalNotes();
  });
}

if ($('btnPrevNotesPage')) {
  $('btnPrevNotesPage').addEventListener('click', () => {
    if (AdminState.notesPage > 1) {
      AdminState.notesPage--;
      loadClinicalNotes();
    }
  });
}

if ($('btnNextNotesPage')) {
  $('btnNextNotesPage').addEventListener('click', () => {
    AdminState.notesPage++;
    loadClinicalNotes();
  });
}

// 2. Care Alerts & SOS Stream
async function loadClinicalAlerts() {
  const tbody = $('alertsTableBody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:32px; color:var(--ink-400);">Loading care alerts...</td></tr>';

  try {
    const params = new URLSearchParams({
      page: AdminState.alertsPage,
      limit: AdminState.alertsLimit,
      search: AdminState.alertsSearch,
      alertType: AdminState.alertsType
    });

    const data = await adminApi('/clinical-oversight/alerts?' + params.toString());
    if (!data) return;

    if (!data.alerts.length) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:32px; color:var(--ink-400);">No alerts found matching criteria.</td></tr>';
      updateAlertsPagination(data.pagination);
      return;
    }

    const alertBadges = {
      sos: '<span style="background:#fee2e2; color:#b91c1c; font-weight:800; font-size:11px; padding:3px 8px; border-radius:4px;">🚨 SOS EMERGENCY</span>',
      dose_missed: '<span style="background:#fef3c7; color:#92400e; font-weight:700; font-size:11px; padding:3px 7px; border-radius:4px;">⏰ DOSE MISSED</span>',
      nudge: '<span style="background:#e0f2fe; color:#0369a1; font-weight:700; font-size:11px; padding:3px 7px; border-radius:4px;">👋 NUDGE</span>',
      vitals_logged: '<span style="background:#ecfdf5; color:#047857; font-weight:700; font-size:11px; padding:3px 7px; border-radius:4px;">💓 VITALS</span>'
    };

    tbody.innerHTML = data.alerts.map((a) => `
      <tr>
        <td><code>#${a.id}</code></td>
        <td>${alertBadges[a.alertType] || `<span style="background:#f1f5f9; padding:2px 6px; border-radius:4px; font-size:11px;">${esc(a.alertType)}</span>`}</td>
        <td>
          <strong>${esc(a.patient.name)}</strong>
          <small style="color:var(--ink-400); display:block;"><code>${esc(a.patient.patientCode || 'PT')}</code></small>
        </td>
        <td style="max-width:320px;">
          <strong style="font-size:13px; color:var(--ink-900);">${esc(a.title)}</strong>
          <div style="font-size:12px; color:var(--ink-700); margin-top:2px;">${esc(a.message)}</div>
        </td>
        <td>
          ${a.sender ? `<strong>${esc(a.sender.name)}</strong><small style="color:var(--ink-400); display:block;">${esc(a.sender.role)}</small>` : '<span style="color:var(--ink-400);">System Trigger</span>'}
        </td>
        <td>
          <strong>${esc(a.recipient.name)}</strong>
          <small style="color:var(--ink-400); display:block;">${esc(a.recipient.role)}</small>
        </td>
        <td><small style="color:var(--ink-600);">${esc(String(a.createdAt || '').slice(0, 16))}</small></td>
      </tr>
    `).join('');

    updateAlertsPagination(data.pagination);
  } catch (err) {
    showToast('Failed to load alerts: ' + err.message, true);
  }
}

function updateAlertsPagination(p) {
  if ($('alertsPaginationInfo')) {
    const start = (p.page - 1) * p.limit + 1;
    const end = Math.min(p.total, p.page * p.limit);
    $('alertsPaginationInfo').textContent = p.total > 0 ? `Showing ${start}-${end} of ${p.total} alerts` : 'No alerts';
  }
  if ($('alertsPageCurrent')) $('alertsPageCurrent').textContent = p.page;
  if ($('btnPrevAlertsPage')) $('btnPrevAlertsPage').disabled = p.page <= 1;
  if ($('btnNextAlertsPage')) $('btnNextAlertsPage').disabled = p.page >= p.pages;
}

if ($('alertsSearchInput')) {
  let alertsTimer;
  $('alertsSearchInput').addEventListener('input', (e) => {
    clearTimeout(alertsTimer);
    alertsTimer = setTimeout(() => {
      AdminState.alertsSearch = e.target.value.trim();
      AdminState.alertsPage = 1;
      loadClinicalAlerts();
    }, 300);
  });
}

if ($('alertsTypeFilter')) {
  $('alertsTypeFilter').addEventListener('change', (e) => {
    AdminState.alertsType = e.target.value;
    AdminState.alertsPage = 1;
    loadClinicalAlerts();
  });
}

if ($('btnPrevAlertsPage')) {
  $('btnPrevAlertsPage').addEventListener('click', () => {
    if (AdminState.alertsPage > 1) {
      AdminState.alertsPage--;
      loadClinicalAlerts();
    }
  });
}

if ($('btnNextAlertsPage')) {
  $('btnNextAlertsPage').addEventListener('click', () => {
    AdminState.alertsPage++;
    loadClinicalAlerts();
  });
}

// 3. Doctor Appointment Requests
async function loadClinicalAppointments() {
  const tbody = $('appointmentsTableBody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:32px; color:var(--ink-400);">Loading appointments...</td></tr>';

  try {
    const params = new URLSearchParams({
      page: AdminState.appointmentsPage,
      limit: AdminState.appointmentsLimit,
      status: AdminState.appointmentsStatus
    });

    const data = await adminApi('/clinical-oversight/appointments?' + params.toString());
    if (!data) return;

    if (!data.appointments.length) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:32px; color:var(--ink-400);">No appointment requests found matching criteria.</td></tr>';
      updateAppointmentsPagination(data.pagination);
      return;
    }

    const statusBadges = {
      requested: '<span style="background:#fef3c7; color:#92400e; font-weight:700; font-size:11px; padding:3px 7px; border-radius:4px;">⏳ Requested</span>',
      confirmed: '<span style="background:#d1fae5; color:#065f46; font-weight:700; font-size:11px; padding:3px 7px; border-radius:4px;">✅ Confirmed</span>',
      cancelled: '<span style="background:#f1f5f9; color:#64748b; font-weight:700; font-size:11px; padding:3px 7px; border-radius:4px;">✕ Cancelled</span>'
    };

    tbody.innerHTML = data.appointments.map((a) => {
      let actionButtons = '';
      if (a.status === 'requested') {
        actionButtons = `
          <button type="button" class="btn-action-icon btn-confirm-appt" data-id="${a.id}" style="background:#d1fae5; color:#065f46; border:1px solid #a7f3d0;" title="Confirm Appointment">✓ Confirm</button>
          <button type="button" class="btn-action-icon btn-cancel-appt" data-id="${a.id}" style="background:#fee2e2; color:#b91c1c; border:1px solid #fecaca;" title="Cancel Request">✕ Cancel</button>
        `;
      } else if (a.status === 'confirmed') {
        actionButtons = `
          <button type="button" class="btn-action-icon btn-cancel-appt" data-id="${a.id}" style="background:#fee2e2; color:#b91c1c; border:1px solid #fecaca;" title="Cancel Appointment">✕ Cancel</button>
        `;
      } else if (a.status === 'cancelled') {
        actionButtons = `
          <button type="button" class="btn-action-icon btn-confirm-appt" data-id="${a.id}" style="background:#d1fae5; color:#065f46; border:1px solid #a7f3d0;" title="Re-confirm Appointment">✓ Re-confirm</button>
        `;
      }

      return `
        <tr>
          <td><code>#${a.id}</code></td>
          <td>
            <strong>${esc(a.patient.name)}</strong>
            <small style="color:var(--ink-400); display:block;"><code>${esc(a.patient.patientCode || 'PT')}</code> · ${esc(a.patient.phone || 'No phone')}</small>
          </td>
          <td>
            <strong>${esc(a.doctor.name)}</strong>
            <small style="color:var(--ink-400); display:block;">${esc(a.doctor.specialization || 'Clinical')} · ${esc(a.doctor.clinicName || 'Clinic')}</small>
          </td>
          <td><strong>${esc(String(a.requestedDate || '').slice(0, 10))}</strong></td>
          <td style="max-width:260px;">
            <div style="font-size:12.5px; color:var(--ink-800);">${esc(a.message || 'No patient message')}</div>
          </td>
          <td>${statusBadges[a.status] || esc(a.status)}</td>
          <td>
            <div style="display:flex; gap:6px;">${actionButtons}</div>
          </td>
        </tr>
      `;
    }).join('');

    tbody.querySelectorAll('.btn-confirm-appt').forEach((b) => {
      b.addEventListener('click', () => patchAppointment(b.dataset.id, 'confirmed'));
    });
    tbody.querySelectorAll('.btn-cancel-appt').forEach((b) => {
      b.addEventListener('click', () => patchAppointment(b.dataset.id, 'cancelled'));
    });

    updateAppointmentsPagination(data.pagination);
  } catch (err) {
    showToast('Failed to load appointments: ' + err.message, true);
  }
}

async function patchAppointment(id, status) {
  try {
    const res = await adminApi(`/clinical-oversight/appointments/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status })
    });
    showToast(res.message || `Appointment status updated to ${status}.`);
    loadClinicalAppointments();
  } catch (err) {
    showToast('Failed to update appointment: ' + err.message, true);
  }
}

function updateAppointmentsPagination(p) {
  if ($('appointmentsPaginationInfo')) {
    const start = (p.page - 1) * p.limit + 1;
    const end = Math.min(p.total, p.page * p.limit);
    $('appointmentsPaginationInfo').textContent = p.total > 0 ? `Showing ${start}-${end} of ${p.total} appointments` : 'No appointments';
  }
  if ($('appointmentsPageCurrent')) $('appointmentsPageCurrent').textContent = p.page;
  if ($('btnPrevAppointmentsPage')) $('btnPrevAppointmentsPage').disabled = p.page <= 1;
  if ($('btnNextAppointmentsPage')) $('btnNextAppointmentsPage').disabled = p.page >= p.pages;
}

if ($('appointmentsStatusFilter')) {
  $('appointmentsStatusFilter').addEventListener('change', (e) => {
    AdminState.appointmentsStatus = e.target.value;
    AdminState.appointmentsPage = 1;
    loadClinicalAppointments();
  });
}

if ($('btnPrevAppointmentsPage')) {
  $('btnPrevAppointmentsPage').addEventListener('click', () => {
    if (AdminState.appointmentsPage > 1) {
      AdminState.appointmentsPage--;
      loadClinicalAppointments();
    }
  });
}

if ($('btnNextAppointmentsPage')) {
  $('btnNextAppointmentsPage').addEventListener('click', () => {
    AdminState.appointmentsPage++;
    loadClinicalAppointments();
  });
}

// ================= USER ACTIVITY STREAM MODULE =================
AdminState.activityPage = 1;
AdminState.activityLimit = 25;
AdminState.activitySearch = '';
AdminState.activityRole = '';
AdminState.activityAction = '';
AdminState.activityFrom = '';
AdminState.activityTo = '';

const ACTIVITY_ROLE_STYLES = {
  patient: { bg: '#ccfbf1', color: '#0f766e', label: 'Patient' },
  guardian: { bg: '#e0e7ff', color: '#4338ca', label: 'Guardian' },
  caretaker: { bg: '#e0f2fe', color: '#0369a1', label: 'Caretaker' },
  admin: { bg: '#fef3c7', color: '#92400e', label: 'Admin' }
};

async function loadActivity() {
  const tbody = $('activityTableBody');
  if (!tbody) return;

  tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:32px; color:var(--ink-400);">Loading activity stream...</td></tr>';

  try {
    const params = new URLSearchParams({
      page: AdminState.activityPage,
      limit: AdminState.activityLimit,
      search: AdminState.activitySearch,
      role: AdminState.activityRole,
      action: AdminState.activityAction,
      from: AdminState.activityFrom,
      to: AdminState.activityTo
    });

    const data = await adminApi('/activity?' + params.toString());
    if (!data) return;

    renderActivitySummary(data.summary);

    if (!data.logs.length) {
      tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:32px; color:var(--ink-400);">No user activity found matching the selected filters.</td></tr>';
      updateActivityPagination(data.pagination);
      return;
    }

    tbody.innerHTML = data.logs.map((l) => {
      const role = ACTIVITY_ROLE_STYLES[l.actor.role] || { bg: '#e5e7eb', color: '#374151', label: l.actor.role };
      const patientCell = l.patient
        ? `<strong>${esc(l.patient.name)}</strong><small style="color:var(--ink-400); display:block;">${esc(l.patient.patientCode || '')}</small>`
        : '<span style="color:var(--ink-400);">—</span>';

      return `
        <tr>
          <td><code>#${l.id}</code></td>
          <td>
            <strong>${esc(l.actor.name)}</strong>
            <small style="color:var(--ink-400); display:block;">ID #${esc(l.actor.id ?? '—')}</small>
          </td>
          <td>
            <span style="background:${role.bg}; color:${role.color}; font-weight:700; font-size:11px; padding:3px 7px; border-radius:4px; text-transform:capitalize;">
              ${esc(role.label)}
            </span>
          </td>
          <td>
            <span style="background:#eef2ff; color:#3730a3; font-weight:700; font-size:11px; padding:3px 7px; border-radius:4px; font-family:monospace;">
              ${esc(l.action)}
            </span>
          </td>
          <td>${patientCell}</td>
          <td style="max-width:340px;">
            <div style="font-size:12.5px; color:var(--ink-900);">${esc(l.details)}</div>
            <small style="color:var(--ink-400);">${esc(l.targetType)}${l.targetId !== '—' ? ` #${esc(l.targetId)}` : ''}</small>
          </td>
          <td><code>${esc(l.ipAddress)}</code></td>
          <td><small style="color:var(--ink-600);">${esc(l.createdAt)}</small></td>
        </tr>
      `;
    }).join('');

    updateActivityPagination(data.pagination);
  } catch (err) {
    showToast('Failed to load activity stream: ' + err.message, true);
  }
}

function renderActivitySummary(summary) {
  const container = $('activitySummaryChips');
  if (!container || !summary) return;

  const roles = ['patient', 'guardian', 'caretaker'];
  const total = roles.reduce((sum, r) => sum + Number(summary.byRole?.[r] || 0), 0);

  const chips = [
    `<div style="background:var(--ink-900); color:#fff; border-radius:8px; padding:8px 14px; font-size:12.5px;">
       <strong>${total}</strong> total actions
     </div>`
  ];

  roles.forEach((r) => {
    const style = ACTIVITY_ROLE_STYLES[r];
    chips.push(`
      <div style="background:${style.bg}; color:${style.color}; border-radius:8px; padding:8px 14px; font-size:12.5px;">
        <strong>${Number(summary.byRole?.[r] || 0)}</strong> ${style.label.toLowerCase()} actions
      </div>
    `);
  });

  (summary.byAction || []).slice(0, 4).forEach((a) => {
    chips.push(`
      <div style="background:#f1f5f9; color:#334155; border-radius:8px; padding:8px 14px; font-size:12px;">
        <code>${esc(a.action)}</code> · ${a.count}
      </div>
    `);
  });

  container.innerHTML = chips.join('');
}

function updateActivityPagination(p) {
  if ($('activityPaginationInfo')) {
    const start = (p.page - 1) * p.limit + 1;
    const end = Math.min(p.total, p.page * p.limit);
    $('activityPaginationInfo').textContent = p.total > 0
      ? `Showing ${start}-${end} of ${p.total} activity records`
      : 'No activity records';
  }
  if ($('activityPageCurrent')) $('activityPageCurrent').textContent = p.page;
  if ($('btnPrevActivityPage')) $('btnPrevActivityPage').disabled = p.page <= 1;
  if ($('btnNextActivityPage')) $('btnNextActivityPage').disabled = p.page >= p.pages;
}

if ($('activitySearchInput')) {
  let activitySearchTimer;
  $('activitySearchInput').addEventListener('input', (e) => {
    clearTimeout(activitySearchTimer);
    activitySearchTimer = setTimeout(() => {
      AdminState.activitySearch = e.target.value.trim();
      AdminState.activityPage = 1;
      loadActivity();
    }, 300);
  });
}

if ($('activityRoleFilter')) {
  $('activityRoleFilter').addEventListener('change', (e) => {
    AdminState.activityRole = e.target.value;
    AdminState.activityPage = 1;
    loadActivity();
  });
}

if ($('activityActionFilter')) {
  $('activityActionFilter').addEventListener('change', (e) => {
    AdminState.activityAction = e.target.value;
    AdminState.activityPage = 1;
    loadActivity();
  });
}

if ($('activityFromDate')) {
  $('activityFromDate').addEventListener('change', (e) => {
    AdminState.activityFrom = e.target.value;
    AdminState.activityPage = 1;
    loadActivity();
  });
}

if ($('activityToDate')) {
  $('activityToDate').addEventListener('change', (e) => {
    AdminState.activityTo = e.target.value;
    AdminState.activityPage = 1;
    loadActivity();
  });
}

if ($('btnPrevActivityPage')) {
  $('btnPrevActivityPage').addEventListener('click', () => {
    if (AdminState.activityPage > 1) {
      AdminState.activityPage--;
      loadActivity();
    }
  });
}

if ($('btnNextActivityPage')) {
  $('btnNextActivityPage').addEventListener('click', () => {
    AdminState.activityPage++;
    loadActivity();
  });
}

// ================= AUDIT LOG & PROFILE MODULE =================
AdminState.auditPage = 1;
AdminState.auditLimit = 25;
AdminState.auditSearch = '';
AdminState.auditAction = '';

async function loadAuditLog() {
  if (AdminState.user) {
    if ($('profileFullName')) $('profileFullName').textContent = AdminState.user.fullName;
    if ($('profileEmail')) $('profileEmail').textContent = AdminState.user.email;
    if ($('profileAvatarLetter')) $('profileAvatarLetter').textContent = AdminState.user.fullName.charAt(0).toUpperCase();
  }

  try {
    const tbody = $('auditTableBody');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:32px; color:var(--ink-400);">Loading forensic audit trail...</td></tr>';

    const params = new URLSearchParams({
      page: AdminState.auditPage,
      limit: AdminState.auditLimit,
      search: AdminState.auditSearch,
      action: AdminState.auditAction
    });

    const data = await adminApi('/audit?' + params.toString());
    if (!data) return;

    if (!data.logs.length) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:32px; color:var(--ink-400);">No audit records found matching criteria.</td></tr>';
      return;
    }

    tbody.innerHTML = data.logs.map((l) => `
      <tr>
        <td><code>#${l.id}</code></td>
        <td>
          <span style="background:#fef3c7; color:#92400e; font-weight:700; font-size:11px; padding:3px 7px; border-radius:4px; font-family:monospace;">
            ${esc(l.action)}
          </span>
        </td>
        <td>
          <small style="color:var(--ink-700); font-weight:600;">${esc(l.targetType)}</small>
          <code>#${esc(l.targetId)}</code>
        </td>
        <td style="max-width:320px;">
          <div style="font-size:12.5px; color:var(--ink-900);">${esc(l.details)}</div>
        </td>
        <td><code>${esc(l.ipAddress)}</code></td>
        <td>
          <strong>${esc(l.admin.name)}</strong>
          <small style="color:var(--ink-400); display:block;">${esc(l.admin.email)}</small>
        </td>
        <td><small style="color:var(--ink-600);">${esc(l.createdAt)}</small></td>
      </tr>
    `).join('');

    updateAuditPagination(data.pagination);
  } catch (err) {
    showToast('Failed to load audit trail: ' + err.message, true);
  }
}

function updateAuditPagination(p) {
  if ($('auditPaginationInfo')) {
    const start = (p.page - 1) * p.limit + 1;
    const end = Math.min(p.total, p.page * p.limit);
    $('auditPaginationInfo').textContent = p.total > 0 ? `Showing ${start}-${end} of ${p.total} audit logs` : 'No audit records';
  }
  if ($('auditPageCurrent')) $('auditPageCurrent').textContent = p.page;
  if ($('btnPrevAuditPage')) $('btnPrevAuditPage').disabled = p.page <= 1;
  if ($('btnNextAuditPage')) $('btnNextAuditPage').disabled = p.page >= p.pages;
}

if ($('auditSearchInput')) {
  let aSearchTimer;
  $('auditSearchInput').addEventListener('input', (e) => {
    clearTimeout(aSearchTimer);
    aSearchTimer = setTimeout(() => {
      AdminState.auditSearch = e.target.value.trim();
      AdminState.auditPage = 1;
      loadAuditLog();
    }, 300);
  });
}

if ($('auditActionFilter')) {
  $('auditActionFilter').addEventListener('change', (e) => {
    AdminState.auditAction = e.target.value;
    AdminState.auditPage = 1;
    loadAuditLog();
  });
}

if ($('btnPrevAuditPage')) {
  $('btnPrevAuditPage').addEventListener('click', () => {
    if (AdminState.auditPage > 1) {
      AdminState.auditPage--;
      loadAuditLog();
    }
  });
}

if ($('btnNextAuditPage')) {
  $('btnNextAuditPage').addEventListener('click', () => {
    AdminState.auditPage++;
    loadAuditLog();
  });
}

// Change Admin Password Form
if ($('formAdminChangePassword')) {
  $('formAdminChangePassword').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const currentPassword = $('admCurrentPassword').value;
      const newPassword = $('admNewPassword').value;

      const res = await adminApi('/audit/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword })
      });

      showToast(res.message);
      $('formAdminChangePassword').reset();
      loadAuditLog();
    } catch (err) {
      showToast(err.message, true);
    }
  });
}

// ================= MONITORING MODULES =================
// State for monitoring modules
AdminState.liveFeedPage = 1;
AdminState.liveFeedLimit = 25;
AdminState.liveFeedSearch = '';
AdminState.liveFeedRole = '';
AdminState.liveFeedAction = '';
AdminState.liveFeedDateFrom = '';
AdminState.liveFeedDateTo = '';
AdminState.liveFeedAutoRefresh = null;
AdminState.liveFeedPaused = false;
AdminState.accessAuditPage = 1;
AdminState.accessAuditLimit = 25;

// ================= 1. LIVE ACTIVITY FEED =================
async function loadLiveFeed() {
  try {
    const tbody = $('liveFeedTableBody');
    if (!tbody) return;

    const params = new URLSearchParams({
      page: AdminState.liveFeedPage,
      limit: AdminState.liveFeedLimit,
      search: AdminState.liveFeedSearch,
      role: AdminState.liveFeedRole,
      actionType: AdminState.liveFeedAction,
      dateFrom: AdminState.liveFeedDateFrom,
      dateTo: AdminState.liveFeedDateTo
    });

    const data = await adminApi('/oversight/live-feed?' + params.toString());
    if (!data) return;

    if (!data.activities || !data.activities.length) {
      tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; padding:32px; color:var(--ink-400);">No activity events match current filters.</td></tr>';
    } else {
      tbody.innerHTML = data.activities.map((a) => {
        const roleColor = { patient: '#0f766e', guardian: '#4338ca', caretaker: '#0369a1', admin: '#b45309' }[a.user.role] || '#475569';
        const actionColors = {
          LOGIN_SUCCESS: '#059669', LOGIN_FAILED: '#dc2626', LOGOUT: '#64748b',
          DOSE_TAKEN: '#059669', DOSE_MISSED: '#dc2626',
          MEDICATION_ADD: '#2563eb', MEDICATION_EDIT: '#d97706', MEDICATION_DELETE: '#dc2626',
          EMERGENCY_SOS_TRIGGERED: '#dc2626', EMERGENCY_SOS_ACKNOWLEDGED: '#059669',
          PROFILE_UPDATE: '#7c3aed', PASSWORD_CHANGE: '#b45309'
        };
        const actionColor = actionColors[a.actionType] || '#475569';
        const ts = String(a.createdAt || '');
        const timeStr = ts.slice(11, 19) || '';
        const dateStr = ts.slice(0, 10) || '';
        const uaShort = (a.userAgent || '—').substring(0, 40) + ((a.userAgent || '').length > 40 ? '…' : '');

        return `
          <tr style="cursor:pointer;" onclick='openActivityDrawer(${JSON.stringify(a).replace(/'/g, "&#39;")})'>
            <td><code>#${a.id}</code></td>
            <td>
              <div style="display:flex; align-items:center; gap:6px;">
                <div style="width:28px; height:28px; border-radius:50%; background:${a.user.avatarColor || '#0d9488'}; color:#fff; display:flex; align-items:center; justify-content:center; font-size:11px; font-weight:700;">${(a.user.name || 'U').charAt(0).toUpperCase()}</div>
                <div>
                  <strong style="font-size:12.5px;">${esc(a.user.name)}</strong>
                  ${a.user.patientCode ? '<br><code style="font-size:10px;">' + esc(a.user.patientCode) + '</code>' : ''}
                </div>
              </div>
            </td>
            <td><span style="color:${roleColor}; font-weight:700; font-size:11px; text-transform:uppercase;">${esc(a.user.role)}</span></td>
            <td><span style="background:${actionColor}15; color:${actionColor}; font-weight:700; font-size:11px; padding:3px 7px; border-radius:4px; font-family:monospace;">${esc(a.actionType)}</span></td>
            <td style="max-width:260px; font-size:12.5px;">${esc(a.description || '—')}</td>
            <td><small>${esc(a.entityType || '—')} #${esc(a.entityId || '—')}</small></td>
            <td><code style="font-size:10px;">${esc(a.ipAddress)}</code><br><small style="color:var(--ink-400); font-size:10px;">${esc(uaShort)}</small></td>
            <td><small>${esc(dateStr)}<br>${esc(timeStr)}</small></td>
            <td><button type="button" class="btn-action-icon" title="Inspect full event details">🔍</button></td>
          </tr>
        `;
      }).join('');
    }

    // Update pagination
    const p = data.pagination;
    if ($('liveFeedPaginationInfo')) {
      const start = (p.page - 1) * p.limit + 1;
      const end = Math.min(p.total, p.page * p.limit);
      $('liveFeedPaginationInfo').textContent = p.total > 0 ? `Showing ${start}-${end} of ${p.total} events` : 'No events found';
    }
    if ($('livePageCurrent')) $('livePageCurrent').textContent = p.page;
    if ($('btnPrevLivePage')) $('btnPrevLivePage').disabled = p.page <= 1;
    if ($('btnNextLivePage')) $('btnNextLivePage').disabled = p.page >= p.pages;

    // Start auto-refresh if not paused
    startLiveFeedAutoRefresh();
  } catch (err) {
    showToast('Failed to load live feed: ' + err.message, true);
  }
}

function startLiveFeedAutoRefresh() {
  stopLiveFeedAutoRefresh();
  if (!AdminState.liveFeedPaused && AdminState.activeTab === 'live-feed') {
    AdminState.liveFeedAutoRefresh = setInterval(() => {
      if (AdminState.activeTab === 'live-feed' && !AdminState.liveFeedPaused) {
        loadLiveFeed();
      } else {
        stopLiveFeedAutoRefresh();
      }
    }, 5000);
  }
}

function stopLiveFeedAutoRefresh() {
  if (AdminState.liveFeedAutoRefresh) {
    clearInterval(AdminState.liveFeedAutoRefresh);
    AdminState.liveFeedAutoRefresh = null;
  }
}

// Live Feed filter & pagination event wiring
if ($('btnToggleAutoRefresh')) {
  $('btnToggleAutoRefresh').addEventListener('click', () => {
    AdminState.liveFeedPaused = !AdminState.liveFeedPaused;
    $('btnToggleAutoRefresh').textContent = AdminState.liveFeedPaused ? '▶ Resume' : '⏸ Pause';
    if ($('liveFeedStatusText')) {
      $('liveFeedStatusText').textContent = AdminState.liveFeedPaused ? 'Paused' : 'Live (5s auto-refresh)';
    }
    if (AdminState.liveFeedPaused) {
      stopLiveFeedAutoRefresh();
    } else {
      startLiveFeedAutoRefresh();
    }
  });
}

if ($('liveSearchInput')) {
  let liveSearchTimer;
  $('liveSearchInput').addEventListener('input', (e) => {
    clearTimeout(liveSearchTimer);
    liveSearchTimer = setTimeout(() => {
      AdminState.liveFeedSearch = e.target.value;
      AdminState.liveFeedPage = 1;
      loadLiveFeed();
    }, 400);
  });
}

if ($('liveRoleFilter')) {
  $('liveRoleFilter').addEventListener('change', (e) => {
    AdminState.liveFeedRole = e.target.value;
    AdminState.liveFeedPage = 1;
    loadLiveFeed();
  });
}

if ($('liveActionFilter')) {
  $('liveActionFilter').addEventListener('change', (e) => {
    AdminState.liveFeedAction = e.target.value;
    AdminState.liveFeedPage = 1;
    loadLiveFeed();
  });
}

if ($('liveDateFrom')) {
  $('liveDateFrom').addEventListener('change', (e) => {
    AdminState.liveFeedDateFrom = e.target.value;
    AdminState.liveFeedPage = 1;
    loadLiveFeed();
  });
}

if ($('liveDateTo')) {
  $('liveDateTo').addEventListener('change', (e) => {
    AdminState.liveFeedDateTo = e.target.value;
    AdminState.liveFeedPage = 1;
    loadLiveFeed();
  });
}

if ($('btnPrevLivePage')) {
  $('btnPrevLivePage').addEventListener('click', () => {
    if (AdminState.liveFeedPage > 1) {
      AdminState.liveFeedPage--;
      loadLiveFeed();
    }
  });
}

if ($('btnNextLivePage')) {
  $('btnNextLivePage').addEventListener('click', () => {
    AdminState.liveFeedPage++;
    loadLiveFeed();
  });
}

// ================= ACTIVITY DETAIL DRAWER =================
function openActivityDrawer(activity) {
  const drawer = $('activityDetailDrawer');
  const content = $('drawerContent');
  if (!drawer || !content) return;

  const a = typeof activity === 'string' ? JSON.parse(activity) : activity;

  const prettyJson = (obj) => {
    if (!obj) return '<span style="color:var(--ink-400);">—</span>';
    try {
      const str = typeof obj === 'string' ? obj : JSON.stringify(obj, null, 2);
      return '<pre style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:6px; padding:10px; font-size:11.5px; overflow-x:auto; max-height:260px; margin:0;">' + esc(str) + '</pre>';
    } catch { return '<span style="color:var(--ink-400);">Unable to parse</span>'; }
  };

  const ts = String(a.createdAt || '');

  content.innerHTML = `
    <div style="margin-bottom:16px;">
      <div style="display:flex; align-items:center; gap:10px; margin-bottom:12px;">
        <div style="width:42px; height:42px; border-radius:50%; background:${a.user?.avatarColor || '#0d9488'}; color:#fff; display:flex; align-items:center; justify-content:center; font-size:16px; font-weight:700;">
          ${(a.user?.name || 'U').charAt(0).toUpperCase()}
        </div>
        <div>
          <strong style="font-size:15px;">${esc(a.user?.name || 'Unknown')}</strong>
          <div style="font-size:12px; color:var(--ink-500);">
            <span style="text-transform:uppercase; font-weight:700;">${esc(a.user?.role || '')}</span>
            ${a.user?.patientCode ? ' · <code>' + esc(a.user.patientCode) + '</code>' : ''}
          </div>
        </div>
      </div>
    </div>

    <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:16px;">
      <div style="background:#f8fafc; padding:10px; border-radius:6px; border:1px solid #e2e8f0;">
        <small style="color:var(--ink-400); font-weight:700;">Event ID</small>
        <div style="font-weight:700; font-size:14px;">#${esc(String(a.id || ''))}</div>
      </div>
      <div style="background:#f8fafc; padding:10px; border-radius:6px; border:1px solid #e2e8f0;">
        <small style="color:var(--ink-400); font-weight:700;">Action Type</small>
        <div><span style="background:#0d948815; color:#0d9488; font-weight:700; font-size:12px; padding:2px 8px; border-radius:4px; font-family:monospace;">${esc(a.actionType || '')}</span></div>
      </div>
      <div style="background:#f8fafc; padding:10px; border-radius:6px; border:1px solid #e2e8f0;">
        <small style="color:var(--ink-400); font-weight:700;">Target Entity</small>
        <div style="font-size:13px;">${esc(a.entityType || '—')} #${esc(String(a.entityId || '—'))}</div>
      </div>
      <div style="background:#f8fafc; padding:10px; border-radius:6px; border:1px solid #e2e8f0;">
        <small style="color:var(--ink-400); font-weight:700;">Timestamp</small>
        <div style="font-size:13px;">${esc(ts)}</div>
      </div>
    </div>

    <div style="margin-bottom:16px;">
      <small style="color:var(--ink-400); font-weight:700;">Description</small>
      <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:6px; padding:10px; font-size:13px; margin-top:4px;">
        ${esc(a.description || '—')}
      </div>
    </div>

    <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:16px;">
      <div>
        <small style="color:var(--ink-400); font-weight:700;">🔴 Old Value (Before)</small>
        <div style="margin-top:4px;">${prettyJson(a.oldValue)}</div>
      </div>
      <div>
        <small style="color:var(--ink-400); font-weight:700;">🟢 New Value (After)</small>
        <div style="margin-top:4px;">${prettyJson(a.newValue)}</div>
      </div>
    </div>

    <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; padding-top:12px; border-top:1px solid #e2e8f0;">
      <div>
        <small style="color:var(--ink-400); font-weight:700;">IP Address</small>
        <div style="font-family:monospace; font-size:12.5px;">${esc(a.ipAddress || '—')}</div>
      </div>
      <div>
        <small style="color:var(--ink-400); font-weight:700;">User Agent / Device</small>
        <div style="font-size:11.5px; word-break:break-all;">${esc(a.userAgent || '—')}</div>
      </div>
    </div>
  `;

  drawer.classList.remove('hide');
}

if ($('btnCloseDrawer')) {
  $('btnCloseDrawer').addEventListener('click', () => {
    $('activityDetailDrawer').classList.add('hide');
  });
}

if ($('btnCloseDrawerFooter')) {
  $('btnCloseDrawerFooter').addEventListener('click', () => {
    $('activityDetailDrawer').classList.add('hide');
  });
}

// Close drawer on backdrop click
if ($('activityDetailDrawer')) {
  $('activityDetailDrawer').addEventListener('click', (e) => {
    if (e.target === $('activityDetailDrawer')) {
      $('activityDetailDrawer').classList.add('hide');
    }
  });
}

// ================= 2. USER 360 VIEW =================
async function initUser360() {
  try {
    // Populate user dropdown
    const sel = $('selectUser360');
    if (!sel) return;

    const data = await adminApi('/users?limit=200');
    if (!data || !data.users) return;

    sel.innerHTML = '<option value="">Select a patient, guardian, or caretaker to investigate...</option>' +
      data.users.map(u => `<option value="${u.id}">${esc(u.fullName)} (${esc(u.role)}) ${u.patientCode ? '[' + esc(u.patientCode) + ']' : ''}</option>`).join('');
  } catch (err) {
    showToast('Failed to load user list: ' + err.message, true);
  }
}

if ($('selectUser360')) {
  $('selectUser360').addEventListener('change', (e) => {
    if (e.target.value) loadUser360(e.target.value);
  });
}

if ($('btnRefreshUser360')) {
  $('btnRefreshUser360').addEventListener('click', () => {
    const sel = $('selectUser360');
    if (sel && sel.value) loadUser360(sel.value);
  });
}

async function loadUser360(userId) {
  const container = $('user360ContentContainer');
  if (!container) return;

  container.innerHTML = '<div class="admin-card" style="text-align:center; padding:40px; color:var(--ink-400);">Loading complete 360° investigation dossier & recording audit access…</div>';

  try {
    const data = await adminApi('/oversight/users/' + userId + '/360');
    if (!data) return;

    const u = data.user;
    const s = data.sessionInfo;
    const adh = data.adherence;
    const meds = data.medications || [];
    const doses = data.doseHistory || [];
    const notes = data.vitalsAndNotes || [];
    const docs = data.doctors || [];
    const cc = data.careCircle || {};
    const timeline = data.personalTimeline || [];

    // Risk badges
    const riskBadges = [];
    if (adh.isAtRisk) riskBadges.push('<span style="background:#fef2f2; color:#dc2626; font-weight:700; font-size:11px; padding:3px 8px; border-radius:4px;">⚠ LOW ADHERENCE <70%</span>');
    if (adh.hasConsecutiveMissedRisk) riskBadges.push('<span style="background:#fff7ed; color:#ea580c; font-weight:700; font-size:11px; padding:3px 8px; border-radius:4px;">⚠ 3+ CONSECUTIVE MISSED</span>');
    if (adh.hasInactivityRisk) riskBadges.push('<span style="background:#fefce8; color:#ca8a04; font-weight:700; font-size:11px; padding:3px 8px; border-radius:4px;">⚠ 48h+ INACTIVE</span>');

    container.innerHTML = `
      <!-- Profile Header -->
      <div class="admin-card" style="margin-bottom:20px;">
        <div style="display:flex; align-items:center; gap:16px; margin-bottom:14px;">
          <div style="width:56px; height:56px; border-radius:50%; background:${u.avatarColor || '#0d9488'}; color:#fff; display:flex; align-items:center; justify-content:center; font-size:22px; font-weight:700;">
            ${(u.fullName || 'U').charAt(0).toUpperCase()}
          </div>
          <div>
            <h2 style="font-size:20px; margin-bottom:4px;">${esc(u.fullName)}</h2>
            <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
              <span class="badge-role badge-role-${u.role}">${esc(u.role)}</span>
              <span class="badge-status ${u.isActive ? 'badge-status-active' : 'badge-status-inactive'}">${u.isActive ? '● Active' : '● Inactive'}</span>
              ${u.patientCode ? '<code>' + esc(u.patientCode) + '</code>' : ''}
              ${riskBadges.join(' ')}
            </div>
          </div>
        </div>
        <div style="display:grid; grid-template-columns:repeat(4, 1fr); gap:12px; background:#f8fafc; padding:12px; border-radius:8px; border:1px solid #e2e8f0; font-size:12.5px;">
          <div><strong>Email:</strong><br>${esc(u.email)}</div>
          <div><strong>Phone:</strong><br>${esc(u.phone || '—')}</div>
          <div><strong>Emergency:</strong><br>${esc(u.emergencyContact || '—')}</div>
          <div><strong>Registered:</strong><br>${esc(String(u.createdAt || '').slice(0, 10))}</div>
        </div>
      </div>

      <!-- Session & Adherence Stats Row -->
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:20px; margin-bottom:20px;">
        <div class="admin-card" style="margin-bottom:0;">
          <h4 style="font-size:14px; margin-bottom:10px;">🔐 Session & Login Info</h4>
          <div style="font-size:13px; line-height:1.8;">
            <div><strong>Last Login:</strong> ${s.lastLogin ? esc(String(s.lastLogin.timestamp || '').slice(0, 19)) : 'Never'}</div>
            <div><strong>Last IP:</strong> <code>${s.lastLogin ? esc(s.lastLogin.ipAddress) : '—'}</code></div>
            <div><strong>Failed Attempts (24h):</strong> <span style="color:${s.failedAttempts24h >= 5 ? '#dc2626' : '#059669'}; font-weight:700;">${s.failedAttempts24h}</span></div>
          </div>
          ${s.recentSessions && s.recentSessions.length ? `
            <div style="margin-top:10px; font-size:11.5px;">
              <strong>Recent Auth Events:</strong>
              ${s.recentSessions.slice(0, 5).map(ss => `<div style="color:var(--ink-600);">${esc(ss.action_type)} — ${esc(String(ss.created_at || '').slice(0, 19))} from ${esc(ss.ip_address || '—')}</div>`).join('')}
            </div>
          ` : ''}
        </div>
        <div class="admin-card" style="margin-bottom:0;">
          <h4 style="font-size:14px; margin-bottom:10px;">📊 30-Day Adherence Summary</h4>
          <div style="display:flex; align-items:center; gap:18px;">
            <div style="font-size:36px; font-weight:800; color:${adh.adherenceRate < 70 ? '#dc2626' : adh.adherenceRate < 85 ? '#d97706' : '#059669'};">${adh.adherenceRate}%</div>
            <div style="font-size:12.5px; line-height:1.7;">
              <div>Scheduled: <strong>${adh.totalDoses}</strong></div>
              <div>Taken: <strong style="color:#059669;">${adh.takenDoses}</strong></div>
              <div>Missed: <strong style="color:#dc2626;">${adh.missedDoses}</strong></div>
              <div>Consecutive Missed: <strong style="color:${adh.consecutiveMissed >= 3 ? '#dc2626' : 'inherit'};">${adh.consecutiveMissed}</strong></div>
              <div>Hours Since Last Dose: <strong>${adh.hoursSinceLastDose !== null ? adh.hoursSinceLastDose + 'h' : 'N/A'}</strong></div>
            </div>
          </div>
        </div>
      </div>

      <!-- Medications -->
      <div class="admin-card" style="margin-bottom:20px;">
        <h4 style="font-size:14px; margin-bottom:10px;">💊 Medications & Schedules (${meds.length})</h4>
        ${meds.length ? `
          <div class="admin-table-wrap"><table class="admin-table"><thead><tr>
            <th>Medication</th><th>Dosage</th><th>Frequency</th><th>Dose Times</th><th>Period</th><th>Status</th>
          </tr></thead><tbody>
          ${meds.map(m => `<tr>
            <td><strong>${esc(m.name)}</strong></td>
            <td>${esc(m.dosage)} (${esc(m.quantity)})</td>
            <td>${esc(m.frequency)}</td>
            <td>${(m.schedules || []).map(s => '<span class="time-pill">' + esc(s.time) + '</span>').join(' ') || '—'}</td>
            <td><small>${esc(String(m.startDate || '').slice(0, 10))} → ${esc(String(m.endDate || '').slice(0, 10) || 'Ongoing')}</small></td>
            <td>${m.isActive ? '<span class="badge-status badge-status-active">Active</span>' : '<span class="badge-status badge-status-inactive">Inactive</span>'}</td>
          </tr>`).join('')}
          </tbody></table></div>
        ` : '<p style="font-size:12px; color:var(--ink-400);">No medications registered.</p>'}
      </div>

      <!-- Recent Doses -->
      <div class="admin-card" style="margin-bottom:20px;">
        <h4 style="font-size:14px; margin-bottom:10px;">💉 Recent Dose History (${doses.length})</h4>
        ${doses.length ? `
          <div class="admin-table-wrap"><table class="admin-table"><thead><tr>
            <th>Medication</th><th>Status</th><th>Scheduled For</th><th>Recorded At</th><th>Recorded By</th>
          </tr></thead><tbody>
          ${doses.slice(0, 20).map(d => `<tr>
            <td>${esc(d.medicationName || '—')} ${esc(d.dosage || '')}</td>
            <td><span style="color:${d.status === 'taken' ? '#059669' : '#dc2626'}; font-weight:700;">${esc(d.status)}</span></td>
            <td><small>${esc(String(d.scheduledFor || '').slice(0, 19))}</small></td>
            <td><small>${esc(String(d.recordedAt || '').slice(0, 19))}</small></td>
            <td>${esc(d.recordedBy || '—')}</td>
          </tr>`).join('')}
          </tbody></table></div>
        ` : '<p style="font-size:12px; color:var(--ink-400);">No dose events recorded.</p>'}
      </div>

      <!-- Vitals & Care Notes -->
      ${notes.length ? `
      <div class="admin-card" style="margin-bottom:20px;">
        <h4 style="font-size:14px; margin-bottom:10px;">📋 Vitals & Care Notes (${notes.length})</h4>
        <div style="display:flex; flex-direction:column; gap:8px;">
          ${notes.slice(0, 15).map(n => `
            <div style="background:#f8fafc; border:1px solid #e2e8f0; padding:10px; border-radius:6px; font-size:12.5px;">
              <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                <strong style="color:#0f766e;">${esc(n.authorName || 'System')} (${esc(n.authorRole || '')})</strong>
                <small style="color:var(--ink-400);">${esc(String(n.createdAt || '').slice(0, 16))}</small>
              </div>
              <div>${esc(n.content || n.note || '—')}</div>
              ${n.vitals ? '<div style="font-size:11px; color:var(--ink-500); margin-top:4px;">Vitals: ' + esc(JSON.stringify(n.vitals)) + '</div>' : ''}
            </div>
          `).join('')}
        </div>
      </div>
      ` : ''}

      <!-- Doctors -->
      ${docs.length ? `
      <div class="admin-card" style="margin-bottom:20px;">
        <h4 style="font-size:14px; margin-bottom:10px;">🩺 Saved Doctors (${docs.length})</h4>
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:10px;">
          ${docs.map(d => `
            <div style="background:#f8fafc; border:1px solid #e2e8f0; padding:10px; border-radius:6px; font-size:12.5px;">
              <strong>${esc(d.name)}</strong> <small style="color:var(--ink-400);">${esc(d.specialty || '')}</small>
              <div style="font-size:11px; color:var(--ink-600); margin-top:2px;">${esc(d.phone || '')} · ${esc(d.email || '')}</div>
            </div>
          `).join('')}
        </div>
      </div>
      ` : ''}

      <!-- Care Circle -->
      <div class="admin-card" style="margin-bottom:20px;">
        <h4 style="font-size:14px; margin-bottom:10px;">⭕ Care Circle Connections</h4>
        ${(cc.asPatient && cc.asPatient.length) ? `
          <div style="margin-bottom:10px;">
            <strong style="font-size:12px; color:var(--ink-500);">Care Team Members (caring for this patient):</strong>
            ${cc.asPatient.map(c => `
              <div style="background:#f0fdf4; border:1px solid #bbf7d0; padding:8px 12px; border-radius:6px; font-size:12.5px; margin-top:6px; display:flex; justify-content:space-between;">
                <div><strong>${esc(c.full_name)}</strong> (${esc(c.role)}) — ${esc(c.relationship)}</div>
                <small style="color:var(--ink-400);">${esc(c.email || c.phone || '')}</small>
              </div>
            `).join('')}
          </div>
        ` : ''}
        ${(cc.asMember && cc.asMember.length) ? `
          <div>
            <strong style="font-size:12px; color:var(--ink-500);">Patients this user is caring for:</strong>
            ${cc.asMember.map(c => `
              <div style="background:#eff6ff; border:1px solid #bfdbfe; padding:8px 12px; border-radius:6px; font-size:12.5px; margin-top:6px; display:flex; justify-content:space-between;">
                <div><strong>${esc(c.full_name)}</strong> [<code>${esc(c.patient_code)}</code>] — ${esc(c.relationship)}</div>
              </div>
            `).join('')}
          </div>
        ` : ''}
        ${(!cc.asPatient || !cc.asPatient.length) && (!cc.asMember || !cc.asMember.length) ? '<p style="font-size:12px; color:var(--ink-400);">No care circle connections.</p>' : ''}
      </div>

      <!-- Personal Activity Timeline -->
      <div class="admin-card" style="margin-bottom:20px;">
        <h4 style="font-size:14px; margin-bottom:10px;">🕐 Personal Activity Timeline (Last ${timeline.length} actions)</h4>
        ${timeline.length ? `
          <div class="admin-table-wrap"><table class="admin-table"><thead><tr>
            <th>Action</th><th>Entity</th><th>Description</th><th>IP</th><th>Timestamp</th><th>Inspect</th>
          </tr></thead><tbody>
          ${timeline.map(t => `<tr style="cursor:pointer;">
            <td><span style="font-family:monospace; font-size:11px; font-weight:700;">${esc(t.actionType)}</span></td>
            <td><small>${esc(t.entityType || '—')} #${esc(String(t.entityId || '—'))}</small></td>
            <td style="max-width:240px; font-size:12px;">${esc(t.description || '—')}</td>
            <td><code style="font-size:10px;">${esc(t.ipAddress || '—')}</code></td>
            <td><small>${esc(String(t.createdAt || '').slice(0, 19))}</small></td>
            <td><button type="button" class="btn-action-icon btn-inspect-timeline" data-event='${JSON.stringify(t).replace(/'/g, "&#39;")}' title="Inspect">🔍</button></td>
          </tr>`).join('')}
          </tbody></table></div>
        ` : '<p style="font-size:12px; color:var(--ink-400);">No activity recorded for this user.</p>'}
      </div>

      <div style="padding:10px; background:#fef3c7; border:1px solid #fde68a; border-radius:6px; font-size:11px; color:#92400e;">
        🛡️ <strong>Compliance Audit Notice:</strong> Access to this User 360° clinical dossier was recorded in the forensic audit log under administrator ID #${AdminState.user?.id}.
      </div>
    `;

    // Wire up timeline inspect buttons
    container.querySelectorAll('.btn-inspect-timeline').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        try {
          const ev = JSON.parse(btn.dataset.event);
          ev.user = { name: u.fullName, role: u.role, patientCode: u.patientCode, avatarColor: u.avatarColor };
          openActivityDrawer(ev);
        } catch {}
      });
    });
  } catch (err) {
    container.innerHTML = '<div class="admin-card" style="text-align:center; padding:40px; color:#dc2626;">Failed to load User 360 dossier: ' + esc(err.message) + '</div>';
  }
}

// ================= 3. LOGIN & SESSION MONITOR =================
async function loadSessionMonitor() {
  try {
    const data = await adminApi('/oversight/sessions');
    if (!data) return;

    // Online Users Grid
    const grid = $('onlineUsersGrid');
    if (grid) {
      if (!data.onlineUsers || !data.onlineUsers.length) {
        grid.innerHTML = '<div style="color:var(--ink-400); font-size:13px; padding:12px;">No users active in the last 30 minutes.</div>';
      } else {
        grid.innerHTML = data.onlineUsers.map(u => `
          <div style="background:#f0fdf4; border:1px solid #bbf7d0; border-radius:8px; padding:12px; display:flex; align-items:center; gap:10px;">
            <div style="width:36px; height:36px; border-radius:50%; background:${u.avatarColor || '#0d9488'}; color:#fff; display:flex; align-items:center; justify-content:center; font-size:14px; font-weight:700;">
              ${(u.fullName || 'U').charAt(0).toUpperCase()}
            </div>
            <div style="flex:1;">
              <strong style="font-size:13px;">${esc(u.fullName)}</strong>
              <div style="font-size:11px; color:var(--ink-500);">
                <span style="text-transform:uppercase; font-weight:700;">${esc(u.role)}</span>
                ${u.patientCode ? ' · <code>' + esc(u.patientCode) + '</code>' : ''}
              </div>
              <div style="font-size:10px; color:var(--ink-400); margin-top:2px;">
                IP: <code>${esc(u.ipAddress || '—')}</code> · Last: ${esc(String(u.lastSeen || '').slice(11, 19))}
              </div>
            </div>
            <span style="width:10px; height:10px; border-radius:50%; background:#22c55e; display:inline-block;" title="Online"></span>
          </div>
        `).join('');
      }
    }

    // Suspicious Flags Banner
    const banner = $('sessionSuspiciousBanner');
    const flagList = $('sessionSuspiciousList');
    if (banner && flagList) {
      const flags = data.suspiciousFlags || {};
      const items = [];

      if (flags.bruteForceAlerts && flags.bruteForceAlerts.length) {
        flags.bruteForceAlerts.forEach(b => {
          items.push(`🔴 <strong>Brute Force Alert:</strong> IP <code>${esc(b.ip_address)}</code> — ${b.failed_count} failed login attempts in 24h (last: ${esc(String(b.last_attempt || '').slice(0, 19))})`);
        });
      }

      if (flags.multiIpAlerts && flags.multiIpAlerts.length) {
        flags.multiIpAlerts.forEach(m => {
          items.push(`🟠 <strong>Multi-IP Login:</strong> ${esc(m.full_name)} (${esc(m.role)}) logged in from ${m.ip_count} distinct IPs: <code>${esc(m.ips)}</code>`);
        });
      }

      if (items.length) {
        flagList.innerHTML = items.join('<br>');
        banner.classList.remove('hide');
      } else {
        banner.classList.add('hide');
      }
    }

    // Recent Auth Events Table
    const authTbody = $('sessionAuthTableBody');
    if (authTbody) {
      if (!data.recentAuth || !data.recentAuth.length) {
        authTbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:24px; color:var(--ink-400);">No recent auth events.</td></tr>';
      } else {
        authTbody.innerHTML = data.recentAuth.map(e => {
          const color = e.action_type === 'LOGIN_SUCCESS' ? '#059669' : e.action_type === 'LOGIN_FAILED' ? '#dc2626' : '#64748b';
          return `<tr>
            <td><strong style="font-size:12.5px;">${esc(e.user_name)}</strong><br><small style="color:var(--ink-400);">${esc(e.user_role || '')}</small></td>
            <td><span style="color:${color}; font-weight:700; font-size:11px;">${esc(e.action_type)}</span></td>
            <td><code style="font-size:10px;">${esc(e.ip_address || '—')}</code><br><small style="font-size:10px; color:var(--ink-400);">${esc((e.user_agent || '').substring(0, 35))}</small></td>
            <td><small>${esc(String(e.created_at || '').slice(0, 19))}</small></td>
          </tr>`;
        }).join('');
      }
    }

    // Failed Login Attempts Table
    const failedTbody = $('sessionFailedTableBody');
    if (failedTbody) {
      if (!data.failedAttempts || !data.failedAttempts.length) {
        failedTbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:24px; color:var(--ink-400);">No failed login attempts in the last 24 hours. ✅</td></tr>';
      } else {
        failedTbody.innerHTML = data.failedAttempts.map(f => `<tr>
          <td><code>${esc(f.ip_address || '—')}</code></td>
          <td style="font-size:12px;">${esc(f.description || '—')}</td>
          <td><span style="color:${f.count >= 5 ? '#dc2626' : '#d97706'}; font-weight:700;">${f.count}</span></td>
          <td><small>${esc(String(f.last_attempt || '').slice(0, 19))}</small></td>
        </tr>`).join('');
      }
    }
  } catch (err) {
    showToast('Failed to load session monitor: ' + err.message, true);
  }
}

if ($('btnRefreshSessions')) {
  $('btnRefreshSessions').addEventListener('click', () => loadSessionMonitor());
}

// ================= 4. ADHERENCE WATCHLIST =================
async function loadAdherenceWatchlist() {
  try {
    const tbody = $('watchlistTableBody');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="10" style="text-align:center; padding:32px; color:var(--ink-400);">Evaluating patient adherence compliance...</td></tr>';

    const data = await adminApi('/oversight/adherence-watchlist');
    if (!data || !data.watchlist) return;

    if (!data.watchlist.length) {
      tbody.innerHTML = '<tr><td colspan="10" style="text-align:center; padding:32px; color:var(--ink-400);">No active patients found in the system.</td></tr>';
      return;
    }

    tbody.innerHTML = data.watchlist.map(p => {
      const rateColor = p.adherenceRate < 70 ? '#dc2626' : p.adherenceRate < 85 ? '#d97706' : '#059669';
      const flagBadges = [];
      if (p.flags.atRisk) flagBadges.push('<span style="background:#fef2f2; color:#dc2626; font-size:10px; font-weight:700; padding:2px 6px; border-radius:3px;">AT RISK</span>');
      if (p.flags.consecutiveMissed) flagBadges.push('<span style="background:#fff7ed; color:#ea580c; font-size:10px; font-weight:700; padding:2px 6px; border-radius:3px;">3+ MISSED</span>');
      if (p.flags.inactivity48h) flagBadges.push('<span style="background:#fefce8; color:#ca8a04; font-size:10px; font-weight:700; padding:2px 6px; border-radius:3px;">48h INACTIVE</span>');

      return `<tr>
        <td>
          <div style="display:flex; align-items:center; gap:6px;">
            <div style="width:28px; height:28px; border-radius:50%; background:${p.avatarColor || '#0d9488'}; color:#fff; display:flex; align-items:center; justify-content:center; font-size:11px; font-weight:700;">${(p.fullName || 'P').charAt(0).toUpperCase()}</div>
            <strong style="font-size:12.5px;">${esc(p.fullName)}</strong>
          </div>
        </td>
        <td><code>${esc(p.patientCode || '—')}</code></td>
        <td style="text-align:center;">${p.scheduled}</td>
        <td style="text-align:center; color:#059669; font-weight:700;">${p.taken}</td>
        <td style="text-align:center; color:#dc2626; font-weight:700;">${p.missed}</td>
        <td style="text-align:center;"><span style="font-size:16px; font-weight:800; color:${rateColor};">${p.adherenceRate}%</span></td>
        <td style="text-align:center;"><span style="font-weight:700; color:${p.consecutiveMissed >= 3 ? '#dc2626' : 'inherit'};">${p.consecutiveMissed}</span></td>
        <td style="text-align:center; font-size:12px;">${typeof p.hoursInactive === 'number' ? p.hoursInactive + 'h ago' : esc(String(p.hoursInactive))}</td>
        <td>${flagBadges.length ? flagBadges.join(' ') : '<span style="color:#059669; font-weight:700; font-size:11px;">✅ OK</span>'}</td>
        <td><button type="button" class="btn-action-icon btn-watchlist-360" data-id="${p.id}" title="Open User 360° View">👁️ 360°</button></td>
      </tr>`;
    }).join('');

    // Wire up 360 buttons
    tbody.querySelectorAll('.btn-watchlist-360').forEach(btn => {
      btn.addEventListener('click', () => {
        const uid = btn.dataset.id;
        switchTab('user-360');
        setTimeout(() => {
          const sel = $('selectUser360');
          if (sel) { sel.value = uid; loadUser360(uid); }
        }, 300);
      });
    });
  } catch (err) {
    showToast('Failed to load adherence watchlist: ' + err.message, true);
  }
}

if ($('btnRefreshWatchlist')) {
  $('btnRefreshWatchlist').addEventListener('click', () => loadAdherenceWatchlist());
}

// ================= 5. MEDICATION & SCHEDULE CHANGE TRACKER =================
async function loadMedicationChanges() {
  try {
    const tbody = $('medChangesTableBody');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:32px; color:var(--ink-400);">Loading medication change history...</td></tr>';

    const data = await adminApi('/oversight/medication-changes?limit=50');
    if (!data || !data.changes) return;

    if (!data.changes.length) {
      tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:32px; color:var(--ink-400);">No medication or schedule changes recorded yet.</td></tr>';
      return;
    }

    tbody.innerHTML = data.changes.map(c => {
      const actionColors = {
        MEDICATION_ADD: '#2563eb', MEDICATION_EDIT: '#d97706', MEDICATION_DELETE: '#dc2626',
        SCHEDULE_CREATE: '#2563eb', SCHEDULE_EDIT: '#d97706', SCHEDULE_TOGGLE: '#7c3aed'
      };
      const aColor = actionColors[c.actionType] || '#475569';

      // Build a compact diff display
      let diffHtml = '—';
      if (c.oldValue || c.newValue) {
        const oldStr = c.oldValue ? JSON.stringify(c.oldValue, null, 1) : '(none)';
        const newStr = c.newValue ? JSON.stringify(c.newValue, null, 1) : '(none)';
        diffHtml = `<div style="display:grid; grid-template-columns:1fr 1fr; gap:4px; font-size:10px;">
          <div style="background:#fef2f2; padding:4px 6px; border-radius:4px; max-height:60px; overflow:auto;"><strong style="color:#dc2626;">OLD:</strong> ${esc(oldStr.substring(0, 120))}${oldStr.length > 120 ? '…' : ''}</div>
          <div style="background:#f0fdf4; padding:4px 6px; border-radius:4px; max-height:60px; overflow:auto;"><strong style="color:#059669;">NEW:</strong> ${esc(newStr.substring(0, 120))}${newStr.length > 120 ? '…' : ''}</div>
        </div>`;
      }

      return `<tr style="${c.isUnusual ? 'background:#fffbeb;' : ''}">
        <td><code>#${c.id}</code>${c.isUnusual ? '<br><span style="color:#d97706; font-size:10px; font-weight:700;">⚠ ' + esc(c.unusualReason || 'Unusual') + '</span>' : ''}</td>
        <td>
          <strong style="font-size:12.5px;">${esc(c.actor.name || '—')}</strong>
          <div style="font-size:10px; color:var(--ink-500); text-transform:uppercase;">${esc(c.actor.role || '')}</div>
        </td>
        <td><span style="background:${aColor}15; color:${aColor}; font-weight:700; font-size:11px; padding:2px 6px; border-radius:4px; font-family:monospace;">${esc(c.actionType)}</span></td>
        <td style="max-width:200px; font-size:12px;">${esc(c.description || '—')}</td>
        <td style="max-width:260px;">${diffHtml}</td>
        <td><code style="font-size:10px;">${esc(c.ipAddress || '—')}</code></td>
        <td><small>${esc(String(c.createdAt || '').slice(0, 19))}</small></td>
        <td><button type="button" class="btn-action-icon btn-inspect-medchange" data-event='${JSON.stringify(c).replace(/'/g, "&#39;")}' title="Inspect full diff">🔍</button></td>
      </tr>`;
    }).join('');

    // Wire inspect buttons
    tbody.querySelectorAll('.btn-inspect-medchange').forEach(btn => {
      btn.addEventListener('click', () => {
        try {
          const ev = JSON.parse(btn.dataset.event);
          ev.user = ev.actor;
          openActivityDrawer(ev);
        } catch {}
      });
    });
  } catch (err) {
    showToast('Failed to load medication changes: ' + err.message, true);
  }
}

if ($('btnRefreshMedChanges')) {
  $('btnRefreshMedChanges').addEventListener('click', () => loadMedicationChanges());
}

// ================= 6. EMERGENCY & ALERT CENTER =================
async function loadAlertCenter() {
  try {
    const tbody = $('alertCenterTableBody');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; padding:32px; color:var(--ink-400);">Loading emergency and alert stream...</td></tr>';

    const data = await adminApi('/oversight/alert-center');
    if (!data || !data.alerts) return;

    if (!data.alerts.length) {
      tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; padding:32px; color:var(--ink-400);">No alerts or emergency events recorded.</td></tr>';
      return;
    }

    tbody.innerHTML = data.alerts.map(a => {
      const typeColors = { sos: '#dc2626', nudge: '#d97706', missed_dose: '#ea580c', medication: '#2563eb' };
      const tColor = typeColors[a.alertType] || '#475569';
      const statusBadge = a.status === 'open'
        ? '<span style="background:#fef2f2; color:#dc2626; font-weight:700; font-size:11px; padding:2px 8px; border-radius:4px;">🔴 OPEN</span>'
        : '<span style="background:#f0fdf4; color:#059669; font-weight:700; font-size:11px; padding:2px 8px; border-radius:4px;">✅ ACK</span>';

      return `<tr style="${a.isUrgent ? 'background:#fef2f2;' : ''}">
        <td><code>#${a.id}</code></td>
        <td><span style="background:${tColor}15; color:${tColor}; font-weight:700; font-size:11px; padding:2px 8px; border-radius:4px; text-transform:uppercase;">${esc(a.alertType)}</span></td>
        <td>
          <strong>${esc(a.patient.name)}</strong>
          ${a.patient.patientCode ? '<br><code style="font-size:10px;">' + esc(a.patient.patientCode) + '</code>' : ''}
        </td>
        <td style="max-width:220px;">
          <strong style="font-size:12.5px;">${esc(a.title)}</strong>
          <div style="font-size:11.5px; color:var(--ink-600);">${esc(a.message || '')}</div>
        </td>
        <td>${a.sender ? esc(a.sender.name) + ' <small>(' + esc(a.sender.role) + ')</small>' : '—'}</td>
        <td>${esc(a.recipient.name)} <small>(${esc(a.recipient.role)})</small></td>
        <td>${statusBadge}</td>
        <td>${a.responseTimeMinutes ? '<span style="font-weight:700;">' + a.responseTimeMinutes + ' min</span>' + (a.acknowledgedBy ? '<br><small>by ' + esc(a.acknowledgedBy) + '</small>' : '') : '<span style="color:var(--ink-400);">—</span>'}</td>
        <td><small>${esc(String(a.createdAt || '').slice(0, 19))}</small></td>
      </tr>`;
    }).join('');
  } catch (err) {
    showToast('Failed to load alert center: ' + err.message, true);
  }
}

if ($('btnRefreshAlertCenter')) {
  $('btnRefreshAlertCenter').addEventListener('click', () => loadAlertCenter());
}

// ================= 7. CARE CIRCLE MAP =================
async function loadCareCircleMap() {
  try {
    const tbody = $('careMapTableBody');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:32px; color:var(--ink-400);">Compiling care circle relationship matrix...</td></tr>';

    const data = await adminApi('/oversight/care-circle-map');
    if (!data || !data.map) return;

    if (!data.map.length) {
      tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:32px; color:var(--ink-400);">No patient-caregiver connections found in the system.</td></tr>';
      return;
    }

    tbody.innerHTML = data.map.map(c => {
      const permissions = [];
      if (c.canManageMeds) permissions.push('💊 Manage Meds');
      if (c.canRecordDoses) permissions.push('✅ Record Doses');
      if (!permissions.length) permissions.push('View Only');

      return `<tr>
        <td>
          <div style="display:flex; align-items:center; gap:6px;">
            <div style="width:24px; height:24px; border-radius:50%; background:${c.patient.avatar || '#0d9488'}; color:#fff; display:flex; align-items:center; justify-content:center; font-size:10px; font-weight:700;">${(c.patient.name || 'P').charAt(0).toUpperCase()}</div>
            <div>
              <strong style="font-size:12.5px;">${esc(c.patient.name)}</strong>
              <div><code style="font-size:10px;">${esc(c.patient.patientCode || '—')}</code></div>
            </div>
          </div>
        </td>
        <td>
          <div style="display:flex; align-items:center; gap:6px;">
            <div style="width:24px; height:24px; border-radius:50%; background:${c.caregiver.avatar || '#4338ca'}; color:#fff; display:flex; align-items:center; justify-content:center; font-size:10px; font-weight:700;">${(c.caregiver.name || 'C').charAt(0).toUpperCase()}</div>
            <div>
              <strong style="font-size:12.5px;">${esc(c.caregiver.name)}</strong>
              <div style="font-size:10px; color:var(--ink-500); text-transform:uppercase; font-weight:700;">${esc(c.caregiver.role)}</div>
            </div>
          </div>
        </td>
        <td><span style="font-size:12px;">${esc(c.relationship || '—')}</span></td>
        <td><span style="font-size:11px;">${permissions.join(', ')}</span></td>
        <td style="text-align:center; font-weight:700;">${c.stats.notesLogged}</td>
        <td style="text-align:center; font-weight:700;">${c.stats.dosesSignedOff}</td>
        <td style="text-align:center; font-weight:700;">${c.stats.nudgesSent}</td>
        <td><small>${esc(String(c.stats.lastActive || 'Never').slice(0, 19))}</small></td>
      </tr>`;
    }).join('');
  } catch (err) {
    showToast('Failed to load care circle map: ' + err.message, true);
  }
}

if ($('btnRefreshCareMap')) {
  $('btnRefreshCareMap').addEventListener('click', () => loadCareCircleMap());
}

// ================= 8. DATA ACCESS AUDIT =================
async function loadDataAccessAudit() {
  try {
    const tbody = $('dataAccessAuditTableBody');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:32px; color:var(--ink-400);">Loading data access audit ledger...</td></tr>';

    const params = new URLSearchParams({
      page: AdminState.accessAuditPage,
      limit: AdminState.accessAuditLimit
    });

    const data = await adminApi('/oversight/data-access-audit?' + params.toString());
    if (!data) return;

    if (!data.accessLogs || !data.accessLogs.length) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:32px; color:var(--ink-400);">No admin data access records found. Access events are logged when administrators open patient health dossiers.</td></tr>';
    } else {
      tbody.innerHTML = data.accessLogs.map(l => `<tr>
        <td><code>#${l.id}</code></td>
        <td>
          <strong>${esc(l.admin_name)}</strong>
          <div style="font-size:10px; color:var(--ink-400);">${esc(l.admin_email)}</div>
        </td>
        <td><span style="background:#fef3c7; color:#92400e; font-weight:700; font-size:11px; padding:2px 7px; border-radius:4px; font-family:monospace;">${esc(l.action)}</span></td>
        <td><small>${esc(l.target_type || '—')} #${esc(String(l.target_id || '—'))}</small></td>
        <td style="max-width:300px; font-size:12px;">${esc(l.details || '—')}</td>
        <td><code style="font-size:10px;">${esc(l.ip_address || '—')}</code></td>
        <td><small>${esc(String(l.created_at || '').slice(0, 19))}</small></td>
      </tr>`).join('');
    }

    // Pagination
    const p = data.pagination;
    if ($('accessAuditPaginationInfo')) {
      const start = (p.page - 1) * p.limit + 1;
      const end = Math.min(p.total, p.page * p.limit);
      $('accessAuditPaginationInfo').textContent = p.total > 0 ? `Showing ${start}-${end} of ${p.total} access logs` : 'No access logs';
    }
    if ($('accessAuditPageCurrent')) $('accessAuditPageCurrent').textContent = p.page;
    if ($('btnPrevAccessAuditPage')) $('btnPrevAccessAuditPage').disabled = p.page <= 1;
    if ($('btnNextAccessAuditPage')) $('btnNextAccessAuditPage').disabled = p.page >= p.pages;
  } catch (err) {
    showToast('Failed to load data access audit: ' + err.message, true);
  }
}

if ($('btnRefreshAccessAudit')) {
  $('btnRefreshAccessAudit').addEventListener('click', () => loadDataAccessAudit());
}

if ($('btnPrevAccessAuditPage')) {
  $('btnPrevAccessAuditPage').addEventListener('click', () => {
    if (AdminState.accessAuditPage > 1) {
      AdminState.accessAuditPage--;
      loadDataAccessAudit();
    }
  });
}

if ($('btnNextAccessAuditPage')) {
  $('btnNextAccessAuditPage').addEventListener('click', () => {
    AdminState.accessAuditPage++;
    loadDataAccessAudit();
  });
}

// ================= SESSION BOOTSTRAP =================
(async () => {
  if (!AdminState.token) {
    window.location.href = '/admin/login';
    return;
  }

  try {
    const data = await adminApi('/auth/me');
    if (!data || !data.user) {
      window.location.href = '/admin/login';
      return;
    }

    AdminState.user = data.user;

    if ($('adminHeaderName')) {
      $('adminHeaderName').textContent = data.user.fullName || 'Administrator';
    }
    if ($('adminAvatarLetter')) {
      $('adminAvatarLetter').textContent = (data.user.fullName || 'A').charAt(0).toUpperCase();
      if (data.user.avatarColor) {
        $('adminAvatarLetter').style.background = data.user.avatarColor;
      }
    }

    switchTab('dashboard');
  } catch (err) {
    console.error('Admin session validation failed:', err);
    localStorage.removeItem('dosetrack_admin_token');
    localStorage.removeItem('dosetrack_admin_user');
    window.location.href = '/admin/login';
  }
})();
