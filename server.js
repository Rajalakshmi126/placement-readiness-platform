require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const authRoutes = require('./routes/auth');
const roleRoutes = require('./routes/roles');
const resumeRoutes = require('./routes/resume');
const assessmentRoutes = require('./routes/assessment');
const reportRoutes = require('./routes/report');
const jobsRoutes = require('./routes/jobs');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve the frontend
app.use(express.static(path.join(__dirname, 'public')));

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/roles', roleRoutes);
app.use('/api/resume', resumeRoutes);
app.use('/api/assessment', assessmentRoutes);
app.use('/api/report', reportRoutes);
app.use('/api/jobs', jobsRoutes);

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// Fallback to index.html for any non-API route (simple multi-page app,
// but this keeps direct links to /dashboard etc. working if you later
// convert to client-side routing)
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Something went wrong on the server.' });
});

app.listen(PORT, () => {
  console.log(`🚀 Placement Readiness Platform running at http://localhost:${PORT}`);
});
