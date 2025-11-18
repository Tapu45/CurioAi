import * as lancedb from '@lancedb/lancedb';
import path from 'path';
import { app } from 'electron';
import logger from '../utils/logger.js';
import fs from 'fs/promises';

let db = null;
let table = null;
const TABLE_NAME = 'knowledge_base';
const EMBEDDING_DIMENSION = 384; // all-MiniLM-L6-v2 dimension

// Initialize LanceDB
async function initializeLanceDB() {
    try {
        const lancedbPath = path.join(app.getPath('userData'), 'data', 'lancedb');

        // Ensure directory exists
        await fs.mkdir(lancedbPath, { recursive: true });

        // Connect to LanceDB (creates if doesn't exist)
        db = await lancedb.connect(lancedbPath);

        logger.info('LanceDB initialized at:', lancedbPath);
        return db;
    } catch (error) {
        logger.error('Failed to initialize LanceDB:', error instanceof Error ? error : new Error(String(error)));
        throw error;
    }
}

// Get or create table
async function getTable() {
    if (!db) {
        await initializeLanceDB();
    }

    try {
        // Try to open existing table
        const tableNames = await db.tableNames();
        if (tableNames.includes(TABLE_NAME)) {
            table = await db.openTable(TABLE_NAME);
            logger.debug('LanceDB table retrieved:', TABLE_NAME);
        } else {
            // Create new table with schema
            const schema = {
                id: 'string',
                vector: `float32(${EMBEDDING_DIMENSION})`,
                document: 'string',
                activity_id: 'int64',
                summary_id: 'int64',
                title: 'string',
                source_type: 'string',
                complexity: 'string',
                sentiment: 'float32',
                timestamp: 'string',
            };

            // Create empty table with initial data
            const initialData = [{
                id: 'init',
                vector: Array(EMBEDDING_DIMENSION).fill(0),
                document: '',
                activity_id: 0,
                summary_id: 0,
                title: '',
                source_type: '',
                complexity: '',
                sentiment: 0.0,
                timestamp: new Date().toISOString(),
            }];

            table = await db.createTable(TABLE_NAME, initialData);
            // Delete the initial row
            await table.delete('id = "init"');

            logger.info('LanceDB table created:', TABLE_NAME);
        }
    } catch (error) {
        logger.error('Failed to get/create LanceDB table:', error instanceof Error ? error : new Error(String(error)));
        throw error;
    }

    return table;
}

// Store embedding in LanceDB
async function storeEmbedding(embeddingData) {
    try {
        const tbl = await getTable();

        const {
            id,
            embedding,
            document,
            metadata = {},
        } = embeddingData;

        // Validate embedding dimension
        if (embedding.length !== EMBEDDING_DIMENSION) {
            throw new Error(`Embedding dimension mismatch: expected ${EMBEDDING_DIMENSION}, got ${embedding.length}`);
        }

        // Prepare data for LanceDB
        const data = [{
            id: id,
            vector: embedding,
            document: document || '',
            activity_id: metadata.activity_id ? parseInt(metadata.activity_id) : 0,
            summary_id: metadata.summary_id ? parseInt(metadata.summary_id) : 0,
            title: metadata.title || '',
            source_type: metadata.source_type || '',
            complexity: metadata.complexity || '',
            sentiment: metadata.sentiment || 0.0,
            timestamp: metadata.timestamp || new Date().toISOString(),
        }];

        // Check if ID already exists, delete if so (upsert behavior)
        try {
            await tbl.delete(`id = "${id}"`);
        } catch (error) {
            // Ignore if doesn't exist
        }

        // Insert new data
        await tbl.add(data);

        logger.info(`Embedding stored in LanceDB: ${id}`);
        return true;
    } catch (error) {
        logger.error('Error storing embedding in LanceDB:', error instanceof Error ? error : new Error(String(error)));
        throw error;
    }
}

// Query similar embeddings
async function querySimilarEmbeddings(queryEmbedding, limit = 10, filters = {}) {
    try {
        const tbl = await getTable();

        // Validate query embedding dimension
        if (queryEmbedding.length !== EMBEDDING_DIMENSION) {
            throw new Error(`Query embedding dimension mismatch: expected ${EMBEDDING_DIMENSION}, got ${queryEmbedding.length}`);
        }

        // Build filter predicate if filters provided
        let predicate = null;
        if (Object.keys(filters).length > 0) {
            const filterParts = [];
            for (const [key, value] of Object.entries(filters)) {
                if (value === null || value === undefined) {
                    continue; // Skip null/undefined values
                }
                if (typeof value === 'object' && value.$ne) {
                    filterParts.push(`${key} != ${typeof value.$ne === 'string' ? `"${value.$ne}"` : value.$ne}`);
                } else if (typeof value === 'object' && value.$eq) {
                    filterParts.push(`${key} = ${typeof value.$eq === 'string' ? `"${value.$eq}"` : value.$eq}`);
                } else {
                    filterParts.push(`${key} = ${typeof value === 'string' ? `"${value}"` : value}`);
                }
            }
            if (filterParts.length > 0) {
                predicate = filterParts.join(' AND ');
            }
        }

        // Perform vector search - only add .where() if predicate is not null
        let query = tbl.search(queryEmbedding).limit(limit);
        if (predicate !== null && predicate !== undefined) {
            query = query.where(predicate);
        }

        const results = await query.toArray();

        // Format results to match ChromaDB format
        const formattedResults = results.map((row) => ({
            id: row.id,
            distance: row._distance || 0, // LanceDB returns _distance
            document: row.document || '',
            metadata: {
                activity_id: row.activity_id,
                summary_id: row.summary_id,
                title: row.title,
                source_type: row.source_type,
                complexity: row.complexity,
                sentiment: row.sentiment,
                timestamp: row.timestamp,
            },
        }));

        return formattedResults;
    } catch (error) {
        logger.error('Error querying LanceDB:', error instanceof Error ? error : new Error(String(error)));
        throw error;
    }
}

// Get embedding by ID
async function getEmbeddingById(id) {
    try {
        const tbl = await getTable();

        // Use a zero vector of correct dimension
        const zeroVector = Array(EMBEDDING_DIMENSION).fill(0);

        const results = await tbl
            .search(zeroVector) // Use proper dimension vector
            .where(`id = "${id}"`)
            .limit(1)
            .toArray();

        if (results.length === 0) {
            return null;
        }

        const row = results[0];
        return {
            id: row.id,
            embedding: row.vector,
            document: row.document,
            metadata: {
                activity_id: row.activity_id,
                summary_id: row.summary_id,
                title: row.title,
                source_type: row.source_type,
                complexity: row.complexity,
                sentiment: row.sentiment,
                timestamp: row.timestamp,
            },
        };
    } catch (error) {
        logger.error('Error getting embedding from LanceDB:', error instanceof Error ? error : new Error(String(error)));
        return null;
    }
}

// Delete embedding
async function deleteEmbedding(id) {
    try {
        const tbl = await getTable();
        await tbl.delete(`id = "${id}"`);
        logger.info(`Embedding deleted from LanceDB: ${id}`);
        return true;
    } catch (error) {
        logger.error('Error deleting embedding from LanceDB:', error instanceof Error ? error : new Error(String(error)));
        throw error;
    }
}

// Get all embeddings (with pagination)
async function getAllEmbeddings(limit = 100, offset = 0) {
    try {
        const tbl = await getTable();

        // Use a zero vector of correct dimension (384) instead of [0]
        const zeroVector = Array(EMBEDDING_DIMENSION).fill(0);

        // LanceDB doesn't have direct offset, so we'll get all and slice
        const results = await tbl
            .search(zeroVector) // Use proper dimension vector
            .limit(limit + offset)
            .toArray();

        // Apply offset
        const paginatedResults = results.slice(offset, offset + limit);

        // Format to match ChromaDB structure
        return {
            ids: paginatedResults.map(r => r.id),
            embeddings: paginatedResults.map(r => r.vector),
            documents: paginatedResults.map(r => r.document),
            metadatas: paginatedResults.map(r => ({
                activity_id: r.activity_id,
                summary_id: r.summary_id,
                title: r.title,
                source_type: r.source_type,
                complexity: r.complexity,
                sentiment: r.sentiment,
                timestamp: r.timestamp,
            })),
        };
    } catch (error) {
        logger.error('Error getting all embeddings from LanceDB:', error instanceof Error ? error : new Error(String(error)));
        throw error;
    }
}

// Count embeddings
async function countEmbeddings() {
    try {
        const tbl = await getTable();
        // Use a zero vector of correct dimension
        const zeroVector = Array(EMBEDDING_DIMENSION).fill(0);

        // Get all and count (LanceDB doesn't have direct count)
        const results = await tbl
            .search(zeroVector) // Use proper dimension vector
            .limit(1000000) // Large limit to get all
            .toArray();
        return results.length;
    } catch (error) {
        logger.error('Error counting embeddings in LanceDB:', error instanceof Error ? error : new Error(String(error)));
        return 0;
    }
}

// Clear all data from LanceDB table
async function clearCollection() {
    try {
        const tbl = await getTable();
        // Use a zero vector of correct dimension
        const zeroVector = Array(EMBEDDING_DIMENSION).fill(0);

        // Get all IDs first
        const results = await tbl
            .search(zeroVector) // Use proper dimension vector instead of [0]
            .limit(1000000)
            .toArray();

        if (results.length > 0) {
            const ids = results.map(r => r.id);
            // Delete in batches
            for (const id of ids) {
                await tbl.delete(`id = "${id}"`);
            }
        }
        logger.info('LanceDB collection cleared');
        return { success: true };
    } catch (error) {
        logger.error('Error clearing LanceDB collection:', error instanceof Error ? error : new Error(String(error)));
        throw error;
    }
}

// Close LanceDB connection
function closeLanceDB() {
    // LanceDB doesn't need explicit closing, but we can null the references
    db = null;
    table = null;
    logger.info('LanceDB connection closed');
}

export {
    initializeLanceDB,
    getTable,
    storeEmbedding,
    querySimilarEmbeddings,
    getEmbeddingById,
    deleteEmbedding,
    getAllEmbeddings,
    countEmbeddings,
    closeLanceDB,
    clearCollection,
};