import axios from 'axios';
import logger from '../utils/logger.js';
import { getAppConfig } from '../utils/config-manager.js';
import { classifyActivity as ruleBasedClassify } from '../filters/activity-classifier.js';

// Cache for recent classifications
const classificationCache = new Map();
const CACHE_SIZE = 100;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// AI service base URL
function getAIServiceURL() {
    const config = getAppConfig();
    return config.aiServiceURL || 'http://127.0.0.1:8000';
}

/**
 * Check if ML classifier is available
 * @returns {Promise<boolean>}
 */
async function isMLClassifierAvailable() {
    try {
        const response = await axios.get(`${getAIServiceURL()}/api/v1/classifier/status`, {
            timeout: 2000,
        });
        return response.data?.ml_available === true;
    } catch (error) {
        logger.debug('ML classifier not available, using rule-based:', error.message);
        return false;
    }
}

/**
 * Classify activity using ML (with fallback to rule-based)
 * @param {Object} activity - Activity object
 * @returns {Promise<Object>} - Classification result
 */
async function classifyActivityML(activity) {
    try {
        // Check cache first
        const cacheKey = `${activity.app_name}|${activity.window_title}|${activity.url || ''}`;
        const cached = classificationCache.get(cacheKey);

        if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
            logger.debug('Using cached classification');
            return cached.result;
        }

        // Check if ML classifier is available
        const mlAvailable = await isMLClassifierAvailable();

        if (!mlAvailable) {
            // Fallback to rule-based
            logger.debug('ML classifier not available, using rule-based');
            const result = ruleBasedClassify(activity);

            // Cache result
            cacheResult(cacheKey, result);
            return result;
        }

        // Use ML classifier
        try {
            const response = await axios.post(
                `${getAIServiceURL()}/api/v1/classify-activity`,
                {
                    app_name: activity.app_name || '',
                    window_title: activity.window_title || '',
                    url: activity.url || null,
                    content_snippet: activity.content?.substring(0, 200) || null,
                },
                {
                    timeout: 5000, // 5 second timeout
                }
            );

            const result = {
                type: response.data.activity_type || 'other',
                confidence: response.data.confidence || 0.5,
                reason: response.data.reason || 'ML classification',
                metadata: response.data.metadata || {},
            };

            // Cache result
            cacheResult(cacheKey, result);

            logger.debug(`ML classification: ${result.type} (confidence: ${result.confidence})`);
            return result;
        } catch (mlError) {
            // ML service error, fallback to rule-based
            logger.warn('ML classifier error, falling back to rule-based:', mlError.message);
            const result = ruleBasedClassify(activity);
            cacheResult(cacheKey, result);
            return result;
        }
    } catch (error) {
        logger.error('Error in ML classification:', error);
        // Always fallback to rule-based
        return ruleBasedClassify(activity);
    }
}

/**
 * Batch classify activities
 * @param {Array<Object>} activities - Array of activity objects
 * @returns {Promise<Array<Object>>} - Array of classification results
 */
async function batchClassifyActivities(activities) {
    try {
        const mlAvailable = await isMLClassifierAvailable();

        if (!mlAvailable || activities.length === 0) {
            // Fallback to rule-based for each
            return activities.map(activity => ruleBasedClassify(activity));
        }

        try {
            const response = await axios.post(
                `${getAIServiceURL()}/api/v1/batch-classify`,
                {
                    activities: activities.map(activity => ({
                        app_name: activity.app_name || '',
                        window_title: activity.window_title || '',
                        url: activity.url || null,
                        content_snippet: activity.content?.substring(0, 200) || null,
                    })),
                },
                {
                    timeout: 10000, // 10 second timeout for batch
                }
            );

            return response.data.results.map(result => ({
                type: result.activity_type || 'other',
                confidence: result.confidence || 0.5,
                reason: result.reason || 'ML batch classification',
                metadata: result.metadata || {},
            }));
        } catch (mlError) {
            logger.warn('ML batch classification error, falling back to rule-based:', mlError.message);
            return activities.map(activity => ruleBasedClassify(activity));
        }
    } catch (error) {
        logger.error('Error in batch ML classification:', error);
        return activities.map(activity => ruleBasedClassify(activity));
    }
}

/**
 * Cache classification result
 */
function cacheResult(key, result) {
    // Limit cache size
    if (classificationCache.size >= CACHE_SIZE) {
        // Remove oldest entry
        const firstKey = classificationCache.keys().next().value;
        classificationCache.delete(firstKey);
    }

    classificationCache.set(key, {
        result,
        timestamp: Date.now(),
    });
}

/**
 * Clear classification cache
 */
function clearCache() {
    classificationCache.clear();
}

export {
    classifyActivityML,
    batchClassifyActivities,
    isMLClassifierAvailable,
    clearCache,
};