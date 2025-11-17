import axios from 'axios';
import logger from '../utils/logger.js';
import { getAppConfig } from '../utils/config-manager.js';

const DEFAULT_AI_SERVICE_URL = 'http://127.0.0.1:8000';

// Get AI service URL from config
function getAIServiceURL() {
    const appConfig = getAppConfig();
    return appConfig.aiServiceURL || DEFAULT_AI_SERVICE_URL;
}

// Check if AI service is available
async function checkServiceHealth() {
    try {
        const url = getAIServiceURL();
        const response = await axios.get(`${url}/health`, { timeout: 5000 });
        return response.data.status === 'healthy';
    } catch (error) {
        logger.debug('AI service health check failed:', error.message);
        return false;
    }
}

// Summarize content
async function summarizeContent(content, options = {}) {
    try {
        const url = getAIServiceURL();
        const response = await axios.post(
            `${url}/api/v1/summarize`,
            {
                content,
                max_length: options.maxLength || 200,
                include_key_points: options.includeKeyPoints !== false,
            },
            { timeout: 30000 } // 30 second timeout for LLM
        );

        return response.data;
    } catch (error) {
        logger.error('Error summarizing content:', error);
        throw new Error(`Failed to summarize content: ${error.message}`);
    }
}

// Generate embedding
async function generateEmbedding(text, model = null) {
    try {
        const url = getAIServiceURL();
        const response = await axios.post(
            `${url}/api/v1/embedding`,
            {
                text,
                model,
            },
            { timeout: 10000 }
        );

        return response.data;
    } catch (error) {
        logger.error('Error generating embedding:', error);
        throw new Error(`Failed to generate embedding: ${error.message}`);
    }
}

// Extract concepts
async function extractConcepts(text, minConfidence = 0.5) {
    try {
        const url = getAIServiceURL();
        const response = await axios.post(
            `${url}/api/v1/concepts`,
            {
                text,
                min_confidence: minConfidence,
            },
            { timeout: 15000 }
        );

        return response.data;
    } catch (error) {
        logger.error('Error extracting concepts:', error);
        throw new Error(`Failed to extract concepts: ${error.message}`);
    }
}

// Process content (all-in-one)
async function processContent(content, options = {}) {
    try {
        const url = getAIServiceURL();
        const response = await axios.post(
            `${url}/api/v1/process`,
            {
                content,
                title: options.title || null,
                generate_summary: options.generateSummary !== false,
                generate_embedding: options.generateEmbedding !== false,
                extract_concepts: options.extractConcepts !== false,
            },
            { timeout: 45000 } // Longer timeout for full processing
        );

        return response.data;
    } catch (error) {
        logger.error('Error processing content:', error);
        throw new Error(`Failed to process content: ${error.message}`);
    }
}

// RAG-based chat
async function chatWithRAG(query, context = []) {
    try {
        const url = getAIServiceURL();

        // Format context for API
        const formattedContext = context.map(item => ({
            title: item.title || 'Untitled',
            content: item.content || '',
        }));

        const response = await axios.post(
            `${url}/api/v1/chat`,
            {
                query,
                context: formattedContext,
            },
            { timeout: 60000 } // 60 second timeout for chat
        );

        return response.data;
    } catch (error) {
        logger.error('Error in RAG chat:', error);

        // If chat endpoint doesn't exist, fallback to summarization
        if (error.response?.status === 404) {
            logger.warn('Chat endpoint not found, using fallback');
            try {
                // Build context text manually
                const contextText = context
                    .map((item, idx) => `[Source ${idx + 1}: ${item.title}]\n${item.content}`)
                    .join('\n\n');

                const prompt = `Based on the following context, answer this question: ${query}\n\nContext:\n${contextText}`;

                const summaryResult = await summarizeContent(prompt, { maxLength: 500 });
                return {
                    answer: summaryResult.summary || 'I encountered an error generating a response.',
                    sources_used: context.length,
                };
            } catch (fallbackError) {
                logger.error('Fallback chat also failed:', fallbackError);
                throw new Error(`Failed to get chat response: ${error.message}`);
            }
        }

        throw new Error(`Failed to get chat response: ${error.message}`);
    }
}

export {
    checkServiceHealth,
    summarizeContent,
    generateEmbedding,
    extractConcepts,
    processContent,
    chatWithRAG, // Add this
};