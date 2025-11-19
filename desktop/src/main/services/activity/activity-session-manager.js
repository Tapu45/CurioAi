import { v4 as uuidv4 } from 'uuid';
import logger from '../utils/logger.js';
import {
    createSession,
    updateSession,
    closeSession,
    getActiveSession,
    getSessionById,
} from '../storage/sqlite-db.js';
import { extractProjectInfo } from '../extractors/code-extractor.js';
import aggregator from './activity/activity-aggregator.js';
import { getActivitiesBySession } from '../../storage/sqlite-db.js';

// Session timeout: 30 minutes in milliseconds
const SESSION_TIMEOUT_MS = 30 * 60 * 1000;

// Current active session state
let activeSession = null;
let lastActivityTime = null;

/**
 * Detect if activity belongs to current session or needs new session
 * @param {Object} activity - Current activity
 * @param {Object} lastActivity - Previous activity (if any)
 * @returns {Object} - { belongsToSession: boolean, sessionId: string | null }
 */
function detectSession(activity, lastActivity) {
    // If no active session, create new one
    if (!activeSession) {
        return { belongsToSession: false, sessionId: null };
    }

    // Check if session timed out
    const now = new Date();
    const timeSinceLastActivity = lastActivityTime
        ? now.getTime() - lastActivityTime.getTime()
        : SESSION_TIMEOUT_MS + 1;

    if (timeSinceLastActivity > SESSION_TIMEOUT_MS) {
        logger.debug('Session timed out, creating new session');
        return { belongsToSession: false, sessionId: null };
    }

    // Determine activity type (simplified, will be enhanced in Stage 2)
    const activityType = determineActivityType(activity);
    const lastActivityType = activeSession.activity_type;

    // Different activity types = new session
    if (activityType !== lastActivityType) {
        logger.debug(`Activity type changed from ${lastActivityType} to ${activityType}, creating new session`);
        return { belongsToSession: false, sessionId: null };
    }

    // Session detection rules based on activity type
    switch (activityType) {
        case 'coding':
            return detectCodingSession(activity, lastActivity);
        case 'browsing':
            return detectBrowsingSession(activity, lastActivity);
        case 'reading':
            return detectReadingSession(activity, lastActivity);
        case 'watching':
            return detectWatchingSession(activity, lastActivity);
        case 'gaming':
            return detectGamingSession(activity, lastActivity);
        default:
            // For other types, same app = same session
            return detectGenericSession(activity, lastActivity);
    }
}

/**
 * Determine activity type from activity data
 * @param {Object} activity
 * @returns {string}
 */
function determineActivityType(activity) {
    const appName = (activity.app_name || '').toLowerCase();
    const title = (activity.window_title || '').toLowerCase();
    const url = activity.url || '';
    const sourceType = activity.source_type || '';

    // Coding
    if (sourceType === 'code' || appName.includes('code') || appName.includes('studio')) {
        return 'coding';
    }

    // PDF Reading
    if (sourceType === 'pdf' || title.includes('.pdf') || appName.includes('pdf')) {
        return 'reading';
    }

    // Video watching
    if (sourceType === 'video' || url.includes('youtube.com') || url.includes('vimeo.com')) {
        return 'watching';
    }

    // Gaming (heuristic - can be improved)
    if (appName.includes('steam') || appName.includes('epic') ||
        title.match(/\b(game|gaming|play)\b/i)) {
        return 'gaming';
    }

    // Browsing
    if (sourceType === 'browser' || ['chrome', 'firefox', 'safari', 'edge'].some(b => appName.includes(b))) {
        return 'browsing';
    }

    return 'other';
}

/**
 * Detect coding session - same app + same project = same session
 */
function detectCodingSession(activity, lastActivity) {
    const currentProject = extractProjectInfo(activity);
    const lastProject = activeSession.project_name;

    // Same project name = same session
    if (currentProject.projectName && lastProject &&
        currentProject.projectName === lastProject) {
        return { belongsToSession: true, sessionId: activeSession.id };
    }

    // Same app but different project = new session
    return { belongsToSession: false, sessionId: null };
}

/**
 * Detect browsing session - same browser + same domain = same session
 */
function detectBrowsingSession(activity, lastActivity) {
    const currentDomain = extractDomain(activity.url);
    const lastDomain = extractDomain(activeSession.aggregated_urls?.[0]);

    // Same domain = same session (unless timeout)
    if (currentDomain && lastDomain && currentDomain === lastDomain) {
        return { belongsToSession: true, sessionId: activeSession.id };
    }

    return { belongsToSession: false, sessionId: null };
}

/**
 * Detect reading session - each PDF = separate session
 */
function detectReadingSession(activity, lastActivity) {
    // Each PDF file is a separate session
    const currentFile = activity.file_path || activity.window_title;
    const lastFile = activeSession.aggregated_files?.[0];

    if (currentFile && lastFile && currentFile === lastFile) {
        return { belongsToSession: true, sessionId: activeSession.id };
    }

    return { belongsToSession: false, sessionId: null };
}

/**
 * Detect watching session - each video = separate activity but can be in same browsing session
 */
function detectWatchingSession(activity, lastActivity) {
    // Each video is separate, but if it's part of browsing session, keep it
    const videoId = extractVideoId(activity.url);
    if (videoId) {
        // New video = new activity, but might be same browsing session
        return { belongsToSession: false, sessionId: null };
    }
    return detectBrowsingSession(activity, lastActivity);
}

/**
 * Detect gaming session - each game launch = new session
 */
function detectGamingSession(activity, lastActivity) {
    // Each game is a separate session
    return { belongsToSession: false, sessionId: null };
}

/**
 * Detect generic session - same app = same session
 */
function detectGenericSession(activity, lastActivity) {
    const currentApp = activity.app_name;
    const lastApp = activeSession.app_name;

    if (currentApp && lastApp && currentApp === lastApp) {
        return { belongsToSession: true, sessionId: activeSession.id };
    }

    return { belongsToSession: false, sessionId: null };
}

/**
 * Extract domain from URL
 */
function extractDomain(url) {
    if (!url) return null;
    try {
        const urlObj = new URL(url);
        return urlObj.hostname.replace('www.', '');
    } catch {
        return null;
    }
}

/**
 * Extract video ID from YouTube URL
 */
function extractVideoId(url) {
    if (!url) return null;
    const patterns = [
        /[?&]v=([^&]+)/,
        /youtu\.be\/([^?]+)/,
    ];
    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match) return match[1];
    }
    return null;
}

/**
 * Create new session
 * @param {Object} activity
 * @returns {Promise<Object>} - Session object
 */
async function createNewSession(activity) {
    const activityType = determineActivityType(activity);
    const sessionId = uuidv4();
    const now = new Date().toISOString();

    // Extract session-specific metadata
    let projectName = null;
    let aggregatedFiles = [];
    let aggregatedUrls = [];

    if (activityType === 'coding') {
        const projectInfo = extractProjectInfo(activity);
        projectName = projectInfo.projectName;
        if (activity.window_title) {
            aggregatedFiles = [activity.window_title];
        }
    } else if (activityType === 'reading') {
        const filePath = activity.file_path || activity.window_title;
        if (filePath) {
            aggregatedFiles = [filePath];
        }
    } else if (activityType === 'browsing' || activityType === 'watching') {
        if (activity.url) {
            aggregatedUrls = [activity.url];
        }
    }

    const session = {
        id: sessionId,
        activity_type: activityType,
        start_time: now,
        end_time: null,
        duration_seconds: null,
        project_name: projectName,
        aggregated_files: JSON.stringify(aggregatedFiles),
        aggregated_urls: JSON.stringify(aggregatedUrls),
        summary: null,
        concepts: null,
        confidence: null,
    };

    // Store in database
    await createSession(session);

    // Update active session state
    activeSession = session;
    lastActivityTime = new Date();

    logger.info(`Created new session: ${sessionId} (type: ${activityType})`);

    return session;
}

/**
 * Update existing session with new activity
 * @param {string} sessionId
 * @param {Object} activity
 */
async function updateExistingSession(sessionId, activity) {
    if (!activeSession || activeSession.id !== sessionId) {
        // Reload session from DB if needed
        activeSession = await getSessionById(sessionId);
        if (!activeSession) {
            logger.error(`Session ${sessionId} not found`);
            return;
        }
    }

    // Update aggregated data
    const activityType = activeSession.activity_type;
    let aggregatedFiles = JSON.parse(activeSession.aggregated_files || '[]');
    let aggregatedUrls = JSON.parse(activeSession.aggregated_urls || '[]');

    if (activityType === 'coding' && activity.window_title) {
        // Add file if not already present
        if (!aggregatedFiles.includes(activity.window_title)) {
            aggregatedFiles.push(activity.window_title);
        }
    } else if (activityType === 'browsing' && activity.url) {
        // Add URL if not already present
        if (!aggregatedUrls.includes(activity.url)) {
            aggregatedUrls.push(activity.url);
        }
    }

    // Update session in database
    await updateSession(sessionId, {
        aggregated_files: JSON.stringify(aggregatedFiles),
        aggregated_urls: JSON.stringify(aggregatedUrls),
    });

    // Update active session state
    activeSession.aggregated_files = JSON.stringify(aggregatedFiles);
    activeSession.aggregated_urls = JSON.stringify(aggregatedUrls);
    lastActivityTime = new Date();

    logger.debug(`Updated session: ${sessionId}`);
}

/**
 * Close current session
 * @param {string} sessionId
 * @param {Object} summary - Optional session summary
 */
async function closeCurrentSession(sessionId, summary = null) {
    if (!activeSession || activeSession.id !== sessionId) {
        activeSession = await getSessionById(sessionId);
    }

    if (!activeSession) {
        logger.error(`Session ${sessionId} not found for closing`);
        return;
    }

    const now = new Date();
    const startTime = new Date(activeSession.start_time);
    const durationSeconds = Math.floor((now.getTime() - startTime.getTime()) / 1000);

    // NEW: Aggregate session activities before closing
    try {
        const activities = await getActivitiesBySession(sessionId);
        if (activities && activities.length > 0) {
            const aggregated = await aggregator.aggregateSession(sessionId, activities);

            if (aggregated && aggregated.summary) {
                summary = summary || {};
                summary.summary = aggregated.summary;
            }
        }
    } catch (error) {
        logger.error(`Error aggregating session ${sessionId}:`, error);
    }

    await closeSession(sessionId, {
        end_time: now.toISOString(),
        duration_seconds: durationSeconds,
        summary: summary?.summary || null,
        concepts: summary?.concepts ? JSON.stringify(summary.concepts) : null,
    });

    logger.info(`Closed session: ${sessionId} (duration: ${durationSeconds}s)`);

    // Clear active session
    activeSession = null;
    lastActivityTime = null;
}

/**
 * Get current active session
 * @returns {Object|null}
 */
function getCurrentActiveSession() {
    return activeSession;
}

/**
 * Initialize session manager (call on app start)
 */
async function initializeSessionManager() {
    // Close any open sessions from previous run
    if (activeSession) {
        await closeCurrentSession(activeSession.id);
    }
    activeSession = null;
    lastActivityTime = null;
    logger.info('Session manager initialized');
}

/**
 * Get or create session for activity
 * @param {Object} activity
 * @param {Object} lastActivity
 * @returns {Promise<Object>} - Session object
 */
async function getOrCreateSession(activity, lastActivity) {
    const detection = detectSession(activity, lastActivity);

    if (detection.belongsToSession && detection.sessionId) {
        // Update existing session
        await updateExistingSession(detection.sessionId, activity);
        return activeSession;
    } else {
        // Close previous session if exists
        if (activeSession) {
            await closeCurrentSession(activeSession.id);
        }
        // Create new session
        return await createNewSession(activity);
    }
}

export {
    getOrCreateSession,
    getCurrentActiveSession,
    closeCurrentSession,
    initializeSessionManager,
    detectSession,
    determineActivityType,
};