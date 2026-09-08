import mongoose from 'mongoose';
import request from 'supertest';
import Employee from '../models/Employee.js'; 
import jwt from 'jsonwebtoken';
import app from '../server.js'

let adminToken;

// Connect once before all tests
beforeAll(async () => {
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'testsecret';

  //clear DB before seeding
  await Employee.deleteMany({});

  //seed admin
  const admin = await Employee.create({
    name: 'Shanel',
    email: 'shanel@example.com',
    password: 'Password123',
    role: 'admin'
  });

  adminToken = jwt.sign({id: admin._id}, process.env.JWT_SECRET);
});

// Disconnect after all tests
afterAll(async () => {
  await mongoose.disconnect();
});

describe('Auth API Integration Tests', () => {
  // 1. Signup with valid data
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

  // 2. Login with valid credentials
  it('should login successfully with correct credentials', async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .send({
        email: 'shanel@example.com',
        password: 'Password123',
      });

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(res.body.user).toHaveProperty('email', 'shanel@example.com');
  });

  it('should reject login with wrong password', async () => {
    const res = await request(app)
    .post('/api/auth/login')
    .send({
      email: 'shanel@example.com',
      password: 'WrongPassword'
    });
    expect(res.statusCode).toBe(401);
  });

  // 3. NoSQL injection attempt on login
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

  // 4. Signup with invalid role injection
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

  // 5. Signup with invalid email
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
