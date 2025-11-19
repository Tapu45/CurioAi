import React, { useMemo } from 'react';
import Button from '../../common/Button/index.jsx';
import ActivityItem from './ActivityItem.jsx'; // Reuse or create
import './SessionDetail.css';

export default function SessionDetail({ session, onClose }) {
    if (!session) return null;

    const formattedDate = useMemo(() => {
        const start = new Date(session.start_time);
        const end = session.end_time ? new Date(session.end_time) : null;
        return {
            start: start.toLocaleString(),
            end: end ? end.toLocaleString() : 'Ongoing',
            duration: session.duration_seconds
                ? formatDuration(session.duration_seconds)
                : 'Ongoing',
        };
    }, [session]);

    const concepts = useMemo(() => {
        try {
            return typeof session.concepts === 'string'
                ? JSON.parse(session.concepts)
                : session.concepts || [];
        } catch {
            return [];
        }
    }, [session.concepts]);

    const aggregatedFiles = useMemo(() => {
        try {
            return typeof session.aggregated_files === 'string'
                ? JSON.parse(session.aggregated_files)
                : session.aggregated_files || [];
        } catch {
            return [];
        }
    }, [session.aggregated_files]);

    const aggregatedUrls = useMemo(() => {
        try {
            return typeof session.aggregated_urls === 'string'
                ? JSON.parse(session.aggregated_urls)
                : session.aggregated_urls || [];
        } catch {
            return [];
        }
    }, [session.aggregated_urls]);

    return (
        <div className="session-detail-overlay" onClick={onClose}>
            <div className="session-detail-modal" onClick={(e) => e.stopPropagation()}>
                <div className="session-detail-header">
                    <div className="session-detail-header-main">
                        <h2 className="session-detail-title">
                            {session.project_name || session.activity_type || 'Session'}
                        </h2>
                        <div className="session-detail-meta">
                            <span className="session-detail-badge">{session.activity_type}</span>
                            <span className="session-detail-separator">•</span>
                            <span className="session-detail-date">{formattedDate.start}</span>
                            <span className="session-detail-separator">•</span>
                            <span className="session-detail-duration">{formattedDate.duration}</span>
                        </div>
                    </div>
                    <button className="session-detail-close" onClick={onClose} aria-label="Close">
                        ×
                    </button>
                </div>

                <div className="session-detail-content">
                    {/* Summary */}
                    {session.summary && (
                        <div className="session-detail-section">
                            <h3 className="session-detail-section-title">Summary</h3>
                            <div className="session-detail-summary">{session.summary}</div>
                        </div>
                    )}

                    {/* Concepts */}
                    {concepts.length > 0 && (
                        <div className="session-detail-section">
                            <h3 className="session-detail-section-title">Concepts</h3>
                            <div className="session-detail-concepts">
                                {concepts.map((concept, idx) => (
                                    <span key={idx} className="session-detail-concept-chip">
                                        {concept}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Files (for coding sessions) */}
                    {aggregatedFiles.length > 0 && (
                        <div className="session-detail-section">
                            <h3 className="session-detail-section-title">Files</h3>
                            <div className="session-detail-files">
                                {aggregatedFiles.map((file, idx) => (
                                    <div key={idx} className="session-detail-file">
                                        {file}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* URLs (for browsing sessions) */}
                    {aggregatedUrls.length > 0 && (
                        <div className="session-detail-section">
                            <h3 className="session-detail-section-title">URLs</h3>
                            <div className="session-detail-urls">
                                {aggregatedUrls.map((url, idx) => (
                                    <a
                                        key={idx}
                                        href={url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="session-detail-url"
                                    >
                                        {url}
                                    </a>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Activities in Session */}
                    {session.activities && session.activities.length > 0 && (
                        <div className="session-detail-section">
                            <h3 className="session-detail-section-title">
                                Activities ({session.activities.length})
                            </h3>
                            <div className="session-detail-activities">
                                {session.activities.map((activity) => (
                                    <ActivityItem
                                        key={activity.id}
                                        activity={activity}
                                        onClick={() => { }}
                                        compact
                                    />
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <div className="session-detail-footer">
                    <Button variant="ghost" onClick={onClose}>
                        Close
                    </Button>
                </div>
            </div>
        </div>
    );
}

function formatDuration(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
        return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
}