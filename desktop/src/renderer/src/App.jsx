import React, { useEffect } from 'react';
import useElectron from './hooks/useElectron.js';
import useAppStore from './store/store.js';
import Sidebar from './components/layout/Sidebar/Sidebar.jsx';
import TitleBar from './components/layout/TitleBar/TitleBar.jsx';
import StatusBar from './components/layout/StatusBar/StatusBar.jsx';
import MainPage from './pages/Main/index.jsx';
import SettingsPage from './pages/Settings/index.jsx';
import HistoryPage from './pages/History/index.jsx';
import SearchPage from './pages/Search/index.jsx';
import ChatPage from './pages/Chat/index.jsx';
import GraphPage from './pages/Graph/index.jsx';
import FilesPage from './pages/Files/index.jsx';

export default function App() {
    const electron = useElectron();
    const activityStatus = useAppStore((s) => s.activityStatus);
    const setActivityStatus = useAppStore((s) => s.setActivityStatus);
    const setTodayCount = useAppStore((s) => s.setTodayCount);
    const setSettings = useAppStore((s) => s.setSettings);
    const setGraphStats = useAppStore((s) => s.setGraphStats);
    const currentPage = useAppStore((s) => s.currentPage);
    const setCurrentPage = useAppStore((s) => s.setCurrentPage);

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

    // Keyboard shortcuts and IPC shortcut listeners
    useEffect(() => {
        const handleKeyDown = (e) => {
            // Cmd/Ctrl + K for search
            if ((e.metaKey || e.ctrlKey) && e.key === 'k' && !e.shiftKey) {
                e.preventDefault();
                setCurrentPage('search');
            }
            // Cmd/Ctrl + Shift + C for chat
            if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'C') {
                e.preventDefault();
                setCurrentPage('chat');
            }
            // Cmd/Ctrl + Shift + G for graph
            if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'G') {
                e.preventDefault();
                setCurrentPage('graph');
            }
            // Escape to go back to main
            if (e.key === 'Escape' && currentPage !== 'main') {
                setCurrentPage('main');
            }
        };

        window.addEventListener('keydown', handleKeyDown);

        // Listen for IPC shortcuts from main process
        electron.on?.('shortcut:open-search', () => {
            setCurrentPage('search');
        });
        electron.on?.('shortcut:open-chat', () => {
            setCurrentPage('chat');
        });
        electron.on?.('shortcut:open-graph', () => {
            setCurrentPage('graph');
        });
        electron.on?.('menu:open-preferences', () => {
            setCurrentPage('settings');
        });

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            electron.removeAllListeners?.('shortcut:open-search');
            electron.removeAllListeners?.('shortcut:open-chat');
            electron.removeAllListeners?.('shortcut:open-graph');
            electron.removeAllListeners?.('menu:open-preferences');
        };
    }, [electron, currentPage, setCurrentPage]);

    const renderPage = () => {
        switch (currentPage) {
            case 'settings':
                return <SettingsPage />;
            case 'files':
                return <FilesPage />; 
            case 'history':
                return <HistoryPage />;
            case 'search':
                return <SearchPage />;
            case 'chat':
                return <ChatPage />;
            case 'graph':
                return <GraphPage />;
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