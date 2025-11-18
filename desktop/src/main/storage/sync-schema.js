import { getDatabaseClient } from './sqlite-db.js';
import logger from '../utils/logger.js';

/**
 * Create sync-related database tables
 */
export async function createSyncTables() {
    try {
        const client = await getDatabaseClient();

        // Sync configuration table
        await client.execute(`
            CREATE TABLE IF NOT EXISTS sync_config (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                path TEXT NOT NULL,
                enabled BOOLEAN DEFAULT 1,
                recursive BOOLEAN DEFAULT 1,
                patterns TEXT, -- JSON array of include patterns
                excluded_patterns TEXT, -- JSON array of exclude patterns
                priority INTEGER DEFAULT 0,
                last_sync DATETIME,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Sync progress table
        await client.execute(`
            CREATE TABLE IF NOT EXISTS sync_progress (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                file_path TEXT NOT NULL,
                status TEXT NOT NULL, -- 'pending', 'processing', 'completed', 'failed'
                progress_percentage INTEGER DEFAULT 0,
                error_message TEXT,
                started_at DATETIME,
                completed_at DATETIME,
                sync_config_id INTEGER,
                FOREIGN KEY (sync_config_id) REFERENCES sync_config(id) ON DELETE CASCADE
            )
        `);

        // Indexes for performance
        await client.execute(`
            CREATE INDEX IF NOT EXISTS idx_sync_config_enabled ON sync_config(enabled);
        `);
        await client.execute(`
            CREATE INDEX IF NOT EXISTS idx_sync_config_path ON sync_config(path);
        `);
        await client.execute(`
            CREATE INDEX IF NOT EXISTS idx_sync_progress_status ON sync_progress(status);
        `);
        await client.execute(`
            CREATE INDEX IF NOT EXISTS idx_sync_progress_file_path ON sync_progress(file_path);
        `);
        await client.execute(`
            CREATE INDEX IF NOT EXISTS idx_sync_progress_sync_config_id ON sync_progress(sync_config_id);
        `);

        logger.info('Sync tables created');
    } catch (error) {
        logger.error('Error creating sync tables:', error);
        throw error;
    }
}

/**
 * Get database client (helper function)
 */
async function getDatabaseClient() {
    const { getClient } = await import('./sqlite-db.js');
    return getClient();
}