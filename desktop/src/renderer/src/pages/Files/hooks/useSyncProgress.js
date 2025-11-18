import { useState, useEffect, useCallback } from 'react';
import useElectron from '@renderer/hooks/useElectron';

export function useSyncProgress() {
    const electron = useElectron();
    const [currentFile, setCurrentFile] = useState(null);
    const [progress, setProgress] = useState(0);
    const [fileProgress, setFileProgress] = useState({});

    useEffect(() => {
        const handleProgress = (event, data) => {
            if (data.type === 'file-progress') {
                setFileProgress(prev => ({
                    ...prev,
                    [data.filePath]: {
                        status: data.status,
                        progressPercentage: data.progressPercentage,
                        errorMessage: data.errorMessage,
                    },
                }));

                if (data.status === 'processing') {
                    setCurrentFile(data.filePath);
                    setProgress(data.progressPercentage || 0);
                } else if (data.status === 'completed' || data.status === 'failed') {
                    if (currentFile === data.filePath) {
                        setCurrentFile(null);
                        setProgress(0);
                    }
                }
            } else if (data.type === 'started') {
                setCurrentFile(null);
                setProgress(0);
            } else if (data.type === 'stopped' || data.type === 'paused') {
                setCurrentFile(null);
            }
        };

        // Listen to sync progress events
        if (electron.onSyncProgress) {
            electron.onSyncProgress(handleProgress);
        }

        return () => {
            if (electron.removeSyncProgressListener) {
                electron.removeSyncProgressListener();
            }
        };
    }, [electron, currentFile]);

    return {
        currentFile,
        progress,
        fileProgress,
    };
}