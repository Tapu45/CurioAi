import chokidar from 'chokidar';
import path from 'path';
import { app } from 'electron';
import logger from '../utils/logger.js';
import { indexFile } from './file-indexer.js';
import { getAppConfig } from '../utils/config-manager.js';

let watcher = null;
let isWatching = false;

// Default file patterns to watch
const DEFAULT_PATTERNS = {
    documents: ['**/*.pdf', '**/*.docx', '**/*.xlsx', '**/*.pptx', '**/*.txt', '**/*.md'],
    images: ['**/*.jpg', '**/*.jpeg', '**/*.png', '**/*.gif', '**/*.webp'],
    code: ['**/*.js', '**/*.ts', '**/*.jsx', '**/*.tsx', '**/*.py', '**/*.java', '**/*.cpp', '**/*.c', '**/*.go', '**/*.rs'],
};

// Default ignored patterns
const DEFAULT_IGNORED = [
    /(^|[\/\\])\../, // dotfiles
    /node_modules/,
    /\.git/,
    /\.vscode/,
    /\.idea/,
    /\.DS_Store/,
    /Thumbs\.db/,
    /\.tmp$/,
    /\.log$/,
];

// Queue for batch processing
let processingQueue = [];
let processingTimeout = null;
const BATCH_DELAY = 5000; // Process batch every 5 seconds
const MAX_BATCH_SIZE = 20;

/**
 * Process queued files
 */
async function processQueue() {
    if (processingQueue.length === 0) {
        return;
    }

    const batch = processingQueue.splice(0, MAX_BATCH_SIZE);
    logger.info(`Processing batch of ${batch.length} files`);

    for (const filePath of batch) {
        try {
            await indexFile(filePath, { generateEmbeddings: true });
        } catch (error) {
            logger.error(`Error indexing file ${filePath}:`, error);
        }
    }

    // Schedule next batch if queue not empty
    if (processingQueue.length > 0) {
        scheduleQueueProcessing();
    }
}

/**
 * Schedule queue processing
 */
function scheduleQueueProcessing() {
    if (processingTimeout) {
        clearTimeout(processingTimeout);
    }
    processingTimeout = setTimeout(processQueue, BATCH_DELAY);
}

/**
 * Add file to processing queue
 */
function queueFile(filePath) {
    // Avoid duplicates
    if (processingQueue.includes(filePath)) {
        return;
    }
    processingQueue.push(filePath);
    scheduleQueueProcessing();
}

/**
 * Start file watcher
 */
function startFileWatcher() {
    if (isWatching) {
        logger.warn('File watcher already started');
        return;
    }

    const config = getAppConfig();
    const watchPaths = config.fileWatchPaths || [
        app.getPath('documents'),
        app.getPath('downloads'),
        app.getPath('desktop'),
    ];

    // Build glob patterns
    const patterns = [];
    watchPaths.forEach((basePath) => {
        DEFAULT_PATTERNS.documents.forEach((pattern) => {
            patterns.push(path.join(basePath, pattern));
        });
        DEFAULT_PATTERNS.images.forEach((pattern) => {
            patterns.push(path.join(basePath, pattern));
        });
        if (config.watchCodeFiles !== false) {
            DEFAULT_PATTERNS.code.forEach((pattern) => {
                patterns.push(path.join(basePath, pattern));
            });
        }
    });

    // Combine ignored patterns
    const ignored = [...DEFAULT_IGNORED];
    if (config.fileWatchIgnored) {
        ignored.push(...config.fileWatchIgnored.map(p => new RegExp(p)));
    }

    watcher = chokidar.watch(patterns, {
        ignored,
        persistent: true,
        ignoreInitial: true, // Don't process existing files on startup
        awaitWriteFinish: {
            stabilityThreshold: 2000, // Wait 2s after file stops changing
            pollInterval: 100,
        },
    });

    watcher
        .on('add', (filePath) => {
            logger.info(`File detected: ${path.basename(filePath)}`);
            queueFile(filePath);
        })
        .on('change', (filePath) => {
            logger.debug(`File changed: ${path.basename(filePath)}`);
            queueFile(filePath);
        })
        .on('unlink', (filePath) => {
            logger.info(`File deleted: ${path.basename(filePath)}`);
            // TODO: Handle file deletion (mark as deleted in DB)
        })
        .on('error', (error) => {
            logger.error('File watcher error:', error);
        })
        .on('ready', () => {
            logger.info(`File watcher ready, watching ${patterns.length} patterns`);
        });

    isWatching = true;
    logger.info('File watcher started');
}

/**
 * Stop file watcher
 */
function stopFileWatcher() {
    if (watcher) {
        watcher.close();
        watcher = null;
        isWatching = false;

        // Process remaining queue
        if (processingQueue.length > 0) {
            logger.info(`Processing ${processingQueue.length} remaining files in queue`);
            processQueue();
        }

        if (processingTimeout) {
            clearTimeout(processingTimeout);
            processingTimeout = null;
        }

        logger.info('File watcher stopped');
    }
}

/**
 * Get watcher status
 */
function getWatcherStatus() {
    return {
        isWatching,
        queueLength: processingQueue.length,
    };
}

export { startFileWatcher, stopFileWatcher, getWatcherStatus };