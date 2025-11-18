import { getClient } from '../../storage/sqlite-db.js';
import { analyzeImage } from './image-analyzer.js';
import { extractStructuredData } from './structured-extractor.js';
import { extractTables } from './table-extractor.js';
import logger from '../../utils/logger.js';

/**
 * Deep extraction service - orchestrates all deep extraction tasks
 */
class DeepExtractor {
    constructor() {
        this.cache = new Map(); // Cache extraction results
    }

    /**
     * Perform deep extraction on a file
     */
    async extract(fileId, filePath, fileType, options = {}) {
        try {
            const {
                extractStructured = true,
                analyzeImages = true,
                extractTables = true,
                forceReextract = false,
            } = options;

            // Check cache
            const cacheKey = `${fileId}_${filePath}`;
            if (!forceReextract && this.cache.has(cacheKey)) {
                logger.debug(`Using cached extraction for file ${fileId}`);
                return this.cache.get(cacheKey);
            }

            const results = {
                fileId,
                structuredData: null,
                imageAnalysis: null,
                tables: null,
            };

            // Extract structured data (tables, forms, key-value pairs)
            if (extractStructured && this.needsStructuredExtraction(fileType)) {
                try {
                    results.structuredData = await extractStructuredData(fileId, filePath, fileType);
                    logger.info(`Structured data extracted for file ${fileId}`);
                } catch (error) {
                    logger.error(`Error extracting structured data for file ${fileId}:`, error);
                }
            }

            // Analyze images
            if (analyzeImages && this.isImageFile(fileType)) {
                try {
                    results.imageAnalysis = await analyzeImage(fileId, filePath);
                    logger.info(`Image analysis completed for file ${fileId}`);
                } catch (error) {
                    logger.error(`Error analyzing image for file ${fileId}:`, error);
                }
            }

            // Extract tables
            if (extractTables && this.hasTables(fileType)) {
                try {
                    results.tables = await extractTables(fileId, filePath, fileType);
                    logger.info(`Tables extracted for file ${fileId}`);
                } catch (error) {
                    logger.error(`Error extracting tables for file ${fileId}:`, error);
                }
            }

            // Update file flags
            await this.updateFileFlags(fileId, results);

            // Cache results
            this.cache.set(cacheKey, results);

            return results;
        } catch (error) {
            logger.error(`Error in deep extraction for file ${fileId}:`, error);
            throw error;
        }
    }

    /**
     * Check if file needs structured extraction
     */
    needsStructuredExtraction(fileType) {
        const types = ['pdf', 'docx', 'xlsx', 'pptx'];
        return types.some(type => fileType.includes(type));
    }

    /**
     * Check if file is an image
     */
    isImageFile(fileType) {
        return fileType.startsWith('image/');
    }

    /**
     * Check if file likely contains tables
     */
    hasTables(fileType) {
        return ['pdf', 'xlsx', 'docx'].some(type => fileType.includes(type));
    }

    /**
     * Update file flags in database
     */
    async updateFileFlags(fileId, results) {
        try {
            const client = getClient();
            const updates = [];

            if (results.structuredData) {
                updates.push('structured_extracted = 1');
            }
            if (results.imageAnalysis) {
                updates.push('image_analyzed = 1');
            }

            if (updates.length > 0) {
                await client.execute(
                    `UPDATE files SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
                    [fileId]
                );
            }
        } catch (error) {
            logger.error('Error updating file flags:', error);
        }
    }

    /**
     * Clear cache
     */
    clearCache() {
        this.cache.clear();
    }
}

// Singleton instance
let deepExtractorInstance = null;

export function getDeepExtractor() {
    if (!deepExtractorInstance) {
        deepExtractorInstance = new DeepExtractor();
    }
    return deepExtractorInstance;
}