import { getHybridQueryHandler } from './agents/hybrid-query-handler.js';
import { insertChatMessage, getChatHistory } from '../storage/chat-history.js';
import logger from '../utils/logger.js';
import { SOURCE_TYPES } from './source-types.js';
import { getAgentStatusTracker } from './agents/agent-status-tracker.js'; // Add import
import { EventEmitter } from 'events'; // Add import

// Create event emitter for chat status
const chatEventEmitter = new EventEmitter();

// Hybrid chat response using Hybrid Handler
async function handleChatMessage(query, options = {}) {
    try {
        const {
            maxContextItems = 5,
            storeHistory = true,
            useMemory = true,
            filters = {},
            sourceType = SOURCE_TYPES.ALL,
        } = options;

        logger.info(`Processing chat message: "${query.substring(0, 50)}..." with source: ${sourceType}`);

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

        // Use hybrid query handler
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

// Get chat history
async function getChatHistoryFromDB(limit = 50) {
    try {
        return await getChatHistory(limit);
    } catch (error) {
        logger.error('Error getting chat history:', error);
        return [];
    }
}

export { handleChatMessage, getChatHistoryFromDB, chatEventEmitter };