import React, { useState, useEffect, useMemo, useCallback } from 'react';
import useElectron from '../../hooks/useElectron.js';
import useAppStore from '../../store/store.js';
import Button from '../../components/common/Button/index.jsx';
import ActivityDetail from '../../components/features/History/ActivityDetail.jsx';
import './History.css';

export default function HistoryPage() {
    const electron = useElectron();
    const [activities, setActivities] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedActivity, setSelectedActivity] = useState(null);
    const [filters, setFilters] = useState({
        sourceType: '',
        appName: '',
        searchQuery: '',
        dateRange: 'all', // 'today', 'week', 'month', 'all'
    });

    const loadActivities = useCallback(async () => {
        setLoading(true);
        try {
            const dateFilter = getDateFilter(filters.dateRange);
            const allActivities = await electron.getActivities({
                startDate: dateFilter.start,
                endDate: dateFilter.end,
                sourceType: filters.sourceType || undefined,
                limit: 100,
            });

            // Client-side filtering for search and app name
            let filtered = allActivities;

            if (filters.searchQuery) {
                const query = filters.searchQuery.toLowerCase();
                filtered = filtered.filter(
                    (a) =>
                        (a.title || '').toLowerCase().includes(query) ||
                        (a.window_title || '').toLowerCase().includes(query) ||
                        (a.url || '').toLowerCase().includes(query) ||
                        (a.app_name || '').toLowerCase().includes(query)
                );
            }

            if (filters.appName) {
                filtered = filtered.filter(
                    (a) => (a.app_name || '').toLowerCase() === filters.appName.toLowerCase()
                );
            }

            setActivities(filtered);
        } catch (error) {
            console.error('Failed to load activities:', error);
            setActivities([]);
        } finally {
            setLoading(false);
        }
    }, [electron, filters]);

    useEffect(() => {
        loadActivities();
    }, [loadActivities]);

    const sourceTypes = useMemo(() => {
        const types = new Set(activities.map((a) => a.source_type).filter(Boolean));
        return Array.from(types);
    }, [activities]);

    const appNames = useMemo(() => {
        const apps = new Set(activities.map((a) => a.app_name).filter(Boolean));
        return Array.from(apps).sort();
    }, [activities]);

    const handleActivityClick = useCallback((activity) => {
        setSelectedActivity(activity);
    }, []);

    const handleCloseDetail = useCallback(() => {
        setSelectedActivity(null);
    }, []);

    if (loading && activities.length === 0) {
        return (
            <div className="history-page">
                <div className="card">
                    <div className="history-loading">Loading activities...</div>
                </div>
            </div>
        );
    }

    return (
        <div className="history-page">
            <div className="history-header">
                <div>
                    <h1 className="history-title">Activity History</h1>
                    <p className="history-subtitle">
                        Browse and explore your captured learning moments
                    </p>
                </div>
                <div className="history-count">
                    {activities.length} {activities.length === 1 ? 'activity' : 'activities'}
                </div>
            </div>

            {/* Filters */}
            <div className="card history-filters">
                <div className="filters-grid">
                    <div className="filter-group">
                        <label className="filter-label">Search</label>
                        <input
                            type="text"
                            className="filter-input"
                            placeholder="Search by title, URL, or app..."
                            value={filters.searchQuery}
                            onChange={(e) =>
                                setFilters((f) => ({ ...f, searchQuery: e.target.value }))
                            }
                        />
                    </div>

                    <div className="filter-group">
                        <label className="filter-label">Time Range</label>
                        <select
                            className="filter-select"
                            value={filters.dateRange}
                            onChange={(e) =>
                                setFilters((f) => ({ ...f, dateRange: e.target.value }))
                            }
                        >
                            <option value="today">Today</option>
                            <option value="week">This Week</option>
                            <option value="month">This Month</option>
                            <option value="all">All Time</option>
                        </select>
                    </div>

                    <div className="filter-group">
                        <label className="filter-label">Source Type</label>
                        <select
                            className="filter-select"
                            value={filters.sourceType}
                            onChange={(e) =>
                                setFilters((f) => ({ ...f, sourceType: e.target.value }))
                            }
                        >
                            <option value="">All Types</option>
                            {sourceTypes.map((type) => (
                                <option key={type} value={type}>
                                    {type.charAt(0).toUpperCase() + type.slice(1)}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="filter-group">
                        <label className="filter-label">App</label>
                        <select
                            className="filter-select"
                            value={filters.appName}
                            onChange={(e) =>
                                setFilters((f) => ({ ...f, appName: e.target.value }))
                            }
                        >
                            <option value="">All Apps</option>
                            {appNames.map((app) => (
                                <option key={app} value={app}>
                                    {app}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* Activities List */}
            {activities.length === 0 ? (
                <div className="card history-empty">
                    <div className="empty-icon">📚</div>
                    <h3 className="empty-title">No activities found</h3>
                    <p className="empty-description">
                        {filters.searchQuery || filters.sourceType || filters.appName
                            ? 'Try adjusting your filters'
                            : 'Start tracking to see your learning activities here'}
                    </p>
                </div>
            ) : (
                <div className="activities-list">
                    {activities.map((activity) => (
                        <ActivityItem
                            key={activity.id}
                            activity={activity}
                            onClick={() => handleActivityClick(activity)}
                        />
                    ))}
                </div>
            )}

            {/* Activity Detail Modal */}
            {selectedActivity && (
                <ActivityDetail
                    activity={selectedActivity}
                    onClose={handleCloseDetail}
                />
            )}
        </div>
    );
}

function ActivityItem({ activity, onClick }) {
    const formattedDate = useMemo(() => {
        const date = new Date(activity.timestamp);
        return {
            date: date.toLocaleDateString(),
            time: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
    }, [activity.timestamp]);

    return (
        <div className="activity-item" onClick={onClick}>
            <div className="activity-item-main">
                <div className="activity-item-header">
                    <h3 className="activity-item-title">
                        {activity.title || activity.window_title || 'Untitled Activity'}
                    </h3>
                    <span className="activity-item-badge">{activity.source_type}</span>
                </div>
                <div className="activity-item-meta">
                    <span className="activity-item-app">{activity.app_name}</span>
                    <span className="activity-item-separator">•</span>
                    <span className="activity-item-date">{formattedDate.date}</span>
                    <span className="activity-item-time">{formattedDate.time}</span>
                </div>
                {activity.url && (
                    <div className="activity-item-url" title={activity.url}>
                        {activity.url}
                    </div>
                )}
            </div>
            <div className="activity-item-arrow">→</div>
        </div>
    );
}

function getDateFilter(range) {
    const now = new Date();
    const start = new Date();

    switch (range) {
        case 'today':
            start.setHours(0, 0, 0, 0);
            break;
        case 'week':
            start.setDate(now.getDate() - 7);
            break;
        case 'month':
            start.setMonth(now.getMonth() - 1);
            break;
        default:
            return { start: null, end: null };
    }

    return {
        start: start.toISOString(),
        end: now.toISOString(),
    };
}