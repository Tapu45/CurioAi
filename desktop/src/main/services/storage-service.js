import { stat } from 'fs/promises';
import { join } from 'path';
import { app } from 'electron';
import logger from '../utils/logger.js';

export async function getStorageSize() {
    try {
        const userDataPath = app.getPath('userData');
        const dbPath = join(userDataPath, 'data', 'sqlite', 'curioai.db');
        const lancedbPath = join(userDataPath, 'data', 'lancedb');
        const graphPath = join(userDataPath, 'data', 'graph');

        const sizes = {
            sqlite: 0,
            lancedb: 0,
            graph: 0,
            total: 0,
        };

        try {
            const dbStat = await stat(dbPath);
            sizes.sqlite = dbStat.size;
        } catch (e) {
            // File doesn't exist yet
        }

        // Calculate directory sizes (simplified - would need recursive walk for full accuracy)
        try {
            const lancedbStat = await stat(lancedbPath);
            if (lancedbStat.isDirectory()) {
                // Simplified - would need to walk directory
                sizes.lancedb = 0; // Placeholder
            }
        } catch (e) {
            // Directory doesn't exist
        }

        sizes.total = sizes.sqlite + sizes.lancedb + sizes.graph;

        return {
            sqlite: sizes.sqlite,
            lancedb: sizes.lancedb,
            graph: sizes.graph,
            total: sizes.total,
            formatted: {
                sqlite: formatBytes(sizes.sqlite),
                lancedb: formatBytes(sizes.lancedb),
                graph: formatBytes(sizes.graph),
                total: formatBytes(sizes.total),
            },
        };
    } catch (error) {
        logger.error('Error calculating storage size:', error);
        return {
            sqlite: 0,
            lancedb: 0,
            graph: 0,
            total: 0,
            formatted: {
                sqlite: '0 B',
                lancedb: '0 B',
                graph: '0 B',
                total: '0 B',
            },
        };
    }
}

function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}