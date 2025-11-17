import activeWin from 'active-win';
import { BrowserWindow } from 'electron';
import { insertActivity, updateActivity } from '../storage/sqlite-db.js';
import { getWhitelist, getAppConfig, getPrivacyConfig } from '../utils/config-manager.js';
import { isLearningActivity, classifyActivity } from '../filters/activity-classifier.js';
import { checkWhitelist } from '../filters/whitelist-manager.js';
import logger from '../utils/logger.js';
import { getMainWindow } from '../windows/main-window.js';
import { extractContent } from './content-extractor.js';

let trackingInterval = null;
let isTracking = false;
let isPaused = false;
let lastActivity = null;
let lastWindowInfo = null;

// Start activity tracking
async function startTracking() {
    if (isTracking) {
        logger.warn('Tracking already started');
        return;
    }

    const privacyConfig = getPrivacyConfig();
    if (!privacyConfig.enableTracking) {
        logger.info('Tracking disabled in privacy settings');
        return;
    }

    isTracking = true;
    isPaused = false;

    const appConfig = getAppConfig();
    const interval = appConfig.trackingInterval || 60000; // Default 60 seconds

    logger.info(`Starting activity tracking with ${interval}ms interval`);

    // Run initial check
    await checkActivity();

    // Set up interval
    trackingInterval = setInterval(async () => {
        if (!isPaused) {
            await checkActivity();
        }
    }, interval);

    // Notify renderer
    notifyStatusChange();
}

// Stop activity tracking
function stopTracking() {
    if (!isTracking) {
        return;
    }

    if (trackingInterval) {
        clearInterval(trackingInterval);
        trackingInterval = null;
    }

    isTracking = false;
    isPaused = false;
    logger.info('Activity tracking stopped');

    // Notify renderer
    notifyStatusChange();
}

// Pause tracking
async function pauseTracking() {
    if (!isTracking) {
        return { success: false, message: 'Tracking not started' };
    }

    isPaused = true;
    logger.info('Activity tracking paused');

    // Notify renderer
    notifyStatusChange();

    return { success: true };
}

// Resume tracking
async function resumeTracking() {
    if (!isTracking) {
        return { success: false, message: 'Tracking not started' };
    }

    isPaused = false;
    logger.info('Activity tracking resumed');

    // Run immediate check
    await checkActivity();

    // Notify renderer
    notifyStatusChange();

    return { success: true };
}

// Check current activity
async function checkActivity() {
    try {
        const windowInfo = await activeWin();

        if (!windowInfo) {
            logger.debug('No active window detected');
            return;
        }

        // Check if window changed
        if (isSameWindow(windowInfo, lastWindowInfo)) {
            return; // Same window, skip
        }

        lastWindowInfo = windowInfo;

        // Extract window information
        const activity = {
            app_name: windowInfo.owner?.name || 'Unknown',
            window_title: windowInfo.title || '',
            url: extractUrl(windowInfo),
            timestamp: new Date().toISOString(),
        };

        // Check whitelist
        const whitelist = getWhitelist();
        if (!checkWhitelist(activity, whitelist)) {
            logger.debug('Activity not in whitelist:', activity.app_name, activity.window_title);
            return;
        }

        // Classify activity
        const classification = classifyActivity(activity);
        if (!isLearningActivity(classification)) {
            logger.debug('Activity classified as non-learning:', classification);
            return;
        }

        // Determine source type
        activity.source_type = determineSourceType(activity);

        // Store activity
        try {
            const activityId = await insertActivity(activity); // <-- add await
            logger.info(`Activity captured: ${activity.app_name} - ${activity.window_title} (ID: ${activityId})`);

            extractContent(activity)
                .then(async extractedActivity => {
                    // Update activity with extracted content
                    const { title, content, url } = extractedActivity;
                    await updateActivity(activityId, { title, content, url }); // <-- add await
                })
                .catch(error => {
                    logger.error('Error extracting content:', error);
                });

            lastActivity = {
                id: activityId,
                ...activity,
                classification,
            };

            // Notify renderer
            notifyActivityUpdate(lastActivity);
        } catch (error) {
            logger.error('Error storing activity:', error);
        }
    } catch (error) {
        logger.error('Error checking activity:', error);
    }
}

// Check if same window
function isSameWindow(current, previous) {
    if (!previous) return false;

    return (
        current.owner?.name === previous.owner?.name &&
        current.title === previous.title &&
        extractUrl(current) === extractUrl(previous)
    );
}

// Extract URL from window info
function extractUrl(windowInfo) {
    // Try to extract URL from title or owner
    const title = windowInfo.title || '';
    const owner = windowInfo.owner?.name || '';

    // Check if title contains URL pattern
    const urlPattern = /(https?:\/\/[^\s]+)/;
    const match = title.match(urlPattern);
    if (match) {
        return match[1];
    }

    // Check if it's a browser
    if (isBrowser(owner)) {
        // Try to extract from title (e.g., "Page Title - Browser")
        // This is a simple heuristic, will be improved with content extraction
        return null; // Will be extracted by content extractor
    }

    return null;
}

// Check if app is a browser
function isBrowser(appName) {
    const browsers = ['Google Chrome', 'Chromium', 'Firefox', 'Safari', 'Microsoft Edge', 'Brave'];
    return browsers.some(browser => appName.includes(browser));
}

// Determine source type
function determineSourceType(activity) {
    const appName = activity.app_name.toLowerCase();
    const title = activity.window_title.toLowerCase();

    if (isBrowser(appName)) {
        if (title.includes('youtube') || activity.url?.includes('youtube.com')) {
            return 'video';
        }
        return 'browser';
    }

    if (appName.includes('code') || appName.includes('studio') || appName.includes('idea')) {
        return 'code';
    }

    if (title.includes('.pdf') || appName.includes('pdf') || appName.includes('reader')) {
        return 'pdf';
    }

    if (appName.includes('notion') || appName.includes('obsidian') || appName.includes('word')) {
        return 'document';
    }

    return 'other';
}

// Get activity status
async function getActivityStatus() {
    const { getTodayActivityCount } = await import('../storage/sqlite-db.js');
    const todayCount = await getTodayActivityCount();

    return {
        isTracking,
        isPaused,
        lastActivity,
        todayCount,
    };
}

// Get today's activity count
async function getTodayActivityCount() {
    const { getTodayActivityCount: getCount } = await import('../storage/sqlite-db.js');
    return await getCount();
}

// Notify renderer of activity update
function notifyActivityUpdate(activity) {
    const mainWindow = getMainWindow();
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('activity:update', activity);
    }
}

// Notify renderer of status change
function notifyStatusChange() {
    const mainWindow = getMainWindow();
    if (mainWindow && !mainWindow.isDestroyed()) {
        getActivityStatus().then(status => {
            mainWindow.webContents.send('activity:status-change', status);
        });
    }
}

export {
    startTracking,
    stopTracking,
    pauseTracking,
    resumeTracking,
    getActivityStatus,
    getTodayActivityCount,
};