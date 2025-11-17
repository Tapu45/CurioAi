import { getRAGChain } from './rag-chain.js';
import { insertChatMessage, getChatHistory } from '../storage/chat-history.js';
import logger from '../utils/logger.js';

// RAG-based chat response using LangChain
async function sendChatMessage(message, options = {}) {
    try {
        const {
            maxContextItems = 5,
            storeHistory = true,
            useMemory = true,
            filters = {},
        } = options;

        logger.info(`Processing chat message: "${message.substring(0, 50)}..."`);

        // Get RAG chain instance
        const ragChain = await getRAGChain({
            k: maxContextItems,
            useMemory,
        });

        // Invoke RAG chain
        const response = await ragChain.invoke(message, {
            filters,
            maxContextItems,
            includeMemory: useMemory,
        });

        // Store in chat history
        if (storeHistory) {
            try {
                await insertChatMessage({
                    role: 'user',
                    content: message,
                });
                await insertChatMessage({
                    role: 'assistant',
                    content: response.answer,
                    metadata: JSON.stringify({
                        sources: response.sources,
                        confidence: response.confidence,
                        contextUsed: response.contextUsed,
                        memoryUsed: response.memoryUsed,
                    }),
                });
            } catch (error) {
                logger.error('Failed to store chat history:', error);
                // Don't fail the request if history storage fails
            }
        }

        logger.info(`Chat response generated with ${response.contextUsed} context items, confidence: ${response.confidence}%`);
        return response;
    } catch (error) {
        logger.error('Error in chat service:', error);

        // Return a helpful error message
        return {
            answer: `I encountered an error while processing your question: ${error.message}. Please make sure the local AI service is running and try again.`,
            sources: [],
            confidence: 0,
            contextUsed: 0,
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

export { sendChatMessage, getChatHistoryFromDB };