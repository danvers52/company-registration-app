const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/company-registration')
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

const db = mongoose.connection;

// Setup function
async function setupTimeSeries() {
  try {
    console.log('Setting up Time-Series Collections...\n');

    // Drop existing collections if they exist
    try {
      await db.collection('attendance').drop();
      console.log('✓ Dropped existing attendance collection');
    } catch (e) {
      // Collection might not exist, that's fine
    }

    try {
      await db.collection('employees').drop();
      console.log('✓ Dropped existing employees collection');
    } catch (e) {
      // Collection might not exist, that's fine
    }

    // Create time-series collection for attendance
    await db.createCollection('attendance', {
      timeseries: {
        timeField: 'timestamp',
        metaField: 'metadata',
        granularity: 'minutes'
      }
    });
    console.log('✓ Created time-series collection: attendance');

    // Create regular collection for employees
    await db.createCollection('employees', {
      validator: {
        $jsonSchema: {
          bsonType: 'object',
          required: ['name', 'email', 'password', 'role'],
          properties: {
            name: { bsonType: 'string' },
            email: { bsonType: 'string' },
            password: { bsonType: 'string' },
            role: { enum: ['employee', 'admin'] },
            department: { bsonType: 'string' },
            profilePicture: { bsonType: 'string' },
            isActive: { bsonType: 'bool' }
          }
        }
      }
    });
    console.log('✓ Created collection: employees\n');

    // Create admin account
    const adminPassword = await bcrypt.hash('admin123', 10);
    const adminResult = await db.collection('employees').insertOne({
      name: 'Admin User',
      email: 'admin@company.com',
      password: adminPassword,
      role: 'admin',
      department: 'Management',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    console.log('✓ Created Admin Account:');
    console.log('  Email: admin@company.com');
    console.log('  Password: admin123\n');

    // Create local employee account
    const employeePassword = await bcrypt.hash('employee123', 10);
    const employeeResult = await db.collection('employees').insertOne({
      name: 'Local Employee',
      email: 'employee@company.com',
      password: employeePassword,
      role: 'employee',
      department: 'Operations',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    console.log('✓ Created Employee Account:');
    console.log('  Email: employee@company.com');
    console.log('  Password: employee123\n');

    // Create indexes for performance
    await db.collection('attendance').createIndex({ 'metadata.employeeId': 1, 'timestamp': -1 });
    await db.collection('employees').createIndex({ email: 1 }, { unique: true });
    console.log('✓ Created indexes for performance\n');

    console.log('✅ Time-Series setup completed successfully!');
    console.log('\nYou can now run: npm start');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error setting up time-series:', error.message);
    process.exit(1);
  }
}

// Run setup
setupTimeSeries();
