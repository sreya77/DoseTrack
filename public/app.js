/**
 * DoseTrack Connected Care System - Client Application
 * Role-tailored frontend for Patients, Guardians, and Caretakers.
 */

// Global State
const S = {
  token: localStorage.getItem('dosetrack_token'),
  user: null,
  authMode: 'login', // 'login' | 'register'
  registerRole: 'patient', // 'patient' | 'guardian' | 'caretaker'
  currentPage: 'dashboard',
  activePatientId: null, // For Guardian / Caretaker
  activePatient: null,
  connectedPatients: [],
  medications: [],
  todayDoses: [],
  alerts: [],
  unreadAlerts: 0,
  pollTimer: null
};

// Utilities
const $ = (id) => document.getElementById(id);
const esc = (s) =>
  String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[c]));

async function api(path, opt = {}) {
  const headers = { 'Content-Type': 'application/json', ...(opt.headers || {}) };
  if (S.token) headers.Authorization = `Bearer ${S.token}`;

  const res = await fetch('/api' + path, { ...opt, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || data.message || `Request failed (${res.status})`);
  }
  return data;
}

function toast(msg, isError = false) {
  const el = $('appToast');
  el.textContent = msg;
  el.style.background = isError ? '#e11d48' : '#0f172a';
  el.classList.remove('hide');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => el.classList.add('hide'), 3600);
}

// ================= AUTHENTICATION LOGIC =================

function setAuthMode(mode) {
  S.authMode = mode;
  const isReg = mode === 'register';

  $('authHeading').textContent = isReg ? 'Create your account' : 'Welcome back';
  $('authSubheading').textContent = isReg
    ? 'Join DoseTrack with your unique email address.'
    : 'Sign in to your personalized care workspace.';
  $('authSubmitBtn').textContent = isReg ? 'Create Account & Continue →' : 'Sign In to Workspace →';
  $('switchPrompt').textContent = isReg ? 'Already have an account?' : "Don't have an account yet?";
  $('btnToggleAuthMode').textContent = isReg ? 'Sign In' : 'Create Account';

  $('roleSelectWrap').classList.toggle('hide', !isReg);
  $('nameWrap').classList.toggle('hide', !isReg);
  $('phoneWrap').classList.toggle('hide', !isReg);
  $('pwdHint').classList.toggle('hide', !isReg);
  $('authName').required = isReg;
  $('authError').classList.add('hide');

  updateRegistrationRoleFields();
}

function updateRegistrationRoleFields() {
  if (S.authMode !== 'register') {
    $('linkPatientWrap').classList.add('hide');
    $('relationshipWrap').classList.add('hide');
    $('emergencyContactWrap').classList.add('hide');
    return;
  }

  const isPatient = S.registerRole === 'patient';
  $('emergencyContactWrap').classList.toggle('hide', !isPatient);
  $('linkPatientWrap').classList.toggle('hide', isPatient);
  $('relationshipWrap').classList.toggle('hide', isPatient);
}

// Role Tabs Selector in Register
document.querySelectorAll('.role-tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.role-tab').forEach((t) => t.classList.remove('selected'));
    tab.classList.add('selected');
    const input = tab.querySelector('input');
    if (input) {
      input.checked = true;
      S.registerRole = input.value;
      updateRegistrationRoleFields();
    }
  });
});

$('btnToggleAuthMode').addEventListener('click', () => {
  setAuthMode(S.authMode === 'login' ? 'register' : 'login');
});

// Quick 1-Click Demo Logins
$('btnDemoPatient').addEventListener('click', () => quickLogin('patient@dosetrack.com', 'password123'));
$('btnDemoGuardian').addEventListener('click', () => quickLogin('guardian@dosetrack.com', 'password123'));
$('btnDemoCaretaker').addEventListener('click', () => quickLogin('caretaker@dosetrack.com', 'password123'));

async function quickLogin(email, password) {
  $('authEmail').value = email;
  $('authPassword').value = password;
  await performLogin(email, password);
}

$('authForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('authError').classList.add('hide');

  const email = $('authEmail').value.trim();
  const password = $('authPassword').value;

  if (S.authMode === 'login') {
    await performLogin(email, password);
  } else {
    // Register
    const fullName = $('authName').value.trim();
    const phone = $('authPhone').value.trim();
    const emergencyContact = $('authEmergency').value.trim();
    const patientCodeToLink = $('authLinkPatientCode').value.trim();
    const relationship = $('authRelationship').value.trim();

    try {
      const res = await api('/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          fullName,
          email,
          phone,
          password,
          role: S.registerRole,
          emergencyContact,
          patientCodeToLink,
          relationship
        })
      });

      S.token = res.token;
      S.user = res.user;
      localStorage.setItem('dosetrack_token', S.token);
      toast(`Account created! Welcome, ${res.user.fullName}.`);
      await enterApp();
    } catch (err) {
      $('authError').textContent = err.message;
      $('authError').classList.remove('hide');
    }
  }
});

async function performLogin(email, password) {
  try {
    const res = await api('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });

    S.token = res.token;
    S.user = res.user;
    localStorage.setItem('dosetrack_token', S.token);
    await enterApp();
  } catch (err) {
    $('authError').textContent = err.message;
    $('authError').classList.remove('hide');
  }
}

$('btnResetDemoData').addEventListener('click', async () => {
  if (!confirm('Reset the demo database to factory sample data?')) return;
  try {
    await api('/seed-demo', { method: 'POST' });
    toast('Demo data reset successfully.');
  } catch (e) {
    toast(e.message, true);
  }
});

function signOut() {
  S.token = null;
  S.user = null;
  S.activePatientId = null;
  S.activePatient = null;
  localStorage.removeItem('dosetrack_token');
  clearInterval(S.pollTimer);
  $('appView').classList.add('hide');
  $('authView').classList.remove('hide');
  setAuthMode('login');
}

$('btnLogout').addEventListener('click', signOut);

// ================= APP INITIALIZATION & ROLES =================

async function enterApp() {
  try {
    const profile = await api('/auth/me');
    S.user = profile.user;

    $('authView').classList.add('hide');
    $('appView').classList.remove('hide');

    applyUserRoleLayout();
    await loadInitialCareContext();
    await navigateTo('dashboard');
    startAlertsPolling();
  } catch (err) {
    console.error('Session validation error:', err);
    signOut();
  }
}

function applyUserRoleLayout() {
  const role = S.user.role || 'patient';
  const roleLabels = {
    patient: 'PATIENT',
    guardian: 'GUARDIAN',
    caretaker: 'CARETAKER / NURSE'
  };

  // Header and Sidebar role tags
  $('sidebarRolePill').textContent = roleLabels[role] || 'USER';
  $('sidebarRolePill').className = `role-badge role-${role}`;
  $('userFullName').textContent = S.user.fullName;
  $('userAvatar').textContent = S.user.fullName.charAt(0).toUpperCase();
  if (S.user.avatarColor) $('userAvatar').style.background = S.user.avatarColor;

  if (role === 'patient') {
    $('userRoleSub').textContent = `Patient · ${S.user.patientCode || 'DT-PT'}`;
    $('patientBanner').classList.remove('hide');
    $('guardianBanner').classList.add('hide');
    $('caretakerBanner').classList.add('hide');
    $('patientCodePanel').classList.remove('hide');
    $('displayPatientCode').textContent = S.user.patientCode || 'DT-PT-1001';
    $('navRounds').classList.add('hide');
    $('navCareTeamText').textContent = 'My Care Circle';
    $('roleTipText').textContent = 'Take your medications on schedule and mark them here so your family stays reassured.';
  } else if (role === 'guardian') {
    $('userRoleSub').textContent = 'Family Guardian';
    $('patientBanner').classList.add('hide');
    $('guardianBanner').classList.remove('hide');
    $('caretakerBanner').classList.add('hide');
    $('patientCodePanel').classList.add('hide');
    $('navRounds').classList.add('hide');
    $('navCareTeamText').textContent = 'Assigned Patients';
    $('roleTipText').textContent = 'You receive real-time notifications whenever doses are taken or missed.';
  } else if (role === 'caretaker') {
    $('userRoleSub').textContent = 'Caregiver / Nurse';
    $('patientBanner').classList.add('hide');
    $('guardianBanner').classList.add('hide');
    $('caretakerBanner').classList.remove('hide');
    $('patientCodePanel').classList.add('hide');
    $('navRounds').classList.remove('hide');
    $('navCareTeamText').textContent = 'Assigned Patients';
    $('roleTipText').textContent = 'Use the Medication Rounds tab to sign off on administration across your patient roster.';
  }

  // Today's formatted date in header
  const now = new Date();
  $('headerDateLabel').textContent = new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric'
  }).format(now).toUpperCase();
}

async function loadInitialCareContext() {
  if (S.user.role === 'patient') {
    S.activePatientId = S.user.id;
    S.activePatient = S.user;
    $('activePatientBanner').classList.add('hide');
  } else {
    // Guardian / Caretaker: fetch connected patients
    const teamData = await api('/care-team');
    S.connectedPatients = teamData.patients || [];

    if (S.connectedPatients.length > 0) {
      if (!S.activePatientId || !S.connectedPatients.some((p) => p.patient_id === S.activePatientId)) {
        S.activePatientId = S.connectedPatients[0].patient_id;
        S.activePatient = S.connectedPatients[0];
      }
      updateActivePatientBanner();
    } else {
      S.activePatientId = null;
      S.activePatient = null;
      $('activePatientBanner').classList.remove('hide');
      $('activePtName').textContent = 'No Connected Patient';
      $('activePtCode').textContent = 'Link required';
      toast('Please connect to a patient using their Patient Code.', false);
    }
  }
}

function updateActivePatientBanner() {
  if (S.user.role === 'patient') return;

  $('activePatientBanner').classList.remove('hide');
  const pt = S.activePatient;
  if (pt) {
    $('activePtName').textContent = pt.full_name;
    $('activePtCode').textContent = pt.patient_code || 'CODE';
    $('activePtAvatar').textContent = pt.full_name.charAt(0).toUpperCase();
    if (pt.avatar_color) $('activePtAvatar').style.background = pt.avatar_color;

    // Update Banner title if in Guardian view
    if (S.user.role === 'guardian') {
      const h3 = $('guardianBanner').querySelector('h3');
      if (h3) h3.textContent = `Monitoring ${pt.full_name}`;
    }
  }
}

// Switch Patient Dialog
$('btnSwitchPatient').addEventListener('click', () => {
  renderPatientSelectionModal();
  $('switchPatientDialog').classList.remove('hide');
});

function renderPatientSelectionModal() {
  const container = $('patientSelectionList');
  if (!S.connectedPatients.length) {
    container.innerHTML = '<p class="empty-notif">No patients connected yet.</p>';
    return;
  }

  container.innerHTML = S.connectedPatients.map((p) => `
    <div class="patient-select-item ${p.patient_id === S.activePatientId ? 'selected' : ''}" data-ptid="${p.patient_id}">
      <div class="patient-card-inner">
        <span class="avatar-sm" style="background:${esc(p.avatar_color || '#0d9488')}">${esc(p.full_name.charAt(0).toUpperCase())}</span>
        <div>
          <strong>${esc(p.full_name)}</strong>
          <small style="color:#64748b;display:block;">Code: ${esc(p.patient_code)} · ${p.adherenceRate}% adherence</small>
        </div>
      </div>
      <span class="chip-badge chip-green">${esc(p.relationship || 'Connected')}</span>
    </div>
  `).join('');

  container.querySelectorAll('.patient-select-item').forEach((item) => {
    item.onclick = async () => {
      const ptId = Number(item.dataset.ptid);
      S.activePatientId = ptId;
      S.activePatient = S.connectedPatients.find((p) => p.patient_id === ptId);
      updateActivePatientBanner();
      $('switchPatientDialog').classList.add('hide');
      await navigateTo(S.currentPage);
      toast(`Switched active view to ${S.activePatient.full_name}.`);
    };
  });
}

$('btnLinkAnotherPatient').addEventListener('click', () => {
  $('switchPatientDialog').classList.add('hide');
  openLinkMemberDialog();
});

// ================= PAGE NAVIGATION =================

async function navigateTo(page) {
  S.currentPage = page;
  document.querySelectorAll('.content-page').forEach((el) => el.classList.add('hide'));
  document.querySelectorAll('.nav-btn').forEach((b) => b.classList.toggle('active', b.dataset.page === page));

  const pageMap = {
    dashboard: 'pageDashboard',
    medications: 'pageMedications',
    rounds: 'pageRounds',
    vitals: 'pageVitals',
    history: 'pageHistory',
    careteam: 'pageCareteam',
    doctors: 'pageDoctors'
  };

  const pageEl = $(pageMap[page]);
  if (pageEl) pageEl.classList.remove('hide');

  const titles = {
    dashboard: 'Your Daily Overview',
    medications: 'Medication Cabinet',
    rounds: 'Medication Administration Rounds',
    vitals: 'Care Notes & Health Vitals',
    history: '30-Day Adherence History',
    careteam: S.user?.role === 'patient' ? 'My Care Circle' : 'Assigned Patients',
    doctors: 'Physician & Clinic Contacts'
  };

  $('headerTitle').textContent = titles[page] || 'Overview';

  try {
    if (page === 'dashboard') await loadDashboard();
    if (page === 'medications') await loadMedications();
    if (page === 'rounds') await loadRounds();
    if (page === 'vitals') await loadCareNotes();
    if (page === 'history') await loadHistory();
    if (page === 'careteam') await loadCareTeam();
    if (page === 'doctors') await loadDoctors();
  } catch (err) {
    toast(err.message, true);
  }
}

document.querySelectorAll('.sidebar-nav .nav-btn').forEach((btn) => {
  btn.addEventListener('click', () => navigateTo(btn.dataset.page));
});

// ================= PAGE 1: DASHBOARD / OVERVIEW =================

async function loadDashboard() {
  const patientParam = S.activePatientId ? `?patientId=${S.activePatientId}` : '';
  const [summaryData, dosesData] = await Promise.all([
    api(`/dashboard/summary${patientParam}`),
    api(`/doses/today${patientParam}`)
  ]);

  // Update Top Stats
  $('statActiveMeds').textContent = summaryData.activeMedications || 0;
  $('statTodayStatus').textContent = `${summaryData.today?.taken || 0} / ${summaryData.today?.scheduled || 0}`;
  $('statTodaySub').textContent = `${summaryData.today?.taken || 0} taken · ${summaryData.today?.missed || 0} missed`;
  $('statAdherenceRate').textContent = `${summaryData.adherence || 100}%`;
  $('statCareCircle').textContent = `${summaryData.careTeamCount || 0} Member(s)`;

  // Greeting
  if (S.user.role === 'patient') {
    $('bannerGreeting').textContent = `Good day, ${S.user.fullName}!`;
  }

  // Vitals Snapshot
  const v = summaryData.latestVitals?.vitals;
  if (v) {
    $('vitalBP').textContent = v.blood_pressure || '--/--';
    $('vitalHR').textContent = v.heart_rate || '--';
    $('vitalGlucose').textContent = v.blood_glucose || '--';
    $('vitalO2').textContent = v.oxygen_saturation || '--';
    $('vitalsAuthorMeta').textContent = `Recorded by ${summaryData.latestVitals.author_name} (${summaryData.latestVitals.author_role})`;
  } else {
    $('vitalBP').textContent = '--/--';
    $('vitalHR').textContent = '--';
    $('vitalGlucose').textContent = '--';
    $('vitalO2').textContent = '--';
    $('vitalsAuthorMeta').textContent = 'No vitals recorded yet today.';
  }

  // Latest Note
  if (summaryData.latestNote) {
    $('latestNoteContent').textContent = `"${summaryData.latestNote.content}"`;
    $('latestNoteMeta').textContent = `— ${summaryData.latestNote.author_name} (${summaryData.latestNote.author_role})`;
  } else {
    $('latestNoteContent').textContent = '"Care team synchronized. All systems running normally."';
    $('latestNoteMeta').textContent = '— DoseTrack System';
  }

  // Render Today's Doses
  S.todayDoses = dosesData.doses || [];
  renderTodayDoses(S.todayDoses);
}

function renderTodayDoses(doses) {
  const container = $('todayDosesList');
  if (!doses.length) {
    container.innerHTML = `
      <div class="empty-notif" style="padding: 40px 20px;">
        <span style="font-size:32px;display:block;margin-bottom:8px;">💊</span>
        <strong>No doses scheduled for today.</strong>
        <p style="font-size:12px;color:#94a3b8;margin-top:4px;">Add a medication to create automated reminders.</p>
      </div>`;
    return;
  }

  container.innerHTML = doses.map((d) => {
    const isTaken = d.status === 'taken';
    const isMissed = d.status === 'missed';
    const statusClass = isTaken ? 'taken' : isMissed ? 'missed' : '';
    const timeFormatted = String(d.dose_time).slice(0, 5);

    let statusDisplay = '';
    if (isTaken) {
      statusDisplay = `
        <span class="status-pill taken">✓ Taken</span>
        ${d.recorded_by_name ? `<small style="display:block;font-size:9px;color:#059669;margin-top:2px;">by ${esc(d.recorded_by_name)}</small>` : ''}
      `;
    } else if (isMissed) {
      statusDisplay = `<span class="status-pill missed">⚠️ Missed</span>`;
    } else {
      statusDisplay = `
        <div class="dose-action-buttons">
          <button class="btn-dose-take" data-action="taken" data-id="${d.schedule_id}" data-time="${esc(d.scheduled_for)}">
            ✓ Take Dose
          </button>
          <button class="btn-dose-miss" data-action="missed" data-id="${d.schedule_id}" data-time="${esc(d.scheduled_for)}">
            Skip
          </button>
        </div>
      `;
    }

    return `
      <div class="dose-card-item ${statusClass}">
        <div class="dose-time-badge">
          <time>${timeFormatted}</time>
          <small>Dose</small>
        </div>
        <div class="dose-info">
          <h4>${esc(d.name)}</h4>
          <span class="dose-meta">${esc(d.dosage)} ${d.quantity ? '· ' + esc(d.quantity) : ''}</span>
          ${d.instructions ? `<div class="dose-instructions"><span>ℹ</span> ${esc(d.instructions)}</div>` : ''}
        </div>
        <div>
          ${statusDisplay}
        </div>
      </div>
    `;
  }).join('');

  // Attach status buttons click
  container.querySelectorAll('[data-action]').forEach((btn) => {
    btn.onclick = async () => {
      const scheduleId = btn.dataset.id;
      const status = btn.dataset.action;
      const scheduledFor = btn.dataset.time;

      try {
        const res = await api(`/doses/${scheduleId}/status`, {
          method: 'POST',
          body: JSON.stringify({ status, scheduledFor })
        });
        toast(res.message);
        await loadDashboard();
        fetchAlerts();
      } catch (err) {
        toast(err.message, true);
      }
    };
  });
}

// Copy Patient Code
$('btnCopyCode').addEventListener('click', () => {
  const code = $('displayPatientCode').textContent;
  navigator.clipboard.writeText(code).then(() => {
    toast(`Patient Code ${code} copied to clipboard!`);
  });
});

// Patient Emergency SOS Alert
$('btnTriggerSOS').addEventListener('click', async () => {
  if (!confirm('🚨 Send an IMMEDIATE Emergency SOS to all your connected Guardians and Caretakers?')) return;
  try {
    const res = await api('/alerts/sos', {
      method: 'POST',
      body: JSON.stringify({ message: 'Patient Eleanor Vance has activated the DoseTrack Emergency SOS button. Immediate check-in required!' })
    });
    toast(res.message);
    fetchAlerts();
  } catch (err) {
    toast(err.message, true);
  }
});

// Guardian / Caretaker quick actions
$('btnSendNudge').addEventListener('click', () => {
  $('inputNudgeMessage').value = '';
  $('nudgeDialog').classList.remove('hide');
});

$('btnQuickLogVitals').addEventListener('click', () => {
  $('vitalsForm').reset();
  $('vitalsDialog').classList.remove('hide');
});

$('btnOpenVitalsDialog').addEventListener('click', () => {
  $('vitalsForm').reset();
  $('vitalsDialog').classList.remove('hide');
});

$('btnAddMedForPatient').addEventListener('click', () => openMedicationModal());
$('btnViewAllRounds').addEventListener('click', () => navigateTo('rounds'));

// ================= PAGE 2: MEDICATIONS =================

async function loadMedications() {
  const patientParam = S.activePatientId ? `?patientId=${S.activePatientId}` : '';
  const data = await api(`/medications${patientParam}`);
  S.medications = data.medications || [];

  const container = $('medicationCardsGrid');
  if (!S.medications.length) {
    container.innerHTML = `
      <div class="panel-box empty-notif" style="grid-column: 1 / -1; padding: 48px;">
        <span style="font-size:36px;display:block;margin-bottom:8px;">💊</span>
        <strong>Your medication cabinet is empty.</strong>
        <p style="font-size:13px;color:#94a3b8;margin-top:6px;">Add prescription details to automate your dose schedule.</p>
      </div>`;
    return;
  }

  container.innerHTML = S.medications.map((m) => `
    <article class="med-card">
      <div>
        <div class="med-card-top">
          <div>
            <h4>${esc(m.name)}</h4>
            <span class="med-badge">${esc(m.dosage)} ${m.quantity ? '· ' + esc(m.quantity) : ''}</span>
          </div>
          <span class="chip-badge chip-green">Active</span>
        </div>

        <div class="med-details-list">
          <div class="med-detail-item">
            <small>Frequency</small>
            <strong>${esc(m.frequency)}</strong>
          </div>
          <div class="med-detail-item">
            <small>Dates</small>
            <strong>${esc(String(m.start_date).slice(0, 10))} ${m.end_date ? 'to ' + esc(String(m.end_date).slice(0, 10)) : '(Ongoing)'}</strong>
          </div>
          ${m.instructions ? `
          <div class="med-detail-item" style="grid-column: 1 / -1;">
            <small>Instructions</small>
            <strong>${esc(m.instructions)}</strong>
          </div>` : ''}
        </div>

        <div class="time-tags-row">
          ${(m.dose_times || []).map((t) => `<span class="time-tag">◷ ${esc(String(t).slice(0, 5))}</span>`).join('')}
        </div>
      </div>

      <div class="card-actions-row">
        <button class="btn btn-secondary" data-mededit="${m.id}">Edit</button>
        <button class="btn btn-secondary" style="color:#e11d48;" data-meddel="${m.id}">Delete</button>
      </div>
    </article>
  `).join('');

  container.querySelectorAll('[data-mededit]').forEach((b) => {
    b.onclick = () => {
      const med = S.medications.find((m) => String(m.id) === b.dataset.mededit);
      if (med) openMedicationModal(med);
    };
  });

  container.querySelectorAll('[data-meddel]').forEach((b) => {
    b.onclick = async () => {
      if (!confirm('Are you sure you want to delete this medication and its schedules?')) return;
      try {
        await api(`/medications/${b.dataset.meddel}`, { method: 'DELETE' });
        toast('Medication deleted.');
        loadMedications();
      } catch (err) {
        toast(err.message, true);
      }
    };
  });
}

$('btnAddMedication').addEventListener('click', () => openMedicationModal());

function openMedicationModal(med = null) {
  $('medicationForm').reset();
  $('medFormError').classList.add('hide');
  $('formMedId').value = med ? med.id : '';
  $('medModalTitle').textContent = med ? 'Edit Medication' : 'Add Medication';

  // Reset prescription scanner states
  resetPrescriptionScannerState();

  // If editing an existing medication, hide AI scanner banner to keep edit clean
  const scanWrap = document.querySelector('.ai-scan-wrapper');
  if (scanWrap) scanWrap.classList.toggle('hide', !!med);

  $('formMedName').value = med?.name || '';
  $('formMedDosage').value = med?.dosage || '';
  $('formMedQuantity').value = med?.quantity || '';
  $('formMedFreq').value = med?.frequency || 'Once daily';
  $('formMedStart').value = med?.start_date ? String(med.start_date).slice(0, 10) : new Date().toISOString().slice(0, 10);
  $('formMedEnd').value = med?.end_date ? String(med.end_date).slice(0, 10) : '';
  $('formMedInstructions').value = med?.instructions || '';

  const wrap = $('doseTimeInputsWrap');
  wrap.innerHTML = '';
  const times = med?.dose_times && med.dose_times.length ? med.dose_times : ['08:00'];
  times.forEach((t) => addDoseTimeInput(String(t).slice(0, 5)));

  $('medicationDialog').classList.remove('hide');
}

// ================= AI PRESCRIPTION SCANNER CONTROLLER =================

function resetPrescriptionScannerState() {
  $('scanLoadingBox').classList.add('hide');
  $('multiMedSelectorBox').classList.add('hide');
  $('aiConfidenceNotice').classList.add('hide');
  $('prescriptionFileInput').value = '';

  // Reset preview
  $('scanPreviewThumbnail').src = '';
  $('scanPreviewThumbnail').classList.add('hide');
  $('scanPreviewIcon').classList.remove('hide');

  // Reset field highlightings and badges
  ['formMedName', 'formMedDosage', 'formMedFreq', 'formMedInstructions'].forEach((id) => {
    const el = $(id);
    if (el) el.classList.remove('field-review-needed');
  });

  ['badgeMedName', 'badgeMedDosage', 'badgeMedFreq', 'badgeMedTimes', 'badgeMedInstructions'].forEach((id) => {
    const b = $(id);
    if (b) {
      b.textContent = '';
      b.className = 'confidence-field-pill hide';
    }
  });
}

function initPrescriptionScanner() {
  const fileInput = $('prescriptionFileInput');
  if (fileInput) {
    fileInput.addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;

      if (!file.type.startsWith('image/')) {
        toast('Please upload an image file (JPEG, PNG, WEBP).', true);
        return;
      }

      // Read as base64
      const reader = new FileReader();
      reader.onload = async (evt) => {
        const base64Data = evt.target.result;
        // Show thumbnail
        $('scanPreviewThumbnail').src = base64Data;
        $('scanPreviewThumbnail').classList.remove('hide');
        $('scanPreviewIcon').classList.add('hide');

        await processPrescriptionScan({
          imageBase64: base64Data,
          mimeType: file.type
        });
      };
      reader.readAsDataURL(file);
    });
  }

  // Quick 1-Click Sample Prescriptions
  document.querySelectorAll('.sample-rx-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const sampleId = btn.dataset.sample;
      $('scanPreviewThumbnail').classList.add('hide');
      $('scanPreviewIcon').classList.remove('hide');

      await processPrescriptionScan({ sampleId });
    });
  });

  // Clear AI extraction button
  $('btnClearAiScan').addEventListener('click', () => {
    resetPrescriptionScannerState();
    $('formMedName').value = '';
    $('formMedDosage').value = '';
    $('formMedQuantity').value = '';
    $('formMedInstructions').value = '';
    toast('Prescription auto-fill cleared.');
  });
}

async function processPrescriptionScan({ imageBase64, mimeType, sampleId }) {
  resetPrescriptionScannerState();
  $('scanLoadingBox').classList.remove('hide');

  const titles = [
    'Scanning Prescription Image...',
    'Analyzing Doctor Handwriting & Sig Codes...',
    'Extracting Medications, Strengths & Schedules...'
  ];
  let step = 0;
  const progressTimer = setInterval(() => {
    step = (step + 1) % titles.length;
    $('scanProgressTitle').textContent = titles[step];
  }, 500);

  try {
    const res = await api('/medications/scan-prescription', {
      method: 'POST',
      body: JSON.stringify({ imageBase64, mimeType, sampleId })
    });

    clearInterval(progressTimer);
    $('scanLoadingBox').classList.add('hide');

    const medications = res.medications || [];
    if (!medications.length) {
      toast('No prescription medications detected in image.', true);
      return;
    }

    if (medications.length > 1) {
      // Multiple medications detected
      renderMultiMedicationSelector(medications);
      populateFormFromAiMedication(medications[0]);
    } else {
      // Single medication
      populateFormFromAiMedication(medications[0]);
    }

    toast(`Prescription scanned! ${medications.length} medication(s) extracted.`);
  } catch (err) {
    clearInterval(progressTimer);
    $('scanLoadingBox').classList.add('hide');
    toast(err.message, true);
  }
}

function renderMultiMedicationSelector(medications) {
  const box = $('multiMedSelectorBox');
  const list = $('multiMedCardsList');
  $('multiMedCountBadge').textContent = `${medications.length} found`;

  list.innerHTML = medications.map((m, idx) => `
    <div class="multi-med-item-card ${idx === 0 ? 'selected' : ''}" data-idx="${idx}">
      <div>
        <strong>${esc(m.medicine_name)}</strong>
        <span>${esc(m.dosage)} · ${esc(m.frequency)}</span>
      </div>
      <small>Confidence: ${Math.round((m.confidence_score || 0.85) * 100)}%</small>
    </div>
  `).join('');

  box.classList.remove('hide');

  list.querySelectorAll('.multi-med-item-card').forEach((card) => {
    card.onclick = () => {
      list.querySelectorAll('.multi-med-item-card').forEach((c) => c.classList.remove('selected'));
      card.classList.add('selected');
      const idx = Number(card.dataset.idx);
      populateFormFromAiMedication(medications[idx]);
    };
  });
}

function populateFormFromAiMedication(med) {
  const conf = typeof med.confidence_score === 'number' ? med.confidence_score : 0.85;
  const isLowConf = conf < 0.75;
  const confPercent = Math.round(conf * 100);

  // Set field values
  $('formMedName').value = med.medicine_name || '';
  $('formMedDosage').value = med.dosage || '';
  $('formMedInstructions').value = med.instructions || '';

  // Auto-set duration / dates
  $('formMedStart').value = new Date().toISOString().slice(0, 10);
  if (med.duration_days) {
    const end = new Date();
    end.setDate(end.getDate() + Number(med.duration_days));
    $('formMedEnd').value = end.toISOString().slice(0, 10);
  } else {
    $('formMedEnd').value = '';
  }

  // Auto-select frequency
  const freqSelect = $('formMedFreq');
  const rawFreq = (med.frequency || '').toLowerCase();
  let matchedFreq = 'Once daily';
  if (rawFreq.includes('twice') || rawFreq.includes('2x') || rawFreq.includes('bid')) matchedFreq = 'Twice daily';
  else if (rawFreq.includes('three') || rawFreq.includes('3x') || rawFreq.includes('tid')) matchedFreq = 'Three times daily';
  else if (rawFreq.includes('four') || rawFreq.includes('4x') || rawFreq.includes('qid')) matchedFreq = 'Four times daily';
  else if (rawFreq.includes('needed') || rawFreq.includes('prn')) matchedFreq = 'As needed / PRN';
  freqSelect.value = matchedFreq;

  // Set dose times
  const wrap = $('doseTimeInputsWrap');
  wrap.innerHTML = '';
  const slots = Array.isArray(med.time_slots) && med.time_slots.length ? med.time_slots : ['08:00 AM'];
  slots.forEach((s) => {
    const time24 = convertTo24Hour(s);
    addDoseTimeInput(time24);
  });

  // Confidence Banner Display
  const notice = $('aiConfidenceNotice');
  notice.classList.remove('hide');
  notice.classList.toggle('low-confidence', isLowConf);

  if (isLowConf) {
    $('aiConfidenceIcon').textContent = '⚠️';
    $('aiConfidenceTitle').textContent = `Handwritten Prescription (Confidence: ${confPercent}%)`;
    $('aiConfidenceText').textContent = 'Doctor handwriting was moderately legible. Highlighted fields require your verification.';
  } else {
    $('aiConfidenceIcon').textContent = '✓';
    $('aiConfidenceTitle').textContent = `AI Extracted from Prescription (Confidence: ${confPercent}%)`;
    $('aiConfidenceText').textContent = 'High confidence extraction. Review the values below and confirm before saving.';
  }

  // Highlight fields if low confidence
  ['formMedName', 'formMedDosage', 'formMedFreq', 'formMedInstructions'].forEach((id) => {
    const el = $(id);
    if (el) el.classList.toggle('field-review-needed', isLowConf);
  });

  // Update field pill badges
  const pillClass = isLowConf ? 'confidence-field-pill pill-low' : 'confidence-field-pill pill-high';
  const pillText = isLowConf ? `⚠️ Verify (${confPercent}%)` : `✓ AI Extracted (${confPercent}%)`;

  ['badgeMedName', 'badgeMedDosage', 'badgeMedFreq', 'badgeMedTimes', 'badgeMedInstructions'].forEach((id) => {
    const badge = $(id);
    if (badge) {
      badge.textContent = pillText;
      badge.className = pillClass;
    }
  });
}

function convertTo24Hour(timeStr) {
  if (!timeStr) return '08:00';
  const str = String(timeStr).trim();
  // If already "08:00"
  if (/^\d{2}:\d{2}$/.test(str)) return str;

  const match = str.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!match) return '08:00';

  let hours = parseInt(match[1], 10);
  const minutes = match[2];
  const modifier = match[3] ? match[3].toUpperCase() : null;

  if (modifier === 'PM' && hours < 12) hours += 12;
  if (modifier === 'AM' && hours === 12) hours = 0;

  return `${String(hours).padStart(2, '0')}:${minutes}`;
}

initPrescriptionScanner();

function addDoseTimeInput(val = '08:00') {
  const wrap = $('doseTimeInputsWrap');
  const input = document.createElement('input');
  input.type = 'time';
  input.className = 'dose-time-input';
  input.required = true;
  input.value = val;
  wrap.appendChild(input);
}

$('btnAddTimeInput').addEventListener('click', () => addDoseTimeInput('12:00'));

$('medicationForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('medFormError').classList.add('hide');

  const times = [...document.querySelectorAll('.dose-time-input')].map((i) => i.value).filter(Boolean);
  if (!times.length) {
    $('medFormError').textContent = 'Please specify at least one dose time.';
    $('medFormError').classList.remove('hide');
    return;
  }

  const id = $('formMedId').value;
  const body = {
    patientId: S.activePatientId,
    name: $('formMedName').value.trim(),
    dosage: $('formMedDosage').value.trim(),
    quantity: $('formMedQuantity').value.trim(),
    frequency: $('formMedFreq').value,
    startDate: $('formMedStart').value,
    endDate: $('formMedEnd').value || null,
    instructions: $('formMedInstructions').value.trim(),
    doseTimes: times
  };

  try {
    const res = await api(`/medications${id ? '/' + id : ''}`, {
      method: id ? 'PUT' : 'POST',
      body: JSON.stringify(body)
    });

    $('medicationDialog').classList.add('hide');
    toast(res.message);
    if (S.currentPage === 'medications') await loadMedications();
    if (S.currentPage === 'dashboard') await loadDashboard();
  } catch (err) {
    $('medFormError').textContent = err.message;
    $('medFormError').classList.remove('hide');
  }
});

// ================= PAGE 3: CARETAKER ROUNDS =================

async function loadRounds() {
  const data = await api('/doses/rounds');
  const rounds = data.rounds || [];
  const container = $('roundsContainer');

  if (!rounds.length) {
    container.innerHTML = '<div class="empty-notif" style="padding:40px;">No scheduled rounds found for your assigned patients today.</div>';
    return;
  }

  container.innerHTML = rounds.map((r) => {
    const isTaken = r.status === 'taken';
    const isMissed = r.status === 'missed';
    const statusClass = isTaken ? 'taken' : isMissed ? 'missed' : '';

    return `
      <div class="dose-card-item ${statusClass}" style="margin-bottom:10px;">
        <div class="dose-time-badge">
          <time>${esc(r.dose_time)}</time>
          <small>Round</small>
        </div>
        <div class="dose-info">
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:2px;">
            <span class="avatar-sm" style="width:20px;height:20px;font-size:10px;background:${esc(r.patient_avatar || '#0284c7')}">${esc(r.patient_name.charAt(0))}</span>
            <strong>${esc(r.patient_name)}</strong>
          </div>
          <h4>${esc(r.name)} <small style="font-weight:normal;color:#64748b;">(${esc(r.dosage)})</small></h4>
          ${r.instructions ? `<div class="dose-instructions"><span>ℹ</span> ${esc(r.instructions)}</div>` : ''}
        </div>
        <div>
          ${isTaken
            ? `<span class="status-pill taken">✓ Administered</span>`
            : isMissed
            ? `<span class="status-pill missed">⚠️ Missed</span>`
            : `<button class="btn btn-primary" data-administer="${r.schedule_id}" data-time="${esc(r.scheduled_for)}">Administer & Sign Off</button>`}
        </div>
      </div>
    `;
  }).join('');

  container.querySelectorAll('[data-administer]').forEach((btn) => {
    btn.onclick = async () => {
      try {
        const res = await api(`/doses/${btn.dataset.administer}/status`, {
          method: 'POST',
          body: JSON.stringify({ status: 'taken', scheduledFor: btn.dataset.time })
        });
        toast(res.message);
        loadRounds();
      } catch (e) {
        toast(e.message, true);
      }
    };
  });
}

$('btnRefreshRounds').addEventListener('click', loadRounds);

// ================= PAGE 4: CARE NOTES & VITALS =================

async function loadCareNotes() {
  const patientParam = S.activePatientId ? `?patientId=${S.activePatientId}` : '';
  const data = await api(`/care-notes${patientParam}`);
  const notes = data.notes || [];
  const container = $('careNotesList');

  if (!notes.length) {
    container.innerHTML = `
      <div class="panel-box empty-notif" style="padding:48px;">
        <span style="font-size:32px;display:block;margin-bottom:8px;">📝</span>
        <strong>No clinical observations recorded yet.</strong>
        <p style="font-size:13px;color:#94a3b8;margin-top:4px;">Use the button above to log vitals, nursing notes, or patient wellness checks.</p>
      </div>`;
    return;
  }

  container.innerHTML = notes.map((n) => {
    const v = n.vitals;
    const dateFormatted = new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(n.created_at));

    return `
      <article class="care-note-card">
        <div class="note-head">
          <div class="note-author-info">
            <span class="avatar-sm" style="background:${esc(n.author_avatar || '#6366f1')}">${esc(n.author_name.charAt(0))}</span>
            <div>
              <strong>${esc(n.author_name)}</strong>
              <small> · ${esc(n.author_role.toUpperCase())}</small>
            </div>
          </div>
          <span style="font-size:11px;color:#94a3b8;">${dateFormatted}</span>
        </div>

        <p class="note-body">${esc(n.content)}</p>

        ${v ? `
        <div class="vitals-inline-chips">
          ${v.blood_pressure ? `<span class="vital-chip">Blood Pressure: <b>${esc(v.blood_pressure)}</b></span>` : ''}
          ${v.heart_rate ? `<span class="vital-chip">Heart Rate: <b>${esc(v.heart_rate)} bpm</b></span>` : ''}
          ${v.blood_glucose ? `<span class="vital-chip">Blood Sugar: <b>${esc(v.blood_glucose)} mg/dL</b></span>` : ''}
          ${v.oxygen_saturation ? `<span class="vital-chip">SpO2: <b>${esc(v.oxygen_saturation)}%</b></span>` : ''}
        </div>` : ''}
      </article>
    `;
  }).join('');
}

$('btnLogNewNote').addEventListener('click', () => {
  $('vitalsForm').reset();
  $('vitalsFormError').classList.add('hide');
  $('vitalsDialog').classList.remove('hide');
});

$('vitalsTypeSelect').addEventListener('change', (e) => {
  const isVitals = e.target.value === 'vitals';
  $('vitalsInputsGroup').classList.toggle('hide', !isVitals);
});

$('vitalsForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('vitalsFormError').classList.add('hide');

  const noteType = $('vitalsTypeSelect').value;
  const content = $('inputNoteContent').value.trim();

  let vitals = null;
  if (noteType === 'vitals') {
    vitals = {
      blood_pressure: $('inputBP').value.trim() || null,
      heart_rate: $('inputHR').value.trim() || null,
      blood_glucose: $('inputGlucose').value.trim() || null,
      oxygen_saturation: $('inputO2').value.trim() || null
    };
  }

  try {
    const res = await api('/care-notes', {
      method: 'POST',
      body: JSON.stringify({
        patientId: S.activePatientId,
        noteType,
        content,
        vitals
      })
    });

    $('vitalsDialog').classList.add('hide');
    toast(res.message);
    if (S.currentPage === 'vitals') await loadCareNotes();
    if (S.currentPage === 'dashboard') await loadDashboard();
  } catch (err) {
    $('vitalsFormError').textContent = err.message;
    $('vitalsFormError').classList.remove('hide');
  }
});

// ================= PAGE 5: ADHERENCE HISTORY =================

async function loadHistory() {
  const patientParam = S.activePatientId ? `?patientId=${S.activePatientId}` : '';
  const data = await api(`/doses/history${patientParam}`);
  const history = data.history || [];
  const container = $('historyTableContainer');

  if (!history.length) {
    container.innerHTML = '<div class="empty-notif" style="padding:48px;">No dose history recorded yet. Mark doses as taken to build your record.</div>';
    return;
  }

  container.innerHTML = `
    <table class="data-table">
      <thead>
        <tr>
          <th>Medication</th>
          <th>Dosage</th>
          <th>Scheduled Time</th>
          <th>Status</th>
          <th>Recorded By</th>
        </tr>
      </thead>
      <tbody>
        ${history.map((h) => {
          const dateStr = new Intl.DateTimeFormat(undefined, {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          }).format(new Date(h.scheduled_for));

          return `
            <tr>
              <td><strong>${esc(h.name)}</strong></td>
              <td>${esc(h.dosage)}</td>
              <td>${dateStr}</td>
              <td>
                <span class="status-pill ${h.status === 'taken' ? 'taken' : 'missed'}">
                  ${h.status === 'taken' ? '✓ Taken' : '⚠️ Missed'}
                </span>
              </td>
              <td>
                <small style="color:#64748b;">${esc(h.recorded_by_name || 'Patient')} ${h.recorded_by_role ? '(' + esc(h.recorded_by_role) + ')' : ''}</small>
              </td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>
  `;
}

// ================= PAGE 6: CARE TEAM & PATIENTS =================

async function loadCareTeam() {
  const data = await api('/care-team');
  const container = $('careTeamGrid');

  if (S.user.role === 'patient') {
    $('careTeamTitle').textContent = 'My Care Circle';
    const team = data.careTeam || [];
    if (!team.length) {
      container.innerHTML = `
        <div class="panel-box empty-notif" style="grid-column:1 / -1;padding:48px;">
          <span style="font-size:32px;display:block;margin-bottom:8px;">👥</span>
          <strong>No guardians or caretakers linked yet.</strong>
          <p style="font-size:13px;color:#94a3b8;margin-top:4px;">Share your Patient Code (<b>${esc(S.user.patientCode)}</b>) so your family or nurse can link to you.</p>
        </div>`;
      return;
    }

    container.innerHTML = team.map((m) => `
      <article class="person-card">
        <div class="person-card-top">
          <div style="display:flex;align-items:center;gap:10px;">
            <span class="avatar-sm" style="background:${esc(m.avatar_color || '#6366f1')}">${esc(m.full_name.charAt(0))}</span>
            <div>
              <h4>${esc(m.full_name)}</h4>
              <span class="sub" style="font-size:11px;">${esc(m.relationship)}</span>
            </div>
          </div>
          <span class="person-role-tag role-${m.role}">${esc(m.role.toUpperCase())}</span>
        </div>

        <div class="person-contact-list">
          ${m.phone ? `<div>📞 <a href="tel:${esc(m.phone)}" style="color:inherit;">${esc(m.phone)}</a></div>` : ''}
          ${m.email ? `<div>✉️ <a href="mailto:${esc(m.email)}" style="color:inherit;">${esc(m.email)}</a></div>` : ''}
        </div>

        <div class="card-actions-row">
          <button class="btn btn-secondary" style="color:#e11d48;" data-unlink="${m.connection_id}">Disconnect</button>
        </div>
      </article>
    `).join('');
  } else {
    // Guardian / Caretaker: list of patients
    $('careTeamTitle').textContent = 'My Connected Patients';
    const patients = data.patients || [];
    if (!patients.length) {
      container.innerHTML = `
        <div class="panel-box empty-notif" style="grid-column:1 / -1;padding:48px;">
          <strong>You are not currently connected to any patients.</strong>
          <p style="font-size:13px;color:#94a3b8;margin-top:4px;">Click the button above to link using the patient's code.</p>
        </div>`;
      return;
    }

    container.innerHTML = patients.map((p) => `
      <article class="person-card">
        <div class="person-card-top">
          <div style="display:flex;align-items:center;gap:10px;">
            <span class="avatar-sm" style="background:${esc(p.avatar_color || '#0d9488')}">${esc(p.full_name.charAt(0))}</span>
            <div>
              <h4>${esc(p.full_name)}</h4>
              <span class="pt-code-chip">${esc(p.patient_code)}</span> · <small>${esc(p.relationship)}</small>
            </div>
          </div>
          <span class="chip-badge chip-green">${p.adherenceRate}% Adherence</span>
        </div>

        <div class="med-details-list" style="margin: 10px 0;">
          <div class="med-detail-item">
            <small>Active Medicines</small>
            <strong>${p.activeMeds}</strong>
          </div>
          <div class="med-detail-item">
            <small>Today's Doses</small>
            <strong>${p.todayTaken} / ${p.todayScheduled}</strong>
          </div>
          ${p.emergency_contact ? `
          <div class="med-detail-item" style="grid-column:1 / -1;">
            <small>Emergency Contact</small>
            <strong>${esc(p.emergency_contact)}</strong>
          </div>` : ''}
        </div>

        <div class="card-actions-row">
          <button class="btn btn-primary" data-viewpt="${p.patient_id}">Open Dashboard →</button>
          <button class="btn btn-secondary" style="color:#e11d48;" data-unlink="${p.connection_id}">Disconnect</button>
        </div>
      </article>
    `).join('');

    container.querySelectorAll('[data-viewpt]').forEach((b) => {
      b.onclick = async () => {
        const ptId = Number(b.dataset.viewpt);
        S.activePatientId = ptId;
        S.activePatient = S.connectedPatients.find((p) => p.patient_id === ptId);
        updateActivePatientBanner();
        await navigateTo('dashboard');
      };
    });
  }

  container.querySelectorAll('[data-unlink]').forEach((b) => {
    b.onclick = async () => {
      if (!confirm('Disconnect this care connection?')) return;
      try {
        await api(`/care-team/${b.dataset.unlink}`, { method: 'DELETE' });
        toast('Connection removed.');
        loadCareTeam();
      } catch (e) {
        toast(e.message, true);
      }
    };
  });
}

$('btnLinkNewMember').addEventListener('click', openLinkMemberDialog);

function openLinkMemberDialog() {
  $('linkMemberForm').reset();
  $('linkMemberError').classList.add('hide');
  $('linkMemberDialog').classList.remove('hide');
}

$('linkMemberForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('linkMemberError').classList.add('hide');

  const inputVal = $('inputPatientCodeOrEmail').value.trim();
  const relationship = $('inputMemberRelationship').value.trim();

  const isEmail = inputVal.includes('@');
  const body = {
    patientCode: isEmail ? null : inputVal,
    patientEmail: isEmail ? inputVal : null,
    relationship
  };

  try {
    const res = await api('/care-team/link', {
      method: 'POST',
      body: JSON.stringify(body)
    });

    $('linkMemberDialog').classList.add('hide');
    toast(res.message);
    await loadInitialCareContext();
    if (S.currentPage === 'careteam') await loadCareTeam();
  } catch (err) {
    $('linkMemberError').textContent = err.message;
    $('linkMemberError').classList.remove('hide');
  }
});

// ================= PAGE 7: DOCTORS & CLINIC =================

async function loadDoctors() {
  const patientParam = S.activePatientId ? `?patientId=${S.activePatientId}` : '';
  const data = await api(`/doctors${patientParam}`);
  const doctors = data.doctors || [];
  const container = $('doctorsListGrid');

  if (!doctors.length) {
    container.innerHTML = `
      <div class="panel-box empty-notif" style="grid-column:1 / -1;padding:48px;">
        <span style="font-size:32px;display:block;margin-bottom:8px;">🩺</span>
        <strong>No doctor contacts saved yet.</strong>
        <p style="font-size:13px;color:#94a3b8;margin-top:4px;">Add your primary physician or clinic details to keep contacts handy.</p>
      </div>`;
    return;
  }

  container.innerHTML = doctors.map((d) => `
    <article class="med-card">
      <div>
        <div class="med-card-top">
          <div>
            <h4>${esc(d.name)}</h4>
            <span class="med-badge">${esc(d.specialization || 'Healthcare Provider')}</span>
          </div>
        </div>

        <div class="person-contact-list">
          ${d.clinic_name ? `<div>🏥 <b>Clinic:</b> ${esc(d.clinic_name)}</div>` : ''}
          ${d.availability ? `<div>🕒 <b>Hours:</b> ${esc(d.availability)}</div>` : ''}
          ${d.clinic_address ? `<div>📍 ${esc(d.clinic_address)}</div>` : ''}
          ${d.phone ? `<div>📞 <a href="tel:${esc(d.phone)}" style="color:inherit;">${esc(d.phone)}</a></div>` : ''}
          ${d.email ? `<div>✉️ <a href="mailto:${esc(d.email)}" style="color:inherit;">${esc(d.email)}</a></div>` : ''}
        </div>
      </div>

      <div class="card-actions-row">
        ${d.phone ? `<a class="btn btn-secondary" href="tel:${esc(d.phone)}">Call Clinic</a>` : ''}
        <button class="btn btn-primary" data-reqappt="${d.id}">Request Appointment</button>
      </div>
    </article>
  `).join('');

  container.querySelectorAll('[data-reqappt]').forEach((b) => {
    b.onclick = async () => {
      const requestedDate = prompt('Preferred Appointment Date (YYYY-MM-DD):', new Date().toISOString().slice(0, 10));
      if (requestedDate === null) return;
      const message = prompt('Reason or message for clinic (optional):', 'Routine checkup and prescription refill review.') || '';

      try {
        const res = await api(`/doctors/${b.dataset.reqappt}/appointment-requests`, {
          method: 'POST',
          body: JSON.stringify({ requestedDate, message })
        });
        toast(res.message);
      } catch (err) {
        toast(err.message, true);
      }
    };
  });
}

$('btnAddDoctor').addEventListener('click', () => {
  $('doctorForm').reset();
  $('doctorFormError').classList.add('hide');
  $('doctorDialog').classList.remove('hide');
});

$('doctorForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('doctorFormError').classList.add('hide');

  const body = {
    patientId: S.activePatientId,
    name: $('inputDocName').value.trim(),
    specialization: $('inputDocSpec').value.trim(),
    clinicName: $('inputDocClinic').value.trim(),
    phone: $('inputDocPhone').value.trim(),
    email: $('inputDocEmail').value.trim(),
    availability: $('inputDocAvailability').value.trim(),
    clinicAddress: $('inputDocAddress').value.trim()
  };

  try {
    const res = await api('/doctors', {
      method: 'POST',
      body: JSON.stringify(body)
    });
    $('doctorDialog').classList.add('hide');
    toast(res.message);
    loadDoctors();
  } catch (err) {
    $('doctorFormError').textContent = err.message;
    $('doctorFormError').classList.remove('hide');
  }
});

// ================= GENTLE NUDGES & PRESETS =================

document.querySelectorAll('.preset-pill').forEach((btn) => {
  btn.addEventListener('click', () => {
    $('inputNudgeMessage').value = btn.dataset.nudge;
  });
});

$('nudgeForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const msg = $('inputNudgeMessage').value.trim();
  try {
    const res = await api('/alerts/nudge', {
      method: 'POST',
      body: JSON.stringify({ patientId: S.activePatientId, message: msg })
    });
    $('nudgeDialog').classList.add('hide');
    toast(res.message);
    fetchAlerts();
  } catch (err) {
    toast(err.message, true);
  }
});

// ================= NOTIFICATION CENTER & POLLING =================

function startAlertsPolling() {
  fetchAlerts();
  clearInterval(S.pollTimer);
  S.pollTimer = setInterval(fetchAlerts, 15000);
}

async function fetchAlerts() {
  if (!S.token) return;
  try {
    const data = await api('/alerts');
    S.alerts = data.alerts || [];
    S.unreadAlerts = data.unreadCount || 0;

    const badge = $('notifBadge');
    if (S.unreadAlerts > 0) {
      badge.textContent = S.unreadAlerts > 9 ? '9+' : S.unreadAlerts;
      badge.classList.remove('hide');
    } else {
      badge.classList.add('hide');
    }

    renderAlertsDropdown(S.alerts);
  } catch (e) {
    // Ignore silent poll error
  }
}

function renderAlertsDropdown(alerts) {
  const container = $('notifList');
  if (!alerts.length) {
    container.innerHTML = '<div class="empty-notif">No notifications yet.</div>';
    return;
  }

  container.innerHTML = alerts.map((a) => {
    const isSos = a.alert_type === 'sos';
    const isUnread = !a.read_status;
    const timeFormatted = new Intl.DateTimeFormat(undefined, {
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(a.created_at));

    return `
      <div class="notif-item ${isUnread ? 'unread' : ''}" style="${isSos ? 'background:#fff1f2;border-left:3px solid #e11d48;' : ''}">
        <div class="notif-item-top">
          <span class="notif-item-title">${esc(a.title)}</span>
          <span class="notif-item-time">${timeFormatted}</span>
        </div>
        <p class="notif-item-msg">${esc(a.message)}</p>
      </div>
    `;
  }).join('');
}

$('btnNotif').addEventListener('click', (e) => {
  e.stopPropagation();
  $('notifDropdown').classList.toggle('hide');
});

document.addEventListener('click', (e) => {
  if (!e.target.closest('.notif-wrapper')) {
    $('notifDropdown').classList.add('hide');
  }
});

$('btnMarkAllRead').addEventListener('click', async () => {
  try {
    await api('/alerts/read-all', { method: 'POST' });
    fetchAlerts();
  } catch (e) {
    // ignore
  }
});

// Modal close handlers (data-close attributes and Escape key)
document.addEventListener('click', (e) => {
  const closeBtn = e.target.closest('[data-close]');
  if (closeBtn) {
    const modalId = closeBtn.dataset.close;
    const el = $(modalId);
    if (el) el.classList.add('hide');
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-backdrop').forEach((m) => m.classList.add('hide'));
    $('notifDropdown').classList.add('hide');
  }
});

// Auto-login on reload if token exists
if (S.token) {
  enterApp();
} else {
  setAuthMode('login');
}
