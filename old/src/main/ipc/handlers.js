import { ipcMain } from 'electron';
import { CHANNELS } from './channels.js';
import { getActivityStatus, pauseTracking, resumeTracking, getTodayActivityCount } from '../services/activity-tracker.js';
import { getSettings, updateSettings, getWhitelist, updateWhitelist } from '../services/settings-service.js';
import { getActivities, getSummary, deleteActivity } from '../storage/sqlite-db.js';
import logger from '../utils/logger.js';

// Activity handlers
function registerActivityHandlers() {
    ipcMain.handle(CHANNELS.ACTIVITY.GET_STATUS, async () => {
        try {
            const { getActivityStatus } = await import('../services/activity-tracker.js');
            return await getActivityStatus();
        } catch (error) {
            logger.error('Error getting activity status:', error);
            throw error;
        }
    });

    ipcMain.handle(CHANNELS.ACTIVITY.PAUSE, async () => {
        try {
            const { pauseTracking } = await import('../services/activity-tracker.js');
            await pauseTracking();
            return { success: true };
        } catch (error) {
            logger.error('Error pausing tracking:', error);
            throw error;
        }
    });

    ipcMain.handle(CHANNELS.ACTIVITY.RESUME, async () => {
        try {
            const { resumeTracking } = await import('../services/activity-tracker.js');
            await resumeTracking();
            return { success: true };
        } catch (error) {
            logger.error('Error resuming tracking:', error);
            throw error;
        }
    });

    ipcMain.handle(CHANNELS.ACTIVITY.GET_TODAY_COUNT, async () => {
        try {
            const { getTodayActivityCount } = await import('../services/activity-tracker.js');
            return await getTodayActivityCount();
        } catch (error) {
            logger.error('Error getting today count:', error);
            throw error;
        }
    });
}

// Settings handlers
function registerSettingsHandlers() {
    ipcMain.handle(CHANNELS.SETTINGS.GET, async () => {
        try {
            return await getSettings();
        } catch (error) {
            logger.error('Error getting settings:', error);
            throw error;
        }
    });

    ipcMain.handle(CHANNELS.SETTINGS.UPDATE, async (event, settings) => {
        try {
            return await updateSettings(settings);
        } catch (error) {
            logger.error('Error updating settings:', error);
            throw error;
        }
    });

    ipcMain.handle(CHANNELS.SETTINGS.GET_WHITELIST, async () => {
        try {
            return await getWhitelist();
        } catch (error) {
            logger.error('Error getting whitelist:', error);
            throw error;
        }
    });

    ipcMain.handle(CHANNELS.SETTINGS.UPDATE_WHITELIST, async (event, whitelist) => {
        try {
            return await updateWhitelist(whitelist);
        } catch (error) {
            logger.error('Error updating whitelist:', error);
            throw error;
        }
    });
}

// Database handlers
function registerDatabaseHandlers() {
    ipcMain.handle(CHANNELS.DB.GET_ACTIVITIES, async (event, filters) => {
        try {
            return await getActivities(filters);
        } catch (error) {
            logger.error('Error getting activities:', error);
            throw error;
        }
    });

    ipcMain.handle(CHANNELS.DB.GET_SUMMARY, async (event, activityId) => {
        try {
            return await getSummary(activityId);
        } catch (error) {
            logger.error('Error getting summary:', error);
            throw error;
        }
    });

    ipcMain.handle(CHANNELS.DB.DELETE_ACTIVITY, async (event, activityId) => {
        try {
            return await deleteActivity(activityId);
        } catch (error) {
            logger.error('Error deleting activity:', error);
            throw error;
        }
    });
}

// Graph handlers
function registerGraphHandlers() {
    ipcMain.handle(CHANNELS.GRAPH.GET_DATA, async () => {
        try {
            const { getGraphData } = await import('../services/database-service.js');
            return await getGraphData();
        } catch (error) {
            logger.error('Error getting graph data:', error);
            throw error;
        }
    });

    ipcMain.handle(CHANNELS.GRAPH.GET_RELATED, async (event, concept) => {
        try {
            const { getRelatedConcepts } = await import('../services/database-service.js');
            return await getRelatedConcepts(concept);
        } catch (error) {
            logger.error('Error getting related concepts:', error);
            throw error;
        }
    });

    ipcMain.handle(CHANNELS.GRAPH.GET_CONCEPT_DETAILS, async (event, conceptName) => {
        try {
            const { getConceptDetails } = await import('../services/graph-visualization.js');
            return await getConceptDetails(conceptName);
        } catch (error) {
            logger.error('Error getting concept details:', error);
            throw error;
        }
    });

    ipcMain.handle(CHANNELS.GRAPH.BUILD_GRAPH, async () => {
        try {
            const { triggerGraphBuild } = await import('../services/graph-scheduler.js');
            return await triggerGraphBuild();
        } catch (error) {
            logger.error('Error building graph:', error);
            throw error;
        }
    });

    ipcMain.handle(CHANNELS.GRAPH.GET_STATS, async () => {
        try {
            const { getGraphStatistics } = await import('../services/graph-builder.js');
            return await getGraphStatistics();
        } catch (error) {
            logger.error('Error getting graph stats:', error);
            throw error;
        }
    });

    ipcMain.handle(CHANNELS.GRAPH.GET_VISUALIZATION, async (event, options) => {
        try {
            const { getVisualizationData } = await import('../services/graph-visualization.js');
            return await getVisualizationData(options);
        } catch (error) {
            logger.error('Error getting visualization data:', error);
            throw error;
        }
    });
}

// Register all IPC handlers
function registerIpcHandlers() {
    registerActivityHandlers();
    registerSettingsHandlers();
    registerDatabaseHandlers();
    registerGraphHandlers();
    logger.info('All IPC handlers registered');
}

export { registerIpcHandlers };