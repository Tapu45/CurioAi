import React from 'react';
import { FileCheck, FileX, Clock, HardDrive } from 'lucide-react';
import './SyncStats.css';

export default function SyncStats({ stats, lastSync }) {
    if (!stats) {
        return null;
    }

    const formatDate = (dateString) => {
        if (!dateString) return 'Never';
        const date = new Date(dateString);
        return date.toLocaleString();
    };

    return (
        <div className="sync-stats">
            <div className="sync-stats-grid">
                <div className="sync-stats-item">
                    <div className="sync-stats-icon">
                        <FileCheck size={20} />
                    </div>
                    <div className="sync-stats-content">
                        <div className="sync-stats-label">Indexed</div>
                        <div className="sync-stats-value">{stats.completed || 0}</div>
                    </div>
                </div>

                <div className="sync-stats-item">
                    <div className="sync-stats-icon error">
                        <FileX size={20} />
                    </div>
                    <div className="sync-stats-content">
                        <div className="sync-stats-label">Failed</div>
                        <div className="sync-stats-value">{stats.failed || 0}</div>
                    </div>
                </div>

                <div className="sync-stats-item">
                    <div className="sync-stats-icon">
                        <Clock size={20} />
                    </div>
                    <div className="sync-stats-content">
                        <div className="sync-stats-label">Pending</div>
                        <div className="sync-stats-value">{stats.pending || 0}</div>
                    </div>
                </div>

                <div className="sync-stats-item">
                    <div className="sync-stats-icon">
                        <HardDrive size={20} />
                    </div>
                    <div className="sync-stats-content">
                        <div className="sync-stats-label">Last Sync</div>
                        <div className="sync-stats-value-small">{formatDate(lastSync)}</div>
                    </div>
                </div>
            </div>
        </div>
    );
}