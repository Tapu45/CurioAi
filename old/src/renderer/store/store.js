import { create } from 'zustand';

const useAppStore = create((set) => ({
    // Activity
    activityStatus: null, // { isTracking, isPaused, lastActivity, todayCount }
    setActivityStatus: (status) => set({ activityStatus: status }),
    todayCount: 0,
    setTodayCount: (count) => set({ todayCount: count }),

    // Settings
    settings: null, // { whitelist, appConfig, privacyConfig }
    setSettings: (settings) => set({ settings }),

    // Graph
    graphStats: null,
    setGraphStats: (stats) => set({ graphStats: stats }),

    // UI
    currentPage: 'main', // 'main' | 'settings' | 'history' | 'graph'
    setCurrentPage: (page) => set({ currentPage: page }),
}));

export default useAppStore;