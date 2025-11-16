import { ChromaClient } from 'chromadb';
import path from 'path';
import { app } from 'electron';
import logger from '../utils/logger.js';

let client = null;
let collection = null;
const COLLECTION_NAME = 'knowledge_base';

// Initialize ChromaDB client
function initializeChromaDB() {
    try {
        const chromaPath = path.join(app.getPath('userData'), 'data', 'chromadb');

        // ChromaDB can run in-memory or with persistent storage
        // For Electron, we'll use persistent storage
        client = new ChromaClient({
            path: chromaPath,
        });

        logger.info('ChromaDB client initialized at:', chromaPath);
        return client;
    } catch (error) {
        logger.error('Failed to initialize ChromaDB:', error);
        throw error;
    }
}

// Get or create collection
async function getCollection() {
    if (!client) {
        initializeChromaDB();
    }

    try {
        // Try to get existing collection
        collection = await client.getCollection({ name: COLLECTION_NAME });
        logger.debug('ChromaDB collection retrieved');
    } catch (error) {
        // Collection doesn't exist, create it
        try {
            collection = await client.createCollection({
                name: COLLECTION_NAME,
                metadata: {
                    description: 'CurioAI knowledge base embeddings',
                },
            });
            logger.info('ChromaDB collection created');
        } catch (createError) {
            logger.error('Failed to create ChromaDB collection:', createError);
            throw createError;
        }
    }

    return collection;
}

// Store embedding in ChromaDB
async function storeEmbedding(embeddingData) {
    try {
        const coll = await getCollection();

        const {
            id,
            embedding,
            document,
            metadata = {},
        } = embeddingData;

        await coll.add({
            ids: [id],
            embeddings: [embedding],
            documents: [document || ''],
            metadatas: [{
                ...metadata,
                timestamp: new Date().toISOString(),
            }],
        });

        logger.info(`Embedding stored in ChromaDB: ${id}`);
        return true;
    } catch (error) {
        logger.error('Error storing embedding in ChromaDB:', error);
        throw error;
    }
}

// Query similar embeddings
async function querySimilarEmbeddings(queryEmbedding, limit = 10, filters = {}) {
    try {
        const coll = await getCollection();

        const results = await coll.query({
            queryEmbeddings: [queryEmbedding],
            nResults: limit,
            where: filters, // Metadata filters
        });

        // Format results
        const formattedResults = results.ids[0].map((id, index) => ({
            id,
            distance: results.distances[0][index],
            document: results.documents[0][index],
            metadata: results.metadatas[0][index],
        }));

        return formattedResults;
    } catch (error) {
        logger.error('Error querying ChromaDB:', error);
        throw error;
    }
}

// Get embedding by ID
async function getEmbeddingById(id) {
    try {
        const coll = await getCollection();

        const results = await coll.get({
            ids: [id],
        });

        if (results.ids.length === 0) {
            return null;
        }

        return {
            id: results.ids[0],
            embedding: results.embeddings[0],
            document: results.documents[0],
            metadata: results.metadatas[0],
        };
    } catch (error) {
        logger.error('Error getting embedding from ChromaDB:', error);
        throw error;
    }
}

// Delete embedding
async function deleteEmbedding(id) {
    try {
        const coll = await getCollection();

        await coll.delete({
            ids: [id],
        });

        logger.info(`Embedding deleted from ChromaDB: ${id}`);
        return true;
    } catch (error) {
        logger.error('Error deleting embedding from ChromaDB:', error);
        throw error;
    }
}

// Get all embeddings (with pagination)
async function getAllEmbeddings(limit = 100, offset = 0) {
    try {
        const coll = await getCollection();

        const results = await coll.get({
            limit,
            offset,
        });

        return {
            ids: results.ids,
            embeddings: results.embeddings,
            documents: results.documents,
            metadatas: results.metadatas,
        };
    } catch (error) {
        logger.error('Error getting all embeddings from ChromaDB:', error);
        throw error;
    }
}

// Count embeddings
async function countEmbeddings() {
    try {
        const coll = await getCollection();
        const results = await coll.get();
        return results.ids.length;
    } catch (error) {
        logger.error('Error counting embeddings in ChromaDB:', error);
        return 0;
    }
}

// Close ChromaDB connection
function closeChromaDB() {
    // ChromaDB client doesn't need explicit closing in this implementation
    client = null;
    collection = null;
    logger.info('ChromaDB connection closed');
}

export {
    initializeChromaDB,
    getCollection,
    storeEmbedding,
    querySimilarEmbeddings,
    getEmbeddingById,
    deleteEmbedding,
    getAllEmbeddings,
    countEmbeddings,
    closeChromaDB,
};