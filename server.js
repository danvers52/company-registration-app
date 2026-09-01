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

// Validate required environment variables on startup
const validateEnvironment = () => {
  const errors = [];
  
  if (!mongoUri || mongoUri.trim() === '') {
    errors.push('MONGODB_URI is not set or is empty');
  }
  
  if (!port || port <= 0 || port > 65535) {
    errors.push('PORT must be a valid port number (1-65535)');
  }
  
  if (!corsOrigin || corsOrigin.trim() === '') {
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

const connectToMongoDB = async () => {
  try {
    mongoConnectionAttempts++;
    console.log(`[${mongoConnectionAttempts}/${maxConnectionAttempts}] Attempting MongoDB connection...`);
    
    await mongoose.connect(mongoUri, {
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
      console.error(`  - MongoDB is running at ${mongoUri}`);
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
  console.warn('⚠ Mongoose disconnected from MongoDB');
});

// Connect to MongoDB
connectToMongoDB();

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

// Health check endpoint
app.get('/api/health', (req, res) => {
  const health = {
    status: mongoose.connection.readyState === 1 ? 'UP' : 'DOWN',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: env,
    mongodb: {
      connected: mongoose.connection.readyState === 1,
      state: ['disconnected', 'connected', 'connecting', 'disconnecting'][mongoose.connection.readyState],
    },
  };
  
  const statusCode = health.status === 'UP' ? 200 : 503;
  res.status(statusCode).json(health);
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
  console.error('❌ Error:', err.message);
  
  const status = err.status || 500;
  const message = process.env.NODE_ENV === 'production' 
    ? 'Internal Server Error' 
    : err.message;
  
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

// Start Server
const server = app.listen(port, () => {
  console.log(`✓ Server running on http://localhost:${port}`);
  console.log(`✓ Environment: ${env}`);
  console.log(`✓ Health check: GET /api/health`);
});

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
