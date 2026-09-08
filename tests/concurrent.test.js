import request from 'supertest';
import app from '../server.js';
import mongoose, { mongo } from 'mongoose';

beforeAll(async () => {
  const URI = process.env.MONGO_URI_TEST || 'mongodb://mongo:27017/company-registration-test';
  console.log('Connecting to MongoDB for tests:', URI);

  await mongoose.connect(URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
});

afterAll(async () => {
  await mongoose.connection.close();
});

describe('Concurrent Access Handling', () => {
  it('should allow two employees to clock in simultaneously', async () => {
    const empA = request(app)
      .post('/api/attendance/record')
      .send({ employeeId: 'empA', type: 'clock-in' })
      .set('Authorization', `Bearer ${process.env.EMP_A_TOKEN}`);

    const empB = request(app)
      .post('/api/attendance/record')
      .send({ employeeId: 'empB', type: 'clock-in' })
      .set('Authorization', `Bearer ${process.env.EMP_B_TOKEN}`);

    const [resA, resB] = await Promise.all([empA, empB]);

    expect(resA.status).toBe(201);
    expect(resB.status).toBe(201);
    expect(resA.body.attendance).toHaveProperty('employeeId', 'empA');
    expect(resB.body.attendance).toHaveProperty('employeeId', 'empB');
  });

  it('should allow employee clock-in while admin login simultaneously', async () => {
    const empC = request(app)
      .post('/api/attendance/record')
      .send({ employeeId: 'empC', type: 'clock-in' })
      .set('Authorization', `Bearer ${process.env.EMP_C_TOKEN}`);

    const adminLogin = request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@example.com', password: 'password123' });

    const [resEmp, resAdmin] = await Promise.all([empC, adminLogin]);

    expect(resEmp.status).toBe(201);
    expect(resAdmin.status).toBe(200);
    expect(resEmp.body.attendance).toHaveProperty('employeeId', 'empC');
    expect(resAdmin.body).toHaveProperty('token');
  });

  it('should reject duplicate clock-ins for the same employee at the same time', async () => {
    const empD1 = request(app)
      .post('/api/attendance/record')
      .send({ employeeId: 'empD', type: 'clock-in' })
      .set('Authorization', `Bearer ${process.env.EMP_D_TOKEN}`);

    const empD2 = request(app)
      .post('/api/attendance/record')
      .send({ employeeId: 'empD', type: 'clock-in' })
      .set('Authorization', `Bearer ${process.env.EMP_D_TOKEN}`);

    const [res1, res2] = await Promise.all([empD1, empD2]);

    // One should succeed, the other should fail
    const statuses = [res1.status, res2.status].sort();
    expect(statuses).toEqual([201, 400]); //code for duplicate user
    expect(res1.body.attendance?.employeeId || res2.body.attendance?.employeeId).toBe('empD');
  });
});
