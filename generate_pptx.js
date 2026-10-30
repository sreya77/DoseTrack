const pptxgen = require('pptxgenjs');
const path = require('path');
const fs = require('fs');

async function buildPresentation() {
  const pres = new pptxgen();
  pres.layout = 'LAYOUT_16x9';
  pres.author = 'Mefa Rahiman, Shabana, Sreya S Jeevan, Gopika Babu';
  pres.company = 'KMCT Institute of Emerging Technology and Management';
  pres.title = 'DoseTrack - Medication Reminder & Adherence Monitoring System';
  pres.subject = 'BCA S5 Mini Project Final Evaluation';

  // Palette
  const C_TEAL = '0D9488';
  const C_TEAL_DARK = '0F766E';
  const C_BLUE = '0284C7';
  const C_TEXT = '0F172A';
  const C_MUTED = '475569';
  const C_BG = 'F8FAFC';
  const C_WHITE = 'FFFFFF';
  const C_BORDER = 'E2E8F0';
  const C_GREEN = '16A34A';
  const C_AMBER = 'D97706';
  const C_ROSE = 'E11D48';

  const imgPath = (name) => path.join(__dirname, 'public', 'images', name);

  // Helper for slide header
  function addHeader(slide, category, title, subtitle) {
    // Category pill
    slide.addShape(pres.ShapeType.roundRect, {
      x: 0.8, y: 0.4, w: 2.5, h: 0.3,
      fill: { color: 'F0FDFA' },
      line: { color: C_TEAL, width: 1 },
      rectRadius: 0.15
    });
    slide.addText(category.toUpperCase(), {
      x: 0.8, y: 0.4, w: 2.5, h: 0.3,
      fontSize: 9, bold: true, color: C_TEAL, fontFace: 'Arial',
      align: 'center', valign: 'middle'
    });

    // Watermark
    slide.addText('DoseTrack · BCA S5 · KMCT IETM (KTU)', {
      x: 8.5, y: 0.4, w: 4.0, h: 0.3,
      fontSize: 9, color: '94A3B8', fontFace: 'Arial', align: 'right'
    });

    // Title & Subtitle
    slide.addText(title, {
      x: 0.8, y: 0.75, w: 11.5, h: 0.55,
      fontSize: 22, bold: true, color: C_TEXT, fontFace: 'Arial'
    });
    if (subtitle) {
      slide.addText(subtitle, {
        x: 0.8, y: 1.3, w: 11.5, h: 0.35,
        fontSize: 11, color: C_MUTED, fontFace: 'Arial'
      });
    }
  }

  // Helper for card background
  function addCard(slide, x, y, w, h, borderColor = C_BORDER, topBarColor = null) {
    slide.addShape(pres.ShapeType.roundRect, {
      x, y, w, h,
      fill: { color: C_WHITE },
      line: { color: borderColor, width: 1 },
      rectRadius: 0.08
    });
    if (topBarColor) {
      slide.addShape(pres.ShapeType.rect, {
        x: x + 0.01, y: y + 0.01, w: w - 0.02, h: 0.06,
        fill: { color: topBarColor },
        line: { color: topBarColor, width: 0 }
      });
    }
  }

  // ==========================================================
  // SLIDE 1: TITLE SLIDE
  // ==========================================================
  {
    const slide = pres.addSlide();
    slide.background = { color: C_BG };
    slide.addNotes("Respected guide Ms. Ansha MK, coordinator Prof. Kavitha G. Nair, Head of Department Thejas Mon P, and respected evaluators: Good morning. We are presenting our BCA S5 Mini Project titled 'DoseTrack – Medication Reminder & Adherence Monitoring System'. Team: Mefa Rahiman, Shabana, Sreya S Jeevan, Gopika Babu, KMCT IETM, affiliated to APJ KTU.");

    // Top Header Banner
    slide.addShape(pres.ShapeType.rect, { x: 0, y: 0, w: 13.33, h: 0.4, fill: { color: C_TEAL } });
    slide.addText('MINI PROJECT FINAL EVALUATION PRESENTATION · OCTOBER 2026', {
      x: 0.8, y: 0.05, w: 11.5, h: 0.3,
      fontSize: 9, bold: true, color: 'FFFFFF', align: 'left', fontFace: 'Arial'
    });

    // College Emblem
    if (fs.existsSync(imgPath('logo_kmct.png'))) {
      slide.addImage({ path: imgPath('logo_kmct.png'), x: 0.8, y: 0.7, w: 1.2, h: 1.2 });
    }

    slide.addText('DEPARTMENT OF COMPUTER APPLICATION\nKMCT INSTITUTE OF EMERGING TECHNOLOGY AND MANAGEMENT\nAffiliated to APJ Abdul Kalam Technological University, Kerala', {
      x: 2.2, y: 0.7, w: 10.0, h: 1.1,
      fontSize: 12, bold: true, color: C_MUTED, fontFace: 'Arial', lineSpacingMultiple: 1.2
    });

    // Big Title Box
    addCard(slide, 0.8, 2.0, 11.73, 2.2, C_TEAL, C_TEAL);
    slide.addText('DoseTrack', {
      x: 1.1, y: 2.2, w: 11.0, h: 0.7,
      fontSize: 34, bold: true, color: C_TEXT, fontFace: 'Arial'
    });
    slide.addText('Medication Reminder & Adherence Monitoring System', {
      x: 1.1, y: 2.9, w: 11.0, h: 0.45,
      fontSize: 16, bold: true, color: C_TEAL, fontFace: 'Arial'
    });
    slide.addText('A centralized digital platform designed to help users organize medication regimens, configure dosage schedules, receive timely automated reminders, track dose adherence, and access doctor contact information.', {
      x: 1.1, y: 3.4, w: 11.0, h: 0.65,
      fontSize: 11, color: C_MUTED, fontFace: 'Arial', lineSpacingMultiple: 1.2
    });

    // Team Card
    addCard(slide, 0.8, 4.4, 5.7, 2.4, C_BORDER, C_TEAL);
    slide.addText('PROJECT TEAM MEMBERS (BCA S5)', {
      x: 1.0, y: 4.55, w: 5.3, h: 0.3,
      fontSize: 10, bold: true, color: C_TEAL, fontFace: 'Arial'
    });
    const teamText = [
      { text: '•  Mefa Rahiman\n', options: { bold: true, color: C_TEXT } },
      { text: '•  Shabana\n', options: { bold: true, color: C_TEXT } },
      { text: '•  Sreya S Jeevan\n', options: { bold: true, color: C_TEXT } },
      { text: '•  Gopika Babu', options: { bold: true, color: C_TEXT } }
    ];
    slide.addText(teamText, {
      x: 1.0, y: 4.9, w: 5.3, h: 1.7,
      fontSize: 12, fontFace: 'Arial', lineSpacingMultiple: 1.3
    });

    // Faculty Guidance Card
    addCard(slide, 6.83, 4.4, 5.7, 2.4, C_BORDER, C_BLUE);
    slide.addText('FACULTY SUPERVISION & COORDINATION', {
      x: 7.03, y: 4.55, w: 5.3, h: 0.3,
      fontSize: 10, bold: true, color: C_BLUE, fontFace: 'Arial'
    });
    const guideText = [
      { text: 'Project Guide:\n', options: { fontSize: 10, color: C_MUTED } },
      { text: 'Ms. ANSHA MK  (Assistant Professor)\n\n', options: { fontSize: 12, bold: true, color: C_TEXT } },
      { text: 'Project Coordinator:  ', options: { fontSize: 10, color: C_MUTED } },
      { text: 'Prof. Kavitha G. Nair\n', options: { fontSize: 11, bold: true, color: C_TEXT } },
      { text: 'Head of Department:  ', options: { fontSize: 10, color: C_MUTED } },
      { text: 'Thejas Mon P', options: { fontSize: 11, bold: true, color: C_TEXT } }
    ];
    slide.addText(guideText, {
      x: 7.03, y: 4.9, w: 5.3, h: 1.7,
      fontSize: 11, fontFace: 'Arial', lineSpacingMultiple: 1.2
    });
  }

  // ==========================================================
  // SLIDE 2: ABSTRACT
  // ==========================================================
  {
    const slide = pres.addSlide();
    slide.background = { color: C_BG };
    slide.addNotes("DoseTrack is a centralized web application designed to help users manage medication details, configure dosage schedules, receive timely automated reminders, record Taken or Missed dose statuses, and review their historical adherence.");
    addHeader(slide, 'Project Overview', 'Project Abstract', 'Digital medication management, automated reminder engine, and adherence audit history.');

    addCard(slide, 0.8, 1.8, 5.7, 4.0, C_BORDER, C_TEAL);
    slide.addText('Core Capabilities of DoseTrack', {
      x: 1.0, y: 1.95, w: 5.3, h: 0.35, fontSize: 13, bold: true, color: C_TEXT
    });
    const absPoints = [
      { text: '•  Medication Information Management: ', options: { bold: true, color: C_TEXT } },
      { text: 'Store drug names, dosages, frequencies, treatment durations, and special intake instructions.\n\n', options: { color: C_MUTED } },
      { text: '•  Dosage Scheduling: ', options: { bold: true, color: C_TEXT } },
      { text: 'Configure exact intake timings (e.g. 08:00 AM, 08:30 PM) and daily administration frequencies.\n\n', options: { color: C_MUTED } },
      { text: '•  Automated Reminders: ', options: { bold: true, color: C_TEXT } },
      { text: 'Notifications generated at specified times to prevent forgotten or delayed doses.\n\n', options: { color: C_MUTED } },
      { text: '•  Adherence Tracking & History: ', options: { bold: true, color: C_TEXT } },
      { text: 'Mark doses as Taken or Missed, updating an organized audit history in MySQL.\n\n', options: { color: C_MUTED } },
      { text: '•  Doctor Contact Directory: ', options: { bold: true, color: C_TEXT } },
      { text: 'Quick access to physician profiles, specialties, clinic hours, and contact options.', options: { color: C_MUTED } }
    ];
    slide.addText(absPoints, { x: 1.0, y: 2.35, w: 5.3, h: 3.3, fontSize: 10, lineSpacingMultiple: 1.15 });

    addCard(slide, 6.83, 1.8, 5.7, 4.0, C_BORDER, C_ROSE);
    slide.addText('The Problem with Traditional Approaches', {
      x: 7.03, y: 1.95, w: 5.3, h: 0.35, fontSize: 13, bold: true, color: C_TEXT
    });
    const tradPoints = [
      { text: '✗  Memory-Based Tracking: ', options: { bold: true, color: C_ROSE } },
      { text: 'High risk of forgotten doses, delayed intakes, or accidental double-dosing.\n\n', options: { color: C_MUTED } },
      { text: '✗  Disconnected Notes & Alarms: ', options: { bold: true, color: C_ROSE } },
      { text: 'Mobile alarms lack medicine names, dosage strengths, and meal instructions.\n\n', options: { color: C_MUTED } },
      { text: '✗  Multi-Medicine Confusion: ', options: { bold: true, color: C_ROSE } },
      { text: 'Managing multiple prescriptions with differing timings creates significant cognitive burden.\n\n', options: { color: C_MUTED } },
      { text: '✗  No Centralized History: ', options: { bold: true, color: C_ROSE } },
      { text: 'Neither patients nor healthcare providers have a structured record of past compliance.\n\n', options: { color: C_MUTED } },
      { text: '✗  Scattered Medical Contacts: ', options: { bold: true, color: C_ROSE } },
      { text: 'Emergency clinic contact details are stored in separate paper files or phonebooks.', options: { color: C_MUTED } }
    ];
    slide.addText(tradPoints, { x: 7.03, y: 2.35, w: 5.3, h: 3.3, fontSize: 10, lineSpacingMultiple: 1.15 });

    // Flow Strip
    addCard(slide, 0.8, 6.0, 11.73, 1.0, C_TEAL);
    slide.addText('CORE SYSTEM INFORMATION FLOW:  Medication Entry  →  Schedule Config  →  Automated Reminder  →  Dose Status (Taken/Missed)  →  Adherence History', {
      x: 1.0, y: 6.25, w: 11.33, h: 0.5,
      fontSize: 11, bold: true, color: C_TEAL, align: 'center', fontFace: 'Arial'
    });
  }

  // ==========================================================
  // SLIDE 3: PROBLEM STATEMENT
  // ==========================================================
  {
    const slide = pres.addSlide();
    slide.background = { color: C_BG };
    slide.addNotes("Users forget medication timings, especially when taking multiple medicines or following repeated schedules. Traditional notes and separate alarms leave information scattered with no simple way to see what has been taken and what has been missed.");
    addHeader(slide, 'Problem Formulation', 'Problem Statement', 'Clinical and daily challenges associated with manual medication management.');

    const problems = [
      { title: 'Forgetfulness & Skipped Doses', desc: 'Patients frequently forget scheduled medication timings, leading to interrupted therapeutic cycles.', color: C_ROSE },
      { title: 'Multiple Medicines Complexity', desc: 'Prescriptions with differing timings, frequencies, and meal instructions cause frequent confusion.', color: C_AMBER },
      { title: 'Scattered Reminders & Notes', desc: 'Relying on memory or basic clock alarms leaves data uncoordinated with no contextual instructions.', color: C_BLUE },
      { title: 'Absence of Adherence History', desc: 'No reliable chronological log to verify taken or missed doses, hindering clinical reviews.', color: C_TEAL },
      { title: 'Isolated Healthcare Contacts', desc: 'Doctor contact info and clinic consultation hours are stored separately from daily medication schedules.', color: '6366F1' },
      { title: 'Risk of Health Complications', desc: 'Irregular medication intake diminishes treatment effectiveness and can cause preventable health issues.', color: C_ROSE }
    ];

    problems.forEach((p, idx) => {
      const col = idx % 3;
      const row = Math.floor(idx / 3);
      const x = 0.8 + col * 4.0;
      const y = 1.8 + row * 2.2;
      addCard(slide, x, y, 3.73, 2.0, C_BORDER, p.color);
      slide.addText(p.title, { x: x + 0.2, y: y + 0.2, w: 3.33, h: 0.35, fontSize: 12, bold: true, color: C_TEXT });
      slide.addText(p.desc, { x: x + 0.2, y: y + 0.65, w: 3.33, h: 1.1, fontSize: 10, color: C_MUTED, lineSpacingMultiple: 1.2 });
    });

    addCard(slide, 0.8, 6.2, 11.73, 0.8, C_TEAL, C_TEAL);
    slide.addText('CORE NEED: A centralized, accessible system that unifies medication details, schedules, reminders, basic tracking, and doctor contacts in one platform.', {
      x: 1.0, y: 6.35, w: 11.33, h: 0.5, fontSize: 11, bold: true, color: C_TEAL, align: 'center'
    });
  }

  // ==========================================================
  // SLIDE 4: OBJECTIVES
  // ==========================================================
  {
    const slide = pres.addSlide();
    slide.background = { color: C_BG };
    slide.addNotes("Chapter 2 specifies six specific project objectives: Efficient medication management, automated reminder system, adherence monitoring, user-friendly dashboard, doctor-contact access, and organized MySQL data management.");
    addHeader(slide, 'Project Scope', 'Project Objectives', 'Six key functional objectives formulated for DoseTrack.');

    const objs = [
      { id: 'OBJ 1', title: 'Efficient Medication Management', desc: 'Create a centralized platform to store, add, update, delete, and view medication details (names, dosages, frequency, duration, and instructions).', color: C_TEAL },
      { id: 'OBJ 2', title: 'Automated Medication Reminders', desc: 'Implement a reliable reminder engine that notifies patients precisely when scheduled medication doses become due.', color: C_BLUE },
      { id: 'OBJ 3', title: 'Monitor & Track Adherence', desc: 'Record scheduled doses as Taken or Missed, storing events in MySQL and displaying historical adherence patterns.', color: C_GREEN },
      { id: 'OBJ 4', title: 'User-Friendly Dashboard', desc: 'Provide a centralized graphical dashboard displaying upcoming doses, completed doses, missed doses, and recent adherence activities.', color: '6366F1' },
      { id: 'OBJ 5', title: 'Easy Doctor-Contact Access', desc: 'Develop a dedicated module allowing patients to access doctor profiles, specializations, clinic details, availability, and contact options.', color: C_AMBER },
      { id: 'OBJ 6', title: 'Organized Data Management', desc: 'Develop a structured relational MySQL database to securely store user credentials, medication details, schedules, and adherence logs.', color: C_ROSE }
    ];

    objs.forEach((o, idx) => {
      const col = idx % 3;
      const row = Math.floor(idx / 3);
      const x = 0.8 + col * 4.0;
      const y = 1.8 + row * 2.5;
      addCard(slide, x, y, 3.73, 2.3, C_BORDER, o.color);
      slide.addText(o.id, { x: x + 0.2, y: y + 0.15, w: 1.0, h: 0.25, fontSize: 9, bold: true, color: o.color });
      slide.addText(o.title, { x: x + 0.2, y: y + 0.45, w: 3.33, h: 0.4, fontSize: 12, bold: true, color: C_TEXT });
      slide.addText(o.desc, { x: x + 0.2, y: y + 0.95, w: 3.33, h: 1.15, fontSize: 10, color: C_MUTED, lineSpacingMultiple: 1.2 });
    });
  }

  // ==========================================================
  // SLIDE 5: LITERATURE SURVEY
  // ==========================================================
  {
    const slide = pres.addSlide();
    slide.background = { color: C_BG };
    slide.addNotes("In Chapter 4, we reviewed related works: Moshnyaga et al. (2016) used Kinect sensors for dementia patients; Rajan et al. (2021) designed an Arduino IoT pill box; Srinivas et al. (2018) added vital sensors; Mason et al. (2022) surveyed adherence technologies. These highlight the need for an accessible software solution without costly hardware.");
    addHeader(slide, 'Literature Review', 'Literature Survey & Existing Approaches', 'Comparative analysis of existing adherence technologies from Chapter 4 of the report.');

    const headers = [
      { text: 'Study / Approach', options: { bold: true, fill: 'F1F5F9' } },
      { text: 'Technology Used', options: { bold: true, fill: 'F1F5F9' } },
      { text: 'Key Strengths', options: { bold: true, fill: 'F1F5F9' } },
      { text: 'Limitations Identified', options: { bold: true, fill: 'F1F5F9' } }
    ];

    const rows = [
      headers,
      [
        { text: 'Moshnyaga et al. (2016)\nDementia Adherence Monitoring' },
        { text: 'Kinect sensor, vocal guidance & caregiver alerts' },
        { text: 'Actively monitors medication-taking activities rather than relying only on alarms.' },
        { text: 'Specialized sensing equipment increases cost and implementation complexity.' }
      ],
      [
        { text: 'Rajan et al. (2021)\nSmart Pill Box with Auto-Fill' },
        { text: 'Arduino, GSM communication, IoT & Blynk App' },
        { text: 'Automated physical notifications and medicine supply monitoring.' },
        { text: 'Hardware equipment, ongoing maintenance, and continuous connectivity dependencies.' }
      ],
      [
        { text: 'Srinivas et al. (2018)\nIntelligent Medicine Box' },
        { text: 'IoT hardware, vital sign sensors & Android App' },
        { text: 'Integrates reminders with abnormal vital sign alerts to guardian.' },
        { text: 'Sensor-based systems increase hardware dependencies and maintenance points.' }
      ],
      [
        { text: 'Mason et al. (2022)\nAdherence Technology Review' },
        { text: 'Electronic pill boxes, bottles, sensors & self-reporting' },
        { text: 'Comprehensive review of usability, cost, and implementation factors.' },
        { text: 'Recording hardware activity does not always confirm actual medicine consumption.' }
      ]
    ];

    slide.addTable(rows, {
      x: 0.8, y: 1.8, w: 11.73, h: 3.8,
      fontSize: 9, color: C_TEXT, border: { pt: 1, color: C_BORDER },
      colW: [2.5, 2.5, 3.36, 3.37]
    });

    addCard(slide, 0.8, 5.9, 11.73, 1.1, C_TEAL, C_TEAL);
    slide.addText('MOTIVATION FOR DOSETRACK:\n“Need for an accessible, practical software-based solution that combines medication management, reminders, adherence tracking, and doctor-contact information in one system without requiring specialized monitoring hardware.”', {
      x: 1.0, y: 6.05, w: 11.33, h: 0.8, fontSize: 10, bold: true, color: C_TEAL, lineSpacingMultiple: 1.2
    });
  }

  // ==========================================================
  // SLIDE 6: PROPOSED SYSTEM
  // ==========================================================
  {
    const slide = pres.addSlide();
    slide.background = { color: C_BG };
    slide.addNotes("Chapter 5 describes the proposed DoseTrack system. It functions as a centralized hub connecting user management, medication cabinet, schedule configuration, reminder engine, adherence tracking, dashboard, and doctor contacts.");
    addHeader(slide, 'Proposed Architecture', 'Proposed System – DoseTrack', 'Centralized platform integrating medication management, reminders, and adherence monitoring.');

    // Center Core Card
    addCard(slide, 4.66, 2.2, 4.0, 3.4, C_TEAL, C_TEAL);
    slide.addText('DoseTrack Core System', {
      x: 4.86, y: 2.5, w: 3.6, h: 0.4, fontSize: 16, bold: true, color: C_TEXT, align: 'center'
    });
    slide.addText('Centralized Web Application\n& Relational MySQL Database\n\n• Automated Schedule Engine\n• Immutable Adherence Log\n• Doctor Contact Directory', {
      x: 4.86, y: 3.1, w: 3.6, h: 2.2, fontSize: 11, color: C_MUTED, align: 'center', lineSpacingMultiple: 1.3
    });

    // Left Spokes
    const leftSpokes = [
      { title: 'User Management', desc: 'Secure registration, login & profile context' },
      { title: 'Medication Management', desc: 'CRUD operations for drugs, dosages & units' },
      { title: 'Schedule Management', desc: 'Exact dose times, frequency & duration' }
    ];
    leftSpokes.forEach((s, idx) => {
      const y = 1.9 + idx * 1.5;
      addCard(slide, 0.8, y, 3.5, 1.25, C_BORDER, C_TEAL);
      slide.addText(s.title, { x: 0.95, y: y + 0.15, w: 3.2, h: 0.3, fontSize: 11, bold: true, color: C_TEXT });
      slide.addText(s.desc, { x: 0.95, y: y + 0.45, w: 3.2, h: 0.6, fontSize: 9, color: C_MUTED });
    });

    // Right Spokes
    const rightSpokes = [
      { title: 'Reminder Engine', desc: 'Automated alerts triggered at scheduled times' },
      { title: 'Adherence Tracking', desc: 'Taken/Missed recording & 30-day history log' },
      { title: 'Doctor-Contact Access', desc: 'Physician profiles, clinic hours & contacts' }
    ];
    rightSpokes.forEach((s, idx) => {
      const y = 1.9 + idx * 1.5;
      addCard(slide, 9.03, y, 3.5, 1.25, C_BORDER, C_BLUE);
      slide.addText(s.title, { x: 9.18, y: y + 0.15, w: 3.2, h: 0.3, fontSize: 11, bold: true, color: C_TEXT });
      slide.addText(s.desc, { x: 9.18, y: y + 0.45, w: 3.2, h: 0.6, fontSize: 9, color: C_MUTED });
    });

    // Bottom Spoke: Dashboard
    addCard(slide, 4.66, 5.85, 4.0, 1.15, C_BORDER, C_GREEN);
    slide.addText('Overview Dashboard: Daily routines, adherence stats & vitals', {
      x: 4.86, y: 6.0, w: 3.6, h: 0.8, fontSize: 10, bold: true, color: C_TEXT, align: 'center'
    });
  }

  // ==========================================================
  // SLIDE 7: PROJECT METHODOLOGY
  // ==========================================================
  {
    const slide = pres.addSlide();
    slide.background = { color: C_BG };
    slide.addNotes("Section 6.1 defines our methodology: Requirement Analysis, System Design, Database Design, Frontend Development, Application Logic, Reminder & Adherence Implementation, Testing, and Final Integration.");
    addHeader(slide, 'Development Methodology', 'Project Methodology', 'Structured eight-phase engineering lifecycle followed during DoseTrack development.');

    const phases = [
      { step: '01', title: 'Requirement Analysis', desc: 'Identified challenges in manual medicine tracking and clinical adherence needs.' },
      { step: '02', title: 'System Design', desc: 'Defined the 3-layer architecture, module responsibilities, and interaction contracts.' },
      { step: '03', title: 'Database Design', desc: 'Created relational schema with users, medications, schedules, and dose events.' },
      { step: '04', title: 'Frontend Development', desc: 'Crafted responsive, accessible UI using semantic HTML5, CSS3, and JavaScript.' },
      { step: '05', title: 'Application Logic', desc: 'Programmed backend routing, authentication validation, and medication CRUD logic.' },
      { step: '06', title: 'Reminders & Tracking', desc: 'Engineered schedule time-matching, notification dispatch, and dose logging.' },
      { step: '07', title: 'Testing & Verification', desc: 'Conducted unit and functional testing of auth, CRUD operations, and DB updates.' },
      { step: '08', title: 'Final Integration', desc: 'Unified presentation, logic, and data tiers into a coherent web application.' }
    ];

    phases.forEach((p, idx) => {
      const col = idx % 4;
      const row = Math.floor(idx / 4);
      const x = 0.8 + col * 2.98;
      const y = 1.8 + row * 2.5;
      addCard(slide, x, y, 2.78, 2.2, C_BORDER, C_TEAL);
      slide.addText(p.step, { x: x + 0.15, y: y + 0.15, w: 0.8, h: 0.25, fontSize: 9, bold: true, color: C_TEAL });
      slide.addText(p.title, { x: x + 0.15, y: y + 0.45, w: 2.48, h: 0.4, fontSize: 11, bold: true, color: C_TEXT });
      slide.addText(p.desc, { x: x + 0.15, y: y + 0.9, w: 2.48, h: 1.1, fontSize: 9.5, color: C_MUTED, lineSpacingMultiple: 1.2 });
    });
  }

  // ==========================================================
  // SLIDE 8: SYSTEM ARCHITECTURE
  // ==========================================================
  {
    const slide = pres.addSlide();
    slide.background = { color: C_BG };
    slide.addNotes("Figure 5.1 in Chapter 6 illustrates our 3-Layer Architecture. Presentation Layer handles user interaction, Application Layer checks every request and runs business logic, and Data Layer persists records in MySQL.");
    addHeader(slide, 'Architecture Specification', 'System Architecture', 'Three-layer architecture connecting Presentation, Application Logic, and Relational Data.');

    // Embed Report Figure 5.1 if exists
    if (fs.existsSync(imgPath('fig_5_1_architecture.png'))) {
      slide.addImage({ path: imgPath('fig_5_1_architecture.png'), x: 0.8, y: 1.8, w: 5.5, h: 5.0 });
    }

    // Detail Cards on Right
    addCard(slide, 6.7, 1.8, 5.83, 1.5, C_BORDER, C_TEAL);
    slide.addText('1. Presentation Layer (HTML5, CSS3, JavaScript)', {
      x: 6.9, y: 1.95, w: 5.4, h: 0.3, fontSize: 12, bold: true, color: C_TEXT
    });
    slide.addText('Frontend forms, daily overview dashboard, modal dialogs, schedule configuration forms, real-time alert banners, and doctor contact cards accessed via desktop/mobile browsers.', {
      x: 6.9, y: 2.3, w: 5.4, h: 0.85, fontSize: 10, color: C_MUTED, lineSpacingMultiple: 1.2
    });

    addCard(slide, 6.7, 3.5, 5.83, 1.5, C_BORDER, C_BLUE);
    slide.addText('2. Application / Logic Layer (Node.js / PHP)', {
      x: 6.9, y: 3.65, w: 5.4, h: 0.3, fontSize: 12, bold: true, color: C_TEXT
    });
    slide.addText('Backend business logic and validation checking every request before storage; handles user authentication, medication CRUD operations, schedule matching, and adherence recording.', {
      x: 6.9, y: 4.0, w: 5.4, h: 0.85, fontSize: 10, color: C_MUTED, lineSpacingMultiple: 1.2
    });

    addCard(slide, 6.7, 5.2, 5.83, 1.6, C_BORDER, C_GREEN);
    slide.addText('3. Data Layer (MySQL Relational Database)', {
      x: 6.9, y: 5.35, w: 5.4, h: 0.3, fontSize: 12, bold: true, color: C_TEXT
    });
    slide.addText('Structured MySQL database managing tables for users, medications, dosage schedules, adherence event logs, doctor contact details, and notification settings with foreign key integrity.', {
      x: 6.9, y: 5.7, w: 5.4, h: 0.95, fontSize: 10, color: C_MUTED, lineSpacingMultiple: 1.2
    });
  }

  // ==========================================================
  // SLIDE 9: APPLICATION WORKFLOW
  // ==========================================================
  {
    const slide = pres.addSlide();
    slide.background = { color: C_BG };
    slide.addNotes("Figure 5.3 shows the complete workflow: Register/Login -> Dashboard -> Add Medication -> Set Schedule -> Reminder Generated -> User responds Taken/Missed -> Status Stored in History -> Dashboard Updated.");
    addHeader(slide, 'Operational Flowchart', 'Application Workflow', 'End-to-end user journey flowchart from Chapter 6 (Figure 5.3).');

    if (fs.existsSync(imgPath('fig_5_3_workflow.png'))) {
      slide.addImage({ path: imgPath('fig_5_3_workflow.png'), x: 0.8, y: 1.8, w: 4.5, h: 5.0 });
    }

    const steps = [
      { num: '1', title: 'Register / Login', desc: 'Patient registers and logs in securely; session associates medication data with user account.' },
      { num: '2', title: 'Dashboard Overview', desc: 'Displays todays scheduled medication doses, adherence progress counter, and vitals snapshot.' },
      { num: '3', title: 'Add / Edit Medication', desc: 'User inputs medicine name, dosage strength, quantity, frequency, and treatment duration.' },
      { num: '4', title: 'Configure Schedule', desc: 'Sets specific dose timings (e.g. 08:00 AM, 08:30 PM) directly linked to the medication record.' },
      { num: '5', title: 'Automated Reminder Generated', desc: 'When current time matches schedule, system alerts the patient that a dose is due.' },
      { num: '6', title: 'User Responds: Taken / Missed', desc: 'Patient marks dose status directly from the reminder or daily dashboard.' },
      { num: '7', title: 'Status Stored in MySQL History', desc: 'Event is committed to database; adherence compliance metrics update instantly.' }
    ];

    steps.forEach((s, idx) => {
      const y = 1.8 + idx * 0.72;
      addCard(slide, 5.6, y, 6.93, 0.65, C_BORDER);
      slide.addText(s.num, { x: 5.75, y: y + 0.15, w: 0.35, h: 0.35, fontSize: 10, bold: true, color: C_TEAL });
      slide.addText(s.title + ' — ' + s.desc, {
        x: 6.15, y: y + 0.1, w: 6.2, h: 0.45, fontSize: 9.5, color: C_MUTED, fontFace: 'Arial'
      });
    });
  }

  // ==========================================================
  // SLIDE 10: ALGORITHMS & CORE LOGIC
  // ==========================================================
  {
    const slide = pres.addSlide();
    slide.background = { color: C_BG };
    slide.addNotes("DoseTrack uses deterministic rule-based algorithms rather than AI: Authentication verification, Medication CRUD logic, Reminder schedule-matching logic, and Adherence percentage formula.");
    addHeader(slide, 'Application Logic', 'Algorithms & Core Logic', 'Deterministic rule-based workflows powering authentication, CRUD, reminders, and adherence monitoring.');

    // Logic 1: Auth
    addCard(slide, 0.8, 1.8, 5.7, 2.4, C_BORDER, C_TEAL);
    slide.addText('1. Authentication & Session Logic', { x: 1.0, y: 1.95, w: 5.3, h: 0.3, fontSize: 12, bold: true, color: C_TEXT });
    const authText = [
      { text: '• Input: ', options: { bold: true } }, { text: 'User email & password credentials.\n' },
      { text: '• Step 1: ', options: { bold: true } }, { text: 'Query users table for unique registered email.\n' },
      { text: '• Step 2: ', options: { bold: true } }, { text: 'Verify submitted password against stored secure hash.\n' },
      { text: '• Step 3: ', options: { bold: true } }, { text: 'Initialize authenticated session binding user ID to all data requests.' }
    ];
    slide.addText(authText, { x: 1.0, y: 2.3, w: 5.3, h: 1.7, fontSize: 9.5, color: C_MUTED, lineSpacingMultiple: 1.2 });

    // Logic 2: CRUD
    addCard(slide, 6.83, 1.8, 5.7, 2.4, C_BORDER, C_BLUE);
    slide.addText('2. Medication CRUD Logic', { x: 7.03, y: 1.95, w: 5.3, h: 0.3, fontSize: 12, bold: true, color: C_TEXT });
    const crudText = [
      { text: '• Create: ', options: { bold: true } }, { text: 'Insert medication row with user_id, dosage & instructions.\n' },
      { text: '• Read: ', options: { bold: true } }, { text: 'Retrieve active medicines where start_date <= NOW() <= end_date.\n' },
      { text: '• Update: ', options: { bold: true } }, { text: 'Validate and update dosage, frequency, or instructions.\n' },
      { text: '• Delete: ', options: { bold: true } }, { text: 'Cascade delete associated dosage schedules and alert logs.' }
    ];
    slide.addText(crudText, { x: 7.03, y: 2.3, w: 5.3, h: 1.7, fontSize: 9.5, color: C_MUTED, lineSpacingMultiple: 1.2 });

    // Logic 3: Reminder Triggering
    addCard(slide, 0.8, 4.4, 5.7, 2.5, C_BORDER, C_AMBER);
    slide.addText('3. Reminder Triggering Logic', { x: 1.0, y: 4.55, w: 5.3, h: 0.3, fontSize: 12, bold: true, color: C_TEXT });
    const remText = [
      { text: '• Input: ', options: { bold: true } }, { text: 'Active schedules S = {dose_time, active}.\n' },
      { text: '• Step 1: ', options: { bold: true } }, { text: 'Compare current system time T_now with dose_time.\n' },
      { text: '• Step 2: ', options: { bold: true } }, { text: 'Check if an event already exists in dose_events for today.\n' },
      { text: '• Step 3: ', options: { bold: true } }, { text: 'If T_now >= dose_time and not recorded, trigger dashboard alert.' }
    ];
    slide.addText(remText, { x: 1.0, y: 4.9, w: 5.3, h: 1.8, fontSize: 9.5, color: C_MUTED, lineSpacingMultiple: 1.2 });

    // Logic 4: Adherence
    addCard(slide, 6.83, 4.4, 5.7, 2.5, C_BORDER, C_GREEN);
    slide.addText('4. Adherence Evaluation Logic', { x: 7.03, y: 4.55, w: 5.3, h: 0.3, fontSize: 12, bold: true, color: C_TEXT });
    const adhText = [
      { text: '• User Action: ', options: { bold: true } }, { text: 'Patient selects Taken or Missed.\n' },
      { text: '• Commit: ', options: { bold: true } }, { text: 'Insert record into dose_events with timestamp.\n' },
      { text: '• Formula: ', options: { bold: true, color: C_TEAL } }, { text: 'Adherence Rate (%) = (Total Taken / Total Scheduled) * 100%\n', options: { bold: true, color: C_TEAL } },
      { text: '• Update: ', options: { bold: true } }, { text: 'Refreshes daily progress (e.g. 2/4 doses) and adherence history.' }
    ];
    slide.addText(adhText, { x: 7.03, y: 4.9, w: 5.3, h: 1.8, fontSize: 9.5, color: C_MUTED, lineSpacingMultiple: 1.2 });
  }

  // ==========================================================
  // SLIDE 11: MODULES DEVELOPED
  // ==========================================================
  {
    const slide = pres.addSlide();
    slide.background = { color: C_BG };
    slide.addNotes("Table 5.1 in Chapter 6 details the seven core modules: User Management, Medication, Schedule, Reminder, Tracking, Dashboard, and Settings, plus Doctor Contact module.");
    addHeader(slide, 'Module Architecture', 'Modules Developed', 'Core interconnected subsystems documented in Table 5.1 of the report.');

    const mods = [
      { num: '1', name: 'User Management', resp: 'Registration, secure login, profile information, and account context.' },
      { num: '2', name: 'Medication Management', resp: 'Add, edit, view, and delete medication records and instructions.' },
      { num: '3', name: 'Schedule Management', resp: 'Configure exact dose timings, daily frequencies, and treatment dates.' },
      { num: '4', name: 'Reminder System', resp: 'Scheduled notifications alerting users when medicines become due.' },
      { num: '5', name: 'Adherence Tracking', resp: 'Records Taken or Missed status with persistent event timestamps.' },
      { num: '6', name: 'Dashboard Module', resp: 'Centralized display of upcoming doses, compliance rates, and vitals.' },
      { num: '7', name: 'Settings Module', resp: 'Reminder preferences, notification configurations, and display options.' },
      { num: '8', name: 'Doctor-Contact Module', resp: 'Physician profiles, clinic locations, hours, and appointment requests.' }
    ];

    mods.forEach((m, idx) => {
      const col = idx % 2;
      const row = Math.floor(idx / 2);
      const x = 0.8 + col * 5.95;
      const y = 1.8 + row * 1.22;
      addCard(slide, x, y, 5.78, 1.08, C_BORDER, idx === 7 ? C_TEAL : null);
      slide.addText(m.num + '. ' + m.name, { x: x + 0.2, y: y + 0.12, w: 5.38, h: 0.3, fontSize: 11, bold: true, color: C_TEXT });
      slide.addText(m.resp, { x: x + 0.2, y: y + 0.45, w: 5.38, h: 0.55, fontSize: 9.5, color: C_MUTED });
    });
  }

  // ==========================================================
  // SLIDE 12: TECHNOLOGY STACK
  // ==========================================================
  {
    const slide = pres.addSlide();
    slide.background = { color: C_BG };
    slide.addNotes("DoseTrack uses standard technologies from the report: HTML5, CSS3, JavaScript on frontend; Node.js/PHP on backend; MySQL for database; Git for version control.");
    addHeader(slide, 'Technical Environment', 'Technology Stack', 'Standard web, backend, and relational database technologies referenced in the report.');

    // Frontend
    addCard(slide, 0.8, 1.8, 3.73, 4.8, C_BORDER, C_TEAL);
    slide.addText('Frontend Tier', { x: 1.0, y: 2.0, w: 3.33, h: 0.35, fontSize: 14, bold: true, color: C_TEXT });
    slide.addText('User Interface & Presentation', { x: 1.0, y: 2.35, w: 3.33, h: 0.25, fontSize: 9.5, color: C_TEAL, bold: true });
    const feText = [
      { text: '•  HTML5:\n', options: { bold: true, color: C_TEXT } },
      { text: 'Semantic page structure, responsive forms, and accessible modal views.\n\n', options: { color: C_MUTED } },
      { text: '•  CSS3:\n', options: { bold: true, color: C_TEXT } },
      { text: 'Modern clinical color scheme, card components, flexbox/grid layouts, and status badges.\n\n', options: { color: C_MUTED } },
      { text: '•  JavaScript (ES6+):\n', options: { bold: true, color: C_TEXT } },
      { text: 'Dynamic DOM updates, asynchronous fetch API calls, and client-side form validation.', options: { color: C_MUTED } }
    ];
    slide.addText(feText, { x: 1.0, y: 2.7, w: 3.33, h: 3.7, fontSize: 9.5, lineSpacingMultiple: 1.2 });

    // Backend
    addCard(slide, 4.8, 1.8, 3.73, 4.8, C_BORDER, C_BLUE);
    slide.addText('Application Tier', { x: 5.0, y: 2.0, w: 3.33, h: 0.35, fontSize: 14, bold: true, color: C_TEXT });
    slide.addText('Business Logic & API Routing', { x: 5.0, y: 2.35, w: 3.33, h: 0.25, fontSize: 9.5, color: C_BLUE, bold: true });
    const beText = [
      { text: '•  Node.js / Express:\n', options: { bold: true, color: C_TEXT } },
      { text: 'RESTful API routing, business logic orchestration, and reminder schedule daemons.\n\n', options: { color: C_MUTED } },
      { text: '•  PHP Support:\n', options: { bold: true, color: C_TEXT } },
      { text: 'Backend application logic and request validation cited in Chapter 6.\n\n', options: { color: C_MUTED } },
      { text: '•  Security & Validation:\n', options: { bold: true, color: C_TEXT } },
      { text: 'Secure password hashing, input sanitization, and session state management.', options: { color: C_MUTED } }
    ];
    slide.addText(beText, { x: 5.0, y: 2.7, w: 3.33, h: 3.7, fontSize: 9.5, lineSpacingMultiple: 1.2 });

    // Database
    addCard(slide, 8.8, 1.8, 3.73, 4.8, C_BORDER, C_GREEN);
    slide.addText('Data Tier & Tools', { x: 9.0, y: 2.0, w: 3.33, h: 0.35, fontSize: 14, bold: true, color: C_TEXT });
    slide.addText('Persistent Storage & Tooling', { x: 9.0, y: 2.35, w: 3.33, h: 0.25, fontSize: 9.5, color: C_GREEN, bold: true });
    const dbText = [
      { text: '•  MySQL Database:\n', options: { bold: true, color: C_TEXT } },
      { text: 'Relational data management with InnoDB engine, ACID compliance, and foreign keys.\n\n', options: { color: C_MUTED } },
      { text: '•  Git Version Control:\n', options: { bold: true, color: C_TEXT } },
      { text: 'Distributed version control tracking features, commits, and codebase history.\n\n', options: { color: C_MUTED } },
      { text: '•  Standards & Manuals:\n', options: { bold: true, color: C_TEXT } },
      { text: 'MDN Web Docs standards compliance and MySQL Reference Manual.', options: { color: C_MUTED } }
    ];
    slide.addText(dbText, { x: 9.0, y: 2.7, w: 3.33, h: 3.7, fontSize: 9.5, lineSpacingMultiple: 1.2 });
  }

  // ==========================================================
  // SLIDE 13: DATABASE MANAGEMENT
  // ==========================================================
  {
    const slide = pres.addSlide();
    slide.background = { color: C_BG };
    slide.addNotes("DoseTrack utilizes MySQL to organize data into relational entities: users, medications, schedules, dose_events, and doctors with foreign key cascading.");
    addHeader(slide, 'Data Management', 'Database & Data Management', 'Structured relational MySQL schema ensuring data integrity and audit logging.');

    const tables = [
      { name: 'users', type: 'Primary Account Entity', cols: 'id (PK), full_name, email (UQ), phone, password_hash, created_at' },
      { name: 'medications', type: 'Medication Records (FK -> users.id)', cols: 'id (PK), user_id (FK), name, dosage, quantity, frequency, instructions, start_date, end_date' },
      { name: 'schedules', type: 'Dose Timings (FK -> medications.id)', cols: 'id (PK), medication_id (FK), user_id (FK), dose_time, active, created_at' },
      { name: 'dose_events', type: 'Adherence Audit History Log', cols: 'id (PK), schedule_id (FK), medication_id (FK), user_id (FK), scheduled_for, status (taken/missed), recorded_at' },
      { name: 'doctors', type: 'Doctor & Clinic Directory', cols: 'id (PK), user_id (FK), name, specialization, clinic_name, phone, email, availability, clinic_address' }
    ];

    tables.forEach((t, idx) => {
      const y = 1.8 + idx * 0.95;
      addCard(slide, 0.8, y, 6.5, 0.85, C_BORDER, idx === 3 ? C_GREEN : null);
      slide.addText(t.name + '  (' + t.type + ')', { x: 1.0, y: y + 0.1, w: 6.1, h: 0.25, fontSize: 10.5, bold: true, color: C_TEXT });
      slide.addText(t.cols, { x: 1.0, y: y + 0.38, w: 6.1, h: 0.4, fontSize: 8.5, color: C_MUTED, fontFace: 'Courier New' });
    });

    addCard(slide, 7.6, 1.8, 4.93, 4.65, C_BORDER, C_TEAL);
    slide.addText('Relational Architecture Benefits', { x: 7.8, y: 2.0, w: 4.5, h: 0.35, fontSize: 13, bold: true, color: C_TEXT });
    const bText = [
      { text: '•  Centralized Storage: ', options: { bold: true, color: C_TEXT } },
      { text: 'Consolidates scattered paper notes and uncoordinated alarms into an organized relational schema.\n\n', options: { color: C_MUTED } },
      { text: '•  Cascading Integrity: ', options: { bold: true, color: C_TEXT } },
      { text: 'Deleting a medication automatically cleans up associated dosage schedules and alert logs (ON DELETE CASCADE).\n\n', options: { color: C_MUTED } },
      { text: '•  Adherence Audit Trail: ', options: { bold: true, color: C_TEXT } },
      { text: 'Every taken or missed response is saved with an immutable timestamp for clinical reviews.\n\n', options: { color: C_MUTED } },
      { text: '•  Performance Indexing: ', options: { bold: true, color: C_TEXT } },
      { text: 'Optimized indexes (idx_med_user_dates, idx_schedule_user_active) ensure fast dashboard queries.', options: { color: C_MUTED } }
    ];
    slide.addText(bText, { x: 7.8, y: 2.4, w: 4.5, h: 3.9, fontSize: 9.5, lineSpacingMultiple: 1.25 });
  }

  // ==========================================================
  // SLIDE 14: CORE USER INTERFACES
  // ==========================================================
  {
    const slide = pres.addSlide();
    slide.background = { color: C_BG };
    slide.addNotes("Slide 14 presents real screenshots from Appendices: Login Page, Daily Overview Dashboard, and Medication Cabinet.");
    addHeader(slide, 'User Interfaces · Part 1', 'Application Interfaces – Core Patient Experience', 'Actual interface screenshots from Appendices (Pages 21–22) of the project report.');

    // Screen 1: Login
    addCard(slide, 0.8, 1.8, 3.73, 4.8, C_BORDER);
    if (fs.existsSync(imgPath('screen_01_login.png'))) {
      slide.addImage({ path: imgPath('screen_01_login.png'), x: 0.9, y: 1.9, w: 3.53, h: 3.0 });
    }
    slide.addText('01. Login & Authentication', { x: 0.95, y: 5.0, w: 3.4, h: 0.3, fontSize: 11, bold: true, color: C_TEXT });
    slide.addText('Secure role-aware entry point with credentials validation and workspace sign-in.', { x: 0.95, y: 5.35, w: 3.4, h: 1.1, fontSize: 9, color: C_MUTED });

    // Screen 2: Dashboard
    addCard(slide, 4.8, 1.8, 3.73, 4.8, C_BORDER);
    if (fs.existsSync(imgPath('screen_02_dashboard.png'))) {
      slide.addImage({ path: imgPath('screen_02_dashboard.png'), x: 4.9, y: 1.9, w: 3.53, h: 3.0 });
    }
    slide.addText('02. Daily Overview Dashboard', { x: 4.95, y: 5.0, w: 3.4, h: 0.3, fontSize: 11, bold: true, color: C_TEXT });
    slide.addText('Active medicines, today doses (2/4), 30-day adherence (97%), and schedule action cards.', { x: 4.95, y: 5.35, w: 3.4, h: 1.1, fontSize: 9, color: C_MUTED });

    // Screen 3: Medication Cabinet
    addCard(slide, 8.8, 1.8, 3.73, 4.8, C_BORDER);
    if (fs.existsSync(imgPath('screen_04_medication_cabinet.png'))) {
      slide.addImage({ path: imgPath('screen_04_medication_cabinet.png'), x: 8.9, y: 1.9, w: 3.53, h: 3.0 });
    }
    slide.addText('03. Medication Cabinet', { x: 8.95, y: 5.0, w: 3.4, h: 0.3, fontSize: 11, bold: true, color: C_TEXT });
    slide.addText('Prescription list with dosage units, timings, ongoing dates, and Edit/Delete controls.', { x: 8.95, y: 5.35, w: 3.4, h: 1.1, fontSize: 9, color: C_MUTED });
  }

  // ==========================================================
  // SLIDE 15: ADHERENCE & CARE INTERFACES
  // ==========================================================
  {
    const slide = pres.addSlide();
    slide.background = { color: C_BG };
    slide.addNotes("Slide 15 shows Adherence History audit log, Doctor Contacts directory, and My Care Circle from Report Appendices.");
    addHeader(slide, 'User Interfaces · Part 2', 'Application Interfaces – Adherence & Healthcare', 'Adherence audit trail, doctor contacts, and care circle screens from Report Appendices.');

    // Screen 4: Adherence History
    addCard(slide, 0.8, 1.8, 3.73, 4.8, C_BORDER);
    if (fs.existsSync(imgPath('screen_05_adherence_history.png'))) {
      slide.addImage({ path: imgPath('screen_05_adherence_history.png'), x: 0.9, y: 1.9, w: 3.53, h: 3.0 });
    }
    slide.addText('04. 30-Day Adherence History', { x: 0.95, y: 5.0, w: 3.4, h: 0.3, fontSize: 11, bold: true, color: C_TEXT });
    slide.addText('Audit log table recording medication name, dosage strength, scheduled time, and Taken/Missed status.', { x: 0.95, y: 5.35, w: 3.4, h: 1.1, fontSize: 9, color: C_MUTED });

    // Screen 5: Doctor Contacts
    addCard(slide, 4.8, 1.8, 3.73, 4.8, C_BORDER);
    if (fs.existsSync(imgPath('screen_07_doctor_contacts.png'))) {
      slide.addImage({ path: imgPath('screen_07_doctor_contacts.png'), x: 4.9, y: 1.9, w: 3.53, h: 3.0 });
    }
    slide.addText('05. Doctor & Clinic Contacts', { x: 4.95, y: 5.0, w: 3.4, h: 0.3, fontSize: 11, bold: true, color: C_TEXT });
    slide.addText('Physician directory with specialties, clinic hours, phone numbers, and appointment requests.', { x: 4.95, y: 5.35, w: 3.4, h: 1.1, fontSize: 9, color: C_MUTED });

    // Screen 6: Care Circle
    addCard(slide, 8.8, 1.8, 3.73, 4.8, C_BORDER);
    if (fs.existsSync(imgPath('screen_06_care_circle.png'))) {
      slide.addImage({ path: imgPath('screen_06_care_circle.png'), x: 8.9, y: 1.9, w: 3.53, h: 3.0 });
    }
    slide.addText('06. Care Circle Collaboration', { x: 8.95, y: 5.0, w: 3.4, h: 0.3, fontSize: 11, bold: true, color: C_TEXT });
    slide.addText('Connected family guardian and caretaker profiles to support patient adherence oversight.', { x: 8.95, y: 5.35, w: 3.4, h: 1.1, fontSize: 9, color: C_MUTED });
  }

  // ==========================================================
  // SLIDE 16: IMPLEMENTATION & KEY FUNCTIONALITIES
  // ==========================================================
  {
    const slide = pres.addSlide();
    slide.background = { color: C_BG };
    slide.addNotes("Slide 16 confirms all implemented features: user authentication, medication management, scheduling, automated reminders, dose tracking, adherence history, dashboard, doctor contacts, and MySQL storage.");
    addHeader(slide, 'Feature Verification', 'Implementation & Key Functionalities', 'Summary of implemented features verified in the working prototype.');

    const feats = [
      { name: '1. User Registration & Authentication', desc: 'Secure user login, password hashing, and session management associating patient records.' },
      { name: '2. Medication Record Management', desc: 'Full CRUD operations to store drug names, dosage strengths, units, instructions, and dates.' },
      { name: '3. Medication Schedule Configuration', desc: 'Configurable dosage timings (e.g. 08:00 AM, 08:30 PM), intake frequencies, and active flags.' },
      { name: '4. Automated Medication Reminders', desc: 'Automated notification engine alerting patients precisely when scheduled doses become due.' },
      { name: '5. Taken / Missed Dose Tracking', desc: 'Interactive response buttons allowing users to record dose outcomes with real-time logging.' },
      { name: '6. Adherence History & Audit Trail', desc: 'Structured chronological table of dose events providing an auditable record of compliance.' },
      { name: '7. Daily Overview Dashboard', desc: 'Centralized graphical dashboard visualizing todays doses, adherence stats, and pending alerts.' },
      { name: '8. Doctor Contacts & MySQL Storage', desc: 'Physician directory with clinic timings, appointment options, and relational MySQL persistence.' }
    ];

    feats.forEach((f, idx) => {
      const col = idx % 2;
      const row = Math.floor(idx / 2);
      const x = 0.8 + col * 5.95;
      const y = 1.8 + row * 1.22;
      addCard(slide, x, y, 5.78, 1.1, C_BORDER);
      slide.addText(f.name, { x: x + 0.2, y: y + 0.12, w: 4.5, h: 0.28, fontSize: 11, bold: true, color: C_TEXT });
      slide.addText('✓ Implemented', { x: x + 4.7, y: y + 0.12, w: 0.9, h: 0.25, fontSize: 8.5, bold: true, color: C_GREEN });
      slide.addText(f.desc, { x: x + 0.2, y: y + 0.42, w: 5.38, h: 0.6, fontSize: 9.5, color: C_MUTED });
    });
  }

  // ==========================================================
  // SLIDE 17: RESULTS & FUNCTIONAL ANALYSIS
  // ==========================================================
  {
    const slide = pres.addSlide();
    slide.background = { color: C_BG };
    slide.addNotes("In Slide 17, we present results as functional outcomes based on the implemented features and screenshots without inventing fake numbers.");
    addHeader(slide, 'Results Evaluation', 'Results & Functional Analysis', 'Functional verification of implemented outcomes against project objectives.');

    const resHeaders = [
      { text: 'Expected Outcome (Objectives)', options: { bold: true, fill: 'F1F5F9' } },
      { text: 'Implemented Result in DoseTrack', options: { bold: true, fill: 'F1F5F9' } },
      { text: 'Status', options: { bold: true, fill: 'F1F5F9', align: 'center' } }
    ];

    const resRows = [
      resHeaders,
      [
        { text: 'Centralized Medication Management' },
        { text: 'Stores medicine details, dosage, frequency, and instructions in one unified cabinet.' },
        { text: 'Implemented', options: { color: C_GREEN, bold: true, align: 'center' } }
      ],
      [
        { text: 'Medication Scheduling' },
        { text: 'Allows configuring custom dose timings and frequencies linked directly to medicines.' },
        { text: 'Implemented', options: { color: C_GREEN, bold: true, align: 'center' } }
      ],
      [
        { text: 'Automated Reminders' },
        { text: 'Reminder engine triggers visual alert notifications when dose times become due.' },
        { text: 'Implemented', options: { color: C_GREEN, bold: true, align: 'center' } }
      ],
      [
        { text: 'Dose Adherence Tracking' },
        { text: 'Allows patients to record whether scheduled doses were Taken or Missed.' },
        { text: 'Implemented', options: { color: C_GREEN, bold: true, align: 'center' } }
      ],
      [
        { text: 'Adherence History Log' },
        { text: 'Maintains an auditable 30-day chronological record of dose events in MySQL.' },
        { text: 'Implemented', options: { color: C_GREEN, bold: true, align: 'center' } }
      ],
      [
        { text: 'Interactive Dashboard' },
        { text: 'Centralizes todays medication routine, progress counter, and compliance percentage.' },
        { text: 'Implemented', options: { color: C_GREEN, bold: true, align: 'center' } }
      ],
      [
        { text: 'Doctor-Contact Access' },
        { text: 'Provides stored doctor profiles, clinic hours, phone numbers, and appointment options.' },
        { text: 'Implemented', options: { color: C_GREEN, bold: true, align: 'center' } }
      ]
    ];

    slide.addTable(resRows, {
      x: 0.8, y: 1.8, w: 11.73, h: 3.8,
      fontSize: 9, color: C_TEXT, border: { pt: 1, color: C_BORDER },
      colW: [3.8, 6.33, 1.6]
    });

    addCard(slide, 0.8, 5.85, 11.73, 1.15, C_TEAL, C_TEAL);
    slide.addText('REPORT FUNCTIONAL ANALYSIS:\n“The developed prototype demonstrates the core workflow of medication management, scheduled reminders, dose-status recording, and adherence history tracking. The system organizes medication tasks into an accessible digital routine.”', {
      x: 1.0, y: 6.0, w: 11.33, h: 0.85, fontSize: 10, bold: true, color: C_TEAL, lineSpacingMultiple: 1.2
    });
  }

  // ==========================================================
  // SLIDE 18: LIMITATIONS & FUTURE SCOPE
  // ==========================================================
  {
    const slide = pres.addSlide();
    slide.background = { color: C_BG };
    slide.addNotes("Chapter 7 notes current limitations: user data entry reliance, browser notification dependencies, self-reported adherence, non-diagnostic scope. Future scope: mobile app with push notifications, QR barcode scanning, refill alerts, caregiver access, and exportable reports.");
    addHeader(slide, 'Critical Appraisal', 'Limitations & Future Scope', 'Current operational boundaries and planned technical enhancements from Chapter 7.');

    // Limitations
    addCard(slide, 0.8, 1.8, 5.7, 4.8, C_BORDER, C_AMBER);
    slide.addText('Current System Limitations', { x: 1.0, y: 2.0, w: 5.3, h: 0.35, fontSize: 13, bold: true, color: C_TEXT });
    const limText = [
      { text: '✗  User Input Dependency:\n', options: { bold: true, color: C_AMBER } },
      { text: 'System depends on the user correctly entering medicine names, dosages, and schedules.\n\n', options: { color: C_MUTED } },
      { text: '✗  Notification Environment:\n', options: { bold: true, color: C_AMBER } },
      { text: 'Reminder delivery depends on active browser session, device permissions, and volume.\n\n', options: { color: C_MUTED } },
      { text: '✗  Self-Reported Adherence:\n', options: { bold: true, color: C_AMBER } },
      { text: 'Dose status is recorded based on user input; system cannot physically verify pill ingestion.\n\n', options: { color: C_MUTED } },
      { text: '✗  Non-Diagnostic Boundary:\n', options: { bold: true, color: C_AMBER } },
      { text: 'DoseTrack does not diagnose, prescribe, or provide medical advice; all clinical decisions stay with doctors.\n\n', options: { color: C_MUTED } },
      { text: '✗  Deployment Scope:\n', options: { bold: true, color: C_AMBER } },
      { text: 'Phase 1 operates as a responsive web system with scope for wider native mobile deployment.', options: { color: C_MUTED } }
    ];
    slide.addText(limText, { x: 1.0, y: 2.45, w: 5.3, h: 3.9, fontSize: 9.5, lineSpacingMultiple: 1.15 });

    // Future Scope
    addCard(slide, 6.83, 1.8, 5.7, 4.8, C_BORDER, C_TEAL);
    slide.addText('Future Scope & Planned Enhancements', { x: 7.03, y: 2.0, w: 5.3, h: 0.35, fontSize: 13, bold: true, color: C_TEXT });
    const futText = [
      { text: '✓  Mobile Application with Push Alerts:\n', options: { bold: true, color: C_TEAL } },
      { text: 'Dedicated Android & iOS app with native background push notifications and alarm daemons.\n\n', options: { color: C_MUTED } },
      { text: '✓  QR / Barcode Medicine Entry:\n', options: { bold: true, color: C_TEAL } },
      { text: 'Scan medicine packaging or prescription codes for automated drug name and dosage entry.\n\n', options: { color: C_MUTED } },
      { text: '✓  Medicine Refill Alerts:\n', options: { bold: true, color: C_TEAL } },
      { text: 'Automated supply tracking that alerts patients when medication inventory is running low.\n\n', options: { color: C_MUTED } },
      { text: '✓  Caregiver & Family Access:\n', options: { bold: true, color: C_TEAL } },
      { text: 'Real-time alerts sent to designated family members when critical doses are missed.\n\n', options: { color: C_MUTED } },
      { text: '✓  Exportable Clinical Reports:\n', options: { bold: true, color: C_TEAL } },
      { text: 'One-click PDF generation of 30-day adherence logs for consultation with doctors.', options: { color: C_MUTED } }
    ];
    slide.addText(futText, { x: 7.03, y: 2.45, w: 5.3, h: 3.9, fontSize: 9.5, lineSpacingMultiple: 1.15 });
  }

  // ==========================================================
  // SLIDE 19: CONCLUSION & THANK YOU
  // ==========================================================
  {
    const slide = pres.addSlide();
    slide.background = { color: C_BG };
    slide.addNotes("In conclusion, DoseTrack provides a centralized approach to medication management, scheduled reminders, adherence monitoring, and doctor contact access. We thank our guide Ms. Ansha MK and the Department of Computer Application. We now invite your questions and discussion.");
    addHeader(slide, 'Project Conclusion', 'Conclusion & Discussion', 'Project summary and evaluator viva discussion.');

    // Conclusion Box
    addCard(slide, 0.8, 1.8, 11.73, 1.8, C_BORDER, C_TEAL);
    slide.addText('Project Conclusion', { x: 1.0, y: 1.95, w: 11.33, h: 0.35, fontSize: 13, bold: true, color: C_TEXT });
    slide.addText('DoseTrack successfully delivers a centralized, accessible digital solution that resolves the persistent challenges of forgotten medication doses and scattered routines. By harmonizing medication scheduling, automated reminders, real-time Taken/Missed dose recording, adherence audit history, and direct doctor contact access, the application demonstrates that a practical web-based system can significantly improve daily treatment consistency and patient peace of mind.', {
      x: 1.0, y: 2.35, w: 11.33, h: 1.1, fontSize: 10.5, color: C_MUTED, lineSpacingMultiple: 1.3
    });

    // Thank You Big Banner
    slide.addText('THANK YOU', {
      x: 0.8, y: 3.8, w: 11.73, h: 0.9,
      fontSize: 40, bold: true, color: C_TEXT, align: 'center', fontFace: 'Arial'
    });
    slide.addText('Questions & Discussion', {
      x: 0.8, y: 4.75, w: 11.73, h: 0.4,
      fontSize: 16, bold: true, color: C_TEAL, align: 'center', fontFace: 'Arial'
    });

    // Academic Credentials Bar
    addCard(slide, 0.8, 5.4, 5.7, 1.4, C_BORDER);
    slide.addText('PRESENTED BY TEAM MEMBERS', { x: 1.0, y: 5.5, w: 5.3, h: 0.25, fontSize: 9, bold: true, color: C_TEAL });
    slide.addText('Mefa Rahiman  •  Shabana  •  Sreya S Jeevan  •  Gopika Babu\nDepartment of Computer Application · BCA S5', {
      x: 1.0, y: 5.8, w: 5.3, h: 0.8, fontSize: 10, bold: true, color: C_TEXT, lineSpacingMultiple: 1.2
    });

    addCard(slide, 6.83, 5.4, 5.7, 1.4, C_BORDER);
    slide.addText('INSTITUTION & AFFILIATION', { x: 7.03, y: 5.5, w: 5.3, h: 0.25, fontSize: 9, bold: true, color: C_BLUE });
    slide.addText('KMCT Institute of Emerging Technology and Management, Mukkam\nAffiliated to APJ Abdul Kalam Technological University (KTU)', {
      x: 7.03, y: 5.8, w: 5.3, h: 0.8, fontSize: 10, bold: true, color: C_TEXT, lineSpacingMultiple: 1.2
    });
  }

  const outPath = path.join(__dirname, 'public', 'DoseTrack_Mini_Project_Presentation.pptx');
  await pres.writeFile({ fileName: outPath });
  console.log('Saved presentation to:', outPath);

  // Also copy to Downloads so user has it directly
  const dlOut = path.join('c:\\Users\\DELL\\Downloads', 'DoseTrack_Mini_Project_Presentation_Official.pptx');
  try {
    fs.copyFileSync(outPath, dlOut);
    console.log('Copied official presentation to:', dlOut);
  } catch (e) {
    console.error('Could not copy to downloads:', e.message);
  }
}

buildPresentation().catch(err => {
  console.error('Build Error:', err);
  process.exit(1);
});
