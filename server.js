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
import Attendance from './models/Attendance.js';
import AuditLog from './models/AuditLog.js';
import AuditLogArchive from './models/AuditLogArchive.js';
import Company from './models/Company.js';

//routes
import authRoutes from './routes/auth.js';
import employeeRoutes from './routes/employees.js';
import attendanceRoutes from './routes/attendance.js';
import exportRoutes from './routes/export.js';

//express app
export const app = express();

// mount routes
app.use('/api/auth', authRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/export', exportRoutes);

// Security middleware
app.disable('x-powered-by');
app.use(helmet());
app.use(cors({ origin: config.corsOrigin, methods: ['GET', 'POST', 'PUT', 'DELETE'], allowedHeaders: ['Content-Type', 'Authorization'] }));
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

setInterval(() => {
  runAuditArchival();
}, 24 * 60 * 60 * 1000);

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

export const server = app.listen(config.port, () => {
  console.log(`✓ Server running on http://localhost:${config.port}`);
  console.log(`✓ Environment: ${config.env}`);
  console.log(`✓ Health check: GET /api/health`);
})

// Handle server errors
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`✗ Port ${port} is already in use`);
    process.exit(1);
  } else {
    console.error('✗ Server error:', err);
    process.exit(1);
  }
});

export default {
  mongoUri: process.env.MONGODB_URI || 'mongodb://mongo:27017/company_registration',
  port: process.env.PORT || 5000,
  corsOrigin: process.env.CORS_ORIGIN || '*',
  environment: process.env.NODE_ENV || 'development',
};
