import { generateEmbedding } from './ai-service-client.js';
import { querySimilarEmbeddings } from '../storage/lancedb-client.js';
import { getActivityById, getFileById } from '../storage/sqlite-db.js';
import logger from '../utils/logger.js';

// Perform semantic search with enhanced results
async function semanticSearch(query, options = {}) {
    try {
        const {
            limit = 10,
            filters = {},
            minSimilarity = 0.5,
        } = options;

        // Generate embedding for query
        const embeddingResult = await generateEmbedding(query);
        const queryEmbedding = embeddingResult.embedding;

        // Query LanceDB for similar embeddings
        const results = await querySimilarEmbeddings(
            queryEmbedding,
            limit * 2, // Get more results to filter by similarity
            filters
        );

        // Filter by similarity threshold and format results
        const filteredResults = results
            .filter((item) => {
                const similarity = 1 - item.distance;
                return similarity >= minSimilarity;
            })
            .slice(0, limit)
            .map((item) => {
                const similarity = 1 - item.distance;
                return {
                    id: item.id,
                    activityId: item.metadata?.activity_id,
                    summaryId: item.metadata?.summary_id,
                    fileId: item.metadata?.file_id,
                    chunkIndex: item.metadata?.chunk_index,
                    title: item.metadata?.title || 'Untitled',
                    summary: item.document,
                    similarity,
                    sourceType: item.metadata?.source_type || item.metadata?.file_type || 'unknown',
                    timestamp: item.metadata?.timestamp,
                    metadata: item.metadata,
                };
            });

        // Enrich with full data if available
        const enrichedResults = await Promise.all(
            filteredResults.map(async (result) => {
                // Try to get activity data
                if (result.activityId) {
                    try {
                        const activity = await getActivityById(result.activityId);
                        if (activity) {
                            return {
                                ...result,
                                activity: {
                                    url: activity.url,
                                    app_name: activity.app_name,
                                    window_title: activity.window_title,
                                },
                            };
                        }
                    } catch (error) {
                        logger.debug('Failed to load activity for search result:', error);
                    }
                }

                // Try to get file data
                if (result.fileId) {
                    try {
                        const file = await getFileById(result.fileId);
                        if (file) {
                            return {
                                ...result,
                                file: {
                                    path: file.path,
                                    name: file.name,
                                    type: file.type,
                                },
                            };
                        }
                    } catch (error) {
                        logger.debug('Failed to load file for search result:', error);
                    }
                }

                return result;
            })
        );

        logger.info(`Semantic search completed: ${enrichedResults.length} results for query "${query}"`);
        return enrichedResults;
    } catch (error) {
        logger.error('Error performing semantic search:', error);
        throw error;
    }
}

export { semanticSearch };