import { globalShortcut } from 'electron';
import logger from './logger.js';
import { getMainWindow } from '../windows/main-window.js';
import { getActivityStatus, pauseTracking, resumeTracking } from '../services/activity-tracker.js';

function ensureUnregister(key) {
    try {
        if (globalShortcut.isRegistered(key)) {
            globalShortcut.unregister(key);
            logger.debug(`Unregistered existing shortcut: ${key}`);
        }
    } catch (err) {
        logger.warn('Error while unregistering existing shortcut:', key, err);
    }
}

function registerShortcuts() {
    // Toggle tracking (pause/resume)
    const toggleTrackingKey = 'CommandOrControl+Shift+T';
    ensureUnregister(toggleTrackingKey);
    const toggleTrackingRegistered = globalShortcut.register(toggleTrackingKey, async () => {
        try {
            const status = await getActivityStatus();
            if (status && status.isPaused) {
                await resumeTracking();
                logger.info('Tracking resumed via shortcut');
            } else {
                await pauseTracking();
                logger.info('Tracking paused via shortcut');
            }
        } catch (error) {
            logger.error('Error toggling tracking via shortcut:', error);
        }
    });
    logger.info(`Shortcut ${toggleTrackingKey} registered: ${toggleTrackingRegistered}`);

    // Show / Hide main window
    const toggleWindowKey = 'CommandOrControl+Shift+H';
    ensureUnregister(toggleWindowKey);
    const toggleWindowRegistered = globalShortcut.register(toggleWindowKey, () => {
        try {
            const win = getMainWindow();
            if (win) {
                if (win.isVisible()) {
                    win.hide();
                    logger.info('Main window hidden via shortcut');
                } else {
                    win.show();
                    win.focus();
                    logger.info('Main window shown via shortcut');
                }
            } else {
                logger.warn('Main window not available to toggle');
            }
        } catch (error) {
            logger.error('Error toggling main window via shortcut:', error);
        }
    });
    logger.info(`Shortcut ${toggleWindowKey} registered: ${toggleWindowRegistered}`);

    // Open preferences (same as menu)
    const openPreferencesKey = 'CommandOrControl+,';
    ensureUnregister(openPreferencesKey);
    const openPreferencesRegistered = globalShortcut.register(openPreferencesKey, () => {
        try {
            const win = getMainWindow();
            if (win && win.webContents) {
                win.show();
                win.focus();
                win.webContents.send('menu:open-preferences');
                logger.info('Open preferences requested via shortcut');
            } else {
                logger.warn('Main window not available to open preferences');
            }
        } catch (error) {
            logger.error('Error opening preferences via shortcut:', error);
        }
    });
    logger.info(`Shortcut ${openPreferencesKey} registered: ${openPreferencesRegistered}`);

    // Toggle DevTools (developer convenience)
    const toggleDevtoolsKey = 'CommandOrControl+Shift+I';
    ensureUnregister(toggleDevtoolsKey);
    const toggleDevtoolsRegistered = globalShortcut.register(toggleDevtoolsKey, () => {
        try {
            const win = getMainWindow();
            if (win && win.webContents) {
                win.webContents.toggleDevTools();
                logger.info('Toggled DevTools via shortcut');
            } else {
                logger.warn('Main window not available to toggle DevTools');
            }
        } catch (error) {
            logger.error('Error toggling devtools via shortcut:', error);
        }
    });
    logger.info(`Shortcut ${toggleDevtoolsKey} registered: ${toggleDevtoolsRegistered}`);

    // Export data (mirror menu)
    const exportDataKey = 'CommandOrControl+E';
    ensureUnregister(exportDataKey);
    const exportDataRegistered = globalShortcut.register(exportDataKey, () => {
        try {
            const win = getMainWindow();
            if (win && win.webContents) {
                win.show();
                win.focus();
                win.webContents.send('menu:export-data');
                logger.info('Export data requested via shortcut');
            } else {
                logger.warn('Main window not available to export data');
            }
        } catch (error) {
            logger.error('Error exporting data via shortcut:', error);
        }
    });
    logger.info(`Shortcut ${exportDataKey} registered: ${exportDataRegistered}`);

    logger.info('Shortcuts registered');
}

function unregisterShortcuts() {
    try {
        globalShortcut.unregisterAll();
        logger.info('Shortcuts unregistered');
    } catch (error) {
        logger.error('Error unregistering shortcuts:', error);
    }
}

export {
    registerShortcuts,
    unregisterShortcuts,
};