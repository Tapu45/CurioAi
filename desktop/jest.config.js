module.exports = {
    testEnvironment: 'node',
    roots: ['<rootDir>/src/main'],
    testMatch: ['**/__tests__/**/*.js', '**/?(*.)+(spec|test).js'],
    collectCoverageFrom: [
        'src/main/**/*.js',
        '!src/main/**/*.spec.js',
        '!src/main/**/*.test.js',
        '!src/main/**/__tests__/**',
    ],
    coverageDirectory: 'coverage/main',
    coverageReporters: ['text', 'lcov', 'html'],
    coverageThreshold: {
        global: {
            branches: 60,
            functions: 60,
            lines: 60,
            statements: 60,
        },
    },
    moduleFileExtensions: ['js', 'json'],
    testTimeout: 10000,
    setupFilesAfterEnv: ['<rootDir>/src/main/tests/setup.js'],
};