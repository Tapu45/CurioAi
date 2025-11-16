/// <reference types="vite/client" />

interface Window {
    electronAPI: {
        // Activity channels
        getActivityStatus: () => Promise<any>;
        pauseTracking: () => Promise<any>;
        resumeTracking: () => Promise<any>;
        getTodayActivityCount: () => Promise<number>;

        // Settings channels
        getSettings: () => Promise<any>;
        updateSettings: (settings: any) => Promise<any>;
        getWhitelist: () => Promise<any>;
        updateWhitelist: (whitelist: any) => Promise<any>;

        // Database channels
        getActivities: (filters?: any) => Promise<any[]>;
        getSummary: (activityId: string) => Promise<any>;
        deleteActivity: (activityId: string) => Promise<any>;

        // Graph channels
        getGraphData: () => Promise<any>;
        getRelatedConcepts: (concept: string) => Promise<any[]>;
        getConceptDetails: (conceptName: string) => Promise<any>;
        buildGraph: () => Promise<any>;
        getGraphStats: () => Promise<any>;
        getVisualizationData: (options?: any) => Promise<any>;

        // Event listeners
        onActivityUpdate: (callback: (data: any) => void) => void;
        onStatusChange: (callback: (status: any) => void) => void;
        removeAllListeners: (channel: string) => void;
    };
}