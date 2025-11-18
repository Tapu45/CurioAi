import { contextBridge, ipcRenderer } from 'electron';
import { CHANNELS } from '../main/ipc/channels';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
    // Activity channels
    getActivityStatus: () => ipcRenderer.invoke('activity:get-status'),
    pauseTracking: () => ipcRenderer.invoke('activity:pause'),
    resumeTracking: () => ipcRenderer.invoke('activity:resume'),
    getTodayActivityCount: () => ipcRenderer.invoke('activity:get-today-count'),

    // Settings channels
    getSettings: () => ipcRenderer.invoke('settings:get'),
    updateSettings: (settings) => ipcRenderer.invoke('settings:update', settings),
    getWhitelist: () => ipcRenderer.invoke('settings:get-whitelist'),
    updateWhitelist: (whitelist) => ipcRenderer.invoke('settings:update-whitelist'),

    // Database channels
    getActivities: (filters) => ipcRenderer.invoke('db:get-activities', filters),
    getSummary: (activityId) => ipcRenderer.invoke('db:get-summary', activityId),
    deleteActivity: (activityId) => ipcRenderer.invoke('db:delete-activity', activityId),
    exportData: (format) => ipcRenderer.invoke('db:export-data', format),
    clearAllData: () => ipcRenderer.invoke('db:clear-data'),
    getStorageUsage: () => ipcRenderer.invoke('db:get-storage-usage'),

    // Event listeners
    onActivityUpdate: (callback) => {
        ipcRenderer.on('activity:update', (event, data) => callback(data));
    },
    onStatusChange: (callback) => {
        ipcRenderer.on('activity:status-change', (event, status) => callback(status));
    },

    // Shortcut event listeners
    on: (channel, callback) => {
        const validChannels = [
            'shortcut:open-search',
            'shortcut:open-chat',
            'shortcut:open-graph',
            'menu:open-preferences',
            'menu:export-data',
        ];
        if (validChannels.includes(channel)) {
            ipcRenderer.on(channel, (event, ...args) => callback(...args));
        }
    },

    // Remove listeners
    removeAllListeners: (channel) => {
        ipcRenderer.removeAllListeners(channel);
    },

    // Graph channels
    getGraphData: () => ipcRenderer.invoke('graph:get-data'),
    getRelatedConcepts: (concept) => ipcRenderer.invoke('graph:get-related', concept),
    getConceptDetails: (conceptName) => ipcRenderer.invoke('graph:get-concept-details', conceptName),
    buildGraph: () => ipcRenderer.invoke('graph:build'),
    getGraphStats: () => ipcRenderer.invoke('graph:get-stats'),
    getVisualizationData: (options) => ipcRenderer.invoke('graph:get-visualization', options),

    // Search channels
    semanticSearch: (query, options) => ipcRenderer.invoke('search:semantic', query, options),
    checkAIService: () => ipcRenderer.invoke('search:check-ai-service'),

    // Chat channels
    sendChatMessage: (message) => ipcRenderer.invoke('chat:send-message', message),
    getChatHistory: (limit) => ipcRenderer.invoke('chat:get-history', limit),

    // File channels
    getFiles: (options) => ipcRenderer.invoke('file:get-all', options),
    getFileById: (id) => ipcRenderer.invoke('file:get-by-id', id),
    getFileChunks: (fileId) => ipcRenderer.invoke('file:get-chunks', fileId),
    getFileWatcherStatus: () => ipcRenderer.invoke('file:watcher-status'),
    indexFile: (filePath, options) => ipcRenderer.invoke('file:index', filePath, options),
    indexFiles: (filePaths, options) => ipcRenderer.invoke('file:index-batch', filePaths, options),
    deleteFile: (fileId) => ipcRenderer.invoke('file:delete', fileId),
    searchFiles: (query, options) => ipcRenderer.invoke('file:search', query, options),

    // Model channels
    getCurrentModels: () => ipcRenderer.invoke('model:get-current'),
    getModelResources: () => ipcRenderer.invoke('model:get-resources'),
    getAvailableModels: () => ipcRenderer.invoke('model:get-available'),
    setModelTier: (tier, options) => ipcRenderer.invoke('model:set-tier', tier, options),
    getRecommendedTier: () => ipcRenderer.invoke('model:get-recommended-tier'),
    autoSelectModelTier: () => ipcRenderer.invoke('model:auto-select'),

    getSyncStatus: () => ipcRenderer.invoke(CHANNELS.FILE.SYNC_STATUS),
    startSync: (options?: any) => ipcRenderer.invoke(CHANNELS.FILE.SYNC_START, options),
    stopSync: () => ipcRenderer.invoke(CHANNELS.FILE.SYNC_STOP),
    pauseSync: () => ipcRenderer.invoke(CHANNELS.FILE.SYNC_PAUSE),
    resumeSync: () => ipcRenderer.invoke(CHANNELS.FILE.SYNC_RESUME),
    getSyncConfigs: () => ipcRenderer.invoke(CHANNELS.FILE.SYNC_CONFIG_GET),
    addSyncPath: (config: any) => ipcRenderer.invoke(CHANNELS.FILE.SYNC_CONFIG_ADD_PATH, config),
    updateSyncConfig: (id: number, updates: any) => ipcRenderer.invoke(CHANNELS.FILE.SYNC_CONFIG_UPDATE, id, updates),
    removeSyncPath: (id: number) => ipcRenderer.invoke(CHANNELS.FILE.SYNC_CONFIG_REMOVE_PATH, id),

    // Sync progress event listener
    onSyncProgress: (callback: (event: any, data: any) => void) => {
        ipcRenderer.on(CHANNELS.FILE.SYNC_PROGRESS, callback);
    },
    removeSyncProgressListener: () => {
        ipcRenderer.removeAllListeners(CHANNELS.FILE.SYNC_PROGRESS);
    },

    // Directory selection (optional)
    selectDirectory: () => ipcRenderer.invoke('dialog:select-directory'),

});