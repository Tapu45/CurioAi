import { extractBrowserContent } from '../extractors/browser-extractor.js';
import { extractPDFContent } from '../extractors/pdf-extractor.js';
import { extractYouTubeTranscript } from '../extractors/youtube-extractor.js';
import { extractCodeContent } from '../extractors/code-extractor.js';
import { cleanText, normalizeText } from '../extractors/text-processor.js';
import { anonymizeActivity } from '../filters/privacy-filters.js';
import { getPrivacyConfig } from '../utils/config-manager.js';
import logger from '../utils/logger.js';
import { processContent as processWithAI } from './ai-service-client.js';

// Extract content based on activity type
async function extractContent(activity) {
    try {
        let extractedContent = {
            title: activity.window_title || '',
            content: '',
            url: activity.url || null,
            metadata: {},
        };

        const sourceType = activity.source_type || 'other';

        logger.info(`Extracting content for ${sourceType}: ${activity.app_name}`);

        switch (sourceType) {
            case 'browser':
                extractedContent = await extractBrowserContent(activity);
                break;
            case 'video':
                if (activity.url?.includes('youtube.com')) {
                    extractedContent = await extractYouTubeTranscript(activity);
                } else {
                    extractedContent = await extractBrowserContent(activity);
                }
                break;
            case 'pdf':
                extractedContent = await extractPDFContent(activity);
                break;
            case 'code':
                extractedContent = await extractCodeContent(activity);
                break;
            case 'document':
                extractedContent = {
                    title: activity.window_title || '',
                    content: '',
                    url: null,
                    metadata: {
                        app: activity.app_name,
                    },
                };
                break;
            default:
                logger.debug(`No specific extractor for source type: ${sourceType}`);
                extractedContent = {
                    title: activity.window_title || '',
                    content: '',
                    url: activity.url || null,
                    metadata: {},
                };
        }

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