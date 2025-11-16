import { BrowserWindow } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url'; // <-- Add this
import logger from '../utils/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url)); // <-- Add this

let mainWindow = null;

function createMainWindow() {
    // Create the browser window
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 800,
        minHeight: 600,
        show: false, // Don't show until ready
        frame: true,
        titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
        webPreferences: {
            preload: path.join(__dirname, '../preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
            enableRemoteModule: false,
        },
    });

    // Load the app
    if (process.env.NODE_ENV === 'development') {
        mainWindow.loadURL('http://localhost:3000');
        mainWindow.webContents.openDevTools();
    } else {
        mainWindow.loadFile(path.join(__dirname, '../../renderer/index.html'));
    }

    // Show window when ready
    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
        logger.info('Main window ready');
    });

    // Handle window closed
    mainWindow.on('closed', () => {
        mainWindow = null;
        logger.info('Main window closed');
    });

    // Handle navigation
    mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
        const parsedUrl = new URL(navigationUrl);
        if (parsedUrl.origin !== 'http://localhost:3000' && process.env.NODE_ENV === 'development') {
            event.preventDefault();
        }
    });

    return mainWindow;
}

function getMainWindow() {
    return mainWindow;
}

export {
    createMainWindow,
    getMainWindow,
};