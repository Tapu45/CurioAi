import logger from '../utils/logger.js';
import { getAppConfig } from '../utils/config-manager.js';

// Default significance thresholds (in milliseconds)
const DEFAULT_THRESHOLDS = {
    coding: 30 * 1000,        // 30 seconds
    browsing: 10 * 1000,      // 10 seconds
    watching: 2 * 60 * 1000,  // 2 minutes
    reading: 0,               // Always track (0 = always)
    gaming: 0,                // Always track
    shopping: 10 * 1000,      // 10 seconds
    social: 10 * 1000,        // 10 seconds
    learning: 10 * 1000,      // 10 seconds
    entertainment: 2 * 60 * 1000, // 2 minutes
    work: 30 * 1000,          // 30 seconds
    other: 5 * 1000,          // 5 seconds
};

// Track activity start times for duration calculation
const activityStartTimes = new Map();

/**
 * Check if activity is significant enough to track
 * @param {Object} activity - Activity object
 * @param {Object} lastActivity - Previous activity (if any)
 * @returns {Promise<Object>} - { isSignificant: boolean, reason: string, duration: number }
 */
async function checkSignificance(activity, lastActivity) {
    const activityType = activity.activity_type || activity.source_type || 'other';
    const thresholds = getThresholds();
    const threshold = thresholds[activityType] || thresholds.other;

    // Always track if threshold is 0
    if (threshold === 0) {
        return {
            isSignificant: true,
            reason: `${activityType} activities are always tracked`,
            duration: 0,
        };
    }

    // Calculate duration since last activity of same type
    const duration = calculateDuration(activity, lastActivity);

    // Check if duration meets threshold
    if (duration >= threshold) {
        return {
            isSignificant: true,
            reason: `Duration (${Math.round(duration / 1000)}s) meets threshold (${Math.round(threshold / 1000)}s)`,
            duration,
        };
    }

    // Check for significant changes (for coding activities)
    if (activityType === 'coding') {
        const hasSignificantChange = await checkSignificantChange(activity, lastActivity);
        if (hasSignificantChange) {
            return {
                isSignificant: true,
                reason: 'Significant change detected',
                duration,
            };
        }
    }

    return {
        isSignificant: false,
        reason: `Duration (${Math.round(duration / 1000)}s) below threshold (${Math.round(threshold / 1000)}s)`,
        duration,
    };
}

/**
 * Calculate duration since last activity
 * @param {Object} activity - Current activity
 * @param {Object} lastActivity - Previous activity
 * @returns {number} - Duration in milliseconds
 */
function calculateDuration(activity, lastActivity) {
    const activityKey = getActivityKey(activity);
    const startTime = activityStartTimes.get(activityKey);

    if (startTime) {
        const now = new Date();
        return now.getTime() - startTime.getTime();
    }

    // If no start time, check if same as last activity
    if (lastActivity && isSameActivity(activity, lastActivity)) {
        const lastTimestamp = new Date(lastActivity.timestamp || lastActivity.created_at);
        const now = new Date();
        return now.getTime() - lastTimestamp.getTime();
    }

    // New activity, record start time
    activityStartTimes.set(activityKey, new Date());
    return 0;
}

/**
 * Get unique key for activity (for tracking start time)
 */
function getActivityKey(activity) {
    const activityType = activity.activity_type || activity.source_type || 'other';

    if (activityType === 'coding') {
        return `${activityType}:${activity.project_name || activity.app_name}`;
    } else if (activityType === 'reading') {
        return `${activityType}:${activity.file_path || activity.window_title}`;
    } else if (activityType === 'watching') {
        return `${activityType}:${activity.video_id || activity.url}`;
    } else if (activityType === 'gaming') {
        return `${activityType}:${activity.game_name || activity.window_title}`;
    } else if (activity.url) {
        return `${activityType}:${activity.url}`;
    }

    return `${activityType}:${activity.app_name}:${activity.window_title}`;
}

/**
 * Check if two activities are the same
 */
function isSameActivity(activity1, activity2) {
    const key1 = getActivityKey(activity1);
    const key2 = getActivityKey(activity2);
    return key1 === key2;
}

/**
 * Check for significant changes in coding activity
 * (e.g., file change, project change, etc.)
 */
async function checkSignificantChange(activity, lastActivity) {
    if (!lastActivity) return false;

    // Different project = significant
    if (activity.project_name && lastActivity.project_name &&
        activity.project_name !== lastActivity.project_name) {
        return true;
    }

    // Different file = significant (but might be filtered by aggregator)
    if (activity.window_title && lastActivity.window_title &&
        activity.window_title !== lastActivity.window_title) {
        // Check if it's a meaningful file change (not just navigation)
        const currentFile = extractFileName(activity.window_title);
        const lastFile = extractFileName(lastActivity.window_title);

        if (currentFile && lastFile && currentFile !== lastFile) {
            return true;
        }
    }

    return false;
}

/**
 * Extract filename from window title
 */
function extractFileName(windowTitle) {
    const match = windowTitle.match(/([^\/\\]+\.(js|ts|jsx|tsx|py|java|cpp|c|h|html|css|json|md|go|rs|php|rb))(?:\s|$)/i);
    return match ? match[1] : null;
}

/**
 * Get thresholds from config or use defaults
 */
function getThresholds() {
    const appConfig = getAppConfig();
    const customThresholds = appConfig.activityThresholds || {};

    return {
        ...DEFAULT_THRESHOLDS,
        ...customThresholds,
    };
}

/**
 * Update threshold for activity type
 */
function updateThreshold(activityType, thresholdMs) {
    const appConfig = getAppConfig();
    if (!appConfig.activityThresholds) {
        appConfig.activityThresholds = {};
    }
    appConfig.activityThresholds[activityType] = thresholdMs;

    const { updateAppConfig } = require('../utils/config-manager.js');
    updateAppConfig(appConfig);

    logger.info(`Updated threshold for ${activityType}: ${thresholdMs}ms`);
}

/**
 * Clear activity start times (call periodically or on app close)
 */
function clearActivityStartTimes() {
    activityStartTimes.clear();
}

/**
 * Mark activity as started (call when activity begins)
 */
function markActivityStart(activity) {
    const key = getActivityKey(activity);
    activityStartTimes.set(key, new Date());
}

/**
 * Mark activity as ended (call when activity ends)
 */
function markActivityEnd(activity) {
    const key = getActivityKey(activity);
    activityStartTimes.delete(key);
}

export {
    checkSignificance,
    getThresholds,
    updateThreshold,
    clearActivityStartTimes,
    markActivityStart,
    markActivityEnd,
    calculateDuration,
};