import { getClient } from '../../storage/sqlite-db.js';
import logger from '../../utils/logger.js';

/**
 * Get all sync configurations
 */
export async function getAllSyncConfigs() {
    try {
        const client = getClient();
        const result = await client.execute('SELECT * FROM sync_config ORDER BY priority DESC, created_at ASC');
        return result.rows.map(row => ({
            id: row.id,
            path: row.path,
            enabled: Boolean(row.enabled),
            recursive: Boolean(row.recursive),
            patterns: row.patterns ? JSON.parse(row.patterns) : [],
            excludedPatterns: row.excluded_patterns ? JSON.parse(row.excluded_patterns) : [],
            priority: row.priority,
            lastSync: row.last_sync,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        }));
    } catch (error) {
        logger.error('Error getting sync configs:', error);
        throw error;
    }
}

/**
 * Get sync configuration by ID
 */
export async function getSyncConfigById(id) {
    try {
        const client = getClient();
        const result = await client.execute('SELECT * FROM sync_config WHERE id = ?', [id]);
        if (result.rows.length === 0) {
            return null;
        }
        const row = result.rows[0];
        return {
            id: row.id,
            path: row.path,
            enabled: Boolean(row.enabled),
            recursive: Boolean(row.recursive),
            patterns: row.patterns ? JSON.parse(row.patterns) : [],
            excludedPatterns: row.excluded_patterns ? JSON.parse(row.excluded_patterns) : [],
            priority: row.priority,
            lastSync: row.last_sync,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        };
    } catch (error) {
        logger.error('Error getting sync config:', error);
        throw error;
    }
}

/**
 * Get enabled sync configurations
 */
export async function getEnabledSyncConfigs() {
    try {
        const client = getClient();
        const result = await client.execute(
            'SELECT * FROM sync_config WHERE enabled = 1 ORDER BY priority DESC, created_at ASC'
        );
        return result.rows.map(row => ({
            id: row.id,
            path: row.path,
            enabled: Boolean(row.enabled),
            recursive: Boolean(row.recursive),
            patterns: row.patterns ? JSON.parse(row.patterns) : [],
            excludedPatterns: row.excluded_patterns ? JSON.parse(row.excluded_patterns) : [],
            priority: row.priority,
            lastSync: row.last_sync,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        }));
    } catch (error) {
        logger.error('Error getting enabled sync configs:', error);
        throw error;
    }
}

/**
 * Add sync configuration
 */
export async function addSyncConfig(config) {
    try {
        const client = getClient();
        const {
            path,
            enabled = true,
            recursive = true,
            patterns = [],
            excludedPatterns = [],
            priority = 0,
        } = config;

        const result = await client.execute(
            `INSERT INTO sync_config (path, enabled, recursive, patterns, excluded_patterns, priority)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [
                path,
                enabled ? 1 : 0,
                recursive ? 1 : 0,
                JSON.stringify(patterns),
                JSON.stringify(excludedPatterns),
                priority,
            ]
        );

        logger.info(`Sync config added: ${path} (ID: ${result.lastInsertRowid})`);
        return result.lastInsertRowid;
    } catch (error) {
        logger.error('Error adding sync config:', error);
        throw error;
    }
}

/**
 * Update sync configuration
 */
export async function updateSyncConfig(id, updates) {
    try {
        const client = getClient();
        const fields = [];
        const values = [];

        if (updates.path !== undefined) {
            fields.push('path = ?');
            values.push(updates.path);
        }
        if (updates.enabled !== undefined) {
            fields.push('enabled = ?');
            values.push(updates.enabled ? 1 : 0);
        }
        if (updates.recursive !== undefined) {
            fields.push('recursive = ?');
            values.push(updates.recursive ? 1 : 0);
        }
        if (updates.patterns !== undefined) {
            fields.push('patterns = ?');
            values.push(JSON.stringify(updates.patterns));
        }
        if (updates.excludedPatterns !== undefined) {
            fields.push('excluded_patterns = ?');
            values.push(JSON.stringify(updates.excludedPatterns));
        }
        if (updates.priority !== undefined) {
            fields.push('priority = ?');
            values.push(updates.priority);
        }

        if (fields.length === 0) {
            return;
        }

        fields.push('updated_at = CURRENT_TIMESTAMP');
        values.push(id);

        await client.execute(
            `UPDATE sync_config SET ${fields.join(', ')} WHERE id = ?`,
            values
        );

        logger.info(`Sync config updated: ID ${id}`);
    } catch (error) {
        logger.error('Error updating sync config:', error);
        throw error;
    }
}

/**
 * Delete sync configuration
 */
export async function deleteSyncConfig(id) {
    try {
        const client = getClient();
        await client.execute('DELETE FROM sync_config WHERE id = ?', [id]);
        logger.info(`Sync config deleted: ID ${id}`);
    } catch (error) {
        logger.error('Error deleting sync config:', error);
        throw error;
    }
}

/**
 * Update last sync time
 */
export async function updateLastSync(id, lastSync = new Date().toISOString()) {
    try {
        const client = getClient();
        await client.execute(
            'UPDATE sync_config SET last_sync = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [lastSync, id]
        );
    } catch (error) {
        logger.error('Error updating last sync:', error);
        throw error;
    }
}