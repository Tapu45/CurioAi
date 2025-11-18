import { ipcMain, BrowserWindow } from 'electron';
import { CHANNELS } from './channels.js';
import { getSyncManager } from '../services/sync/sync-manager.js';
import {
    getAllSyncConfigs,
    getSyncConfigById,
    addSyncConfig,
    updateSyncConfig,
    deleteSyncConfig,
} from '../services/sync/sync-config.js';
import logger from '../utils/logger.js';
import { getMainWindow } from '../windows/main-window.js';

/**
 * Register sync-related IPC handlers
 */
export function registerSyncHandlers() {
    const syncManager = getSyncManager();

    // Listen to sync manager events and forward to renderer
    syncManager.on('started', () => {
        const mainWindow = getMainWindow();
        if (mainWindow) {
            mainWindow.webContents.send(CHANNELS.FILE.SYNC_PROGRESS, {
                type: 'started',
            });
        }
    });

    syncManager.on('stopped', () => {
        const mainWindow = getMainWindow();
        if (mainWindow) {
            mainWindow.webContents.send(CHANNELS.FILE.SYNC_PROGRESS, {
                type: 'stopped',
            });
        }
    });

    syncManager.on('paused', () => {
        const mainWindow = getMainWindow();
        if (mainWindow) {
            mainWindow.webContents.send(CHANNELS.FILE.SYNC_PROGRESS, {
                type: 'paused',
            });
        }
    });

    syncManager.on('resumed', () => {
        const mainWindow = getMainWindow();
        if (mainWindow) {
            mainWindow.webContents.send(CHANNELS.FILE.SYNC_PROGRESS, {
                type: 'resumed',
            });
        }
    });

    syncManager.on('progress', (progress) => {
        const mainWindow = getMainWindow();
        if (mainWindow) {
            mainWindow.webContents.send(CHANNELS.FILE.SYNC_PROGRESS, {
                type: 'file-progress',
                ...progress,
            });
        }
    });

    // Start sync
    ipcMain.handle(CHANNELS.FILE.SYNC_START, async (event, options) => {
        try {
            await syncManager.start(options);
            return { success: true };
        } catch (error) {
            logger.error('Error starting sync:', error);
            throw error;
        }
    });

    // Stop sync
    ipcMain.handle(CHANNELS.FILE.SYNC_STOP, async () => {
        try {
            await syncManager.stop();
            return { success: true };
        } catch (error) {
            logger.error('Error stopping sync:', error);
            throw error;
        }
    });

    // Pause sync
    ipcMain.handle(CHANNELS.FILE.SYNC_PAUSE, async () => {
        try {
            syncManager.pause();
            return { success: true };
        } catch (error) {
            logger.error('Error pausing sync:', error);
            throw error;
        }
    });

    // Resume sync
    ipcMain.handle(CHANNELS.FILE.SYNC_RESUME, async () => {
        try {
            syncManager.resume();
            return { success: true };
        } catch (error) {
            logger.error('Error resuming sync:', error);
            throw error;
        }
    });

    // Get sync status
    ipcMain.handle(CHANNELS.FILE.SYNC_STATUS, async () => {
        try {
            return await syncManager.getStatus();
        } catch (error) {
            logger.error('Error getting sync status:', error);
            throw error;
        }
    });

    // Get sync configs
    ipcMain.handle(CHANNELS.FILE.SYNC_CONFIG_GET, async () => {
        try {
            return await getAllSyncConfigs();
        } catch (error) {
            logger.error('Error getting sync configs:', error);
            throw error;
        }
    });

    // Add sync config
    ipcMain.handle(CHANNELS.FILE.SYNC_CONFIG_ADD_PATH, async (event, config) => {
        try {
            const id = await addSyncConfig(config);
            return { success: true, id };
        } catch (error) {
            logger.error('Error adding sync config:', error);
            throw error;
        }
    });

    // Update sync config
    ipcMain.handle(CHANNELS.FILE.SYNC_CONFIG_UPDATE, async (event, id, updates) => {
        try {
            await updateSyncConfig(id, updates);
            return { success: true };
        } catch (error) {
            logger.error('Error updating sync config:', error);
            throw error;
        }
    });

    // Remove sync config
    ipcMain.handle(CHANNELS.FILE.SYNC_CONFIG_REMOVE_PATH, async (event, id) => {
        try {
            await deleteSyncConfig(id);
            return { success: true };
        } catch (error) {
            logger.error('Error removing sync config:', error);
            throw error;
        }
    });

    logger.info('Sync IPC handlers registered');
}