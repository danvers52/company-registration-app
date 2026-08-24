module.exports = {
    testEnvironment: 'jsdom',
    setupFiles: ['./jest.setup.js'],
    //ignore problematic node_modules from being transformed
    transformIgnorePatterns: [
        "/node_modules/(?!html-encoding-sniffer|whatwg-encoding)"
    ],
    transform: {
        "^.+\\.jsx?$": "babel-jest"
    }
};