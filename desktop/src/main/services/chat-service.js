import { getHybridQueryHandler } from './agents/hybrid-query-handler.js'; // Add import at top
import { insertChatMessage, getChatHistory } from '../storage/chat-history.js';
import logger from '../utils/logger.js';

// Hybrid chat response using Hybrid Handler
async function handleChatMessage(query, options = {}) {
    try {
        const {
            maxContextItems = 5,
            storeHistory = true,
            useMemory = true,
            filters = {},
        } = options;

        logger.info(`Processing chat message: "${query.substring(0, 50)}..."`);

        // Use hybrid query handler instead of direct RAG
        const hybridHandler = getHybridQueryHandler();
        await hybridHandler.initialize();

        const result = await hybridHandler.handleQuery(query, {
            filters,
            maxContextItems,
            useMemory,
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

export { handleChatMessage, getChatHistoryFromDB };