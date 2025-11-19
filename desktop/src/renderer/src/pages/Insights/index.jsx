import React, { useState, useEffect, useCallback } from 'react';
import useElectron from '../../hooks/useElectron.js';
import Button from '../../components/common/Button/index.jsx';
import './Insights.css';

export default function InsightsPage() {
    const electron = useElectron();
    const [activeTab, setActiveTab] = useState('daily');
    const [dailySummary, setDailySummary] = useState(null);
    const [weeklyInsights, setWeeklyInsights] = useState(null);
    const [learningGaps, setLearningGaps] = useState([]);
    const [focusAreas, setFocusAreas] = useState([]);
    const [loading, setLoading] = useState(false);
    const [selectedDate, setSelectedDate] = useState(new Date());

    const loadDailySummary = useCallback(async () => {
        setLoading(true);
        try {
            const summary = await electron.getDailySummary(selectedDate);
            setDailySummary(summary);
        } catch (error) {
            console.error('Failed to load daily summary:', error);
        } finally {
            setLoading(false);
        }
    }, [electron, selectedDate]);

    const loadWeeklyInsights = useCallback(async () => {
        setLoading(true);
        try {
            const weekStart = new Date(selectedDate);
            weekStart.setDate(weekStart.getDate() - weekStart.getDay()); // Start of week
            const insights = await electron.getWeeklyInsights(weekStart);
            setWeeklyInsights(insights);
        } catch (error) {
            console.error('Failed to load weekly insights:', error);
        } finally {
            setLoading(false);
        }
    }, [electron, selectedDate]);

    const loadLearningGaps = useCallback(async () => {
        setLoading(true);
        try {
            const gaps = await electron.getLearningGaps();
            setLearningGaps(gaps);
        } catch (error) {
            console.error('Failed to load learning gaps:', error);
        } finally {
            setLoading(false);
        }
    }, [electron]);

    const loadFocusAreas = useCallback(async () => {
        setLoading(true);
        try {
            const areas = await electron.getFocusAreas();
            setFocusAreas(areas);
        } catch (error) {
            console.error('Failed to load focus areas:', error);
        } finally {
            setLoading(false);
        }
    }, [electron]);

    useEffect(() => {
        if (activeTab === 'daily') {
            loadDailySummary();
        } else if (activeTab === 'weekly') {
            loadWeeklyInsights();
        } else if (activeTab === 'gaps') {
            loadLearningGaps();
        } else if (activeTab === 'focus') {
            loadFocusAreas();
        }
    }, [activeTab, loadDailySummary, loadWeeklyInsights, loadLearningGaps, loadFocusAreas]);

    return (
        <div className="insights-page">
            <div className="insights-header">
                <div>
                    <h1 className="insights-title">Learning Insights</h1>
                    <p className="insights-subtitle">
                        AI-powered analysis of your learning patterns
                    </p>
                </div>
            </div>

            <div className="insights-tabs">
                <button
                    className={`insights-tab ${activeTab === 'daily' ? 'active' : ''}`}
                    onClick={() => setActiveTab('daily')}
                >
                    Daily Summary
                </button>
                <button
                    className={`insights-tab ${activeTab === 'weekly' ? 'active' : ''}`}
                    onClick={() => setActiveTab('weekly')}
                >
                    Weekly Insights
                </button>
                <button
                    className={`insights-tab ${activeTab === 'gaps' ? 'active' : ''}`}
                    onClick={() => setActiveTab('gaps')}
                >
                    Learning Gaps
                </button>
                <button
                    className={`insights-tab ${activeTab === 'focus' ? 'active' : ''}`}
                    onClick={() => setActiveTab('focus')}
                >
                    Focus Areas
                </button>
            </div>

            <div className="insights-content">
                {loading ? (
                    <div className="card">
                        <div className="insights-loading">Loading insights...</div>
                    </div>
                ) : (
                    <>
                        {activeTab === 'daily' && <DailySummaryView summary={dailySummary} />}
                        {activeTab === 'weekly' && <WeeklyInsightsView insights={weeklyInsights} />}
                        {activeTab === 'gaps' && <LearningGapsView gaps={learningGaps} />}
                        {activeTab === 'focus' && <FocusAreasView areas={focusAreas} />}
                    </>
                )}
            </div>
        </div>
    );
}

function DailySummaryView({ summary }) {
    if (!summary) {
        return (
            <div className="card">
                <div className="insights-empty">No summary available for this date.</div>
            </div>
        );
    }

    return (
        <div className="insights-grid">
            <div className="card card-wide">
                <h3 className="card-title">AI Summary</h3>
                <p className="insights-text">{summary.aiSummary || summary.summary || 'No summary available.'}</p>
            </div>

            <div className="card">
                <h3 className="card-title">Time Spent</h3>
                <div className="time-spent-list">
                    {Object.entries(summary.time_spent || {}).map(([type, minutes]) => (
                        <div key={type} className="time-spent-item">
                            <span className="time-spent-type">{type}</span>
                            <span className="time-spent-value">{minutes} min</span>
                        </div>
                    ))}
                </div>
            </div>

            <div className="card">
                <h3 className="card-title">Concepts Learned</h3>
                <div className="concepts-list">
                    {(summary.concepts_learned || summary.concepts || []).map((concept, idx) => (
                        <span key={idx} className="concept-chip">
                            {concept}
                        </span>
                    ))}
                </div>
            </div>

            {summary.aiInsights && summary.aiInsights.length > 0 && (
                <div className="card card-wide">
                    <h3 className="card-title">Key Insights</h3>
                    <ul className="insights-list">
                        {summary.aiInsights.map((insight, idx) => (
                            <li key={idx}>{insight}</li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
}

function WeeklyInsightsView({ insights }) {
    if (!insights) {
        return (
            <div className="card">
                <div className="insights-empty">No insights available for this week.</div>
            </div>
        );
    }

    return (
        <div className="insights-grid">
            <div className="card card-wide">
                <h3 className="card-title">Weekly Summary</h3>
                <p className="insights-text">{insights.aiSummary || insights.summary || 'No summary available.'}</p>
            </div>

            {insights.aiPatterns && insights.aiPatterns.length > 0 && (
                <div className="card">
                    <h3 className="card-title">Learning Patterns</h3>
                    <ul className="insights-list">
                        {insights.aiPatterns.map((pattern, idx) => (
                            <li key={idx}>{pattern}</li>
                        ))}
                    </ul>
                </div>
            )}

            {insights.aiRecommendations && insights.aiRecommendations.length > 0 && (
                <div className="card">
                    <h3 className="card-title">Recommendations</h3>
                    <ul className="insights-list">
                        {insights.aiRecommendations.map((rec, idx) => (
                            <li key={idx}>{rec}</li>
                        ))}
                    </ul>
                </div>
            )}

            {insights.aiKnowledgeGrains && insights.aiKnowledgeGrains.length > 0 && (
                <div className="card card-wide">
                    <h3 className="card-title">Knowledge Grains</h3>
                    <div className="concepts-list">
                        {insights.aiKnowledgeGrains.map((grain, idx) => (
                            <span key={idx} className="concept-chip">
                                {grain}
                            </span>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

function LearningGapsView({ gaps }) {
    if (!gaps || gaps.length === 0) {
        return (
            <div className="card">
                <div className="insights-empty">
                    Great! You've been applying what you learn. No learning gaps found.
                </div>
            </div>
        );
    }

    return (
        <div className="gaps-list">
            {gaps.map((gap, idx) => (
                <div key={idx} className="card gap-item">
                    <div className="gap-header">
                        <h3 className="gap-concept">{gap.concept}</h3>
                        <span className="gap-days">{gap.days_since} days ago</span>
                    </div>
                    <p className="gap-watched">
                        Watched in: {gap.watched_in || 'Unknown'}
                    </p>
                    {gap.recommendation && (
                        <p className="gap-recommendation">{gap.recommendation}</p>
                    )}
                </div>
            ))}
        </div>
    );
}

function FocusAreasView({ areas }) {
    if (!areas || areas.length === 0) {
        return (
            <div className="card">
                <div className="insights-empty">
                    Your learning is well-balanced. Keep up the good work!
                </div>
            </div>
        );
    }

    return (
        <div className="focus-areas-list">
            {areas.map((area, idx) => (
                <div key={idx} className="card focus-area-item">
                    <div className="focus-area-header">
                        <h3 className="focus-area-name">{area.area}</h3>
                        <span className={`focus-area-priority priority-${area.priority}`}>
                            {area.priority}
                        </span>
                    </div>
                    <p className="focus-area-reason">{area.reason}</p>
                    {area.action_items && area.action_items.length > 0 && (
                        <div className="focus-area-actions">
                            <h4>Action Items:</h4>
                            <ul>
                                {area.action_items.map((item, itemIdx) => (
                                    <li key={itemIdx}>{item}</li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
}