const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const hpp = require('hpp');
const mongoSanitize = require('express-mongo-sanitize');
const { mongoUri, port, corsOrigin, env } = require('./utils/config');

const app = express();

// Security middleware
app.disable('x-powered-by');
app.use(helmet());
app.use(cors({ origin: corsOrigin, methods: ['GET', 'POST', 'PUT', 'DELETE'], allowedHeaders: ['Content-Type', 'Authorization'] }));
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: false, limit: '10kb' }));
app.use(hpp());
app.use(mongoSanitize());
app.use(express.static('public'));

const globalRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});

const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts, please try again later.' },
});

app.use(globalRateLimiter);
app.use('/api/auth', authRateLimiter);

// MongoDB Connection
mongoose.connect(mongoUri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('MongoDB connected'))
.catch((err) => console.log('MongoDB connection error:', err));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/employees', require('./routes/employees'));
app.use('/api/attendance', require('./routes/attendance'));
app.use('/api/export', require('./routes/export'));

const { archiveOldAuditLogs } = require('./utils/auditArchival');

const runAuditArchival = async () => {
  try {
    await archiveOldAuditLogs();
    console.log('Audit archival check completed');
  } catch (error) {
    console.error('Audit archival check failed:', error.message);
  }
};

(async () => {
  await runAuditArchival();
})();

setInterval(() => {
  runAuditArchival();
}, 24 * 60 * 60 * 1000);

// Basic route
app.get('/', (req, res) => {
  res.send('Company Registration App - API Server');
});

// Start Server
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
