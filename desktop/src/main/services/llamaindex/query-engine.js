import { getAIServiceURL } from '../ai-service-client.js';
import axios from 'axios';
import logger from '../../utils/logger.js';

/**
 * LlamaIndex Query Engine Service
 * Uses Python LlamaIndex service for query processing
 */
class LlamaIndexQueryEngine {
    constructor() {
        this.url = getAIServiceURL();
    }

    /**
     * Query using LlamaIndex query engine
     */
    async query(queryText, options = {}) {
        try {
            const {
                k = 5,
                filters = {},
                useReranking = false,
            } = options;

            const response = await axios.post(
                `${this.url}/api/v1/llamaindex/query`,
                {
                    query: queryText,
                    k,
                    filters,
                    use_reranking: useReranking,
                },
                { timeout: 60000 }
            );

            return {
                answer: response.data.answer || '',
                sources: response.data.sources || [],
                metadata: response.data.metadata || {},
            };
        } catch (error) {
            logger.error('Error querying with LlamaIndex:', error);
            throw error;
        }
    }

    /**
     * Create retriever query engine
     */
    async createRetrieverQueryEngine(options = {}) {
        try {
            const response = await axios.post(
                `${this.url}/api/v1/llamaindex/create-retriever-engine`,
                options,
                { timeout: 30000 }
            );

            return {
                engineId: response.data.engine_id,
                ...response.data,
            };
        } catch (error) {
            logger.error('Error creating retriever query engine:', error);
            throw error;
        }
    }

    /**
     * Create router query engine (multi-source)
     */
    async createRouterQueryEngine(sources, options = {}) {
        try {
            const response = await axios.post(
                `${this.url}/api/v1/llamaindex/create-router-engine`,
                {
                    sources,
                    ...options,
                },
                { timeout: 30000 }
            );

            return {
                engineId: response.data.engine_id,
                ...response.data,
            };
        } catch (error) {
            logger.error('Error creating router query engine:', error);
            throw error;
        }
    }
}

// Singleton instance
let queryEngineInstance = null;

export function getLlamaIndexQueryEngine() {
    if (!queryEngineInstance) {
        queryEngineInstance = new LlamaIndexQueryEngine();
    }
    return queryEngineInstance;
}