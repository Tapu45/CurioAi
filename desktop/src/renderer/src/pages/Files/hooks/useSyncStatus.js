import { useState, useEffect, useCallback } from 'react';
import useElectron from '@renderer/hooks/useElectron';

export function useSyncStatus() {
    const electron = useElectron();
    const [status, setStatus] = useState({
        isRunning: false,
        isPaused: false,
        queue: {
            size: 0,
            pending: 0,
            isProcessing: false,
            stats: {
                total: 0,
                completed: 0,
                failed: 0,
                skipped: 0,
            },
        },
        stats: {
            total: 0,
            pending: 0,
            processing: 0,
            completed: 0,
            failed: 0,
            avgProgress: 0,
        },
    });
    const [loading, setLoading] = useState(true);

    const loadStatus = useCallback(async () => {
        try {
            const syncStatus = await electron.getSyncStatus?.();
            if (syncStatus) {
                setStatus(syncStatus);
            }
        } catch (error) {
            console.error('Failed to load sync status:', error);
        } finally {
            setLoading(false);
        }
    }, [electron]);

    useEffect(() => {
        loadStatus();
        const interval = setInterval(loadStatus, 2000); // Update every 2 seconds
        return () => clearInterval(interval);
    }, [loadStatus]);

    const startSync = useCallback(async (options = {}) => {
        try {
            const result = await electron.startSync?.(options);
            if (result?.success) {
                await loadStatus();
            }
            return result;
        } catch (error) {
            console.error('Failed to start sync:', error);
            throw error;
        }
    }, [electron, loadStatus]);

    const stopSync = useCallback(async () => {
        try {
            const result = await electron.stopSync?.();
            if (result?.success) {
                await loadStatus();
            }
            return result;
        } catch (error) {
            console.error('Failed to stop sync:', error);
            throw error;
        }
    }, [electron, loadStatus]);

    const pauseSync = useCallback(async () => {
        try {
            const result = await electron.pauseSync?.();
            if (result?.success) {
                await loadStatus();
            }
            return result;
        } catch (error) {
            console.error('Failed to pause sync:', error);
            throw error;
        }
    }, [electron, loadStatus]);

    const resumeSync = useCallback(async () => {
        try {
            const result = await electron.resumeSync?.();
            if (result?.success) {
                await loadStatus();
            }
            return result;
        } catch (error) {
            console.error('Failed to resume sync:', error);
            throw error;
        }
    }, [electron, loadStatus]);

    return {
        status,
        loading,
        startSync,
        stopSync,
        pauseSync,
        resumeSync,
        refresh: loadStatus,
    };
}