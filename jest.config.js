export default {
  testEnvironment: 'node',
  setupFiles: ['./jest.setup.js'],
  transform: {}, // disable Babel transforms
  testTimeout: 30000, // 60 seconds
};
