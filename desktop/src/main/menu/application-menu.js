import { Menu, app, shell } from 'electron';
import logger from '../utils/logger.js';

function setupApplicationMenu() {
    const template = [
        {
            label: 'File',
            submenu: [
                {
                    label: 'Export Data',
                    accelerator: 'CmdOrCtrl+E',
                    click: () => {
                        // TODO: Implement export data
                        logger.info('Export data clicked');
                    },
                },
                { type: 'separator' },
                {
                    label: 'Quit',
                    accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
                    click: () => {
                        app.quit();
                    },
                },
            ],
        },
        {
            label: 'Edit',
            submenu: [
                { role: 'undo', label: 'Undo' },
                { role: 'redo', label: 'Redo' },
                { type: 'separator' },
                { role: 'cut', label: 'Cut' },
                { role: 'copy', label: 'Copy' },
                { role: 'paste', label: 'Paste' },
            ],
        },
        {
            label: 'View',
            submenu: [
                { role: 'reload', label: 'Reload' },
                { role: 'forceReload', label: 'Force Reload' },
                { role: 'toggleDevTools', label: 'Toggle Developer Tools' },
                { type: 'separator' },
                { role: 'resetZoom', label: 'Actual Size' },
                { role: 'zoomIn', label: 'Zoom In' },
                { role: 'zoomOut', label: 'Zoom Out' },
                { type: 'separator' },
                { role: 'togglefullscreen', label: 'Toggle Full Screen' },
            ],
        },
        {
            label: 'Settings',
            submenu: [
                {
                    label: 'Preferences',
                    accelerator: 'CmdOrCtrl+,',
                    click: () => {
                        // TODO: Open settings window
                        logger.info('Preferences clicked');
                    },
                },
            ],
        },
        {
            label: 'Help',
            submenu: [
                {
                    label: 'About CurioAI',
                    click: () => {
                        // TODO: Show about dialog
                        logger.info('About clicked');
                    },
                },
                {
                    label: 'Documentation',
                    click: () => {
                        shell.openExternal('https://github.com/curioai/docs');
                    },
                },
            ],
        },
    ];

    // macOS specific menu adjustments
    if (process.platform === 'darwin') {
        template.unshift({
            label: app.getName(),
            submenu: [
                { role: 'about', label: 'About CurioAI' },
                { type: 'separator' },
                { role: 'services', label: 'Services' },
                { type: 'separator' },
                { role: 'hide', label: 'Hide CurioAI' },
                { role: 'hideOthers', label: 'Hide Others' },
                { role: 'unhide', label: 'Show All' },
                { type: 'separator' },
                { role: 'quit', label: 'Quit CurioAI' },
            ],
        });
    }

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
    logger.info('Application menu setup complete');
}

export { setupApplicationMenu };