import { getTable, querySimilarEmbeddings, storeEmbedding } from '../storage/lancedb-client.js';
import { Document } from '@langchain/core/documents';
import logger from '../utils/logger.js';

/**
 * Custom LanceDB Vector Store for LangChain
 * This wraps our LanceDB client to work with LangChain's vector store interface
 */
class LanceDBVectorStore {
    constructor(table) {
        this.table = table;
    }

    /**
     * Add documents to the vector store
     */
    async addDocuments(documents, embeddings) {
        try {
            const results = [];
            for (let i = 0; i < documents.length; i++) {
                const doc = documents[i];
                const embedding = embeddings[i];

                const id = doc.metadata?.id || `doc_${Date.now()}_${i}`;

                await storeEmbedding({
                    id,
                    embedding,
                    document: doc.pageContent,
                    metadata: {
                        ...doc.metadata,
                        timestamp: new Date().toISOString(),
                    },
                });

                results.push(id);
            }
            return results;
        } catch (error) {
            logger.error('Error adding documents to LanceDB:', error);
            throw error;
        }
    }

    /**
     * Similarity search with score
     */
    async similaritySearchWithScore(queryEmbedding, k = 4, filter = null) {
        try {
            // Build filters for LanceDB
            let filters = {};
            if (filter) {
                filters = filter;
            }

            const results = await querySimilarEmbeddings(queryEmbedding, k, filters);

            return results.map(result => [
                new Document({
                    pageContent: result.document,
                    metadata: {
                        ...result.metadata,
                        id: result.id,
                        distance: result.distance,
                    },
                }),
                result.distance, // Score (distance)
            ]);
        } catch (error) {
            logger.error('Error in similarity search:', error);
            throw error;
        }
    }

    /**
     * Similarity search (without score)
     */
    async similaritySearch(queryEmbedding, k = 4, filter = null) {
        const results = await this.similaritySearchWithScore(queryEmbedding, k, filter);
        return results.map(([doc]) => doc);
    }

    /**
     * Similarity search with metadata filtering
     */
    async similaritySearchVectorWithScore(queryEmbedding, k, filter) {
        return this.similaritySearchWithScore(queryEmbedding, k, filter);
    }
}

/**
 * Create LanceDB vector store instance
 */
async function createLanceDBVectorStore() {
    try {
        const table = await getTable();
        return new LanceDBVectorStore(table);
    } catch (error) {
        logger.error('Error creating LanceDB vector store:', error);
        throw error;
    }
}

/**
 * Create a retriever from the vector store
 */
async function createRetriever(options = {}) {
    try {
        const {
            k = 5,
            scoreThreshold = 0.7,
            filter = null,
        } = options;

        const vectorStore = await createLanceDBVectorStore();

        return {
            vectorStore,
            async getRelevantDocuments(queryEmbedding, filters = {}) {
                // Merge filters
                const mergedFilters = filter ? { ...filter, ...filters } : filters;

                const results = await vectorStore.similaritySearchWithScore(
                    queryEmbedding,
                    k * 2, // Get more to filter by score
                    Object.keys(mergedFilters).length > 0 ? mergedFilters : null
                );

                // Filter by score threshold
                const filtered = results
                    .filter(([, score]) => {
                        const similarity = 1 - score;
                        return similarity >= scoreThreshold;
                    })
                    .slice(0, k);

                return filtered.map(([doc]) => doc);
            },
        };
    } catch (error) {
        logger.error('Error creating retriever:', error);
        throw error;
    }
}

export { createLanceDBVectorStore, createRetriever, LanceDBVectorStore };