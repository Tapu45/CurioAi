import React, { useEffect, useState } from 'react';
import useElectron from '../../../hooks/useElectron.js';
import Button from '../../common/Button/index.jsx';
import ActivityDetail from '../History/ActivityDetail.jsx';
import './ConceptDetailPanel.css';

export default function ConceptDetailPanel({ concept, onClose }) {
    const electron = useElectron();
    const [details, setDetails] = useState(null);
    const [loading, setLoading] = useState(true);
    const [selectedActivity, setSelectedActivity] = useState(null);

    useEffect(() => {
        if (!concept) return;

        const loadDetails = async () => {
            setLoading(true);
            try {
                const conceptName = concept.name || concept.label || '';
                const detailsData = await electron.getConceptDetails?.(conceptName);
                setDetails(detailsData);
            } catch (error) {
                console.error('Failed to load concept details:', error);
                setDetails(null);
            } finally {
                setLoading(false);
            }
        };

        loadDetails();
    }, [concept, electron]);

    const handleActivityClick = async (activityId) => {
        try {
            const activities = await electron.getActivities?.({ limit: 1000 });
            const found = activities?.find((a) => a.id === activityId);
            if (found) {
                setSelectedActivity(found);
            }
        } catch (error) {
            console.error('Failed to load activity:', error);
        }
    };

    if (!concept) return null;

    return (
        <>
            <div className="concept-detail-panel">
                <div className="panel-header">
                    <h3 className="panel-title">Concept Details</h3>
                    <button className="panel-close" onClick={onClose} aria-label="Close">
                        ×
                    </button>
                </div>

                <div className="panel-content">
                    {loading ? (
                        <div className="panel-loading">Loading...</div>
                    ) : details ? (
                        <>
                            <div className="concept-info">
                                <h4 className="concept-name">{details.concept.name}</h4>
                                <div className="concept-meta">
                                    <span className="concept-label">{details.concept.label}</span>
                                    {details.concept.confidence && (
                                        <span className="concept-confidence">
                                            Confidence: {Math.round(details.concept.confidence * 100)}%
                                        </span>
                                    )}
                                </div>
                            </div>

                            {details.related && details.related.length > 0 && (
                                <div className="panel-section">
                                    <h5 className="section-title">Related Concepts</h5>
                                    <div className="related-concepts">
                                        {details.related.map((related, idx) => (
                                            <div key={idx} className="related-concept-item">
                                                <span className="related-name">{related.name}</span>
                                                <span className="related-type">{related.relationshipType}</span>
                                                {related.similarity && (
                                                    <span className="related-similarity">
                                                        {Math.round(related.similarity * 100)}% similar
                                                    </span>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {details.activities && details.activities.length > 0 && (
                                <div className="panel-section">
                                    <h5 className="section-title">Activities</h5>
                                    <div className="concept-activities">
                                        {details.activities.map((activity, idx) => (
                                            <button
                                                key={idx}
                                                className="activity-link"
                                                onClick={() => handleActivityClick(activity.id)}
                                            >
                                                <div className="activity-link-title">{activity.title}</div>
                                                <div className="activity-link-meta">
                                                    {activity.source_type} • {new Date(activity.timestamp).toLocaleDateString()}
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="panel-empty">No additional details available</div>
                    )}
                </div>
            </div>

            {selectedActivity && (
                <ActivityDetail
                    activity={selectedActivity}
                    onClose={() => setSelectedActivity(null)}
                />
            )}
        </>
    );
}