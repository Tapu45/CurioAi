import { querySimilarEmbeddings, getEmbeddingById } from '../storage/lancedb-client.js';
import { generateEmbedding } from './ai-service-client.js';
import { getActivities, getActivityById } from '../storage/sqlite-db.js';
import { getActivitiesBySession } from '../storage/sqlite-db.js';
import logger from '../utils/logger.js';
import { parse, format, subDays, startOfWeek, endOfWeek } from 'date-fns';

/**
 * Semantic search across all activities
 * @param {string} query - Natural language query
 * @param {Object} filters - Optional filters (activity_type, date_range, etc.)
 * @returns {Promise<Array>} - Array of matching activities with relevance scores
 */
async function searchActivities(query, filters = {}) {
    try {
        // Generate embedding for query
        const queryEmbedding = await generateEmbedding(query);

        if (!queryEmbedding || !queryEmbedding.embedding) {
            logger.error('Failed to generate query embedding');
            return [];
        }

        // Build filters for LanceDB
        const lancedbFilters = {};

        if (filters.activity_type) {
            lancedbFilters.activity_type = filters.activity_type;
        }

        if (filters.source_type) {
            lancedbFilters.source_type = filters.source_type;
        }

        if (filters.session_id) {
            lancedbFilters.session_id = filters.session_id;
        }

        if (filters.date_range) {
            // Date filtering will be done post-query for now
            // LanceDB doesn't have native date filtering in this version
        }

        // Perform vector search
        const searchResults = await querySimilarEmbeddings(
            queryEmbedding.embedding,
            filters.limit || 20,
            lancedbFilters
        );

        // Fetch full activity data for each result
        const activities = [];
        for (const result of searchResults) {
            try {
                const activity = await getActivityById(result.metadata.activity_id);
                if (activity) {
                    activities.push({
                        ...activity,
                        relevance: result.similarity,
                        distance: result.distance,
                        matchedText: result.document,
                    });
                }
            } catch (error) {
                logger.debug(`Error fetching activity ${result.metadata.activity_id}:`, error.message);
            }
        }

        // Apply date filtering if specified
        let filteredActivities = activities;
        if (filters.date_range) {
            const { startDate, endDate } = filters.date_range;
            filteredActivities = activities.filter(activity => {
                const activityDate = new Date(activity.timestamp || activity.created_at);
                return (!startDate || activityDate >= new Date(startDate)) &&
                    (!endDate || activityDate <= new Date(endDate));
            });
        }

        // Sort by relevance
        filteredActivities.sort((a, b) => (b.relevance || 0) - (a.relevance || 0));

        logger.info(`Semantic search found ${filteredActivities.length} activities for query: "${query}"`);

        return filteredActivities;
    } catch (error) {
        logger.error('Error in semantic search:', error);
        return [];
    }
}

/**
 * Find similar activities to a given activity
 * @param {number} activityId - Activity ID
 * @param {number} limit - Maximum number of results
 * @returns {Promise<Array>} - Array of similar activities
 */
async function findSimilarActivities(activityId, limit = 10) {
    try {
        // Get activity
        const activity = await getActivityById(activityId);
        if (!activity) {
            logger.warn(`Activity ${activityId} not found`);
            return [];
        }

        // Get embedding for this activity
        const embeddingId = `embedding_${activity.summary_id || activityId}`;
        const embeddingData = await getEmbeddingById(embeddingId);

        if (!embeddingData || !embeddingData.embedding) {
            logger.warn(`No embedding found for activity ${activityId}`);
            return [];
        }

        // Search for similar activities (exclude the current one)
        const results = await querySimilarEmbeddings(
            embeddingData.embedding,
            limit + 1, // Get one extra to exclude current
            {
                activity_id: { $ne: activityId },
            }
        );

        // Fetch full activity data
        const similarActivities = [];
        for (const result of results) {
            if (result.metadata.activity_id !== activityId) {
                const similarActivity = await getActivityById(result.metadata.activity_id);
                if (similarActivity) {
                    similarActivities.push({
                        ...similarActivity,
                        similarity: result.similarity,
                        distance: result.distance,
                    });
                }
            }
        }

        return similarActivities.slice(0, limit);
    } catch (error) {
        logger.error('Error finding similar activities:', error);
        return [];
    }
}

/**
 * Search by extracted concept
 * @param {string} concept - Concept name
 * @param {number} limit - Maximum number of results
 * @returns {Promise<Array>} - Array of activities containing the concept
 */
async function searchByConcept(concept, limit = 20) {
    try {
        // Use semantic search with concept as query
        return await searchActivities(concept, { limit });
    } catch (error) {
        logger.error('Error searching by concept:', error);
        return [];
    }
}

/**
 * Temporal search - search within date range
 * @param {string} query - Search query
 * @param {Date|string} startDate - Start date
 * @param {Date|string} endDate - End date
 * @returns {Promise<Array>} - Array of matching activities
 */
async function temporalSearch(query, startDate, endDate) {
    try {
        return await searchActivities(query, {
            date_range: {
                startDate: startDate instanceof Date ? startDate.toISOString() : startDate,
                endDate: endDate instanceof Date ? endDate.toISOString() : endDate,
            },
            limit: 50,
        });
    } catch (error) {
        logger.error('Error in temporal search:', error);
        return [];
    }
}

/**
 * Natural language query parser and executor
 * Supports queries like:
 * - "movie I watched 3 days ago"
 * - "React tutorials from last week"
 * - "PDFs I read this month"
 */
async function naturalLanguageSearch(query) {
    try {
        // Parse temporal expressions
        const temporalMatch = query.match(/(\d+)\s+(day|week|month|year)s?\s+ago/i);
        const relativeMatch = query.match(/(last|this)\s+(week|month|year|day)/i);
        const activityTypeMatch = query.match(/\b(movie|video|tutorial|pdf|book|game|code|project)\b/i);

        let startDate = null;
        let endDate = new Date();

        // Parse "X days ago"
        if (temporalMatch) {
            const amount = parseInt(temporalMatch[1]);
            const unit = temporalMatch[2];
            let daysAgo = 0;

            if (unit === 'day') daysAgo = amount;
            else if (unit === 'week') daysAgo = amount * 7;
            else if (unit === 'month') daysAgo = amount * 30;
            else if (unit === 'year') daysAgo = amount * 365;

            startDate = subDays(new Date(), daysAgo);
        }
        // Parse "last week/month/year"
        else if (relativeMatch) {
            const period = relativeMatch[2];
            if (period === 'week') {
                startDate = startOfWeek(subDays(new Date(), 7));
                endDate = endOfWeek(subDays(new Date(), 7));
            } else if (period === 'month') {
                startDate = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1);
                endDate = new Date(new Date().getFullYear(), new Date().getMonth(), 0);
            } else if (period === 'year') {
                startDate = new Date(new Date().getFullYear() - 1, 0, 1);
                endDate = new Date(new Date().getFullYear() - 1, 11, 31);
            }
        }

        // Determine activity type from query
        let activityType = null;
        if (activityTypeMatch) {
            const typeMap = {
                'movie': 'watching',
                'video': 'watching',
                'tutorial': 'watching',
                'pdf': 'reading',
                'book': 'reading',
                'game': 'gaming',
                'code': 'coding',
                'project': 'coding',
            };
            activityType = typeMap[activityTypeMatch[1].toLowerCase()];
        }

        // Build search query (remove temporal and type keywords)
        let searchQuery = query
            .replace(/(\d+)\s+(day|week|month|year)s?\s+ago/gi, '')
            .replace(/(last|this)\s+(week|month|year|day)/gi, '')
            .replace(/\b(movie|video|tutorial|pdf|book|game|code|project)\b/gi, '')
            .trim();

        if (!searchQuery) {
            searchQuery = query; // Use original if nothing left
        }

        // Perform search with filters
        const filters = {};
        if (startDate) {
            filters.date_range = { startDate, endDate };
        }
        if (activityType) {
            filters.activity_type = activityType;
        }

        return await searchActivities(searchQuery, filters);
    } catch (error) {
        logger.error('Error in natural language search:', error);
        return [];
    }
}

/**
 * Hybrid search - combines semantic, keyword, and temporal
 * @param {string} query - Search query
 * @param {Object} options - Search options
 * @returns {Promise<Array>} - Combined search results
 */
async function hybridSearch(query, options = {}) {
    try {
        const {
            activityType,
            dateRange,
            limit = 20,
            useKeyword = true,
            useSemantic = true,
        } = options;

        const results = [];

        // Semantic search
        if (useSemantic) {
            const semanticResults = await searchActivities(query, {
                activity_type: activityType,
                date_range: dateRange,
                limit: limit * 2, // Get more for ranking
            });
            results.push(...semanticResults.map(r => ({ ...r, source: 'semantic' })));
        }

        // Keyword search (simple text matching in titles/content)
        if (useKeyword) {
            const keywordResults = await keywordSearch(query, {
                activity_type: activityType,
                date_range: dateRange,
                limit: limit,
            });
            results.push(...keywordResults.map(r => ({ ...r, source: 'keyword' })));
        }

        // Deduplicate and rank
        const seen = new Set();
        const ranked = [];

        for (const result of results) {
            const key = `${result.id}_${result.source}`;
            if (!seen.has(result.id)) {
                seen.add(result.id);
                // Boost semantic results slightly
                if (result.source === 'semantic') {
                    result.relevance = (result.relevance || 0) * 1.1;
                }
                ranked.push(result);
            }
        }

        // Sort by relevance
        ranked.sort((a, b) => (b.relevance || 0) - (a.relevance || 0));

        return ranked.slice(0, limit);
    } catch (error) {
        logger.error('Error in hybrid search:', error);
        return [];
    }
}

/**
 * Simple keyword search in activity titles and content
 */
async function keywordSearch(query, filters = {}) {
    try {
        const activities = await getActivities(filters);
        const queryLower = query.toLowerCase();
        const keywords = queryLower.split(/\s+/);

        const matches = activities
            .filter(activity => {
                const title = (activity.title || activity.window_title || '').toLowerCase();
                const content = (activity.content || '').toLowerCase();
                const text = `${title} ${content}`;

                return keywords.some(keyword => text.includes(keyword));
            })
            .map(activity => ({
                ...activity,
                relevance: calculateKeywordRelevance(activity, keywords),
            }))
            .sort((a, b) => (b.relevance || 0) - (a.relevance || 0));

        return matches;
    } catch (error) {
        logger.error('Error in keyword search:', error);
        return [];
    }
}

/**
 * Calculate keyword relevance score
 */
function calculateKeywordRelevance(activity, keywords) {
    const title = (activity.title || activity.window_title || '').toLowerCase();
    const content = (activity.content || '').toLowerCase();
    const text = `${title} ${content}`;

    let score = 0;
    keywords.forEach(keyword => {
        // Title matches are worth more
        if (title.includes(keyword)) score += 2;
        if (content.includes(keyword)) score += 1;
    });

    return score / keywords.length;
}

export {
    searchActivities,
    findSimilarActivities,
    searchByConcept,
    temporalSearch,
    naturalLanguageSearch,
    hybridSearch,
    keywordSearch,
};