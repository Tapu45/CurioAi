import { createRetriever } from './rag-service.js';
import { generateEmbedding } from './ai-service-client.js';
import { chatWithRAG } from './ai-service-client.js';
import { getMemoryManager } from './memory-manager.js';
import { Document } from '@langchain/core/documents';
import logger from '../utils/logger.js';

/**
 * RAG Chain for question answering with retrieval
 */
class RAGChain {
    constructor(options = {}) {
        this.retriever = null;
        this.memoryManager = null;
        this.options = {
            k: options.k || 5,
            scoreThreshold: options.scoreThreshold || 0.7,
            useMemory: options.useMemory !== false,
            streaming: options.streaming || false,
        };
    }

    /**
     * Initialize the RAG chain
     */
    async initialize() {
        try {
            // Initialize retriever
            this.retriever = await createRetriever({
                k: this.options.k,
                scoreThreshold: this.options.scoreThreshold,
            });

            // Initialize memory manager
            if (this.options.useMemory) {
                this.memoryManager = await getMemoryManager();
            }

            logger.info('RAG chain initialized');
        } catch (error) {
            logger.error('Error initializing RAG chain:', error);
            throw error;
        }
    }

    /**
     * Invoke the RAG chain with a query
     */
    async invoke(query, options = {}) {
        try {
            const {
                filters = {},
                maxContextItems = this.options.k,
                includeMemory = this.options.useMemory,
            } = options;

            // Step 1: Generate query embedding
            logger.debug(`RAG query: "${query.substring(0, 50)}..."`);
            const embeddingResult = await generateEmbedding(query);
            const queryEmbedding = embeddingResult.embedding;

            // Step 2: Retrieve relevant documents
            const retrievedDocs = await this.retriever.getRelevantDocuments(queryEmbedding);

            // Apply additional filters if provided
            let filteredDocs = retrievedDocs;
            if (Object.keys(filters).length > 0) {
                filteredDocs = retrievedDocs.filter(doc => {
                    for (const [key, value] of Object.entries(filters)) {
                        if (doc.metadata[key] !== value) {
                            return false;
                        }
                    }
                    return true;
                });
            }

            // Limit to maxContextItems
            filteredDocs = filteredDocs.slice(0, maxContextItems);

            if (filteredDocs.length === 0) {
                return {
                    answer: "I couldn't find any relevant information in your knowledge base to answer that question.",
                    sources: [],
                    contextUsed: 0,
                    confidence: 0,
                };
            }

            // Step 3: Get memory context if enabled
            let memoryContext = '';
            if (includeMemory && this.memoryManager) {
                try {
                    memoryContext = await this.memoryManager.getMemoryContext(query, {
                        useBuffer: true,
                        useVector: true,
                        useEntities: true,
                    });
                } catch (error) {
                    logger.debug('Error getting memory context:', error.message);
                }
            }

            // Step 4: Build context from retrieved documents
            const contextItems = filteredDocs.map((doc, index) => ({
                title: doc.metadata?.title || doc.metadata?.file_name || `Source ${index + 1}`,
                content: doc.pageContent,
                metadata: doc.metadata,
                similarity: 1 - (doc.metadata?.distance || 0),
            }));

            // Step 5: Format context for LLM
            const contextText = contextItems
                .map((item, idx) => `[Source ${idx + 1}: ${item.title}]\n${item.content}`)
                .join('\n\n');

            // Step 6: Build prompt with context and memory
            const fullContext = memoryContext
                ? `${memoryContext}\n\n---\n\nRelevant Information:\n${contextText}`
                : `Relevant Information:\n${contextText}`;

            // Step 7: Call LLM with RAG context
            const chatResponse = await chatWithRAG(query, contextItems);

            // Step 8: Extract answer and format response
            const answer = chatResponse.answer || chatResponse || 'I encountered an error generating a response.';

            // Step 9: Save to memory
            if (includeMemory && this.memoryManager) {
                try {
                    await this.memoryManager.saveMessage(query, answer);
                } catch (error) {
                    logger.debug('Error saving to memory:', error.message);
                }
            }

            // Step 10: Format response with sources
            const sources = contextItems.map((item) => ({
                title: item.title,
                content: item.content.substring(0, 200) + '...',
                similarity: item.similarity,
                metadata: item.metadata,
            }));

            const avgSimilarity =
                contextItems.reduce((sum, item) => sum + item.similarity, 0) /
                contextItems.length;

            return {
                answer,
                sources,
                contextUsed: contextItems.length,
                confidence: Math.min(avgSimilarity * 100, 95),
                memoryUsed: memoryContext ? true : false,
            };
        } catch (error) {
            logger.error('Error in RAG chain invoke:', error);
            throw error;
        }
    }

    /**
     * Stream response (for future implementation)
     */
    async *stream(query, options = {}) {
        // For now, return non-streaming response
        // Future: Implement streaming with LangChain's streaming capabilities
        const response = await this.invoke(query, options);
        yield response;
    }
}

// Singleton instance
let ragChainInstance = null;

/**
 * Get RAG chain instance
 */
async function getRAGChain(options = {}) {
    if (!ragChainInstance) {
        ragChainInstance = new RAGChain(options);
        await ragChainInstance.initialize();
    }
    return ragChainInstance;
}

export { getRAGChain, RAGChain };