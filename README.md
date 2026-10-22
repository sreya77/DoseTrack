# DoseTrack ✚
> Connected Medication Care Platform for Patients, Guardians & Caretakers with AI-Powered Prescription Scanning.

DoseTrack is a full-stack medication management and adherence tracking platform designed to keep treatment routines, dose verifications, vital signs, and family alerts synchronized across the entire care circle.

---

## 🌟 Key Features

### 1. 👥 Multi-Role Connected Care Triangle
* **Patient Workspace (`patient@dosetrack.com` / `password123`)**:
  - Daily routine timeline with time badges and large 1-tap **"✓ Take Dose"** and **"Skip"** buttons.
  - Unique shareable **Patient Code** (`DT-PT-1001`) for connecting family guardians and nurses.
  - 🚨 **Emergency SOS Broadcast**: Instantly alerts all connected guardians and caretakers.
  - Health vitals snapshot and doctor directory.

* **Guardian Workspace (`guardian@dosetrack.com` / `password123`)**:
  - Remote adherence monitoring and live medication compliance feed.
  - 💬 **Gentle Reminders (Nudges)**: Send preset or custom hydration and meal alerts to the patient.
  - Review vitals recorded by the nurse, request clinic appointments, and manage prescriptions on behalf of the patient.

* **Caretaker / Nurse Workspace (`caretaker@dosetrack.com` / `password123`)**:
  - 📋 **Medication Administration Rounds**: Centralized schedule for all assigned patients with clinical sign-off tracking.
  - 📊 **Vitals & Clinical Observation Logger**: Record Blood Pressure (mmHg), Heart Rate (bpm), Blood Glucose (mg/dL), and Oxygen Saturation (SpO2) with clinical notes.
  - Multi-patient roster management and care circle synchronization.

### 2. ✨ AI-Powered Doctor Prescription Scanner
* **Instant Camera & Image Upload**: Snap a photo or upload prescription slips, doctor orders, or pharmacy labels (`capture="environment"` mobile camera support).
* **AI Vision Extraction**: Translates messy doctor handwriting and Latin abbreviations (`Sig`, `PO`, `bid`, `tid`, `qid`, `hs`, `prn`) into structured medication schedules.
* **Confidence-Aware Autofill**:
  - High confidence ($\ge 75\%$): Green verified badge with instant autofill.
  - Low confidence ($< 75\%$): Flags handwritten fields with amber borders and verification badges to signal user review.
* **Multi-Medication Detection**: Detects multiple medications on a single prescription with interactive card selectors.
* **HIPAA-Grade Privacy**: Images are processed in-memory as Base64 buffers with zero disk persistence.

---

## 🛠️ Technology Stack

- **Frontend**: Vanilla JavaScript (ES6+), HTML5 Semantic Structure, Custom CSS3 Design System with Glassmorphism and Responsive Micro-Animations.
- **Backend**: Node.js, Express.js (REST API, JWT Authentication, Rate Limiting, Helmet Security).
- **Database**: MySQL Server 8.4 (InnoDB, Relational Foreign Keys, Cascade Updates).
- **AI Vision Pipeline**: Google Gemini 1.5/2.0 Flash Vision REST API, OpenAI GPT-4o Vision, and Local Heuristic Engine.
- **Task Scheduler**: `node-cron` for automated reminder logging and dose event tracking.

---

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v20+)
- [MySQL Server](https://dev.mysql.com/downloads/mysql/) (v8+)

### Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/sreya77/DoseTrack.git
   cd DoseTrack
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure environment variables in `.env`:
   ```ini
   PORT=3000
   NODE_ENV=development
   JWT_SECRET=dosetrack_super_secret_jwt_key_2026_secure
   DB_HOST=127.0.0.1
   DB_PORT=3306
   DB_USER=root
   DB_PASSWORD=
   DB_NAME=dosetrack

   # Optional: Add your Vision AI API keys (supports Gemini or OpenAI)
   GEMINI_API_KEY=your_gemini_api_key_here
   OPENAI_API_KEY=your_openai_api_key_here
   ```

4. Database Setup:
   The database schema and multi-role migrations initialize automatically on server start:
   ```bash
   node database/seed_demo.js
   ```

5. Start the application:
   ```bash
   npm run dev
   ```
   Open **http://localhost:3000** in your browser.

---

## 🔑 Pre-Configured Demo Accounts (1-Click Login)

| Role | Email | Password | Name | Focus |
| :--- | :--- | :--- | :--- | :--- |
| **Patient** | `patient@dosetrack.com` | `password123` | Eleanor Vance (`DT-PT-1001`) | Daily schedule, dose tracking, SOS alert |
| **Guardian** | `guardian@dosetrack.com` | `password123` | David Vance (Son) | Remote adherence, gentle reminders, vitals review |
| **Caretaker** | `caretaker@dosetrack.com` | `password123` | Nurse Sarah Miller, RN | Clinical medication rounds, vitals logging |

---

## 📋 Database Schema
- `users`: Core profiles, roles (`patient`, `guardian`, `caretaker`), unique emails, and patient codes.
- `patient_connections`: Junction table linking guardians and caretakers to patients.
- `medications`: Prescriptions, dosages, frequencies, and duration intervals.
- `schedules`: Specific dose time slots linked to active medications.
- `dose_events`: Verification records of taken/missed doses with recorder audit trail.
- `care_notes`: Clinical observations, nursing notes, and JSON vitals recordings.
- `care_alerts`: Nudges, missed-dose alerts, vitals updates, and emergency SOS broadcasts.
- `doctors` & `appointment_requests`: Healthcare provider contacts and clinic appointment logs.

---

## ⚖️ Safety & Disclaimer
DoseTrack is a supportive reminder and record-keeping tool, not a diagnostic system. Always follow prescribing clinicians' instructions and verify prescriptions. In a medical emergency, immediately contact your local emergency services (e.g. 911 / 112).
