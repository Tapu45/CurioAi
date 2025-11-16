import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { sql } from 'drizzle-orm';
import path from 'path';
import fs from 'fs';
import logger from '../utils/logger.js';
import { app } from 'electron';
import { activities, summaries, embeddings } from './schema.js';

let db = null;
const DB_PATH = path.join(app.getPath('userData'), 'data', 'sqlite', 'curioai.db');
const DB_URL = `file:${DB_PATH}`;

// Ensure data directory exists
function ensureDataDirectory() {
    const dbDir = path.dirname(DB_PATH);
    if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
        logger.info('Created data directory:', dbDir);
    }
}

// Create tables (equivalent to old better-sqlite3 schema)
async function createTables(client) {
    await client.execute(`
        CREATE TABLE IF NOT EXISTS activities (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          url TEXT,
          title TEXT,
          content TEXT,
          timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
          source_type TEXT NOT NULL,
          app_name TEXT,
          window_title TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    await client.execute(`
        CREATE TABLE IF NOT EXISTS summaries (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          activity_id INTEGER NOT NULL,
          summary_text TEXT NOT NULL,
          key_concepts TEXT,
          complexity TEXT,
          sentiment REAL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (activity_id) REFERENCES activities(id) ON DELETE CASCADE
        )
    `);

    await client.execute(`
        CREATE TABLE IF NOT EXISTS embeddings (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          summary_id INTEGER NOT NULL,
          vector TEXT,
          model_version TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (summary_id) REFERENCES summaries(id) ON DELETE CASCADE
        )
    `);

    // Graph nodes table
    await client.execute(`
        CREATE TABLE IF NOT EXISTS graph_nodes (
          id TEXT PRIMARY KEY,
          label TEXT NOT NULL,
          name TEXT,
          title TEXT,
          properties TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Graph edges table
    await client.execute(`
        CREATE TABLE IF NOT EXISTS graph_edges (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          source TEXT NOT NULL,
          target TEXT NOT NULL,
          type TEXT NOT NULL,
          properties TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (source) REFERENCES graph_nodes(id) ON DELETE CASCADE,
          FOREIGN KEY (target) REFERENCES graph_nodes(id) ON DELETE CASCADE
        )
    `);

    // Indexes for graph tables
    await client.execute(`
        CREATE INDEX IF NOT EXISTS idx_graph_nodes_label ON graph_nodes(label);
    `);
    await client.execute(`
        CREATE INDEX IF NOT EXISTS idx_graph_edges_source ON graph_edges(source);
    `);
    await client.execute(`
        CREATE INDEX IF NOT EXISTS idx_graph_edges_target ON graph_edges(target);
    `);
    await client.execute(`
        CREATE INDEX IF NOT EXISTS idx_graph_edges_type ON graph_edges(type);
    `);

    await client.execute(`
        CREATE INDEX IF NOT EXISTS idx_activities_timestamp ON activities(timestamp);
    `);
    await client.execute(`
        CREATE INDEX IF NOT EXISTS idx_activities_source_type ON activities(source_type);
    `);
    await client.execute(`
        CREATE INDEX IF NOT EXISTS idx_summaries_activity_id ON summaries(activity_id);
    `);
    await client.execute(`
        CREATE INDEX IF NOT EXISTS idx_embeddings_summary_id ON embeddings(summary_id);
    `);

    logger.info('Database tables ensured');
}

// Initialize database
async function initializeDatabase() {
    try {
        ensureDataDirectory();

        const client = createClient({
            url: DB_URL,
        });

        // NEW: ensure schema exists
        await createTables(client);

        db = drizzle(client, {
            schema: { activities, summaries, embeddings },
        });

        logger.info('Database initialized at:', DB_PATH);
        return db;
    } catch (error) {
        logger.error('Failed to initialize database:', error);
        throw error;
    }
}

// Get database instance
function getDatabase() {
    if (!db) {
        throw new Error('Database not initialized. Call initializeDatabase() first.');
    }
    return db;
}

// Activity operations
async function insertActivity(activity) {
    try {
        const [row] = await db
            .insert(activities)
            .values({
                url: activity.url || null,
                title: activity.title || null,
                content: activity.content || null,
                timestamp: activity.timestamp || new Date().toISOString(),
                sourceType: activity.source_type,
                appName: activity.app_name || null,
                windowTitle: activity.window_title || null,
            })
            .returning({ id: activities.id });
        return row.id;
    } catch (error) {
        logger.error('Error inserting activity:', error);
        throw error;
    }
}

async function getActivities(filters = {}) {
    try {
        let query = db.select().from(activities);
        const conditions = [];

        if (filters.startDate) {
            conditions.push(sql`${activities.timestamp} >= ${filters.startDate}`);
        }

        if (filters.endDate) {
            conditions.push(sql`${activities.timestamp} <= ${filters.endDate}`);
        }

        if (filters.sourceType) {
            conditions.push(sql`${activities.sourceType} = ${filters.sourceType}`);
        }

        if (conditions.length > 0) {
            query = query.where(sql`${sql.join(conditions, sql` AND `)}`);
        }

        query = query.orderBy(sql`${activities.timestamp} DESC`);

        if (filters.limit) {
            query = query.limit(filters.limit);
        }

        return await query;
    } catch (error) {
        logger.error('Error fetching activities:', error);
        throw error;
    }
}

async function getActivityById(id) {
    try {
        const [row] = await db
            .select()
            .from(activities)
            .where(sql`${activities.id} = ${id}`)
            .limit(1);
        return row || null;
    } catch (error) {
        logger.error('Error fetching activity by ID:', error);
        throw error;
    }
}

async function deleteActivity(id) {
    try {
        await db.delete(activities).where(sql`${activities.id} = ${id}`);
    } catch (error) {
        logger.error('Error deleting activity:', error);
        throw error;
    }
}

// Update activity (used after content extraction)
async function updateActivity(id, updates) {
    const changes = {};

    if ('title' in updates) changes.title = updates.title;
    if ('content' in updates) changes.content = updates.content;
    if ('url' in updates) changes.url = updates.url;
    if (Object.keys(changes).length === 0) return;

    changes.updatedAt = new Date().toISOString();

    await db
        .update(activities)
        .set(changes)
        .where(sql`${activities.id} = ${id}`);
}

// Summary operations
async function insertSummary(summary) {
    try {
        const keyConceptsJson = summary.key_concepts
            ? JSON.stringify(summary.key_concepts)
            : null;

        const [row] = await db
            .insert(summaries)
            .values({
                activityId: summary.activity_id,
                summaryText: summary.summary_text,
                keyConcepts: keyConceptsJson,
                complexity: summary.complexity || null,
                sentiment: summary.sentiment || null,
            })
            .returning({ id: summaries.id });
        return row.id;
    } catch (error) {
        logger.error('Error inserting summary:', error);
        throw error;
    }
}

async function getSummary(activityId) {
    try {
        const [row] = await db
            .select()
            .from(summaries)
            .where(sql`${summaries.activityId} = ${activityId}`)
            .limit(1);

        if (!row) return null;

        if (row.keyConcepts) {
            row.key_concepts = JSON.parse(row.keyConcepts);
        }

        return row;
    } catch (error) {
        logger.error('Error fetching summary:', error);
        throw error;
    }
}

// Embedding operations
async function insertEmbedding(embedding) {
    try {
        const vectorJson = JSON.stringify(embedding.vector);

        const [row] = await db
            .insert(embeddings)
            .values({
                summaryId: embedding.summary_id,
                vector: vectorJson,
                modelVersion: embedding.model_version || '1.0',
            })
            .returning({ id: embeddings.id });
        return row.id;
    } catch (error) {
        logger.error('Error inserting embedding:', error);
        throw error;
    }
}

async function getEmbedding(summaryId) {
    try {
        const [row] = await db
            .select()
            .from(embeddings)
            .where(sql`${embeddings.summaryId} = ${summaryId}`)
            .limit(1);

        if (!row) return null;

        if (row.vector) {
            row.vector = JSON.parse(row.vector);
        }

        return row;
    } catch (error) {
        logger.error('Error fetching embedding:', error);
        throw error;
    }
}

// Get today's activity count
async function getTodayActivityCount() {
    try {
        const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

        const result = await db
            .select({
                count: sql`COUNT(*)`.mapWith(Number),
            })
            .from(activities)
            .where(sql`DATE(${activities.timestamp}) = ${today}`);

        return result[0]?.count || 0;
    } catch (error) {
        logger.error('Error fetching today activity count:', error);
        throw error;
    }
}

// Close database
async function closeDatabase() {
    try {
        // libSQL client doesn't require explicit close for file-based URL
        db = null;
        logger.info('Database closed');
    } catch (error) {
        logger.error('Error closing database:', error);
        throw error;
    }
}

async function insertSummaryWithAI(summary, aiResult) {
    try {
        const summaryId = await insertSummary({
            activity_id: summary.activity_id,
            summary_text: aiResult.summary?.summary || summary.summary_text,
            key_concepts:
                aiResult.concepts?.concepts?.map(c => c.text) || summary.key_concepts,
            complexity: aiResult.summary?.complexity || 'intermediate',
            sentiment: aiResult.summary?.sentiment || 0.0,
        });

        // Store embedding if available
        if (aiResult.embedding) {
            await insertEmbedding({
                summary_id: summaryId,
                vector: aiResult.embedding.embedding,
                model_version: aiResult.embedding.model,
            });
        }

        return summaryId;
    } catch (error) {
        logger.error('Error inserting summary with AI:', error);
        throw error;
    }
}

export {
    initializeDatabase,
    getDatabase,
    insertActivity,
    getActivities,
    getActivityById,
    deleteActivity,
    insertSummary,
    getSummary,
    insertEmbedding,
    getEmbedding,
    getTodayActivityCount,
    closeDatabase,
    insertSummaryWithAI,
    updateActivity, // NEW
};