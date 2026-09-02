export default {
  testEnvironment: 'node',
  setupFiles: ['<rootDir>/jest.setup.js'],
  transform: {}, // disable Babel transforms
  testTimeout: 30000, // 60 seconds
};
