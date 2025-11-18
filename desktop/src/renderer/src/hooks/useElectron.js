import { useMemo } from 'react';
import electronIPC from '../services/electron-ipc.js';

export default function useElectron() {
    const api = useMemo(() => {
        const electronAPI = typeof window !== 'undefined' && window.electronAPI
            ? window.electronAPI
            : null;

        if (!electronAPI) {
            return {
                ...electronIPC,
                getFiles: async () => [],
                getFileById: async () => null,
                getFileChunks: async () => [],
                getFileWatcherStatus: async () => ({ isWatching: false, queueLength: 0 }),
                getCurrentModels: async () => null,
                getModelResources: async () => null,
                getAvailableModels: async () => ({ llm: [], embedding: [], tiers: [] }),
                setModelTier: async () => ({ success: false }),
                // Sync methods fallbacks
                getSyncStatus: async () => null,
                startSync: async () => ({ success: false }),
                stopSync: async () => ({ success: false }),
                pauseSync: async () => ({ success: false }),
                resumeSync: async () => ({ success: false }),
                getSyncConfigs: async () => [],
                addSyncPath: async () => ({ success: false }),
                updateSyncConfig: async () => ({ success: false }),
                removeSyncPath: async () => ({ success: false }),
                onSyncProgress: () => { },
                removeSyncProgressListener: () => { },
                selectDirectory: async () => null,
            };
        }

        return {
            ...electronIPC,
            getFiles: (options) => electronAPI.getFiles(options),
            getFileById: (id) => electronAPI.getFileById(id),
            getFileChunks: (fileId) => electronAPI.getFileChunks(fileId),
            getFileWatcherStatus: () => electronAPI.getFileWatcherStatus(),
            getCurrentModels: () => electronAPI.getCurrentModels(),
            getModelResources: () => electronAPI.getModelResources(),
            getAvailableModels: () => electronAPI.getAvailableModels(),
            setModelTier: (tier, options) => electronAPI.setModelTier(tier, options),
            // Sync methods
            getSyncStatus: (options) => electronAPI.getSyncStatus?.(options),
            startSync: (options) => electronAPI.startSync?.(options),
            stopSync: () => electronAPI.stopSync?.(),
            pauseSync: () => electronAPI.pauseSync?.(),
            resumeSync: () => electronAPI.resumeSync?.(),
            getSyncConfigs: () => electronAPI.getSyncConfigs?.(),
            addSyncPath: (config) => electronAPI.addSyncPath?.(config),
            updateSyncConfig: (id, updates) => electronAPI.updateSyncConfig?.(id, updates),
            removeSyncPath: (id) => electronAPI.removeSyncPath?.(id),
            onSyncProgress: (callback) => electronAPI.onSyncProgress?.(callback),
            removeSyncProgressListener: () => electronAPI.removeSyncProgressListener?.(),
            selectDirectory: () => electronAPI.selectDirectory?.(),
        };
    }, []);

    return api;
}