import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import useAppStore from '../../../store/store.js';
import useElectron from '../../../hooks/useElectron.js';
import './Statusbar.css';

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

    const getStatusConfig = () => {
        if (!status) {
            return {
                text: 'Connecting…',
                color: 'var(--status-connecting)',
                icon: '⏳',
                variant: 'connecting'
            };
        }
        if (status.isPaused) {
            return {
                text: 'Paused',
                color: 'var(--status-paused)',
                icon: '⏸️',
                variant: 'paused'
            };
        }
        if (status.isTracking) {
            return {
                text: 'Tracking',
                color: 'var(--status-tracking)',
                icon: '🔴',
                variant: 'tracking'
            };
        }
        return {
            text: 'Idle',
            color: 'var(--status-idle)',
            icon: '⭕',
            variant: 'idle'
        };
    };

    const statusConfig = getStatusConfig();
    const timeString = now.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
    });

    return (
        <div className="status-bar">
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.1 }}
                className="status-bar-left"
            >
                <motion.div
                    className={`status-indicator status-indicator-${statusConfig.variant}`}
                    animate={{
                        boxShadow: statusConfig.variant === 'tracking'
                            ? [
                                `0 0 8px ${statusConfig.color}`,
                                `0 0 16px ${statusConfig.color}`,
                                `0 0 8px ${statusConfig.color}`
                            ]
                            : `0 0 0px ${statusConfig.color}`
                    }}
                    transition={{
                        duration: 2,
                        repeat: Infinity,
                        repeatType: 'loop'
                    }}
                />

                <div className="status-info">
                    <span className="status-icon">{statusConfig.icon}</span>
                    <span className="status-text">{statusConfig.text}</span>
                </div>

                {status?.todayCount != null && (
                    <motion.div
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.2 }}
                        className="status-counter"
                    >
                        <span className="status-counter-label">Today:</span>
                        <span className="status-counter-value">
                            {status.todayCount}
                        </span>
                        <span className="status-counter-unit">captures</span>
                    </motion.div>
                )}
            </motion.div>

            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="status-bar-right"
            >
                <div className="status-time">
                    {timeString}
                </div>
            </motion.div>
        </div>
    );
}