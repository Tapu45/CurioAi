import cron from 'node-cron';
import { buildKnowledgeGraph } from './graph-builder.js';
import { getAppConfig } from '../utils/config-manager.js';
import logger from '../utils/logger.js';

let graphBuildTask = null;
let isRunning = false;

// Start periodic graph building
function startGraphScheduler() {
    if (graphBuildTask) {
        logger.warn('Graph scheduler already started');
        return;
    }

    const appConfig = getAppConfig();
    const interval = appConfig.graphUpdateInterval || 1800000; // Default 30 minutes

    // Convert milliseconds to cron expression (every 30 minutes)
    // Cron format: "*/30 * * * *" = every 30 minutes
    const minutes = Math.floor(interval / 60000);
    const cronExpression = `*/${minutes} * * * *`;

    logger.info(`Starting graph scheduler with interval: ${minutes} minutes`);

    graphBuildTask = cron.schedule(cronExpression, async () => {
        if (isRunning) {
            logger.debug('Graph build already in progress, skipping...');
            return;
        }

        try {
            isRunning = true;
            logger.info('Starting scheduled graph build...');

            await buildKnowledgeGraph({
                conceptThreshold: 0.7,
                activityThreshold: 0.75,
                buildTopics: true,
                limit: 100,
            });

            logger.info('Scheduled graph build completed');
        } catch (error) {
            logger.error('Error in scheduled graph build:', error);
        } finally {
            isRunning = false;
        }
    });

    logger.info('Graph scheduler started');
}

// Stop graph scheduler
function stopGraphScheduler() {
    if (graphBuildTask) {
        graphBuildTask.stop();
        graphBuildTask = null;
        logger.info('Graph scheduler stopped');
    }
}

// Trigger manual graph build
async function triggerGraphBuild() {
    if (isRunning) {
        logger.warn('Graph build already in progress');
        return { success: false, message: 'Graph build already in progress' };
    }

    try {
        isRunning = true;
        logger.info('Triggering manual graph build...');

        const results = await buildKnowledgeGraph({
            conceptThreshold: 0.7,
            activityThreshold: 0.75,
            buildTopics: true,
            limit: 100,
        });

        logger.info('Manual graph build completed');
        return { success: true, results };
    } catch (error) {
        logger.error('Error in manual graph build:', error);
        return { success: false, error: error.message };
    } finally {
        isRunning = false;
    }
}

// Get scheduler status
function getSchedulerStatus() {
    return {
        isRunning,
        isScheduled: graphBuildTask !== null,
    };
}

export {
    startGraphScheduler,
    stopGraphScheduler,
    triggerGraphBuild,
    getSchedulerStatus,
};