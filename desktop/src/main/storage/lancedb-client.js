import * as lancedb from '@lancedb/lancedb';
import path from 'path';
import { app } from 'electron';
import logger from '../utils/logger.js';
import fs from 'fs/promises';
import axios from 'axios';
import { getAppConfig } from '../utils/config-manager.js';

let db = null;
let table = null;
const TABLE_NAME = 'knowledge_base';

// Get embedding dimension from AI service
async function getEmbeddingDimension() {
    try {
        const config = getAppConfig();
        const aiServiceURL = config.aiServiceURL || 'http://127.0.0.1:8000';

        const response = await axios.get(`${aiServiceURL}/api/v1/embedding/model-info`, {
            timeout: 2000,
        });

        return response.data?.dimension || 384; // Default to 384 if service unavailable
    } catch (error) {
        logger.warn('Could not get embedding dimension from AI service, using default 384');
        return 384; // Default: all-MiniLM-L6-v2 dimension
    }
}

// Initialize LanceDB
async function initializeLanceDB() {
    try {
        const lancedbPath = path.join(app.getPath('userData'), 'data', 'lancedb');
        await fs.mkdir(lancedbPath, { recursive: true });

        db = await lancedb.connect(lancedbPath);
        logger.info('LanceDB initialized at:', lancedbPath);
        return db;
    } catch (error) {
        logger.error('Failed to initialize LanceDB:', error);
        throw error;
    }
}

// Get or create table
async function getTable() {
    if (!db) {
        await initializeLanceDB();
    }

    try {
        const tableNames = await db.tableNames();
        if (tableNames.includes(TABLE_NAME)) {
            table = await db.openTable(TABLE_NAME);
            logger.debug('LanceDB table retrieved:', TABLE_NAME);
        } else {
            // Get embedding dimension
            const dimension = await getEmbeddingDimension();

            // Create new table with schema
            const schema = {
                id: 'string',
                vector: `float32(${dimension})`,
                document: 'string',
                activity_id: 'int64',
                session_id: 'string',
                summary_id: 'int64',
                title: 'string',
                activity_type: 'string',
                source_type: 'string',
                complexity: 'string',
                sentiment: 'float32',
                timestamp: 'string',
            };

            // Create empty table with initial data
            const initialData = [{
                id: 'init',
                vector: Array(dimension).fill(0),
                document: '',
                activity_id: 0,
                session_id: '',
                summary_id: 0,
                title: '',
                activity_type: '',
                source_type: '',
                complexity: '',
                sentiment: 0.0,
                timestamp: new Date().toISOString(),
            }];

            table = await db.createTable(TABLE_NAME, initialData);
            await table.delete('id = "init"');

            logger.info(`LanceDB table created: ${TABLE_NAME} with dimension ${dimension}`);
        }
    } catch (error) {
        logger.error('Failed to get/create LanceDB table:', error);
        throw error;
    }

    return table;
}

// Store embedding in LanceDB
async function storeEmbedding(embeddingData) {
    try {
        const tbl = await getTable();
        const dimension = await getEmbeddingDimension();

        const {
            id,
            embedding,
            document,
            metadata = {},
        } = embeddingData;

        // Validate embedding dimension
        if (embedding.length !== dimension) {
            throw new Error(`Embedding dimension mismatch: expected ${dimension}, got ${embedding.length}`);
        }

        // Prepare data for LanceDB
        const data = [{
            id: id,
            vector: embedding,
            document: document || '',
            activity_id: metadata.activity_id ? parseInt(metadata.activity_id) : 0,
            session_id: metadata.session_id || '',
            summary_id: metadata.summary_id ? parseInt(metadata.summary_id) : 0,
            title: metadata.title || '',
            activity_type: metadata.activity_type || '',
            source_type: metadata.source_type || '',
            complexity: metadata.complexity || '',
            sentiment: metadata.sentiment || 0.0,
            timestamp: metadata.timestamp || new Date().toISOString(),
        }];

        // Upsert behavior
        try {
            await tbl.delete(`id = "${id}"`);
        } catch (error) {
            // Ignore if doesn't exist
        }

        await tbl.add(data);
        logger.info(`Embedding stored in LanceDB: ${id}`);
        return true;
    } catch (error) {
        logger.error('Error storing embedding in LanceDB:', error);
        throw error;
    }
}

// Query similar embeddings
async function querySimilarEmbeddings(queryEmbedding, limit = 10, filters = {}) {
    try {
        const tbl = await getTable();
        const dimension = await getEmbeddingDimension();

        // Validate query embedding dimension
        if (queryEmbedding.length !== dimension) {
            throw new Error(`Query embedding dimension mismatch: expected ${dimension}, got ${queryEmbedding.length}`);
        }

        // Build filter predicate
        let predicate = null;
        if (Object.keys(filters).length > 0) {
            const filterParts = [];
            for (const [key, value] of Object.entries(filters)) {
                if (value === null || value === undefined) {
                    continue;
                }
                if (typeof value === 'object' && value.$ne) {
                    filterParts.push(`${key} != ${typeof value.$ne === 'string' ? `"${value.$ne}"` : value.$ne}`);
                } else if (typeof value === 'object' && value.$eq) {
                    filterParts.push(`${key} = ${typeof value.$eq === 'string' ? `"${value.$eq}"` : value.$eq}`);
                } else if (typeof value === 'object' && value.$in) {
                    // Support $in operator for multiple values
                    const values = value.$in.map(v => typeof v === 'string' ? `"${v}"` : v).join(', ');
                    filterParts.push(`${key} IN (${values})`);
                } else {
                    filterParts.push(`${key} = ${typeof value === 'string' ? `"${value}"` : value}`);
                }
            }
            if (filterParts.length > 0) {
                predicate = filterParts.join(' AND ');
            }
        }

        // Perform vector search
        let query = tbl.search(queryEmbedding).limit(limit);
        if (predicate !== null && predicate !== undefined) {
            query = query.where(predicate);
        }

        const results = await query.toArray();

        // Format results
        const formattedResults = results.map((row) => ({
            id: row.id,
            distance: row._distance || 0,
            similarity: 1 - (row._distance || 0), // Convert distance to similarity
            document: row.document || '',
            metadata: {
                activity_id: row.activity_id,
                session_id: row.session_id || '',
                summary_id: row.summary_id,
                title: row.title,
                activity_type: row.activity_type || '',
                source_type: row.source_type,
                complexity: row.complexity,
                sentiment: row.sentiment,
                timestamp: row.timestamp,
            },
        }));

        return formattedResults;
    } catch (error) {
        logger.error('Error querying LanceDB:', error);
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
        const dimension = await getEmbeddingDimension();
        const zeroVector = Array(dimension).fill(0);

        const results = await tbl
            .search(zeroVector)
            .limit(limit + offset)
            .toArray();

        const paginatedResults = results.slice(offset, offset + limit);

        return {
            ids: paginatedResults.map(r => r.id),
            embeddings: paginatedResults.map(r => r.vector),
            documents: paginatedResults.map(r => r.document),
            metadatas: paginatedResults.map(r => ({
                activity_id: r.activity_id,
                session_id: r.session_id || '',
                summary_id: r.summary_id,
                title: r.title,
                activity_type: r.activity_type || '',
                source_type: r.source_type,
                complexity: r.complexity,
                sentiment: r.sentiment,
                timestamp: r.timestamp,
            })),
        };
    } catch (error) {
        logger.error('Error getting all embeddings from LanceDB:', error);
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
    getEmbeddingDimension,
};