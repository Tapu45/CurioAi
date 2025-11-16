import { app, BrowserWindow } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let mainWindow = null;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
        },
    });

    const isDev = process.env.NODE_ENV === 'development';
    const startUrl = isDev
        ? 'http://localhost:3000' // Change to your dev server port if using one
        : `file://${path.join(__dirname, '../../src/renderer/index.html')}`;

    mainWindow.loadFile(path.join(__dirname, '../../src/renderer/index.html'));
    mainWindow.webContents.openDevTools();
}

app.whenReady().then(() => {
    createWindow();
    app.on('activate', () => {
        if (mainWindow === null) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});