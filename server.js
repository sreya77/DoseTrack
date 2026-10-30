require('dotenv').config();
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const db = require('./src/db');
const { startReminderJob } = require('./src/reminders');
const { init: initDb } = require('./database/init_db');

const app = express();

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json({ limit: '20mb' }));

// Auth rate limiting (relaxed for development and smooth switching)
app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }));

// Health check
app.get('/api/health', async (req, res) => {
  try {
    await db.query('SELECT 1');
    res.json({ status: 'ok', database: 'connected' });
  } catch (err) {
    res.status(503).json({ status: 'error', database: 'unavailable', message: err.message });
  }
});

// Seed helper endpoint to quickly reset/seed demo data from UI
app.post('/api/seed-demo', async (req, res) => {
  try {
    const { init: initDb } = require('./database/init_db');
    await initDb();
    const { seed } = require('./database/seed_demo');
    await seed();
    res.json({ message: 'Demo data seeded successfully.' });
  } catch (err) {
    console.error('[Seed Demo Error]', err);
    res.status(500).json({ error: err.message });
  }
});

// API Routes
app.use('/api/auth', require('./src/routes/auth'));
app.use('/api/care-team', require('./src/routes/careTeam'));
app.use('/api/care-notes', require('./src/routes/careNotes'));
app.use('/api/alerts', require('./src/routes/alerts'));
app.use('/api/medications', require('./src/routes/prescriptionScanner'));
app.use('/api/medications', require('./src/routes/medications'));
app.use('/api/doses', require('./src/routes/doses'));
app.use('/api/doctors', require('./src/routes/doctors'));
app.use('/api/dashboard', require('./src/routes/dashboard'));

// Admin API
app.use('/api/admin', require('./src/routes/admin'));

// Static frontend
app.use(express.static(path.join(__dirname, 'public')));

// Admin frontend routes
app.get('/admin/login', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin', 'login.html')));
app.get(['/admin', '/admin/*'], (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin', 'index.html')));

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

// Global error handler
app.use((err, req, res, next) => {
  console.error('[Error]', err);
  if (err.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({ error: 'That record or email already exists.' });
  }
  const msg = err.sqlMessage || err.message || 'Server error.';
  res.status(500).json({
    error: process.env.NODE_ENV === 'production'
      ? (err.code?.startsWith('ER_') ? 'Database service is initializing or updating. Please try again in a few seconds.' : 'Something went wrong.')
      : msg
  });
});

const port = Number(process.env.PORT || 3000);

// Initialize DB schema on start and listen
(async () => {
  try {
    await initDb();
    console.log('[DoseTrack] Database schema ready.');
  } catch (e) {
    console.error('[DoseTrack] Schema auto-init error:', e);
  }

  app.listen(port, () => {
    console.log(`DoseTrack running at http://localhost:${port}`);
    startReminderJob();
  });
})();
