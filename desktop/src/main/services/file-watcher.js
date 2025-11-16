import chokidar from 'chokidar';
import path from 'path';
import { app } from 'electron';
import logger from '../utils/logger.js';

let watcher = null;

// Watch PDF files in common directories
function startFileWatcher() {
    if (watcher) {
        logger.warn('File watcher already started');
        return;
    }

    const watchPaths = [
        path.join(app.getPath('documents'), '**/*.pdf'),
        path.join(app.getPath('downloads'), '**/*.pdf'),
    ];

    watcher = chokidar.watch(watchPaths, {
        ignored: /(^|[\/\\])\../, // ignore dotfiles
        persistent: true,
        ignoreInitial: true,
    });

    watcher
        .on('add', (filePath) => {
            logger.info(`PDF file detected: ${filePath}`);
            // Could trigger activity creation here
        })
        .on('change', (filePath) => {
            logger.debug(`PDF file changed: ${filePath}`);
        })
        .on('error', (error) => {
            logger.error('File watcher error:', error);
        });

    logger.info('File watcher started for PDF files');
}

function stopFileWatcher() {
    if (watcher) {
        watcher.close();
        watcher = null;
        logger.info('File watcher stopped');
    }
}

export { startFileWatcher, stopFileWatcher };