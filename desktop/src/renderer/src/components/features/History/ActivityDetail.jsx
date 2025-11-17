import React, { useState, useEffect, useMemo, useCallback } from 'react';
import useElectron from '../../../hooks/useElectron.js';
import Button from '../../common/Button/index.jsx';
import './ActivityDetail.css';

export default function ActivityDetail({ activity, onClose }) {
    const electron = useElectron();
    const [summary, setSummary] = useState(null);
    const [loading, setLoading] = useState(true);
    const [similarActivities, setSimilarActivities] = useState([]);
    const [loadingSimilar, setLoadingSimilar] = useState(false);

    useEffect(() => {
        const loadData = async () => {
            if (!activity?.id) return;

            setLoading(true);
            try {
                // Load summary
                const summaryData = await electron.getSummary(activity.id);
                setSummary(summaryData);
            } catch (error) {
                console.error('Failed to load summary:', error);
                setSummary(null);
            } finally {
                setLoading(false);
            }

            // Load similar activities
            setLoadingSimilar(true);
            try {
                // Note: findSimilarActivities might need to be exposed via IPC
                // For now, we'll skip this or implement a basic version
                setSimilarActivities([]);
            } catch (error) {
                console.error('Failed to load similar activities:', error);
            } finally {
                setLoadingSimilar(false);
            }
        };

        loadData();
    }, [activity?.id, electron]);

    const formattedDate = useMemo(() => {
        if (!activity?.timestamp) return null;
        const date = new Date(activity.timestamp);
        return {
            date: date.toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
            }),
            time: date.toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
            }),
        };
    }, [activity?.timestamp]);

    const keyConcepts = useMemo(() => {
        if (!summary?.key_concepts) return [];
        try {
            return typeof summary.key_concepts === 'string'
                ? JSON.parse(summary.key_concepts)
                : summary.key_concepts;
        } catch {
            return [];
        }
    }, [summary?.key_concepts]);

    const handleDelete = useCallback(async () => {
        if (!window.confirm('Are you sure you want to delete this activity?')) {
            return;
        }

        try {
            await electron.deleteActivity(activity.id);
            onClose();
            // Optionally refresh the history list
            window.location.reload();
        } catch (error) {
            console.error('Failed to delete activity:', error);
            alert('Failed to delete activity. Please try again.');
        }
    }, [activity?.id, electron, onClose]);

    if (!activity) return null;

    return (
        <div className="activity-detail-overlay" onClick={onClose}>
            <div className="activity-detail-modal" onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className="activity-detail-header">
                    <div className="activity-detail-header-main">
                        <h2 className="activity-detail-title">
                            {activity.title || activity.window_title || 'Untitled Activity'}
                        </h2>
                        <div className="activity-detail-meta">
                            <span className="activity-detail-badge">{activity.source_type}</span>
                            <span className="activity-detail-app">{activity.app_name}</span>
                            {formattedDate && (
                                <>
                                    <span className="activity-detail-separator">•</span>
                                    <span className="activity-detail-date">{formattedDate.date}</span>
                                    <span className="activity-detail-time">{formattedDate.time}</span>
                                </>
                            )}
                        </div>
                    </div>
                    <button className="activity-detail-close" onClick={onClose} aria-label="Close">
                        ×
                    </button>
                </div>

                {/* Content */}
                <div className="activity-detail-content">
                    {/* URL */}
                    {activity.url && (
                        <div className="activity-detail-section">
                            <h3 className="activity-detail-section-title">URL</h3>
                            <a
                                href={activity.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="activity-detail-url"
                            >
                                {activity.url}
                            </a>
                        </div>
                    )}

                    {/* Summary */}
                    <div className="activity-detail-section">
                        <h3 className="activity-detail-section-title">Summary</h3>
                        {loading ? (
                            <div className="activity-detail-loading">Loading summary...</div>
                        ) : summary?.summary_text ? (
                            <div className="activity-detail-summary">{summary.summary_text}</div>
                        ) : (
                            <div className="activity-detail-empty">
                                No summary available yet. The AI service may still be processing this activity.
                            </div>
                        )}
                    </div>

                    {/* Key Concepts */}
                    {keyConcepts.length > 0 && (
                        <div className="activity-detail-section">
                            <h3 className="activity-detail-section-title">Key Concepts</h3>
                            <div className="activity-detail-concepts">
                                {keyConcepts.map((concept, idx) => (
                                    <span key={idx} className="activity-detail-concept-chip">
                                        {concept}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Metadata */}
                    {summary && (
                        <div className="activity-detail-section">
                            <h3 className="activity-detail-section-title">Metadata</h3>
                            <div className="activity-detail-metadata">
                                {summary.complexity && (
                                    <div className="activity-detail-metadata-item">
                                        <span className="metadata-label">Complexity:</span>
                                        <span className="metadata-value">{summary.complexity}</span>
                                    </div>
                                )}
                                {summary.sentiment !== null && summary.sentiment !== undefined && (
                                    <div className="activity-detail-metadata-item">
                                        <span className="metadata-label">Sentiment:</span>
                                        <span className="metadata-value">
                                            {summary.sentiment > 0.3
                                                ? 'Positive'
                                                : summary.sentiment < -0.3
                                                    ? 'Negative'
                                                    : 'Neutral'}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Content Preview */}
                    {activity.content && (
                        <div className="activity-detail-section">
                            <h3 className="activity-detail-section-title">Content Preview</h3>
                            <div className="activity-detail-content-preview">
                                {activity.content.length > 500
                                    ? `${activity.content.substring(0, 500)}...`
                                    : activity.content}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="activity-detail-footer">
                    <Button variant="ghost" onClick={onClose}>
                        Close
                    </Button>
                    <Button variant="destructive" onClick={handleDelete} size="sm">
                        Delete Activity
                    </Button>
                </div>
            </div>
        </div>
    );
}