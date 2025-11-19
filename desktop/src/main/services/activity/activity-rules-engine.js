import logger from '../utils/logger.js';
import { getAppConfig, updateAppConfig } from '../utils/config-manager.js';
import { checkSignificance } from '../filters/activity-significance-filter.js';

// Default tracking rules
const DEFAULT_RULES = {
    coding: {
        enabled: true,
        trackFileSwitches: false, // Aggregate file switches, don't track individually
        trackProjectChanges: true,
        minFileViewTime: 30, // seconds
        aggregateInSession: true,
    },
    reading: {
        enabled: true,
        trackEachFile: true, // Each PDF is meaningful
        trackReadingProgress: false, // Optional: track pages read
    },
    watching: {
        enabled: true,
        trackEachVideo: true, // Each video is meaningful
        minWatchTime: 120, // seconds (2 minutes)
    },
    browsing: {
        enabled: true,
        trackEachPage: false, // Aggregate pages by domain
        minPageViewTime: 10, // seconds
        aggregateInSession: true,
    },
    gaming: {
        enabled: true,
        trackEachSession: true, // Each game session is meaningful
    },
    shopping: {
        enabled: true,
        trackIndividualProducts: false, // Privacy: don't track products
        trackCategories: true,
    },
    social: {
        enabled: true,
        trackIndividualPosts: false, // Privacy: don't track posts
        trackTimeSpent: true,
    },
    entertainment: {
        enabled: true,
        trackMovies: true,
        trackMusic: false, // Optional
    },
    learning: {
        enabled: true,
        trackAll: true, // Track all learning activities
    },
    work: {
        enabled: true,
        trackFileSwitches: false,
        aggregateInSession: true,
    },
    other: {
        enabled: true,
        minTime: 5, // seconds
    },
};

/**
 * Apply tracking rules to activity
 * @param {Object} activity - Activity to check
 * @param {Object} lastActivity - Previous activity
 * @returns {Promise<Object>} - { shouldTrack: boolean, reason: string, rules: Object }
 */
async function applyRules(activity, lastActivity) {
    const activityType = activity.activity_type || activity.source_type || 'other';
    const rules = getRules();
    const typeRules = rules[activityType] || rules.other;

    // Check if activity type is enabled
    if (!typeRules.enabled) {
        return {
            shouldTrack: false,
            reason: `${activityType} tracking is disabled`,
            rules: typeRules,
        };
    }

    // Apply type-specific rules
    switch (activityType) {
        case 'coding':
            return await applyCodingRules(activity, lastActivity, typeRules);
        case 'reading':
            return await applyReadingRules(activity, lastActivity, typeRules);
        case 'watching':
            return await applyWatchingRules(activity, lastActivity, typeRules);
        case 'browsing':
            return await applyBrowsingRules(activity, lastActivity, typeRules);
        case 'gaming':
            return await applyGamingRules(activity, lastActivity, typeRules);
        case 'shopping':
            return await applyShoppingRules(activity, lastActivity, typeRules);
        default:
            return await applyGenericRules(activity, lastActivity, typeRules);
    }
}

/**
 * Apply coding-specific rules
 */
async function applyCodingRules(activity, lastActivity, rules) {
    // Check significance
    const significance = await checkSignificance(activity, lastActivity);

    if (!significance.isSignificant && !rules.trackFileSwitches) {
        return {
            shouldTrack: false,
            reason: `File switch not significant (${Math.round(significance.duration / 1000)}s) and file switches disabled`,
            rules,
        };
    }

    // Check if it's a project change
    if (rules.trackProjectChanges && lastActivity) {
        if (activity.project_name && lastActivity.project_name &&
            activity.project_name !== lastActivity.project_name) {
            return {
                shouldTrack: true,
                reason: 'Project change detected',
                rules,
            };
        }
    }

    return {
        shouldTrack: true,
        reason: 'Coding activity meets rules',
        rules,
    };
}

/**
 * Apply reading-specific rules
 */
async function applyReadingRules(activity, lastActivity, rules) {
    // Each PDF is meaningful
    if (rules.trackEachFile) {
        // Check if it's a different file
        if (lastActivity && activity.file_path === lastActivity.file_path) {
            return {
                shouldTrack: false,
                reason: 'Same PDF file, already tracked',
                rules,
            };
        }

        return {
            shouldTrack: true,
            reason: 'New PDF file',
            rules,
        };
    }

    return {
        shouldTrack: true,
        reason: 'Reading activity',
        rules,
    };
}

/**
 * Apply watching-specific rules
 */
async function applyWatchingRules(activity, lastActivity, rules) {
    if (rules.trackEachVideo) {
        // Check if it's a different video
        if (lastActivity && activity.video_id && lastActivity.video_id === activity.video_id) {
            // Same video - check watch time
            const significance = await checkSignificance(activity, lastActivity);
            if (significance.duration < rules.minWatchTime * 1000) {
                return {
                    shouldTrack: false,
                    reason: `Watch time (${Math.round(significance.duration / 1000)}s) below minimum (${rules.minWatchTime}s)`,
                    rules,
                };
            }
        }

        return {
            shouldTrack: true,
            reason: 'Video watching activity',
            rules,
        };
    }

    return {
        shouldTrack: true,
        reason: 'Watching activity',
        rules,
    };
}

/**
 * Apply browsing-specific rules
 */
async function applyBrowsingRules(activity, lastActivity, rules) {
    if (!rules.trackEachPage && rules.aggregateInSession) {
        // Don't track individual pages, aggregate in session
        // But still check significance for first page
        const significance = await checkSignificance(activity, lastActivity);
        if (!significance.isSignificant) {
            return {
                shouldTrack: false,
                reason: `Page view (${Math.round(significance.duration / 1000)}s) below threshold, will be aggregated`,
                rules,
            };
        }
    }

    return {
        shouldTrack: true,
        reason: 'Browsing activity',
        rules,
    };
}

/**
 * Apply gaming-specific rules
 */
async function applyGamingRules(activity, lastActivity, rules) {
    if (rules.trackEachSession) {
        // Check if it's a different game
        if (lastActivity && activity.game_name && lastActivity.game_name === activity.game_name) {
            return {
                shouldTrack: false,
                reason: 'Same game session, already tracked',
                rules,
            };
        }

        return {
            shouldTrack: true,
            reason: 'New game session',
            rules,
        };
    }

    return {
        shouldTrack: true,
        reason: 'Gaming activity',
        rules,
    };
}

/**
 * Apply shopping-specific rules
 */
async function applyShoppingRules(activity, lastActivity, rules) {
    // Don't track individual products for privacy
    if (!rules.trackIndividualProducts) {
        // Only track category-level browsing
        return {
            shouldTrack: true,
            reason: 'Shopping activity (category-level only)',
            rules,
        };
    }

    return {
        shouldTrack: true,
        reason: 'Shopping activity',
        rules,
    };
}

/**
 * Apply generic rules
 */
async function applyGenericRules(activity, lastActivity, rules) {
    const significance = await checkSignificance(activity, lastActivity);

    if (rules.minTime && significance.duration < rules.minTime * 1000) {
        return {
            shouldTrack: false,
            reason: `Duration (${Math.round(significance.duration / 1000)}s) below minimum (${rules.minTime}s)`,
            rules,
        };
    }

    return {
        shouldTrack: true,
        reason: 'Activity meets generic rules',
        rules,
    };
}

/**
 * Get all tracking rules
 */
function getRules() {
    const appConfig = getAppConfig();
    const customRules = appConfig.activityRules || {};

    // Merge with defaults
    const mergedRules = { ...DEFAULT_RULES };
    Object.keys(customRules).forEach(type => {
        if (mergedRules[type]) {
            mergedRules[type] = { ...mergedRules[type], ...customRules[type] };
        } else {
            mergedRules[type] = customRules[type];
        }
    });

    return mergedRules;
}

/**
 * Update rule for activity type
 */
function updateRule(activityType, ruleUpdates) {
    const appConfig = getAppConfig();
    if (!appConfig.activityRules) {
        appConfig.activityRules = {};
    }
    if (!appConfig.activityRules[activityType]) {
        appConfig.activityRules[activityType] = {};
    }

    appConfig.activityRules[activityType] = {
        ...appConfig.activityRules[activityType],
        ...ruleUpdates,
    };

    updateAppConfig(appConfig);
    logger.info(`Updated rules for ${activityType}:`, ruleUpdates);
}

/**
 * Enable/disable tracking for activity type
 */
function setTrackingEnabled(activityType, enabled) {
    updateRule(activityType, { enabled });
}

/**
 * Log filtered activity (for debugging)
 */
function logFilteredActivity(activity, reason) {
    logger.debug(`Activity filtered: ${activity.activity_type || 'unknown'} - ${reason}`, {
        app: activity.app_name,
        title: activity.window_title,
    });
}

export {
    applyRules,
    getRules,
    updateRule,
    setTrackingEnabled,
    logFilteredActivity,
    DEFAULT_RULES,
};