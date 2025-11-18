// Test setup for main process
process.env.NODE_ENV = 'test';

// Mock Electron APIs
global.app = {
    getPath: jest.fn((name) => `/tmp/test-${name}`),
    getVersion: jest.fn(() => '1.0.0'),
};

global.BrowserWindow = jest.fn();
global.dialog = {
    showOpenDialog: jest.fn(),
    showSaveDialog: jest.fn(),
};