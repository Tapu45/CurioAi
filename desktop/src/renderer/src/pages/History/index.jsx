import React, { useState, useEffect, useMemo, useCallback } from 'react';
import useElectron from '../../hooks/useElectron.js';
import useAppStore from '../../store/store.js';
import Button from '../../components/common/Button/index.jsx';
import ActivityDetail from '../../components/features/History/ActivityDetail.jsx';
import SessionDetail from '../../components/features/History/SessionDetail.jsx'; // NEW
import './History.css';

export default function HistoryPage() {
    const electron = useElectron();
    const [viewMode, setViewMode] = useState('sessions'); // 'sessions' or 'activities'
    const [sessions, setSessions] = useState([]); // NEW
    const [activities, setActivities] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedActivity, setSelectedActivity] = useState(null);
    const [selectedSession, setSelectedSession] = useState(null); // NEW
    const [filters, setFilters] = useState({
        sourceType: '',
        activityType: '', // NEW
        appName: '',
        projectName: '', // NEW
        searchQuery: '',
        dateRange: 'all',
    });

    // NEW: Load sessions
    const loadSessions = useCallback(async () => {
        setLoading(true);
        try {
            const dateFilter = getDateFilter(filters.dateRange);
            const allSessions = await electron.getSessions({
                startDate: dateFilter.start,
                endDate: dateFilter.end,
                activityType: filters.activityType || undefined,
                projectName: filters.projectName || undefined,
                limit: 100,
            });

            // Client-side filtering
            let filtered = allSessions;

            if (filters.searchQuery) {
                const query = filters.searchQuery.toLowerCase();
                filtered = filtered.filter(
                    (s) =>
                        (s.summary || '').toLowerCase().includes(query) ||
                        (s.project_name || '').toLowerCase().includes(query) ||
                        (s.activity_type || '').toLowerCase().includes(query)
                );
            }

            setSessions(filtered);
        } catch (error) {
            console.error('Failed to load sessions:', error);
            setSessions([]);
        } finally {
            setLoading(false);
        }
    }, [electron, filters]);

    const loadActivities = useCallback(async () => {
        setLoading(true);
        try {
            const dateFilter = getDateFilter(filters.dateRange);
            const allActivities = await electron.getActivities({
                startDate: dateFilter.start,
                endDate: dateFilter.end,
                sourceType: filters.sourceType || undefined,
                activityType: filters.activityType || undefined, // NEW
                limit: 100,
            });

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
        if (viewMode === 'sessions') {
            loadSessions();
        } else {
            loadActivities();
        }
    }, [viewMode, loadSessions, loadActivities]);

    const activityTypes = useMemo(() => {
        const types = new Set([
            ...sessions.map((s) => s.activity_type).filter(Boolean),
            ...activities.map((a) => a.activity_type).filter(Boolean),
        ]);
        return Array.from(types);
    }, [sessions, activities]);

    const projectNames = useMemo(() => {
        const projects = new Set(sessions.map((s) => s.project_name).filter(Boolean));
        return Array.from(projects).sort();
    }, [sessions]);

    const handleSessionClick = useCallback(async (session) => {
        try {
            const fullSession = await electron.getSessionById(session.id);
            const sessionActivities = await electron.getActivitiesBySession(session.id);
            setSelectedSession({
                ...fullSession,
                activities: sessionActivities,
            });
        } catch (error) {
            console.error('Failed to load session details:', error);
        }
    }, [electron]);

    const handleActivityClick = useCallback((activity) => {
        setSelectedActivity(activity);
    }, []);

    const handleCloseDetail = useCallback(() => {
        setSelectedActivity(null);
        setSelectedSession(null);
    }, []);

    // NEW: Semantic search handler
    const handleSemanticSearch = useCallback(async () => {
        if (!filters.searchQuery.trim()) return;

        setLoading(true);
        try {
            const results = await electron.searchActivities(filters.searchQuery, {
                dateRange: filters.dateRange,
                activityType: filters.activityType || undefined,
            });

            if (viewMode === 'sessions') {
                // Group results by session
                const sessionIds = new Set(results.map(r => r.session_id).filter(Boolean));
                const sessionMap = new Map();
                sessions.forEach(s => sessionMap.set(s.id, s));

                const matchedSessions = Array.from(sessionIds)
                    .map(id => sessionMap.get(id))
                    .filter(Boolean);

                setSessions(matchedSessions);
            } else {
                setActivities(results);
            }
        } catch (error) {
            console.error('Semantic search failed:', error);
            // Fallback to regular search
            if (viewMode === 'sessions') {
                loadSessions();
            } else {
                loadActivities();
            }
        } finally {
            setLoading(false);
        }
    }, [filters, viewMode, electron, loadSessions, loadActivities, sessions]);

    if (loading && (sessions.length === 0 && activities.length === 0)) {
        return (
            <div className="history-page">
                <div className="card">
                    <div className="history-loading">Loading...</div>
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
                        Browse sessions and activities
                    </p>
                </div>
                <div className="history-actions">
                    <div className="view-mode-toggle">
                        <button
                            className={`view-mode-btn ${viewMode === 'sessions' ? 'active' : ''}`}
                            onClick={() => setViewMode('sessions')}
                        >
                            Sessions
                        </button>
                        <button
                            className={`view-mode-btn ${viewMode === 'activities' ? 'active' : ''}`}
                            onClick={() => setViewMode('activities')}
                        >
                            Activities
                        </button>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="card history-filters">
                <div className="filters-grid">
                    <div className="filter-group filter-group-wide">
                        <label className="filter-label">Search</label>
                        <div className="search-input-group">
                            <input
                                type="text"
                                className="filter-input"
                                placeholder="Search by title, URL, project, or use natural language..."
                                value={filters.searchQuery}
                                onChange={(e) =>
                                    setFilters((f) => ({ ...f, searchQuery: e.target.value }))
                                }
                                onKeyPress={(e) => {
                                    if (e.key === 'Enter') {
                                        handleSemanticSearch();
                                    }
                                }}
                            />
                            <Button
                                size="sm"
                                onClick={handleSemanticSearch}
                                disabled={!filters.searchQuery.trim()}
                            >
                                🔍 Search
                            </Button>
                        </div>
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
                        <label className="filter-label">Activity Type</label>
                        <select
                            className="filter-select"
                            value={filters.activityType}
                            onChange={(e) =>
                                setFilters((f) => ({ ...f, activityType: e.target.value }))
                            }
                        >
                            <option value="">All Types</option>
                            {activityTypes.map((type) => (
                                <option key={type} value={type}>
                                    {type.charAt(0).toUpperCase() + type.slice(1)}
                                </option>
                            ))}
                        </select>
                    </div>

                    {viewMode === 'sessions' && (
                        <div className="filter-group">
                            <label className="filter-label">Project</label>
                            <select
                                className="filter-select"
                                value={filters.projectName}
                                onChange={(e) =>
                                    setFilters((f) => ({ ...f, projectName: e.target.value }))
                                }
                            >
                                <option value="">All Projects</option>
                                {projectNames.map((project) => (
                                    <option key={project} value={project}>
                                        {project}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    {viewMode === 'activities' && (
                        <>
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
                                    {/* Populate from activities */}
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
                                    {/* Populate from activities */}
                                </select>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Sessions List */}
            {viewMode === 'sessions' && (
                sessions.length === 0 ? (
                    <div className="card history-empty">
                        <div className="empty-icon">📚</div>
                        <h3 className="empty-title">No sessions found</h3>
                        <p className="empty-description">
                            {filters.searchQuery || filters.activityType || filters.projectName
                                ? 'Try adjusting your filters'
                                : 'Start tracking to see your learning sessions here'}
                        </p>
                    </div>
                ) : (
                    <div className="sessions-list">
                        {sessions.map((session) => (
                            <SessionItem
                                key={session.id}
                                session={session}
                                onClick={() => handleSessionClick(session)}
                            />
                        ))}
                    </div>
                )
            )}

            {/* Activities List */}
            {viewMode === 'activities' && (
                activities.length === 0 ? (
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
                )
            )}

            {/* Session Detail Modal */}
            {selectedSession && (
                <SessionDetail
                    session={selectedSession}
                    onClose={handleCloseDetail}
                />
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

// NEW: Session Item Component
function SessionItem({ session, onClick }) {
    const formattedDate = useMemo(() => {
        const date = new Date(session.start_time);
        return {
            date: date.toLocaleDateString(),
            time: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
    }, [session.start_time]);

    const duration = useMemo(() => {
        if (session.duration_seconds) {
            const minutes = Math.floor(session.duration_seconds / 60);
            const hours = Math.floor(minutes / 60);
            if (hours > 0) {
                return `${hours}h ${minutes % 60}m`;
            }
            return `${minutes}m`;
        }
        return 'Ongoing';
    }, [session.duration_seconds]);

    const concepts = useMemo(() => {
        try {
            return typeof session.concepts === 'string'
                ? JSON.parse(session.concepts)
                : session.concepts || [];
        } catch {
            return [];
        }
    }, [session.concepts]);

    return (
        <div className="session-item" onClick={onClick}>
            <div className="session-item-main">
                <div className="session-item-header">
                    <h3 className="session-item-title">
                        {session.project_name || session.activity_type || 'Untitled Session'}
                    </h3>
                    <span className="session-item-badge">{session.activity_type}</span>
                </div>
                {session.summary && (
                    <p className="session-item-summary">{session.summary}</p>
                )}
                <div className="session-item-meta">
                    <span className="session-item-date">{formattedDate.date}</span>
                    <span className="session-item-time">{formattedDate.time}</span>
                    <span className="session-item-separator">•</span>
                    <span className="session-item-duration">{duration}</span>
                    {concepts.length > 0 && (
                        <>
                            <span className="session-item-separator">•</span>
                            <span className="session-item-concepts">
                                {concepts.slice(0, 3).join(', ')}
                                {concepts.length > 3 && '...'}
                            </span>
                        </>
                    )}
                </div>
            </div>
            <div className="session-item-arrow">→</div>
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