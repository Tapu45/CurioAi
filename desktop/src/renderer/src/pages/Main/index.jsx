import React, { useCallback } from 'react';
import useAppStore from '@renderer/store/store';
import useElectron from '@renderer/hooks/useElectron';
import  Button  from '../../components/common/Button/index.jsx';


export default function MainPage() {
    const electron = useElectron();
    const activityStatus = useAppStore((s) => s.activityStatus);
    const setActivityStatus = useAppStore((s) => s.setActivityStatus);
    const todayCount = useAppStore((s) => s.todayCount);
    const setTodayCount = useAppStore((s) => s.setTodayCount);
    const setCurrentPage = useAppStore((s) => s.setCurrentPage);

    const isPaused = activityStatus?.isPaused;
    const isTracking = activityStatus?.isTracking;

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

    const last = activityStatus?.lastActivity;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="card">
                <div className="card-header">
                    <div>
                        <div className="card-title">Tracking Status</div>
                        <div className="card-subtitle">
                            CurioAI monitors your active window every ~60 seconds.
                        </div>
                    </div>
                    <div>
                        <span className={`badge ${isPaused ? 'badge-yellow' : isTracking ? 'badge-green' : 'badge-red'}`}>
                            {isPaused ? 'Paused' : isTracking ? 'Active' : 'Idle'}
                        </span>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: 16, marginTop: 8, alignItems: 'center' }}>
                    <Button onClick={handleToggleTracking}>
                        {isPaused || !isTracking ? 'Resume Tracking' : 'Pause Tracking'}
                    </Button>
                    <Button
                        variant="secondary"
                        onClick={() => setCurrentPage('settings')}
                    >
                        Privacy & Settings
                    </Button>
                </div>

                <div style={{ marginTop: 16, display: 'flex', gap: 24 }}>
                    <div>
                        <div className="section-title">Today&apos;s Captures</div>
                        <div style={{ fontSize: 28, fontWeight: 700 }}>{todayCount || 0}</div>
                        <div className="section-description">Learning moments logged</div>
                    </div>
                    <div>
                        <div className="section-title">Last Activity</div>
                        {last ? (
                            <>
                                <div style={{ fontSize: 13, fontWeight: 500 }}>{last.title || last.window_title}</div>
                                <div className="muted">
                                    {last.app_name} • {last.source_type} • {new Date(last.timestamp).toLocaleTimeString()}
                                </div>
                                {last.url && (
                                    <div className="muted" style={{ marginTop: 4, wordBreak: 'break-all' }}>
                                        {last.url}
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className="muted">No activity captured yet. Start tracking to see live updates.</div>
                        )}
                    </div>
                </div>
            </div>

            <div className="section-grid">
                <div className="card">
                    <div className="card-header">
                        <div>
                            <div className="card-title">What CurioAI Captures</div>
                            <div className="card-subtitle">Only learning-related windows</div>
                        </div>
                    </div>
                    <ul className="list">
                        <li className="list-item">
                            <span>Browser (YouTube, Medium, docs)</span>
                            <span className="muted">Titles, URLs, content</span>
                        </li>
                        <li className="list-item">
                            <span>PDFs & Papers</span>
                            <span className="muted">Text & metadata</span>
                        </li>
                        <li className="list-item">
                            <span>Code & IDE</span>
                            <span className="muted">Project, languages, file names</span>
                        </li>
                    </ul>
                </div>

                <div className="card">
                    <div className="card-header">
                        <div>
                            <div className="card-title">Privacy & Control</div>
                            <div className="card-subtitle">Local-first by default</div>
                        </div>
                    </div>
                    <p className="section-description">
                        All data stays on your machine by default. You can pause tracking at any time,
                        manage whitelists, and enable/disable sync from Settings.
                    </p>
                    <div className="chip-row">
                        <span className="chip">Local SQLite</span>
                        <span className="chip">ChromaDB Embeddings</span>
                        <span className="chip">Neo4j Graph</span>
                        <span className="chip">Ollama LLM</span>
                    </div>
                </div>
            </div>
        </div>
    );
}