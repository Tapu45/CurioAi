// Simple wrapper around window.electronAPI with safety checks

const getAPI = () => {
    if (typeof window !== 'undefined' && window.electronAPI) {
        return window.electronAPI;
    }
    console.warn('electronAPI is not available (are you running inside Electron?)');
    return {
        // Activity
        getActivityStatus: async () => null,
        pauseTracking: async () => ({ success: false }),
        resumeTracking: async () => ({ success: false }),
        getTodayActivityCount: async () => 0,
        // Settings
        getSettings: async () => null,
        updateSettings: async () => ({ success: false }),
        getWhitelist: async () => ({ domains: [], apps: [] }),
        updateWhitelist: async () => ({ success: false }),
        // DB
        getActivities: async () => [],
        getSummary: async () => null,
        deleteActivity: async () => ({ success: false }),
        exportData: async () => ({ success: false, canceled: true }),
        clearAllData: async () => ({ success: false }),
        getStorageUsage: async () => ({
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
        }),
        // Graph
        getGraphData: async () => ({ nodes: [], edges: [] }),
        getRelatedConcepts: async () => [],
        getConceptDetails: async () => null,
        buildGraph: async () => ({ success: false }),
        getGraphStats: async () => ({ nodes: {}, relationships: {} }),
        getVisualizationData: async () => ({ nodes: [], edges: [], topics: [], stats: {} }),
        // Search
        semanticSearch: async () => ({ results: [] }),
        checkAIService: async () => false,
        // Chat
        sendChatMessage: async () => ({ answer: '', sources: [] }),
        getChatHistory: async () => [],
        // Events
        onActivityUpdate: () => { },
        onStatusChange: () => { },
        on: () => { },
        removeAllListeners: () => { },

        getSyncStatus: async () => null,
        startSync: async () => ({ success: false }),
        stopSync: async () => ({ success: false }),
        pauseSync: async () => ({ success: false }),
        resumeSync: async () => ({ success: false }),
        getSyncConfigs: async () => [],
        addSyncPath: async () => ({ success: false, id: null }),
        updateSyncConfig: async () => ({ success: false }),
        removeSyncPath: async () => ({ success: false }),
        onSyncProgress: () => { },
        removeSyncProgressListener: () => { },
        selectDirectory: async () => null,
    };
};

const electronIPC = getAPI();

export default electronIPC;