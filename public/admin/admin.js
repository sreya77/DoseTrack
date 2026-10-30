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
    'dashboard': 'Clinical Overview & System KPIs',
    'users': 'User Account & Credential Management',
    'medications': 'Cross-Patient Medication Formulary',
    'adherence': 'Dose Adherence & At-Risk Monitoring',
    'doctors': 'Doctor & Clinical Directory',
    'care-circles': 'Care Circle & Family Connections',
    'reminders': 'Reminder Logs & System Configuration',
    'reports': 'Regulatory & Adherence Compliance Reports',
    'audit': 'Forensic Audit Log & Administrator Profile'
  };
  if ($('currentTabTitle')) {
    $('currentTabTitle').textContent = titles[tabId] || 'Administrator Console';
  }

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
  } else if (tabId === 'reminders') {
    loadReminders();
  } else if (tabId === 'reports') {
    initReports();
  } else if (tabId === 'audit') {
    loadAuditLog();
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
  } catch (err) {
    showToast('Failed to load dashboard statistics: ' + err.message, true);
  }
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

    const { user, careTeam, assignedPatients, medications, adherenceStats } = data;

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
