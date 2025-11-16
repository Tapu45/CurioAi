import React, { useEffect } from 'react';
import useElectron from './hooks/useElectron.js';
import useAppStore from './store/store.js';
import Sidebar from './components/layout/Sidebar/Sidebar.js';
import TitleBar from './components/layout/TitleBar/TitleBar.js';
import StatusBar from './components/layout/StatusBar/StatusBar.js';
import MainPage from './pages/Main/index.js';
import SettingsPage from './pages/Settings/index.js';
// You can add HistoryPage and GraphPage later

export default function App() {
    const electron = useElectron();
    const activityStatus = useAppStore((s) => s.activityStatus);
    const setActivityStatus = useAppStore((s) => s.setActivityStatus);
    const setTodayCount = useAppStore((s) => s.setTodayCount);
    const setSettings = useAppStore((s) => s.setSettings);
    const setGraphStats = useAppStore((s) => s.setGraphStats);
    const currentPage = useAppStore((s) => s.currentPage);

    useEffect(() => {
        const init = async () => {
            try {
                const status = await electron.getActivityStatus();
                if (status) {
                    setActivityStatus(status);
                    if (typeof status.todayCount === 'number') {
                    setTodayCount(status.todayCount);
                }
            }
        } catch (e) {
            console.error('Failed to load activity status', e);
        }

        try {
            const settings = await electron.getSettings();
            if (settings) {
                setSettings(settings);
            }
        } catch (e) {
            console.error('Failed to load settings', e);
        }

        try {
            const stats = await electron.getGraphStats?.();
            if (stats) {
                setGraphStats(stats);
            }
        } catch (e) {
            console.error('Failed to load graph stats', e);
        }

        // Activity updates
        electron.onActivityUpdate?.((data) => {
            setActivityStatus((prev) => ({
                ...(prev || {}),
                lastActivity: data,
            }));
        });
    };

    init();

    return () => {
        electron.removeAllListeners?.('activity:update');
        electron.removeAllListeners?.('activity:status-change');
    };
}, [electron, setActivityStatus, setTodayCount, setSettings, setGraphStats]);

const renderPage = () => {
    switch (currentPage) {
        case 'settings':
            return <SettingsPage />;
        case 'history':
            return (
                <div className="card">
                    <div className="card-header">
                        <div className="card-title">History</div>
                    </div>
                    <p className="section-description">
                        History UI will list your past activities and summaries. (Placeholder for now.)
                    </p>
                </div>
            );
        case 'graph':
            return (
                <div className="card">
                    <div className="card-header">
                        <div className="card-title">Knowledge Graph</div>
                    </div>
                    <p className="section-description">
                        Graph viewer will render your concept network here. (Placeholder for now.)
                    </p>
                </div>
            );
        case 'main':
        default:
            return <MainPage />;
    }
};

return (
    <div className="app-shell">
        <Sidebar />
        <div className="main-content">
            <TitleBar />
            <div className="main-content-inner">{renderPage()}</div>
            <StatusBar />
        </div>
    </div>
);
}