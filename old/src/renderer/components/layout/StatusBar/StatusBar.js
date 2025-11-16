import React, { useEffect, useState } from 'react';
import useAppStore from '../../store/store.js';
import useElectron from '../../hooks/useElectron.js';

export default function StatusBar() {
    const electron = useElectron();
    const activityStatus = useAppStore((s) => s.activityStatus);
    const setActivityStatus = useAppStore((s) => s.setActivityStatus);
    const [now, setNow] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        // Subscribe to status change events
        electron.onStatusChange?.((status) => {
            setActivityStatus(status);
        });

        return () => {
            electron.removeAllListeners?.('activity:status-change');
        };
    }, [electron, setActivityStatus]);

    const status = activityStatus;
    const statusText = !status
        ? 'Connecting…'
        : status.isPaused
            ? 'Paused'
            : status.isTracking
                ? 'Tracking'
                : 'Idle';

    const statusColor = !status
        ? '#fbbf24'
        : status.isPaused
            ? '#f97316'
            : status.isTracking
                ? '#22c55e'
                : '#9ca3af';

    return (
        <div className="status-bar">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span
                    style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        backgroundColor: statusColor,
                        boxShadow: `0 0 6px ${statusColor}`,
                    }}
                />
                <span>{statusText}</span>
                {status?.todayCount != null && (
                    <span style={{ marginLeft: 8, fontSize: 11, color: '#9ca3af' }}>
                        Today: {status.todayCount} captures
                    </span>
                )}
            </div>
            <div>{now.toLocaleTimeString()}</div>
        </div>
    );
}