// test-main.js
import { app, BrowserWindow } from 'electron';
app.whenReady().then(() => {
    new BrowserWindow();
});