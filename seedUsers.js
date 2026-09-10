//Seeding 50 users for performance test
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import Employee from './models/Employee.js';
import config from './utils/config.js';

(async () => {
  await mongoose.connect(config.mongoUri);

  const saltRounds = config.bcryptSaltRounds;
  const users = [];

  for (let i = 1; i <= 50; i++) {
    const hashedPassword = await bcrypt.hash(`Password${i}`, saltRounds);
    users.push({
      name: `Test User ${i}`,
      email: `user${i}@example.com`,
      password: hashedPassword,
      companyId: new mongoose.Types.ObjectId(), 
    });
  }

  await Employee.insertMany(users);
  console.log('✓ 50 test users seeded');
  process.exit(0);
})();
