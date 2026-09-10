import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import hpp from 'hpp';
import mongoSanitize from 'express-mongo-sanitize';

//utils and configs
import config from './utils/config.js';
import { archiveOldAuditLogs } from './utils/auditArchival.js';
import { requireCompanyForRequest, isSameCompany } from './utils/tenant.js';
import { isValidObjectId, isValidAttendanceType, isValidDateString, isNonEmptyString, sendError } from './utils/validators.js';

//models
import Employee from './models/Employee.js';
import ArchivedEmployee from './models/ArchivedEmployee.js';
import Attendance from './models/Attendance.js';
import AuditLog from './models/AuditLog.js';
import AuditLogArchive from './models/AuditLogArchive.js';
import Company from './models/Company.js';

//routes
import authRoutes from './routes/auth.js';
import employeeRoutes from './routes/employees.js';
import attendanceRoutes from './routes/attendance.js';
import exportRoutes from './routes/export.js';

//express app & parsing json
const app = express();
app.use(express.json());

// Security middleware
app.disable('x-powered-by');
app.use(helmet());
app.use(cors({ origin: config.corsOrigin, methods: ['GET', 'POST', 'PUT', 'DELETE'], allowedHeaders: ['Content-Type', 'Authorization'] }));
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: false, limit: '10kb' }));
app.use(hpp());
app.use(mongoSanitize());
app.use(express.static('public'));

app.get('/', (req, res) => {
  console.log('Employee route hit:', req.user);
  res.json({message: 'Employee route works'});
});

//Rate Limiters
//Global API limiter:
const globalRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, //15 minutes
  max: 200, //200 requests per window
  message: { error: 'More than 200 resquests occurred, please try again later after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

//Login limiter:
const authRateLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, //10 minutes
  max: 15, //5 login attempt per window
  message: { error: 'More than 5 login attempts occurred, please try again later after 10 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const exportRateLimiter = rateLimit ({
  windowMs: 15 * 60 * 1000, //15 minutes
  max: 10, //10 export requests per window
  message: {error: 'More than 10 export requests occurred, please try again later after 15 minutes.'},
  standardHeaders: true,
  legacyHeaders: false,
});

//rate limiters AFTER express.json
// mount remaining routes
app.use(globalRateLimiter);
app.use('/api/employees', globalRateLimiter, employeeRoutes);
app.use('/api/attendance', globalRateLimiter, attendanceRoutes);

app.use('/api/auth', authRateLimiter, authRoutes);
app.use('/api/export', exportRateLimiter, exportRoutes);

// Validate required environment variables on startup
export const validateEnvironment = () => {
  const errors = [];
  
  if (!config.mongoUri || config.mongoUri.trim() === '') {
    errors.push('MONGODB_URI is not set or is empty');
  }
  
  if (!config.port || config.port <= 0 || config.port > 65535) {
    errors.push('PORT must be a valid port number (1-65535)');
  }
  
  if (!config.corsOrigin || config.corsOrigin.trim() === '') {
    errors.push('CORS_ORIGIN is not set or is empty');
  }
  
  if (errors.length > 0) {
    console.error('❌ Environment Validation Failed:');
    errors.forEach(error => console.error(`   - ${error}`));
    process.exit(1);
  }
  
  console.log('✓ Environment variables validated successfully');
};

// Validate environment on startup
validateEnvironment();

// MongoDB Connection with enhanced error handling
let mongoConnectionAttempts = 0;
const maxConnectionAttempts = 5;

export const connectToMongoDB = async () => {
  try {
    mongoConnectionAttempts++;
    console.log(`[${mongoConnectionAttempts}/${maxConnectionAttempts}] Attempting MongoDB connection...`);
    
    await mongoose.connect(config.mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    
    console.log('✓ MongoDB connected successfully');
    return true;
  } catch (err) {
    console.error(`✗ MongoDB connection attempt ${mongoConnectionAttempts} failed:`, err.message);
    
    if (mongoConnectionAttempts < maxConnectionAttempts) {
      console.log(`  Retrying in 3 seconds...`);
      await new Promise(resolve => setTimeout(resolve, 3000));
      return connectToMongoDB();
    } else {
      console.error('✗ Failed to connect to MongoDB after 5 attempts');
      console.error('  Please check:');
      console.error(`  - MongoDB is running at ${config.mongoUri}`);
      console.error('  - MONGODB_URI environment variable is correct');
      console.error('  - Network connectivity to the database');
      process.exit(1);
    }
  }
};

// Connection event handlers
mongoose.connection.on('connected', () => {
  console.log('✓ Mongoose connected to MongoDB');
});

mongoose.connection.on('error', (err) => {
  console.error('✗ Mongoose connection error:', err.message);
});

mongoose.connection.on('disconnected', () => {
  console.warn('⚠ Mongoose disconnected from MongoDB. Retrying connection...');
});

mongoose.connection.on('reconnected', () => {
  console.log('⟳ MongoDB reconnected');
});

// Connect to MongoDB
connectToMongoDB();

//audit archival scheduler
export const runAuditArchival = async () => {
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

//graceful exit of program despite a timer loop
const auditArchivalInterval = setInterval(() => {
  runAuditArchival();
}, 24 * 60 * 60 * 1000);
auditArchivalInterval.unref();

// Health check endpoint
app.get('/api/health', (req, res) => {
  const health = {
    status: mongoose.connection.readyState === 1 ? 'UP' : 'DOWN',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV,
    mongodb: {
      connected: mongoose.connection.readyState === 1,
      state: ['disconnected', 'connected', 'connecting', 'disconnecting'][mongoose.connection.readyState],
    },
  };
  res.status(health.status === 'UP' ? 200 : 503).json(health);
});

// Basic route
app.get('/', (req, res) => {
  res.send('Company Registration App - API Server');
});

// 404 Not Found handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('✗ Error:', err.message);
  
  const status = err.status || 500;
  const message = process.env.NODE_ENV === 'production' ? 'Internal Server Error' : err.message;
  
  res.status(status).json({ 
    error: message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  mongoose.connection.close();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully...');
  mongoose.connection.close();
  process.exit(0);
});

//Start server
const server = config.env === 'test' ? null : app.listen(config.port, () => {
  console.log(`✓ Server running on http://localhost:${config.port}`);
  console.log(`✓ Environment: ${config.env}`);
  console.log(`✓ Health check: GET /api/health`);
});

// Handle server errors
if (server) {
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`✗ Port ${config.port} is already in use`);
      process.exit(1);
    } else {
      console.error('✗ Server error:', err);
      process.exit(1);
    }
  });
}

export default app;