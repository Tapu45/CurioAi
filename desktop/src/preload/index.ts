import { contextBridge, ipcRenderer } from 'electron';

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

});