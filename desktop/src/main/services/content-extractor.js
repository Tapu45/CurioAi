import { extractActivityContext } from './activity-context-extractor.js';
import { cleanText, normalizeText } from '../extractors/text-processor.js';
import { anonymizeActivity } from '../filters/privacy-filters.js';
import { getPrivacyConfig } from '../utils/config-manager.js';
import logger from '../utils/logger.js';
import { processContent as processWithAI } from './ai-service-client.js';

// Extract content based on activity type (enhanced with context extractor)
async function extractContent(activity) {
    try {
        // Use the new context extractor
        let extractedContent = await extractActivityContext(activity);

        // Clean and normalize text
        if (extractedContent.content) {
            extractedContent.content = cleanText(extractedContent.content);
            extractedContent.content = normalizeText(extractedContent.content);
        }

        // Apply privacy filters if enabled
        const privacyConfig = getPrivacyConfig();
        if (privacyConfig.removePII && extractedContent.content) {
            const anonymized = anonymizeActivity({
                content: extractedContent.content,
                title: extractedContent.title,
            });
            extractedContent.content = anonymized.content;
            extractedContent.title = anonymized.title;
        }

        // Process with AI service (async, don't block)
        if (extractedContent.content && extractedContent.content.length > 50) {
            const { processContent: processWithAI } = await import('./ai-service-client.js');
            const { storeActivityWithAI } = await import('./database-service.js');

            processWithAI(extractedContent.content, {
                title: extractedContent.title,
                generateSummary: true,
                generateEmbedding: true,
                extractConcepts: true,
            }).then(async (aiResult) => {
                // Store complete activity with AI results
                await storeActivityWithAI(activity, aiResult);
                logger.info('Activity stored with AI processing results');
            }).catch(error => {
                logger.error('Error processing content with AI:', error);
            });
        }

        // Update activity with extracted content
        activity.title = extractedContent.title || activity.title;
        activity.content = extractedContent.content;
        activity.url = extractedContent.url || activity.url;
        activity.metadata = { ...activity.metadata, ...extractedContent.metadata };

        logger.info(`Content extracted: ${extractedContent.content?.length || 0} characters`);

        return activity;
    } catch (error) {
        logger.error('Error extracting content:', error instanceof Error ? error : new Error(String(error)));
        // Return activity as-is if extraction fails
        return activity;
    }
}

export { extractContent };