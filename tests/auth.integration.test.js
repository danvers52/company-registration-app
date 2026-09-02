import mongoose from 'mongoose';
import request from 'supertest';
import express from 'express';
import authRouter from '../routes/auth.js';
import config from '../utils/config.js';
import Employee from '../models/Employee.js'; // use Employee model

// Create Express app for testing
const app = express();
app.use(express.json());
app.use('/api/auth', authRouter);

// Resolve URI from env or fallback config
const uri = process.env.MONGO_URI_TEST || config.mongoUri;

// Connect once before all tests
beforeAll(async () => {
    console.log('Connecting to:', uri);
    try {
      await mongoose.connect(uri, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        serverSelectionTimeoutMS: 30000,
        socketTimeoutMS: 30000,
      });
      console.log('MongoDB connected successfully');
    } catch (err) {
      console.error('MongoDB connection error:', err.message);
      throw err;
    }
}, 90000);

// Clean up just the Employee collection before each test
beforeEach(async () => {
  await Employee.deleteMany({});
});

// Disconnect after all tests
afterAll(async () => {
  await mongoose.disconnect();
});

describe('Auth API Integration Tests', () => {
  // --- 1. Signup with valid data ---
  it('should signup a new employee successfully', async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .send({
        name: 'Shanel',
        email: 'shanel@example.com',
        password: 'Password123',
        role: 'admin'
      });
    expect(res.statusCode).toBe(201);
    expect(res.body.user).toHaveProperty('id');
    expect(res.body.user).toHaveProperty('email', 'shanel@example.com');
  });

  // --- 2. Login with valid credentials ---
  it('should login successfully with correct credentials', async () => {
    await request(app)
      .post('/api/auth/signup')
      .send({
        name: 'Shanel',
        email: 'shanel@example.com',
        password: 'Password123',
        role: 'admin'
      });

    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'shanel@example.com',
        password: 'Password123'
      });
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(res.body.user).toHaveProperty('email', 'shanel@example.com');
  });

  // --- 3. NoSQL injection attempt on login ---
  it('should reject NoSQL injection payloads', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: { "$gt": "" },
        password: "anything"
      });
    expect(res.statusCode).toBeGreaterThanOrEqual(400);
    expect(res.body).toHaveProperty('error');
  });

  // --- 4. Signup with invalid role injection ---
  it('should reject invalid role injection', async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .send({
        name: 'Amber',
        email: 'amber@example.com',
        password: 'Password123',
        role: { "$ne": "employee" }
      });
    expect(res.statusCode).toBeGreaterThanOrEqual(400);
    expect(res.body).toHaveProperty('error');
  });

  // --- 5. Signup with invalid email ---
  it('should reject invalid email format', async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .send({
        name: 'TestUser',
        email: 'not-an-email',
        password: 'Password123',
        role: 'admin'
      });
    expect(res.statusCode).toBeGreaterThanOrEqual(400);
    expect(res.body).toHaveProperty('error');
  });
});
