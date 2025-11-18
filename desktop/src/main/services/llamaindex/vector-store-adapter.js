import { getTable, storeEmbedding, querySimilarEmbeddings } from '../../storage/lancedb-client.js';
import { Document } from '@langchain/core/documents';
import logger from '../../utils/logger.js';

/**
 * LanceDB Vector Store Adapter for LlamaIndex
 * This allows LlamaIndex to use LanceDB as its vector store backend
 */
export class LanceDBVectorStoreAdapter {
    constructor(table) {
        this.table = table;
    }

    /**
     * Add documents to vector store
     */
    async add(documents) {
        try {
            const results = [];
            for (const doc of documents) {
                // Generate embedding (should be provided or generated elsewhere)
                if (!doc.embedding) {
                    throw new Error('Document embedding required');
                }

                const id = doc.id || doc.metadata?.id || `doc_${Date.now()}_${Math.random()}`;

                await storeEmbedding({
                    id,
                    embedding: doc.embedding,
                    document: doc.text || doc.pageContent || '',
                    metadata: {
                        ...doc.metadata,
                        file_path: doc.metadata?.filePath || doc.metadata?.file_path,
                        source_type: doc.metadata?.source_type || 'workspace',
                    },
                });

                results.push(id);
            }
            return results;
        } catch (error) {
            logger.error('Error adding documents to LanceDB adapter:', error);
            throw error;
        }
    }

    /**
     * Query similar documents
     */
    async query(queryEmbedding, options = {}) {
        try {
            const {
                k = 4,
                filters = {},
            } = options;

            const results = await querySimilarEmbeddings(queryEmbedding, k, filters);

            return results.map(result => ({
                id: result.id,
                text: result.document,
                score: 1 - result.distance, // Convert distance to similarity
                metadata: result.metadata,
            }));
        } catch (error) {
            logger.error('Error querying LanceDB adapter:', error);
            throw error;
        }
    }

    /**
     * Delete documents
     */
    async delete(ids) {
        try {
            const { deleteEmbedding } = await import('../../storage/lancedb-client.js');
            for (const id of ids) {
                await deleteEmbedding(id);
            }
            return true;
        } catch (error) {
            logger.error('Error deleting from LanceDB adapter:', error);
            throw error;
        }
    }
}

/**
 * Create LanceDB vector store adapter instance
 */
export async function createLanceDBAdapter() {
    try {
        const table = await getTable();
        return new LanceDBVectorStoreAdapter(table);
    } catch (error) {
        logger.error('Error creating LanceDB adapter:', error);
        throw error;
    }
}