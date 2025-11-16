// IPC Channel Constants
export const CHANNELS = {
    // Activity tracking
    ACTIVITY: {
        GET_STATUS: 'activity:get-status',
        PAUSE: 'activity:pause',
        RESUME: 'activity:resume',
        GET_TODAY_COUNT: 'activity:get-today-count',
        UPDATE: 'activity:update',
        STATUS_CHANGE: 'activity:status-change',
    },

    // Settings
    SETTINGS: {
        GET: 'settings:get',
        UPDATE: 'settings:update',
        GET_WHITELIST: 'settings:get-whitelist',
        UPDATE_WHITELIST: 'settings:update-whitelist',
        GET_PRIVACY: 'settings:get-privacy',
        UPDATE_PRIVACY: 'settings:update-privacy',
    },

    // Database operations
    DB: {
        GET_ACTIVITIES: 'db:get-activities',
        GET_SUMMARY: 'db:get-summary',
        DELETE_ACTIVITY: 'db:delete-activity',
        EXPORT_DATA: 'db:export-data',
        CLEAR_DATA: 'db:clear-data',
    },

    // Knowledge graph
    GRAPH: {
        GET_DATA: 'graph:get-data',
        GET_RELATED: 'graph:get-related',
        GET_CONCEPT_DETAILS: 'graph:get-concept-details',
        BUILD_GRAPH: 'graph:build',
        GET_STATS: 'graph:get-stats',
        GET_VISUALIZATION: 'graph:get-visualization',
    },

    // Sync service
    SYNC: {
        GET_STATUS: 'sync:get-status',
        ENABLE: 'sync:enable',
        DISABLE: 'sync:disable',
        SYNC_NOW: 'sync:now',
    },
};

