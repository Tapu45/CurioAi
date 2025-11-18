import { getClient } from '../../storage/sqlite-db.js';
import { EventEmitter } from 'events';
import logger from '../../utils/logger.js';

class SyncProgressTracker extends EventEmitter {
    constructor() {
        super();
        this.progressCache = new Map();
    }

    /**
     * Create or update progress entry
     */
    async setProgress(filePath, status, progressPercentage = 0, errorMessage = null, syncConfigId = null) {
        try {
            const client = getClient();
            const now = new Date().toISOString();

            // Check if entry exists
            const existing = await client.execute(
                'SELECT id FROM sync_progress WHERE file_path = ?',
                [filePath]
            );

            if (existing.rows.length > 0) {
                // Update existing
                const id = existing.rows[0].id;
                await client.execute(
                    `UPDATE sync_progress 
                     SET status = ?, progress_percentage = ?, error_message = ?, 
                         completed_at = ${status === 'completed' || status === 'failed' ? '?' : 'completed_at'},
                         sync_config_id = ?
                     WHERE id = ?`,
                    status === 'completed' || status === 'failed'
                        ? [status, progressPercentage, errorMessage, syncConfigId, now, id]
                        : [status, progressPercentage, errorMessage, syncConfigId, id]
                );

                // Emit progress event
                this.emit('progress', {
                    filePath,
                    status,
                    progressPercentage,
                    errorMessage,
                    id,
                });
            } else {
                // Create new
                const result = await client.execute(
                    `INSERT INTO sync_progress (file_path, status, progress_percentage, error_message, started_at, sync_config_id)
                     VALUES (?, ?, ?, ?, ?, ?)`,
                    [filePath, status, progressPercentage, errorMessage, now, syncConfigId]
                );

                // Emit progress event
                this.emit('progress', {
                    filePath,
                    status,
                    progressPercentage,
                    errorMessage,
                    id: result.lastInsertRowid,
                });
            }

            // Update cache
            this.progressCache.set(filePath, {
                status,
                progressPercentage,
                errorMessage,
            });
        } catch (error) {
            logger.error('Error setting progress:', error);
            throw error;
        }
    }

    /**
     * Get progress for a file
     */
    async getProgress(filePath) {
        try {
            // Check cache first
            if (this.progressCache.has(filePath)) {
                return this.progressCache.get(filePath);
            }

            const client = getClient();
            const result = await client.execute(
                'SELECT * FROM sync_progress WHERE file_path = ? ORDER BY id DESC LIMIT 1',
                [filePath]
            );

            if (result.rows.length === 0) {
                return null;
            }

            const row = result.rows[0];
            const progress = {
                id: row.id,
                filePath: row.file_path,
                status: row.status,
                progressPercentage: row.progress_percentage,
                errorMessage: row.error_message,
                startedAt: row.started_at,
                completedAt: row.completed_at,
                syncConfigId: row.sync_config_id,
            };

            // Update cache
            this.progressCache.set(filePath, progress);
            return progress;
        } catch (error) {
            logger.error('Error getting progress:', error);
            throw error;
        }
    }

    /**
     * Get overall sync statistics
     */
    async getOverallStats() {
        try {
            const client = getClient();
            const stats = await client.execute(`
                SELECT 
                    COUNT(*) as total,
                    SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
                    SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END) as processing,
                    SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
                    SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
                    AVG(progress_percentage) as avg_progress
                FROM sync_progress
            `);

            const row = stats.rows[0];
            return {
                total: row.total || 0,
                pending: row.pending || 0,
                processing: row.processing || 0,
                completed: row.completed || 0,
                failed: row.failed || 0,
                avgProgress: row.avg_progress || 0,
            };
        } catch (error) {
            logger.error('Error getting overall stats:', error);
            throw error;
        }
    }

    /**
     * Get progress by sync config ID
     */
    async getProgressByConfigId(syncConfigId) {
        try {
            const client = getClient();
            const result = await client.execute(
                'SELECT * FROM sync_progress WHERE sync_config_id = ? ORDER BY id DESC',
                [syncConfigId]
            );
            return result.rows.map(row => ({
                id: row.id,
                filePath: row.file_path,
                status: row.status,
                progressPercentage: row.progress_percentage,
                errorMessage: row.error_message,
                startedAt: row.started_at,
                completedAt: row.completed_at,
            }));
        } catch (error) {
            logger.error('Error getting progress by config:', error);
            throw error;
        }
    }

    /**
     * Clear completed progress entries (cleanup)
     */
    async clearCompleted(olderThanDays = 7) {
        try {
            const client = getClient();
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

            await client.execute(
                'DELETE FROM sync_progress WHERE status IN ("completed", "failed") AND completed_at < ?',
                [cutoffDate.toISOString()]
            );

            logger.info('Cleared old progress entries');
        } catch (error) {
            logger.error('Error clearing completed progress:', error);
            throw error;
        }
    }

    /**
     * Clear cache
     */
    clearCache() {
        this.progressCache.clear();
    }
}

// Singleton instance
let progressTrackerInstance = null;

export function getSyncProgressTracker() {
    if (!progressTrackerInstance) {
        progressTrackerInstance = new SyncProgressTracker();
    }
    return progressTrackerInstance;
}