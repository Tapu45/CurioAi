import React, { useCallback, useMemo } from 'react';
import { FileText, MessageCircle, Network, Activity } from 'lucide-react';
import { useEffect, useState } from 'react';
import useAppStore from '../../store/store.js';
import useElectron from '../../hooks/useElectron.js';
import Button from '../../components/common/Button/index.jsx';
import './Main.css';

export default function MainPage() {
    const electron = useElectron();
    const activityStatus = useAppStore((s) => s.activityStatus);
    const setActivityStatus = useAppStore((s) => s.setActivityStatus);
    const todayCount = useAppStore((s) => s.todayCount);
    const setTodayCount = useAppStore((s) => s.setTodayCount);
    const setCurrentPage = useAppStore((s) => s.setCurrentPage);

    const [fileStats, setFileStats] = useState({ total: 0, indexed: 0 });
    const [chatStats, setChatStats] = useState({ conversations: 0, messages: 0 });
    const [graphStats, setGraphStats] = useState({ nodes: 0, edges: 0 });

    const isPaused = activityStatus?.isPaused;
    const isTracking = activityStatus?.isTracking;
    const lastActivity = activityStatus?.lastActivity;

    const handleToggleTracking = useCallback(async () => {
        try {
            if (isPaused || !isTracking) {
                await electron.resumeTracking();
            } else {
                await electron.pauseTracking();
            }
            const status = await electron.getActivityStatus();
            if (status) {
                setActivityStatus(status);
                if (typeof status.todayCount === 'number') {
                    setTodayCount(status.todayCount);
                }
            }
        } catch (e) {
            console.error('Failed to toggle tracking', e);
        }
    }, [electron, isPaused, isTracking, setActivityStatus, setTodayCount]);

    const statusBadgeClass = useMemo(() => {
        if (isPaused) return 'status-badge status-badge-paused';
        if (isTracking) return 'status-badge status-badge-active';
        return 'status-badge status-badge-idle';
    }, [isPaused, isTracking]);

    const statusText = useMemo(() => {
        if (isPaused) return 'Paused';
        if (isTracking) return 'status-badge status-badge-active';
        return 'Idle';
    }, [isPaused, isTracking]);

    const formattedTime = useMemo(() => {
        if (!lastActivity?.timestamp) return null;
        const date = new Date(lastActivity.timestamp);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        const diffHours = Math.floor(diffMins / 60);
        if (diffHours < 24) return `${diffHours}h ago`;
        return date.toLocaleDateString();
    }, [lastActivity?.timestamp]);

    useEffect(() => {
        const loadStats = async () => {
            try {
                // Load file stats
                const files = await electron.getFiles?.({ limit: 1, offset: 0 });
                if (files) {
                    setFileStats({ total: files.length, indexed: files.length });
                }

                // Load chat stats
                const chatHistory = await electron.getChatHistory?.(1);
                if (chatHistory) {
                    setChatStats({ conversations: 1, messages: chatHistory.length });
                }

                // Load graph stats
                const stats = await electron.getGraphStats?.();
                if (stats) {
                    setGraphStats({ nodes: stats.nodes || 0, edges: stats.edges || 0 });
                }
            } catch (error) {
                console.error('Failed to load stats:', error);
            }
        };
        loadStats();
    }, [electron]);

    return (
        <div className="main-page">
            {/* Hero Status Card */}
            <div className="card status-card">
                <div className="card-header">
                    <div>
                        <h2 className="card-title">Tracking Status</h2>
                        <p className="card-subtitle">
                            CurioAI monitors your active window every ~60 seconds
                        </p>
                    </div>
                    <span className={statusBadgeClass}>
                        {statusText}
                    </span>
                </div>

                <div className="status-actions">
                    <Button onClick={handleToggleTracking} variant="primary">
                        {isPaused || !isTracking ? '▶ Resume Tracking' : '⏸ Pause Tracking'}
                    </Button>
                    <Button
                        variant="secondary"
                        onClick={() => setCurrentPage('settings')}
                    >
                        ⚙️ Settings
                    </Button>
                </div>

                <div className="stats-grid">
                    <div className="stat-item">
                        <div className="stat-value">{todayCount || 0}</div>
                        <div className="stat-label">Today&apos;s Captures</div>
                        <div className="stat-description">Learning moments logged</div>
                    </div>

                    <div className="stat-item">
                        <div className="stat-label">Last Activity</div>
                        {lastActivity ? (
                            <>
                                <div className="stat-activity-title">
                                    {lastActivity.title || lastActivity.window_title || 'Untitled'}
                                </div>
                                <div className="stat-activity-meta">
                                    <span className="stat-badge">{lastActivity.app_name || 'Unknown'}</span>
                                    <span className="stat-badge">{lastActivity.source_type || 'other'}</span>
                                    {formattedTime && <span className="stat-time">{formattedTime}</span>}
                                </div>
                                {lastActivity.url && (
                                    <div className="stat-activity-url" title={lastActivity.url}>
                                        {lastActivity.url}
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className="stat-empty">
                                No activity captured yet. Start tracking to see live updates.
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Quick Stats Grid */}
            <div className="main-stats-grid">
                <div className="main-stat-card">
                    <div className="main-stat-card-header">
                        <div className="main-stat-card-icon">
                            <FileText size={20} />
                        </div>
                        <h3 className="main-stat-card-title">Files Indexed</h3>
                    </div>
                    <div className="main-stat-card-value">{fileStats.total}</div>
                    <p className="main-stat-card-description">Documents ready for search</p>
                </div>

                <div className="main-stat-card">
                    <div className="main-stat-card-header">
                        <div className="main-stat-card-icon">
                            <MessageCircle size={20} />
                        </div>
                        <h3 className="main-stat-card-title">Conversations</h3>
                    </div>
                    <div className="main-stat-card-value">{chatStats.conversations}</div>
                    <p className="main-stat-card-description">Chat sessions with AI</p>
                </div>

                <div className="main-stat-card">
                    <div className="main-stat-card-header">
                        <div className="main-stat-card-icon">
                            <Network size={20} />
                        </div>
                        <h3 className="main-stat-card-title">Knowledge Graph</h3>
                    </div>
                    <div className="main-stat-card-value">{graphStats.nodes}</div>
                    <p className="main-stat-card-description">{graphStats.edges} connections</p>
                </div>

                <div className="main-stat-card">
                    <div className="main-stat-card-header">
                        <div className="main-stat-card-icon">
                            <Activity size={20} />
                        </div>
                        <h3 className="main-stat-card-title">Activities</h3>
                    </div>
                    <div className="main-stat-card-value">{todayCount || 0}</div>
                    <p className="main-stat-card-description">Captured today</p>
                </div>
            </div>

            {/* Info Cards Grid */}
            <div className="info-grid">
                <div className="card info-card">
                    <div className="card-header">
                        <h3 className="card-title">What CurioAI Captures</h3>
                        <p className="card-subtitle">Only learning-related windows</p>
                    </div>
                    <ul className="info-list">
                        <li className="info-list-item">
                            <span className="info-icon">🌐</span>
                            <div>
                                <div className="info-item-title">Browser Content</div>
                                <div className="info-item-desc">YouTube, Medium, docs, articles</div>
                            </div>
                        </li>
                        <li className="info-list-item">
                            <span className="info-icon">📄</span>
                            <div>
                                <div className="info-item-title">PDFs & Papers</div>
                                <div className="info-item-desc">Text extraction & metadata</div>
                            </div>
                        </li>
                        <li className="info-list-item">
                            <span className="info-icon">💻</span>
                            <div>
                                <div className="info-item-title">Code & IDE</div>
                                <div className="info-item-desc">Projects, languages, files</div>
                            </div>
                        </li>
                    </ul>
                </div>

                <div className="card info-card">
                    <div className="card-header">
                        <h3 className="card-title">Privacy & Control</h3>
                        <p className="card-subtitle">Local-first by default</p>
                    </div>
                    <p className="info-description">
                        All data stays on your machine by default. You can pause tracking at any time,
                        manage whitelists, and enable/disable sync from Settings.
                    </p>
                    <div className="tech-chips">
                        <span className="tech-chip">Local SQLite</span>
                        <span className="tech-chip">ChromaDB</span>
                        <span className="tech-chip">Neo4j</span>
                        <span className="tech-chip">Ollama LLM</span>
                    </div>
                </div>
            </div>
        </div>
    );
}