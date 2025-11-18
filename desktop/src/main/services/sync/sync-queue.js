import PQueue from 'p-queue';
import logger from '../../utils/logger.js';
import { indexFile } from '../file-indexer.js';
import { getSyncProgressTracker } from './sync-progress.js';

class SyncQueue {
    constructor(options = {}) {
        this.options = {
            concurrency: options.concurrency || 3, // Process 3 files concurrently
            interval: options.interval || 100, // Check queue every 100ms
        };

        this.queue = new PQueue({
            concurrency: this.options.concurrency,
        });

        this.progressTracker = getSyncProgressTracker();
        this.isProcessing = false;
        this.stats = {
            total: 0,
            completed: 0,
            failed: 0,
            skipped: 0,
        };
    }

    /**
     * Add file to queue
     */
    async addFile(filePath, syncConfigId = null, options = {}) {
        try {
            // Set status to pending
            await this.progressTracker.setProgress(filePath, 'pending', 0, null, syncConfigId);

            // Add to queue
            this.stats.total++;
            await this.queue.add(async () => {
                await this.processFile(filePath, syncConfigId, options);
            });

            logger.debug(`File added to sync queue: ${filePath}`);
        } catch (error) {
            logger.error(`Error adding file to queue: ${filePath}`, error);
            await this.progressTracker.setProgress(
                filePath,
                'failed',
                0,
                error.message,
                syncConfigId
            );
            this.stats.failed++;
        }
    }

    /**
     * Process a single file
     */
    async processFile(filePath, syncConfigId, options = {}) {
        try {
            // Set status to processing
            await this.progressTracker.setProgress(filePath, 'processing', 10, null, syncConfigId);

            // Index the file
            await this.progressTracker.setProgress(filePath, 'processing', 50, null, syncConfigId);

            const result = await indexFile(filePath, {
                generateEmbeddings: options.generateEmbeddings !== false,
                forceReindex: options.forceReindex || false,
            });

            if (result.success) {
                if (result.skipped) {
                    this.stats.skipped++;
                    await this.progressTracker.setProgress(
                        filePath,
                        'completed',
                        100,
                        'File already indexed',
                        syncConfigId
                    );
                } else {
                    this.stats.completed++;
                    await this.progressTracker.setProgress(
                        filePath,
                        'completed',
                        100,
                        null,
                        syncConfigId
                    );
                }
            } else {
                this.stats.failed++;
                await this.progressTracker.setProgress(
                    filePath,
                    'failed',
                    0,
                    result.reason || 'Indexing failed',
                    syncConfigId
                );
            }
        } catch (error) {
            logger.error(`Error processing file: ${filePath}`, error);
            this.stats.failed++;
            await this.progressTracker.setProgress(
                filePath,
                'failed',
                0,
                error.message,
                syncConfigId
            );
        }
    }

    /**
     * Add multiple files to queue
     */
    async addFiles(filePaths, syncConfigId = null, options = {}) {
        const promises = filePaths.map(filePath => this.addFile(filePath, syncConfigId, options));
        await Promise.all(promises);
    }

    /**
     * Get queue status
     */
    getStatus() {
        return {
            size: this.queue.size,
            pending: this.queue.pending,
            isProcessing: this.isProcessing,
            stats: { ...this.stats },
        };
    }

    /**
     * Pause queue
     */
    pause() {
        this.queue.pause();
        this.isProcessing = false;
        logger.info('Sync queue paused');
    }

    /**
     * Resume queue
     */
    resume() {
        this.queue.start();
        this.isProcessing = true;
        logger.info('Sync queue resumed');
    }

    /**
     * Clear queue
     */
    clear() {
        this.queue.clear();
        this.stats = {
            total: 0,
            completed: 0,
            failed: 0,
            skipped: 0,
        };
        logger.info('Sync queue cleared');
    }

    /**
     * Wait for queue to be empty
     */
    async onIdle() {
        return this.queue.onIdle();
    }

    /**
     * Reset stats
     */
    resetStats() {
        this.stats = {
            total: 0,
            completed: 0,
            failed: 0,
            skipped: 0,
        };
    }
}

// Singleton instance
let syncQueueInstance = null;

export function getSyncQueue() {
    if (!syncQueueInstance) {
        syncQueueInstance = new SyncQueue();
    }
    return syncQueueInstance;
}