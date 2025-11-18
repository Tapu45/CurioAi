import { ipcMain, BrowserWindow , dialog} from 'electron';
import { CHANNELS } from './channels.js';
import { getActivityStatus, pauseTracking, resumeTracking, getTodayActivityCount } from '../services/activity-tracker.js';
import { getSettings, updateSettings, getWhitelist, updateWhitelist } from '../services/settings-service.js';
import { getActivities, getSummary, deleteActivity } from '../storage/sqlite-db.js';
import logger from '../utils/logger.js';
import { registerSyncHandlers } from './sync-handlers.js';

// Activity handlers
function registerActivityHandlers() {
    ipcMain.handle(CHANNELS.ACTIVITY.GET_STATUS, async () => {
        try {
            const { getActivityStatus } = await import('../services/activity-tracker.js');
            return await getActivityStatus();
        } catch (error) {
            logger.error('Error getting activity status:', error);
            throw error;
        }
    });

    ipcMain.handle(CHANNELS.ACTIVITY.PAUSE, async () => {
        try {
            const { pauseTracking } = await import('../services/activity-tracker.js');
            await pauseTracking();
            return { success: true };
        } catch (error) {
            logger.error('Error pausing tracking:', error);
            throw error;
        }
    });

    ipcMain.handle(CHANNELS.ACTIVITY.RESUME, async () => {
        try {
            const { resumeTracking } = await import('../services/activity-tracker.js');
            await resumeTracking();
            return { success: true };
        } catch (error) {
            logger.error('Error resuming tracking:', error);
            throw error;
        }
    });

    ipcMain.handle(CHANNELS.ACTIVITY.GET_TODAY_COUNT, async () => {
        try {
            const { getTodayActivityCount } = await import('../services/activity-tracker.js');
            return await getTodayActivityCount();
        } catch (error) {
            logger.error('Error getting today count:', error);
            throw error;
        }
    });
}

// Settings handlers
function registerSettingsHandlers() {
    ipcMain.handle(CHANNELS.SETTINGS.GET, async () => {
        try {
            return await getSettings();
        } catch (error) {
            logger.error('Error getting settings:', error);
            throw error;
        }
    });

    ipcMain.handle(CHANNELS.SETTINGS.UPDATE, async (event, settings) => {
        try {
            return await updateSettings(settings);
        } catch (error) {
            logger.error('Error updating settings:', error);
            throw error;
        }
    });

    ipcMain.handle(CHANNELS.SETTINGS.GET_WHITELIST, async () => {
        try {
            return await getWhitelist();
        } catch (error) {
            logger.error('Error getting whitelist:', error);
            throw error;
        }
    });

    ipcMain.handle(CHANNELS.SETTINGS.UPDATE_WHITELIST, async (event, whitelist) => {
        try {
            return await updateWhitelist(whitelist);
        } catch (error) {
            logger.error('Error updating whitelist:', error);
            throw error;
        }
    });
}

// Database handlers
function registerDatabaseHandlers() {
    ipcMain.handle(CHANNELS.DB.GET_ACTIVITIES, async (event, filters) => {
        try {
            return await getActivities(filters);
        } catch (error) {
            logger.error('Error getting activities:', error);
            throw error;
        }
    });

    ipcMain.handle(CHANNELS.DB.GET_SUMMARY, async (event, activityId) => {
        try {
            return await getSummary(activityId);
        } catch (error) {
            logger.error('Error getting summary:', error);
            throw error;
        }
    });

    ipcMain.handle(CHANNELS.DB.DELETE_ACTIVITY, async (event, activityId) => {
        try {
            return await deleteActivity(activityId);
        } catch (error) {
            logger.error('Error deleting activity:', error);
            throw error;
        }
    });

    // Export data handler
    ipcMain.handle(CHANNELS.DB.EXPORT_DATA, async (event, format = 'json') => {
        try {
            const { dialog } = await import('electron');
            const { writeFile } = await import('fs/promises');
            const win = BrowserWindow.fromWebContents(event.sender);

            const result = await dialog.showSaveDialog(win, {
                title: 'Export CurioAI Data',
                defaultPath: `curioai-export-${new Date().toISOString().split('T')[0]}.${format}`,
                filters: [
                    { name: 'JSON', extensions: ['json'] },
                    { name: 'CSV', extensions: ['csv'] },
                ],
            });

            if (result.canceled) {
                return { success: false, canceled: true };
            }

            // Get all data
            const { getAllActivities } = await import('../storage/sqlite-db.js');
            const { getAllSummaries } = await import('../storage/sqlite-db.js');
            const { getGraphData } = await import('../services/database-service.js');

            const activities = await getAllActivities();
            const summaries = await getAllSummaries();
            const graphData = await getGraphData();

            let exportData;
            if (format === 'json') {
                exportData = JSON.stringify({
                    version: '1.0',
                    exportDate: new Date().toISOString(),
                    activities,
                    summaries,
                    graph: graphData,
                }, null, 2);
            } else {
                // CSV format
                const csvRows = ['Title,URL,Source Type,Timestamp,Summary'];
                activities.forEach((activity) => {
                    const summary = summaries.find((s) => s.activity_id === activity.id);
                    const title = (activity.title || '').replace(/"/g, '""');
                    const url = (activity.url || '').replace(/"/g, '""');
                    const summaryText = (summary?.summary_text || '').replace(/"/g, '""');
                    csvRows.push(
                        `"${title}","${url}","${activity.source_type}","${activity.timestamp}","${summaryText}"`
                    );
                });
                exportData = csvRows.join('\n');
            }

            await writeFile(result.filePath, exportData, 'utf-8');
            logger.info(`Data exported to ${result.filePath}`);
            return { success: true, filePath: result.filePath };
        } catch (error) {
            logger.error('Error exporting data:', error);
            throw error;
        }
    });

    // Clear all data handler
    ipcMain.handle(CHANNELS.DB.CLEAR_DATA, async () => {
        try {
            const { clearAllData } = await import('../storage/sqlite-db.js');
            const { clearCollection } = await import('../storage/lancedb-client.js');
            const { clearGraph } = await import('../storage/graph-client.js');

            await clearAllData();
            await clearCollection();
            await clearGraph();

            logger.info('All data cleared');
            return { success: true };
        } catch (error) {
            logger.error('Error clearing data:', error);
            throw error;
        }
    });

    // Get storage usage handler
    ipcMain.handle('db:get-storage-usage', async () => {
        try {
            const { getStorageSize } = await import('../services/storage-service.js');
            return await getStorageSize();
        } catch (error) {
            logger.error('Error getting storage usage:', error);
            return {
                sqlite: 0,
                chromadb: 0,
                graph: 0,
                total: 0,
                formatted: {
                    sqlite: '0 B',
                    chromadb: '0 B',
                    graph: '0 B',
                    total: '0 B',
                },
            };
        }
    });
}

// Graph handlers
function registerGraphHandlers() {
    ipcMain.handle(CHANNELS.GRAPH.GET_DATA, async () => {
        try {
            const { getGraphData } = await import('../services/database-service.js');
            return await getGraphData();
        } catch (error) {
            logger.error('Error getting graph data:', error);
            throw error;
        }
    });

    ipcMain.handle(CHANNELS.GRAPH.GET_RELATED, async (event, concept) => {
        try {
            const { getRelatedConcepts } = await import('../services/database-service.js');
            return await getRelatedConcepts(concept);
        } catch (error) {
            logger.error('Error getting related concepts:', error);
            throw error;
        }
    });

    ipcMain.handle(CHANNELS.GRAPH.GET_CONCEPT_DETAILS, async (event, conceptName) => {
        try {
            const { getConceptDetails } = await import('../services/graph-visualization.js');
            return await getConceptDetails(conceptName);
        } catch (error) {
            logger.error('Error getting concept details:', error);
            throw error;
        }
    });

    ipcMain.handle(CHANNELS.GRAPH.BUILD_GRAPH, async () => {
        try {
            const { triggerGraphBuild } = await import('../services/graph-scheduler.js');
            return await triggerGraphBuild();
        } catch (error) {
            logger.error('Error building graph:', error);
            throw error;
        }
    });

    ipcMain.handle(CHANNELS.GRAPH.GET_STATS, async () => {
        try {
            const { getGraphStatistics } = await import('../services/graph-builder.js');
            return await getGraphStatistics();
        } catch (error) {
            logger.error('Error getting graph stats:', error);
            throw error;
        }
    });

    ipcMain.handle(CHANNELS.GRAPH.GET_VISUALIZATION, async (event, options) => {
        try {
            const { getVisualizationData } = await import('../services/graph-visualization.js');
            return await getVisualizationData(options);
        } catch (error) {
            logger.error('Error getting visualization data:', error);
            throw error;
        }
    });
}

// Search handlers
function registerSearchHandlers() {
    ipcMain.handle(CHANNELS.SEARCH.SEMANTIC_SEARCH, async (event, query, options) => {
        try {
            const { semanticSearch } = await import('../services/search-service.js');
            return await semanticSearch(query, options);
        } catch (error) {
            logger.error('Error in semantic search:', error);
            throw error;
        }
    });

    ipcMain.handle(CHANNELS.SEARCH.CHECK_AI_SERVICE, async () => {
        try {
            const { checkServiceHealth } = await import('../services/ai-service-client.js');
            return await checkServiceHealth();
        } catch (error) {
            logger.error('Error checking AI service:', error);
            return false;
        }
    });
}

// Chat handlers
function registerChatHandlers() {
    ipcMain.handle(CHANNELS.CHAT.GET_HISTORY, async (event, limit = 50) => {
        try {
            const { getChatHistoryFromDB } = await import('../services/chat-service.js');
            return await getChatHistoryFromDB(limit);
        } catch (error) {
            logger.error('Error getting chat history:', error);
            return [];
        }
    });

    ipcMain.handle(CHANNELS.CHAT.SEND_MESSAGE, async (event, message, options = {}) => {
        try {
            const { sendChatMessage } = await import('../services/chat-service.js');

            // Check if streaming is requested
            if (options.streaming) {
                // For now, return non-streaming but mark for future enhancement
                const response = await sendChatMessage(message, { ...options, streaming: false });
                return response;
            }

            return await sendChatMessage(message, options);
        } catch (error) {
            logger.error('Error sending chat message:', error);
            throw error;
        }
    });
}

// File handlers
function registerFileHandlers() {
    // Index a single file
    ipcMain.handle(CHANNELS.FILE.INDEX, async (event, filePath, options = {}) => {
        try {
            const { indexFile } = await import('../services/file-indexer.js');
            return await indexFile(filePath, options);
        } catch (error) {
            logger.error('Error indexing file:', error);
            throw error;
        }
    });

    // Index multiple files (batch)
    ipcMain.handle(CHANNELS.FILE.INDEX_BATCH, async (event, filePaths, options = {}) => {
        try {
            const { indexFiles } = await import('../services/file-indexer.js');
            return await indexFiles(filePaths, options);
        } catch (error) {
            logger.error('Error batch indexing files:', error);
            throw error;
        }
    });

    // Get all files
    ipcMain.handle(CHANNELS.FILE.GET_ALL, async (event, { limit = 100, offset = 0, filters = {} }) => {
        try {
            const { getAllFiles } = await import('../storage/sqlite-db.js');
            let files = await getAllFiles(limit, offset);

            // Apply filters if provided
            if (filters.type) {
                files = files.filter(f => f.type === filters.type);
            }
            if (filters.search) {
                const searchLower = filters.search.toLowerCase();
                files = files.filter(f =>
                    f.name.toLowerCase().includes(searchLower) ||
                    (f.extracted_text && f.extracted_text.toLowerCase().includes(searchLower))
                );
            }

            return files;
        } catch (error) {
            logger.error('Error getting all files:', error);
            return [];
        }
    });

    // Get file by ID
    ipcMain.handle(CHANNELS.FILE.GET_BY_ID, async (event, id) => {
        try {
            const { getFileById } = await import('../storage/sqlite-db.js');
            return await getFileById(id);
        } catch (error) {
            logger.error('Error getting file by id:', error);
            return null;
        }
    });

    // Get file by path
    ipcMain.handle(CHANNELS.FILE.GET_BY_PATH, async (event, filePath) => {
        try {
            const { getFileByPath } = await import('../storage/sqlite-db.js');
            return await getFileByPath(filePath);
        } catch (error) {
            logger.error('Error getting file by path:', error);
            return null;
        }
    });

    // Get file chunks
    ipcMain.handle(CHANNELS.FILE.GET_CHUNKS, async (event, fileId) => {
        try {
            const { getFileChunks } = await import('../storage/sqlite-db.js');
            return await getFileChunks(fileId);
        } catch (error) {
            logger.error('Error getting file chunks:', error);
            return [];
        }
    });

    // Delete file
    ipcMain.handle(CHANNELS.FILE.DELETE, async (event, fileId) => {
        try {
            const { getDatabaseClient } = await import('../storage/sqlite-db.js');
            const { deleteEmbedding } = await import('../storage/lancedb-client.js');
            const client = getDatabaseClient();

            // Get file info first
            const { getFileById } = await import('../storage/sqlite-db.js');
            const file = await getFileById(fileId);

            if (!file) {
                return { success: false, error: 'File not found' };
            }

            // Delete embeddings from LanceDB (file chunks)
            const { getFileChunks } = await import('../storage/sqlite-db.js');
            const chunks = await getFileChunks(fileId);
            for (const chunk of chunks) {
                try {
                    await deleteEmbedding(`file_${fileId}_chunk_${chunk.chunk_index}`);
                } catch (error) {
                    logger.debug('Error deleting embedding (may not exist):', error.message);
                }
            }

            // Delete file (cascade will delete chunks)
            await client.execute('DELETE FROM files WHERE id = ?', [fileId]);

            logger.info(`File deleted: ${fileId}`);
            return { success: true };
        } catch (error) {
            logger.error('Error deleting file:', error);
            throw error;
        }
    });

    // Get file watcher status
    ipcMain.handle(CHANNELS.FILE.WATCHER_STATUS, async () => {
        try {
            const { getWatcherStatus } = await import('../services/file-watcher.js');
            return getWatcherStatus();
        } catch (error) {
            logger.error('Error getting watcher status:', error);
            return { isWatching: false, queueLength: 0 };
        }
    });

    // Search files (semantic search within files)
    ipcMain.handle(CHANNELS.FILE.SEARCH, async (event, query, options = {}) => {
        try {
            const { semanticSearch } = await import('../services/search-service.js');
            // Add file filter to search
            const searchOptions = {
                ...options,
                filters: {
                    ...options.filters,
                    file_id: { $ne: null }, // Only search in files
                },
            };
            return await semanticSearch(query, searchOptions);
        } catch (error) {
            logger.error('Error searching files:', error);
            throw error;
        }
    });
}

// Model handlers
function registerModelHandlers() {
    // Get system resources
    ipcMain.handle('model:get-resources', async () => {
        try {
            const { getModelManager } = await import('../services/model-manager.js');
            const manager = await getModelManager();
            return await manager.getResourceUsage();
        } catch (error) {
            logger.error('Error getting system resources:', error);
            throw error;
        }
    });

    // Get recommended tier
    ipcMain.handle('model:get-recommended-tier', async () => {
        try {
            const { getModelManager } = await import('../services/model-manager.js');
            const manager = await getModelManager();
            return await manager.getRecommendedTier();
        } catch (error) {
            logger.error('Error getting recommended tier:', error);
            throw error;
        }
    });

    // Get current models
    ipcMain.handle('model:get-current', async () => {
        try {
            const { getModelManager } = await import('../services/model-manager.js');
            const manager = await getModelManager();
            return manager.getModelInfo();
        } catch (error) {
            logger.error('Error getting current models:', error);
            throw error;
        }
    });

    // Set model tier
    ipcMain.handle('model:set-tier', async (event, tier, options = {}) => {
        try {
            const { getModelManager } = await import('../services/model-manager.js');
            const manager = await getModelManager();
            return await manager.setModelTier(tier, options);
        } catch (error) {
            logger.error('Error setting model tier:', error);
            throw error;
        }
    });

    // Auto-select tier
    ipcMain.handle('model:auto-select', async () => {
        try {
            const { getModelManager } = await import('../services/model-manager.js');
            const manager = await getModelManager();
            return await manager.autoSelectTier();
        } catch (error) {
            logger.error('Error auto-selecting tier:', error);
            throw error;
        }
    });

    // Get available models
    ipcMain.handle('model:get-available', async () => {
        try {
            const { getAvailableLLMModels, getAvailableEmbeddingModels, MODEL_TIERS } = await import('../utils/model-config.js');
            return {
                llm: getAvailableLLMModels(),
                embedding: getAvailableEmbeddingModels(),
                tiers: Object.keys(MODEL_TIERS).map(key => ({
                    id: key,
                    ...MODEL_TIERS[key],
                })),
            };
        } catch (error) {
            logger.error('Error getting available models:', error);
            throw error;
        }
    });
}

function registerDialogHandlers() {
    ipcMain.handle('dialog:select-directory', async () => {
        const result = await dialog.showOpenDialog({
            properties: ['openDirectory'],
        });
        if (!result.canceled && result.filePaths.length > 0) {
            return result.filePaths[0];
        }
        return null;
    });
}

// Register all IPC handlers
function registerIpcHandlers() {
    registerActivityHandlers();
    registerSettingsHandlers();
    registerDatabaseHandlers();
    registerGraphHandlers();
    registerSearchHandlers();
    registerChatHandlers();
    registerFileHandlers();
    registerModelHandlers();
    registerSyncHandlers();
    registerDialogHandlers();
    logger.info('All IPC handlers registered');
}

export { registerIpcHandlers };