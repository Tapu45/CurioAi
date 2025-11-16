import { BrowserWindow } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { is } from '@electron-toolkit/utils'; // Add this import
import logger from '../utils/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let mainWindow = null;

function createMainWindow() {
    // Create the browser window
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 800,
        minHeight: 600,
        show: false,
        frame: true,
        titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
        webPreferences: {
            preload: path.join(__dirname, '../preload/index.js'), // ✅ Fixed path
            nodeIntegration: false,
            contextIsolation: true,
            enableRemoteModule: false,
        },
    });

    // ✅ Use electron-vite's way to load renderer
    if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
        mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']);
        mainWindow.webContents.openDevTools();
    } else {
        mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
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
        if (is.dev) {
            const rendererUrl = process.env['ELECTRON_RENDERER_URL'];
            if (rendererUrl) {
                const parsedUrl = new URL(navigationUrl);
                const allowedOrigin = new URL(rendererUrl).origin;
                if (parsedUrl.origin !== allowedOrigin) {
                    event.preventDefault();
                }
            } else {
                event.preventDefault(); // Prevent navigation if no dev URL
            }
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