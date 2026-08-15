const dotenv = require('dotenv');

dotenv.config();

const NODE_ENV = process.env.NODE_ENV?.trim() || 'development';
const JWT_SECRET = process.env.JWT_SECRET?.trim();
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN?.trim() || '24h';
const MONGODB_URI = process.env.MONGODB_URI?.trim() || 'mongodb://localhost:27017/company-registration';
const PORT = process.env.PORT?.trim() || '5000';
const CORS_ORIGIN = process.env.CORS_ORIGIN?.trim() || 'http://localhost:5000';
const BCRYPT_SALT_ROUNDS = parseInt(process.env.BCRYPT_SALT_ROUNDS || '12', 10);

if (NODE_ENV === 'production' && !JWT_SECRET) {
  throw new Error('JWT_SECRET is required in production. Set JWT_SECRET in your environment variables.');
}

if (NODE_ENV === 'production' && JWT_SECRET && JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET must be at least 32 characters long in production.');
}

if (Number.isNaN(BCRYPT_SALT_ROUNDS) || BCRYPT_SALT_ROUNDS < 10) {
  throw new Error('BCRYPT_SALT_ROUNDS must be a number greater than or equal to 10.');
}

module.exports = {
  jwtSecret: JWT_SECRET || 'change_this_to_a_secure_key',
  jwtExpiresIn: JWT_EXPIRES_IN,
  mongoUri: MONGODB_URI,
  port: Number(PORT),
  env: NODE_ENV,
  isProduction: NODE_ENV === 'production',
  corsOrigin: CORS_ORIGIN,
  bcryptSaltRounds: BCRYPT_SALT_ROUNDS,
};
