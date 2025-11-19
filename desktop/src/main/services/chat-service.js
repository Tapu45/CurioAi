import { getHybridQueryHandler } from './agents/hybrid-query-handler.js';
import { insertChatMessage, getChatHistory } from '../storage/chat-history.js';
import logger from '../utils/logger.js';
import { SOURCE_TYPES } from './source-types.js';
import { getAgentStatusTracker } from './agents/agent-status-tracker.js'; 
import { EventEmitter } from 'events'; 
import {
    naturalLanguageSearch,
    searchActivities,
    temporalSearch,
    searchByConcept,
} from './semantic-search-service.js';
import {
    generateDailySummary,
    generateWeeklyInsights,
    identifyLearningGaps,
    trackProgress,
} from './activity/activity-insights-engine.js';

// Create event emitter for chat status
const chatEventEmitter = new EventEmitter();


// Get chat history
async function getChatHistoryFromDB(limit = 50) {
    try {
        return await getChatHistory(limit);
    } catch (error) {
        logger.error('Error getting chat history:', error);
        return [];
    }
}


function isActivityQuery(query) {
    const activityKeywords = [
        'watched', 'read', 'coded', 'learned', 'did', 'activity', 'activities',
        'movie', 'video', 'tutorial', 'pdf', 'book', 'game', 'project',
        'yesterday', 'today', 'last week', 'last month', 'days ago',
        'remember', 'what did i', 'show me', 'find', 'search',
    ];

    const queryLower = query.toLowerCase();
    return activityKeywords.some(keyword => queryLower.includes(keyword));
}

/**
 * Handle activity-related queries using semantic search
 */
async function handleActivityQuery(query, options = {}) {
    try {
        logger.info(`Processing activity query: "${query.substring(0, 50)}..."`);

        // Use natural language search
        const searchResults = await naturalLanguageSearch(query);

        if (searchResults.length === 0) {
            return {
                answer: "I couldn't find any activities matching your query. Try asking about something you've done recently, like 'What movie did I watch?' or 'Show me React tutorials from last week.'",
                sources: [],
                method: 'activity-search',
                confidence: 0,
            };
        }

        // Format results for answer
        const topResults = searchResults.slice(0, 5);
        const answer = formatActivityAnswer(query, topResults);

        return {
            answer,
            sources: topResults.map(r => ({
                id: r.id,
                title: r.title || r.window_title,
                type: r.activity_type || r.source_type,
                timestamp: r.timestamp,
                relevance: r.relevance,
            })),
            method: 'activity-search',
            confidence: topResults[0]?.relevance || 0.5,
        };
    } catch (error) {
        logger.error('Error handling activity query:', error);
        return {
            answer: `I encountered an error searching your activities: ${error.message}`,
            sources: [],
            method: 'activity-search',
            confidence: 0,
        };
    }
}

/**
 * Format activity search results into natural language answer
 */
function formatActivityAnswer(query, results) {
    const queryLower = query.toLowerCase();

    // Movie/video queries
    if (queryLower.includes('movie') || queryLower.includes('video') || queryLower.includes('watched')) {
        if (results.length === 1) {
            const result = results[0];
            const date = new Date(result.timestamp).toLocaleDateString();
            return `You watched "${result.title || result.window_title}" on ${date}.`;
        } else {
            const titles = results.map(r => r.title || r.window_title).join(', ');
            return `You watched ${results.length} videos: ${titles}`;
        }
    }

    // PDF/book queries
    if (queryLower.includes('pdf') || queryLower.includes('book') || queryLower.includes('read')) {
        if (results.length === 1) {
            const result = results[0];
            const date = new Date(result.timestamp).toLocaleDateString();
            return `You read "${result.title || result.window_title}" on ${date}.`;
        } else {
            const titles = results.map(r => r.title || r.window_title).join(', ');
            return `You read ${results.length} documents: ${titles}`;
        }
    }

    // Learning queries
    if (queryLower.includes('learn') || queryLower.includes('tutorial')) {
        const concepts = [...new Set(results.map(r => r.metadata?.concepts || []).flat())];
        return `You learned about: ${concepts.slice(0, 5).join(', ')}${concepts.length > 5 ? '...' : ''}`;
    }

    // Generic answer
    if (results.length === 1) {
        const result = results[0];
        const date = new Date(result.timestamp).toLocaleDateString();
        return `I found: "${result.title || result.window_title}" from ${date}.`;
    } else {
        return `I found ${results.length} activities matching your query. The most relevant are: ${results.slice(0, 3).map(r => r.title || r.window_title).join(', ')}.`;
    }
}

/**
 * Handle insights queries (daily summary, weekly insights, etc.)
 */
async function handleInsightsQuery(query, options = {}) {
    try {
        const queryLower = query.toLowerCase();

        // Daily summary
        if (queryLower.includes('daily') || queryLower.includes('today') || queryLower.includes('day')) {
            const date = queryLower.includes('yesterday')
                ? new Date(Date.now() - 24 * 60 * 60 * 1000)
                : new Date();
            const summary = await generateDailySummary(date);

            return {
                answer: summary.aiSummary || summary.insights?.join('. ') || 'No summary available.',
                sources: [],
                method: 'insights',
                confidence: 0.8,
                metadata: summary,
            };
        }

        // Weekly insights
        if (queryLower.includes('week') || queryLower.includes('weekly')) {
            const weekStart = queryLower.includes('last week')
                ? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
                : new Date();
            const insights = await generateWeeklyInsights(weekStart);

            return {
                answer: insights.aiSummary || insights.patterns?.join('. ') || 'No insights available.',
                sources: [],
                method: 'insights',
                confidence: 0.8,
                metadata: insights,
            };
        }

        // Learning gaps
        if (queryLower.includes('gap') || queryLower.includes('not applied') || queryLower.includes('haven\'t coded')) {
            const gaps = await identifyLearningGaps();

            if (gaps.length === 0) {
                return {
                    answer: "Great! You've been applying what you learn. No learning gaps found.",
                    sources: [],
                    method: 'insights',
                    confidence: 0.9,
                };
            }

            const gapText = gaps.slice(0, 3).map(gap =>
                `- ${gap.concept}: ${gap.recommendation || 'Consider applying this in a project'}`
            ).join('\n');

            return {
                answer: `I found ${gaps.length} learning gaps where you watched tutorials but haven't applied the concepts yet:\n\n${gapText}`,
                sources: [],
                method: 'insights',
                confidence: 0.8,
                metadata: { gaps },
            };
        }

        // Focus areas
        if (queryLower.includes('focus') || queryLower.includes('recommend') || queryLower.includes('suggest')) {
            const focusAreas = await suggestFocusAreas();

            if (focusAreas.length === 0) {
                return {
                    answer: "Your learning is well-balanced. Keep up the good work!",
                    sources: [],
                    method: 'insights',
                    confidence: 0.7,
                };
            }

            const focusText = focusAreas.slice(0, 3).map(area =>
                `- ${area.area} (${area.priority} priority): ${area.reason}`
            ).join('\n');

            return {
                answer: `Based on your activity patterns, here are focus areas:\n\n${focusText}`,
                sources: [],
                method: 'insights',
                confidence: 0.8,
                metadata: { focusAreas },
            };
        }

        // Progress tracking
        const progressMatch = query.match(/progress (on|with|in) (.+)/i);
        if (progressMatch) {
            const topic = progressMatch[2];
            const progress = await trackProgress(topic);

            if (!progress) {
                return {
                    answer: `I couldn't find any activities related to "${topic}".`,
                    sources: [],
                    method: 'insights',
                    confidence: 0.5,
                };
            }

            return {
                answer: `Your progress on "${topic}": Watched ${progress.watchedCount} times, Applied ${progress.appliedCount} times. Application rate: ${progress.applicationRate.toFixed(1)}%`,
                sources: [],
                method: 'insights',
                confidence: 0.8,
                metadata: { progress },
            };
        }

        return null; // Not an insights query
    } catch (error) {
        logger.error('Error handling insights query:', error);
        return {
            answer: `Error generating insights: ${error.message}`,
            sources: [],
            method: 'insights',
            confidence: 0,
        };
    }
}

// Enhanced chat message handler
async function handleChatMessage(query, options = {}) {
    try {
        const {
            maxContextItems = 5,
            storeHistory = true,
            useMemory = true,
            filters = {},
            sourceType = SOURCE_TYPES.ALL,
        } = options;

        logger.info(`Processing chat message: "${query.substring(0, 50)}..."`);

        // NEW: Check if it's an activity query
        if (isActivityQuery(query)) {
            const activityResult = await handleActivityQuery(query, options);

            // Store in history
            if (storeHistory) {
                try {
                    await insertChatMessage({
                        role: 'user',
                        content: query,
                    });
                    await insertChatMessage({
                        role: 'assistant',
                        content: activityResult.answer,
                        metadata: JSON.stringify({
                            method: activityResult.method,
                            sources: activityResult.sources,
                        }),
                    });
                } catch (error) {
                    logger.error('Failed to store chat history:', error);
                }
            }

            return activityResult;
        }

        // NEW: Check if it's an insights query
        const insightsResult = await handleInsightsQuery(query, options);
        if (insightsResult) {
            if (storeHistory) {
                try {
                    await insertChatMessage({
                        role: 'user',
                        content: query,
                    });
                    await insertChatMessage({
                        role: 'assistant',
                        content: insightsResult.answer,
                        metadata: JSON.stringify({
                            method: insightsResult.method,
                        }),
                    });
                } catch (error) {
                    logger.error('Failed to store chat history:', error);
                }
            }

            return insightsResult;
        }

        // Status tracking
        const statusTracker = getAgentStatusTracker();
        const statusListener = (event, data) => {
            chatEventEmitter.emit('agent-status', data);
        };
        statusTracker.on('status', statusListener);
        statusTracker.on('reasoning', statusListener);
        statusTracker.on('toolCall', statusListener);
        statusTracker.on('progress', statusListener);
        statusTracker.on('complete', statusListener);
        statusTracker.on('error', statusListener);

        // Use hybrid query handler for other queries
        const hybridHandler = getHybridQueryHandler();
        await hybridHandler.initialize();

        const result = await hybridHandler.handleQuery(query, {
            filters,
            maxContextItems,
            useMemory,
            sourceType,
        });

        // Store in chat history
        if (storeHistory) {
            try {
                await insertChatMessage({
                    role: 'user',
                    content: query,
                });
                await insertChatMessage({
                    role: 'assistant',
                    content: result.answer,
                    metadata: JSON.stringify({
                        sources: result.sources,
                        method: result.method,
                        toolCalls: result.toolCalls,
                        confidence: result.confidence,
                        routing: result.routing,
                    }),
                });
            } catch (error) {
                logger.error('Failed to store chat history:', error);
            }
        }

        logger.info(`Chat response generated with method: ${result.method}, confidence: ${result.confidence}%`);

        // Cleanup listeners
        statusTracker.removeAllListeners();

        return {
            answer: result.answer,
            sources: result.sources || [],
            method: result.method || 'rag',
            toolCalls: result.toolCalls || [],
            confidence: result.confidence || 0,
            routing: result.routing,
        };
    } catch (error) {
        logger.error('Error in chat service:', error);
        return {
            answer: `I encountered an error while processing your question: ${error.message}. Please make sure the local AI service is running and try again.`,
            sources: [],
            confidence: 0,
            method: 'error',
            toolCalls: [],
            routing: null,
            error: true,
        };
    }
}

export { handleChatMessage, getChatHistoryFromDB, chatEventEmitter };