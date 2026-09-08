import request from 'supertest';
import app from '../server.js';
import Employee from '../models/Employee.js';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';

let empAToken, empBToken, empCToken, adminToken;
let empAId, empBId, empCId, empDId;

beforeAll(async () => {
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'testsecret';

  //Clears DB once before seeding
  await Employee.deleteMany({});

  //Seeding employees
  const empA = await Employee.create({name: 'Emp A', email: 'empA@test.com', password: 'Password123', role: 'employee'});
  const empB = await Employee.create({name: 'Emp B', email: 'empB@test.com', password: 'Password123', role: 'employee'});
  const empC = await Employee.create({name: 'Emp C', email: 'empC@test.com', password: 'Password123', role: 'employee'});
  const admin = await Employee.create({name: 'Admin', email: 'admin@example.com', password: 'Password123', role: 'admin'});

  empAId = empA._id.toString();
  empBId = empB._id.toString();
  empCId = empC._id.toString();

  //Generate the tokens for logins
  empAToken = jwt.sign({id: empA._id}, process.env.JWT_SECRET);
  empBToken = jwt.sign({id: empB._id}, process.env.JWT_SECRET);
  empCToken = jwt.sign({id: empC._id}, process.env.JWT_SECRET);
  adminToken = jwt.sign({id: admin._id}, process.env.JWT_SECRET);
});

afterAll(async () => {
  await mongoose.disconnect();
});

describe('Concurrent Access Handling', () => {
  it('should allow two employees to clock in simultaneously', async () => {
    const empA = request(app)
      .post('/api/attendance/record')
      .send({ employeeId: empAId, type: 'clock-in' })
      .set('Authorization', `Bearer ${empAToken}`);

    const empB = request(app)
      .post('/api/attendance/record')
      .send({ employeeId: empBId, type: 'clock-in' })
      .set('Authorization', `Bearer ${empBToken}`);

    const [resA, resB] = await Promise.all([empA, empB]);

    expect(resA.status).toBe(201);
    expect(resB.status).toBe(201);
    expect(resA.body.attendance).toHaveProperty('employeeId', empAId);
    expect(resB.body.attendance).toHaveProperty('employeeId', empBId);
  });

  it('should allow employee clock-in while admin login simultaneously', async () => {
    const empC = request(app)
      .post('/api/attendance/record')
      .send({ employeeId: empCId, type: 'clock-in' })
      .set('Authorization', `Bearer ${empCToken}`);

    const adminLogin = request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@example.com', password: 'Password123' });

    const [resEmp, resAdmin] = await Promise.all([empC, adminLogin]);

    expect(resEmp.status).toBe(201);
    expect(resAdmin.status).toBe(200);
    expect(resEmp.body.attendance).toHaveProperty('employeeId', empCId);
    expect(resAdmin.body).toHaveProperty('token');
  });

  it('should reject duplicate clock-ins for the same employee at the same time', async () => {
    const empD = await Employee.create({name: 'Emp D', email: 'empD@test.com', password: 'Password123', role: 'employee'});
    empDId = empD._id.toString();

    const empDToken = jwt.sign({id: empD._id}, process.env.JWT_SECRET);

    const empD1 = request(app)
      .post('/api/attendance/record')
      .send({ employeeId: empDId, type: 'clock-in' })
      .set('Authorization', `Bearer ${empDToken}`);

    const empD2 = request(app)
      .post('/api/attendance/record')
      .send({ employeeId: empDId, type: 'clock-in' })
      .set('Authorization', `Bearer ${empDToken}`);

    const [res1, res2] = await Promise.all([empD1, empD2]);

    // One should succeed, the other should fail
    const statuses = [res1.status, res2.status].sort();
    expect(statuses).toEqual([201, 400]); //code for duplicate user
    expect(res1.body.attendance?.employeeId || res2.body.attendance?.employeeId).toBe(empDId);
  });
});
