import { app } from 'electron';
import { createMainWindow } from './windows/main-window.js';
import { setupTray } from './windows/tray-manager.js';
import { setupApplicationMenu } from './menu/application-menu.js';
import { registerIpcHandlers } from './ipc/handlers.js';
import { initializeDatabase } from './storage/sqlite-db.js';
import { loadConfig } from './utils/config-manager.js';
import logger from './utils/logger.js';
import { startTracking, stopTracking } from './services/activity-tracker.js';
import { initializeChromaDB } from './storage/chromadb-client.js';
import { startGraphScheduler, stopGraphScheduler } from './services/graph-scheduler.js';
import { closeChromaDB } from './storage/chromadb-client.js';
import { startAIService, stopAIService } from './services/ai-services-manager.js';
import { initializeGraph, checkConnection as checkGraphConnection } from './storage/graph-client.js';
import { closeGraph } from './storage/graph-client.js';



// Keep a global reference of the window object
let mainWindow = null;
let tray = null;

// Initialize app
async function initializeApp() {
    try {
        logger.info('Initializing CurioAI Desktop...');

        // Load configuration
        await loadConfig();
        logger.info('Configuration loaded');

        // Initialize database
        await initializeDatabase();
        logger.info('Database initialized');

        // Initialize ChromaDB
        try {
            initializeChromaDB();
            logger.info('ChromaDB initialized');
        } catch (error) {
            logger.warn(
                'ChromaDB initialization failed:',
                error instanceof Error ? error.message : String(error)
            );
        }

        try {
            const aiStarted = await startAIService();
            if (aiStarted) {
                logger.info('AI service started');
            } else {
                logger.warn('AI service failed to start - some features will be limited');
            }
        } catch (error) {
            logger.warn(
                'AI service startup failed:',
                error instanceof Error ? error.message : String(error)
            );
        }

        // Initialize Graph (graphology + SQLite)
        try {
            await initializeGraph();
            const graphConnected = await checkGraphConnection();
            if (graphConnected) {
                logger.info('Graph initialized and ready');
            } else {
                logger.warn('Graph initialization failed - graph features will be limited');
            }
        } catch (error) {
            logger.warn(
                'Graph initialization failed:',
                error instanceof Error ? error.message : String(error)
            );
        }

        // Register IPC handlers
        registerIpcHandlers();
        logger.info('IPC handlers registered');

        // Create main window
        mainWindow = createMainWindow();
        logger.info('Main window created');

        // Setup system tray
        tray = setupTray(mainWindow);
        logger.info('System tray setup complete');

        // Setup application menu
        setupApplicationMenu();
        logger.info('Application menu setup complete');


        // Start activity tracking
        await startTracking();
        logger.info('Activity tracking started');

        // Start graph scheduler
        startGraphScheduler();
        logger.info('Graph scheduler started');

        logger.info('CurioAI Desktop initialized successfully');
    } catch (error) {
        logger.error('Failed to initialize app:', error);
        if (error instanceof Error && error.stack) {
            logger.error('Error stack:', error.stack);
        }
        if (error instanceof Error && error.message) {
            logger.error('Error message:', error.message);
        }
        app.quit();
    }
}

// App event handlers
app.whenReady().then(() => {
    initializeApp();

    app.on('activate', () => {
        if (mainWindow === null) {
            mainWindow = createMainWindow();
        }
    });
});

app.on('window-all-closed', () => {
    // On macOS, keep app running even when all windows are closed
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('before-quit', () => {
    logger.info('Application shutting down...');
});

app.on('will-quit', (event) => {
    // Stop tracking before quit
    stopTracking();

    // Stop graph scheduler
    stopGraphScheduler();

    // Stop AI service
    stopAIService();

    closeChromaDB();
    closeGraph();

    logger.info('Application quit');
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});