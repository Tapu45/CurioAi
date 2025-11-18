import React from 'react';
import { Loader2, CheckCircle2, XCircle, Clock } from 'lucide-react';
import './SyncProgress.css';

export default function SyncProgress({ status, currentFile, progress }) {
    if (!status?.isRunning && !status?.isPaused) {
        return null;
    }

    const overallProgress = status.stats?.total > 0
        ? ((status.stats.completed + status.stats.failed) / status.stats.total) * 100
        : 0;

    return (
        <div className="sync-progress">
            <div className="sync-progress-header">
                <div className="sync-progress-title">
                    {status.isPaused ? (
                        <>
                            <Clock size={16} />
                            <span>Sync Paused</span>
                        </>
                    ) : (
                        <>
                            <Loader2 size={16} className="sync-progress-spinner" />
                            <span>Syncing Files</span>
                        </>
                    )}
                </div>
                <div className="sync-progress-stats">
                    <span className="sync-progress-stat">
                        {status.stats?.completed || 0} completed
                    </span>
                    {status.stats?.failed > 0 && (
                        <span className="sync-progress-stat error">
                            {status.stats.failed} failed
                        </span>
                    )}
                    {status.queue?.size > 0 && (
                        <span className="sync-progress-stat">
                            {status.queue.size} in queue
                        </span>
                    )}
                </div>
            </div>

            <div className="sync-progress-bar-container">
                <div className="sync-progress-bar">
                    <div
                        className="sync-progress-bar-fill"
                        style={{ width: `${overallProgress}%` }}
                    />
                </div>
                <span className="sync-progress-percentage">
                    {Math.round(overallProgress)}%
                </span>
            </div>

            {currentFile && (
                <div className="sync-progress-current">
                    <div className="sync-progress-current-file">
                        <Loader2 size={14} className="sync-progress-current-spinner" />
                        <span className="sync-progress-current-name" title={currentFile}>
                            {currentFile.split('/').pop()}
                        </span>
                    </div>
                    {progress > 0 && (
                        <div className="sync-progress-current-bar">
                            <div
                                className="sync-progress-current-fill"
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                    )}
                </div>
            )}

            <div className="sync-progress-summary">
                <div className="sync-progress-summary-item">
                    <CheckCircle2 size={14} className="sync-progress-icon success" />
                    <span>{status.stats?.completed || 0} completed</span>
                </div>
                <div className="sync-progress-summary-item">
                    <Clock size={14} className="sync-progress-icon" />
                    <span>{status.stats?.pending || 0} pending</span>
                </div>
                {status.stats?.failed > 0 && (
                    <div className="sync-progress-summary-item">
                        <XCircle size={14} className="sync-progress-icon error" />
                        <span>{status.stats.failed} failed</span>
                    </div>
                )}
            </div>
        </div>
    );
}