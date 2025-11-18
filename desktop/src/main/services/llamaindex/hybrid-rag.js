import { getLlamaIndexQueryEngine } from './query-engine.js';
import { getRAGChain } from '../rag-chain.js';
import logger from '../../utils/logger.js';

/**
 * Hybrid RAG service - combines LlamaIndex and LangChain RAG
 */
export class HybridRAGService {
    constructor() {
        this.llamaindexEngine = getLlamaIndexQueryEngine();
        this.langchainRAG = null; // Will be initialized on demand
    }

    /**
     * Query using hybrid approach
     */
    async query(queryText, options = {}) {
        try {
            const {
                useLlamaIndex = false,
                useLangChain = true,
                combineResults = true,
            } = options;

            const results = {
                answer: '',
                sources: [],
                method: 'hybrid',
            };

            // Query with LlamaIndex
            if (useLlamaIndex) {
                try {
                    const llamaindexResult = await this.llamaindexEngine.query(queryText, {
                        k: options.k || 5,
                        filters: options.filters || {},
                    });
                    results.llamaindex = llamaindexResult;
                } catch (error) {
                    logger.warn('LlamaIndex query failed:', error.message);
                }
            }

            // Query with LangChain RAG
            if (useLangChain) {
                try {
                    if (!this.langchainRAG) {
                        this.langchainRAG = await getRAGChain();
                    }
                    const langchainResult = await this.langchainRAG.invoke(queryText, {
                        filters: options.filters || {},
                        maxContextItems: options.k || 5,
                    });
                    results.langchain = langchainResult;
                } catch (error) {
                    logger.warn('LangChain RAG query failed:', error.message);
                }
            }

            // Combine results if requested
            if (combineResults && results.llamaindex && results.langchain) {
                results.answer = this.combineAnswers(
                    results.llamaindex.answer,
                    results.langchain.answer
                );
                results.sources = [
                    ...(results.llamaindex.sources || []),
                    ...(results.langchain.sources || []),
                ];
            } else if (results.llamaindex) {
                results.answer = results.llamaindex.answer;
                results.sources = results.llamaindex.sources || [];
                results.method = 'llamaindex';
            } else if (results.langchain) {
                results.answer = results.langchain.answer;
                results.sources = results.langchain.sources || [];
                results.method = 'langchain';
            }

            return results;
        } catch (error) {
            logger.error('Error in hybrid RAG query:', error);
            throw error;
        }
    }

    /**
     * Combine answers from multiple sources
     */
    combineAnswers(answer1, answer2) {
        // Simple combination - in production, use LLM to merge
        if (!answer1) return answer2;
        if (!answer2) return answer1;

        // Return the longer/more detailed answer
        return answer1.length > answer2.length ? answer1 : answer2;
    }
}

// Singleton instance
let hybridRAGInstance = null;

export function getHybridRAGService() {
    if (!hybridRAGInstance) {
        hybridRAGInstance = new HybridRAGService();
    }
    return hybridRAGInstance;
}