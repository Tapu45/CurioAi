import { getQueryRouter } from './query-router.js';
import { getAgentManager } from './agent-manager.js';
import { getRAGChain } from '../rag-chain.js';
import logger from '../../utils/logger.js';

/**
 * Hybrid Query Handler - Routes queries to RAG or Agent
 */
class HybridQueryHandler {
    constructor() {
        this.queryRouter = getQueryRouter();
        this.agentManager = null;
        this.ragChain = null;
    }

    /**
     * Initialize handler
     */
    async initialize() {
        try {
            this.agentManager = getAgentManager();
            this.ragChain = await getRAGChain();
            logger.info('Hybrid query handler initialized');
        } catch (error) {
            logger.error('Error initializing hybrid query handler:', error);
            throw error;
        }
    }

    /**
     * Handle query - route to RAG or Agent
     */
    async handleQuery(query, options = {}) {
        try {
            // Route query
            const routing = await this.queryRouter.routeQuery(query, options);

            let result;

            if (routing.shouldUseAgent) {
                // Use agent for complex queries
                logger.info(`Routing to agent: ${query.substring(0, 50)}...`);

                if (!this.agentManager) {
                    this.agentManager = getAgentManager();
                }

                const agentResult = await this.agentManager.processQuery(query, {
                    ...routing.options,
                    ...options,
                });

                result = {
                    answer: agentResult.answer,
                    method: 'agent',
                    toolCalls: agentResult.toolCalls || [],
                    iterations: agentResult.iterations || 0,
                    routing: routing.classification,
                    sources: this.extractSourcesFromToolCalls(agentResult.toolCalls),
                };
            } else {
                // Use RAG for simple queries
                logger.info(`Routing to RAG: ${query.substring(0, 50)}...`);

                if (!this.ragChain) {
                    this.ragChain = await getRAGChain();
                }

                const ragResult = await this.ragChain.invoke(query, {
                    filters: options.filters || {},
                    maxContextItems: options.maxContextItems || 5,
                });

                result = {
                    answer: ragResult.answer,
                    method: 'rag',
                    sources: ragResult.sources || [],
                    contextUsed: ragResult.contextUsed || 0,
                    confidence: ragResult.confidence || 0,
                    routing: routing.classification,
                };
            }

            return result;
        } catch (error) {
            logger.error('Error handling query:', error);

            // Fallback to RAG on error
            try {
                if (!this.ragChain) {
                    this.ragChain = await getRAGChain();
                }
                const fallbackResult = await this.ragChain.invoke(query, options);
                return {
                    ...fallbackResult,
                    method: 'rag-fallback',
                    error: error.message,
                };
            } catch (fallbackError) {
                logger.error('Fallback RAG also failed:', fallbackError);
                throw error;
            }
        }
    }

    /**
     * Extract sources from tool calls
     */
    extractSourcesFromToolCalls(toolCalls) {
        const sources = [];

        if (!toolCalls || !Array.isArray(toolCalls)) {
            return sources;
        }

        for (const toolCall of toolCalls) {
            if (toolCall.tool === 'rag_search' && toolCall.output) {
                try {
                    const output = typeof toolCall.output === 'string'
                        ? JSON.parse(toolCall.output)
                        : toolCall.output;

                    if (output.success && output.result?.sources) {
                        sources.push(...output.result.sources);
                    }
                } catch (error) {
                    logger.debug('Error parsing tool output:', error);
                }
            } else if (toolCall.tool === 'file_search' && toolCall.output) {
                try {
                    const output = typeof toolCall.output === 'string'
                        ? JSON.parse(toolCall.output)
                        : toolCall.output;

                    if (output.success && output.result?.files) {
                        sources.push(...output.result.files.map(file => ({
                            title: file.name,
                            path: file.path,
                            type: file.type,
                            metadata: file,
                        })));
                    }
                } catch (error) {
                    logger.debug('Error parsing file search output:', error);
                }
            }
        }

        return sources;
    }
}

// Singleton instance
let hybridQueryHandlerInstance = null;

export function getHybridQueryHandler() {
    if (!hybridQueryHandlerInstance) {
        hybridQueryHandlerInstance = new HybridQueryHandler();
    }
    return hybridQueryHandlerInstance;
}