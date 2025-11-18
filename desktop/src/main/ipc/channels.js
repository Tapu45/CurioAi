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

    // Search & Chat
    SEARCH: {
        SEMANTIC_SEARCH: 'search:semantic',
        CHECK_AI_SERVICE: 'search:check-ai-service',
    },
    CHAT: {
        SEND_MESSAGE: 'chat:send-message',
        GET_HISTORY: 'chat:get-history',
    },

    // File operations
    FILE: {
        INDEX: 'file:index',
        INDEX_BATCH: 'file:index-batch',
        GET_ALL: 'file:get-all',
        GET_BY_ID: 'file:get-by-id',
        GET_BY_PATH: 'file:get-by-path',
        GET_CHUNKS: 'file:get-chunks',
        DELETE: 'file:delete',
        WATCHER_STATUS: 'file:watcher-status',
        SEARCH: 'file:search',
        // Add these:
        SYNC_START: 'file:sync:start',
        SYNC_STOP: 'file:sync:stop',
        SYNC_PAUSE: 'file:sync:pause',
        SYNC_RESUME: 'file:sync:resume',
        SYNC_STATUS: 'file:sync:status',
        SYNC_PROGRESS: 'file:sync:progress', // Event
        SYNC_CONFIG_GET: 'file:sync:config:get',
        SYNC_CONFIG_UPDATE: 'file:sync:config:update',
        SYNC_CONFIG_ADD_PATH: 'file:sync:config:add-path',
        SYNC_CONFIG_REMOVE_PATH: 'file:sync:config:remove-path',
        EXTRACT_DEEP: 'file:extract-deep',
        GET_STRUCTURED_DATA: 'file:get-structured-data',
        GET_IMAGE_ANALYSIS: 'file:get-image-analysis',
    },
    
    // Model management
    MODEL: {
        GET_RESOURCES: 'model:get-resources',
        GET_RECOMMENDED_TIER: 'model:get-recommended-tier',
        GET_CURRENT: 'model:get-current',
        SET_TIER: 'model:set-tier',
        AUTO_SELECT: 'model:auto-select',
        GET_AVAILABLE: 'model:get-available',
    },

    AGENT: {
        CHAT: 'agent:chat',
        STATUS: 'agent:status',
        TOOL_EXECUTE: 'agent:tool:execute',
        STATUS_UPDATE: 'agent:status-update', // Event
        REASONING_UPDATE: 'agent:reasoning-update', // Event
        TOOL_CALL_UPDATE: 'agent:tool-call-update', // Event
        PROGRESS_UPDATE: 'agent:progress-update', // Event
    },
};

