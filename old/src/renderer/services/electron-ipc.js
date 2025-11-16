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
        // Graph
        getGraphData: async () => ({ nodes: [], edges: [] }),
        getRelatedConcepts: async () => [],
        getConceptDetails: async () => null,
        buildGraph: async () => ({ success: false }),
        getGraphStats: async () => ({ nodes: {}, relationships: {} }),
        getVisualizationData: async () => ({ nodes: [], edges: [], topics: [], stats: {} }),
        // Events
        onActivityUpdate: () => { },
        onStatusChange: () => { },
        removeAllListeners: () => { },
    };
};

const electronIPC = getAPI();

export default electronIPC;