import { EventEmitter } from 'events';
import { getSyncQueue } from './sync-queue.js';
import { getSyncProgressTracker } from './sync-progress.js';
import { getEnabledSyncConfigs, updateLastSync } from './sync-config.js';
import { startFileWatcher, stopFileWatcher } from '../file-watcher.js';
import { glob } from 'fast-glob';
import path from 'path';
import fs from 'fs';
import logger from '../../utils/logger.js';

class SyncManager extends EventEmitter {
    constructor() {
        super();
        this.isRunning = false;
        this.isPaused = false;
        this.queue = getSyncQueue();
        this.progressTracker = getSyncProgressTracker();

        // Listen to progress events
        this.progressTracker.on('progress', (progress) => {
            this.emit('progress', progress);
        });
    }

    /**
     * Start sync process
     */
    async start(options = {}) {
        if (this.isRunning) {
            logger.warn('Sync already running');
            return;
        }

        try {
            this.isRunning = true;
            this.isPaused = false;
            logger.info('Starting file sync...');

            // Get enabled sync configurations
            const configs = await getEnabledSyncConfigs();

            if (configs.length === 0) {
                logger.warn('No enabled sync configurations found');
                this.isRunning = false;
                return;
            }

            // Start file watcher if not already running
            // Note: file-watcher should be started separately, but we ensure it's running
            // startFileWatcher(); // Uncomment if needed

            // Scan existing files if requested
            if (options.scanExisting !== false) {
                await this.scanExistingFiles(configs);
            }

            this.emit('started');
            logger.info('File sync started');
        } catch (error) {
            logger.error('Error starting sync:', error);
            this.isRunning = false;
            throw error;
        }
    }

    /**
     * Scan existing files in configured paths
     */
    async scanExistingFiles(configs) {
        logger.info(`Scanning existing files in ${configs.length} path(s)...`);

        for (const config of configs) {
            try {
                await this.scanPath(config);
            } catch (error) {
                logger.error(`Error scanning path ${config.path}:`, error);
            }
        }
    }

    /**
     * Scan a single path
     */
    async scanPath(config) {
        const { path: basePath, patterns = [], excludedPatterns = [], recursive = true, id } = config;

        if (!fs.existsSync(basePath)) {
            logger.warn(`Path does not exist: ${basePath}`);
            return;
        }

        // Default patterns if none specified
        const defaultPatterns = [
            '**/*.pdf',
            '**/*.docx',
            '**/*.xlsx',
            '**/*.pptx',
            '**/*.txt',
            '**/*.md',
            '**/*.jpg',
            '**/*.jpeg',
            '**/*.png',
            '**/*.gif',
            '**/*.webp',
        ];

        const includePatterns = patterns.length > 0 ? patterns : defaultPatterns;
        const searchPatterns = includePatterns.map(pattern =>
            recursive ? path.join(basePath, '**', pattern) : path.join(basePath, pattern)
        );

        try {
            const files = await glob(searchPatterns, {
                ignore: excludedPatterns,
                absolute: true,
            });

            logger.info(`Found ${files.length} files in ${basePath}`);

            // Add files to queue
            for (const filePath of files) {
                await this.queue.addFile(filePath, id);
            }

            // Update last sync time
            await updateLastSync(id);
        } catch (error) {
            logger.error(`Error scanning path ${basePath}:`, error);
            throw error;
        }
    }

    /**
     * Stop sync process
     */
    async stop() {
        if (!this.isRunning) {
            return;
        }

        try {
            this.isRunning = false;
            this.isPaused = false;
            this.queue.pause();
            this.emit('stopped');
            logger.info('File sync stopped');
        } catch (error) {
            logger.error('Error stopping sync:', error);
            throw error;
        }
    }

    /**
     * Pause sync
     */
    pause() {
        if (!this.isRunning || this.isPaused) {
            return;
        }

        this.isPaused = true;
        this.queue.pause();
        this.emit('paused');
        logger.info('File sync paused');
    }

    /**
     * Resume sync
     */
    resume() {
        if (!this.isRunning || !this.isPaused) {
            return;
        }

        this.isPaused = false;
        this.queue.resume();
        this.emit('resumed');
        logger.info('File sync resumed');
    }

    /**
     * Get sync status
     */
    async getStatus() {
        const queueStatus = this.queue.getStatus();
        const overallStats = await this.progressTracker.getOverallStats();

        return {
            isRunning: this.isRunning,
            isPaused: this.isPaused,
            queue: queueStatus,
            stats: overallStats,
        };
    }
}

// Singleton instance
let syncManagerInstance = null;

export function getSyncManager() {
    if (!syncManagerInstance) {
        syncManagerInstance = new SyncManager();
    }
    return syncManagerInstance;
}