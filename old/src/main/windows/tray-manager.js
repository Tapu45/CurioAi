import { app, Tray, Menu, nativeImage } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url'; // <-- Add this
import logger from '../utils/logger.js';
import { pauseTracking, resumeTracking, getActivityStatus } from '../services/activity-tracker.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url)); // <-- Add this

let tray = null;

function setupTray(mainWindow) {
    // Create tray icon
    const iconPath = path.join(__dirname, '../../public/icon.png');
    const icon = nativeImage.createFromPath(iconPath);

    if (icon.isEmpty()) {
        // Fallback to a simple icon if image not found
        tray = new Tray(nativeImage.createEmpty());
    } else {
        tray = new Tray(icon);
    }

    // Create context menu with dynamic pause/resume
    const updateTrayMenu = async () => {
        const status = await getActivityStatus();
        const isPaused = status?.isPaused || false;
        const contextMenu = Menu.buildFromTemplate([
            {
                label: 'Show CurioAI',
                click: () => {
                    if (mainWindow) {
                        mainWindow.show();
                        mainWindow.focus();
                    }
                },
            },
            {
                label: isPaused ? 'Resume Tracking' : 'Pause Tracking',
                id: 'toggle-tracking',
                click: async () => {
                    try {
                        if (isPaused) {
                            await resumeTracking();
                        } else {
                            await pauseTracking();
                        }
                        updateTrayMenu(); // Refresh menu
                    } catch (error) {
                        logger.error('Error toggling tracking:', error);
                    }
                },
            },
            { type: 'separator' },
            {
                label: 'Settings',
                click: () => {
                    if (mainWindow) {
                        mainWindow.show();
                        mainWindow.focus();
                        // TODO: Navigate to settings page
                    }
                },
            },
            { type: 'separator' },
            {
                label: 'Quit',
                click: () => {
                    app.quit();
                },
            },
        ]);
        tray.setContextMenu(contextMenu);
    };

    // Initial menu setup
    updateTrayMenu();

    // Update menu every 5 seconds to reflect status changes
    setInterval(updateTrayMenu, 5000);

    tray.setToolTip('CurioAI - Personal Knowledge Graph');

    // Handle tray click
    tray.on('click', () => {
        if (mainWindow) {
            if (mainWindow.isVisible()) {
                mainWindow.hide();
            } else {
                mainWindow.show();
                mainWindow.focus();
            }
        }
    });

    logger.info('System tray setup complete');
    return tray;
}

function getTray() {
    return tray;
}

export {
    setupTray,
    getTray,
};