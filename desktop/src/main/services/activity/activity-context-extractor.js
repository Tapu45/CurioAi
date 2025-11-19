import { extractCodeContent } from '../extractors/code-extractor.js';
import { extractPDFContent } from '../extractors/pdf-extractor.js';
import { extractYouTubeTranscript } from '../extractors/youtube-extractor.js';
import { extractBrowserContent } from '../extractors/browser-extractor.js';
import { extractGameContent } from '../extractors/game-extractor.js';
import { extractShoppingContent } from '../extractors/shopping-extractor.js';
import logger from '../utils/logger.js';

/**
 * Orchestrate all extractors based on activity type
 * @param {Object} activity - Activity object with activity_type, source_type, etc.
 * @returns {Promise<Object>} - Enhanced activity with extracted context
 */
async function extractActivityContext(activity) {
    try {
        const activityType = activity.activity_type || activity.source_type || 'other';

        logger.info(`Extracting context for activity type: ${activityType}`);

        let extractedContent = {
            title: activity.window_title || '',
            content: '',
            url: activity.url || null,
            metadata: {},
        };

        // Route to appropriate extractor based on activity type
        switch (activityType) {
            case 'coding':
                extractedContent = await extractCodeContent(activity);
                break;

            case 'reading':
                extractedContent = await extractPDFContent(activity);
                break;

            case 'watching':
                if (activity.url?.includes('youtube.com')) {
                    extractedContent = await extractYouTubeTranscript(activity);
                } else {
                    extractedContent = await extractBrowserContent(activity);
                }
                break;

            case 'gaming':
                extractedContent = await extractGameContent(activity);
                break;

            case 'shopping':
                extractedContent = await extractShoppingContent(activity);
                break;

            case 'browsing':
                extractedContent = await extractBrowserContent(activity);
                break;

            case 'social':
            case 'entertainment':
            case 'work':
            case 'learning':
                // Use browser extractor for web-based activities
                if (activity.url) {
                    extractedContent = await extractBrowserContent(activity);
                }
                break;

            default:
                logger.debug(`No specific extractor for activity type: ${activityType}`);
                // Try to infer from source_type
                if (activity.source_type === 'code') {
                    extractedContent = await extractCodeContent(activity);
                } else if (activity.source_type === 'pdf') {
                    extractedContent = await extractPDFContent(activity);
                } else if (activity.source_type === 'video') {
                    extractedContent = await extractYouTubeTranscript(activity);
                } else if (activity.url) {
                    extractedContent = await extractBrowserContent(activity);
                }
        }

        // Merge extracted content into activity
        const enhancedActivity = {
            ...activity,
            title: extractedContent.title || activity.title || activity.window_title,
            content: extractedContent.content || activity.content || '',
            url: extractedContent.url || activity.url,
            metadata: {
                ...activity.metadata,
                ...extractedContent.metadata,
            },
        };

        // Validate extracted data
        validateExtractedData(enhancedActivity);

        logger.info(`Context extraction completed for: ${activityType}`);

        return enhancedActivity;
    } catch (error) {
        logger.error('Error in activity context extraction:', error);
        // Return activity as-is if extraction fails
        return activity;
    }
}

/**
 * Validate extracted data
 */
function validateExtractedData(activity) {
    // Check if essential fields are present
    if (!activity.title && !activity.window_title) {
        logger.warn('Activity missing title after extraction');
    }

    // Check metadata
    if (!activity.metadata) {
        activity.metadata = {};
    }

    // Ensure sourceType is set
    if (!activity.metadata.sourceType && activity.source_type) {
        activity.metadata.sourceType = activity.source_type;
    }
}

/**
 * Extract context for multiple activities (batch processing)
 * @param {Array<Object>} activities - Array of activity objects
 * @returns {Promise<Array<Object>>} - Array of enhanced activities
 */
async function batchExtractContext(activities) {
    const results = [];

    for (const activity of activities) {
        try {
            const enhanced = await extractActivityContext(activity);
            results.push(enhanced);
        } catch (error) {
            logger.error(`Error extracting context for activity ${activity.id}:`, error);
            results.push(activity); // Return original if extraction fails
        }
    }

    return results;
}

export {
    extractActivityContext,
    batchExtractContext,
    validateExtractedData,
};