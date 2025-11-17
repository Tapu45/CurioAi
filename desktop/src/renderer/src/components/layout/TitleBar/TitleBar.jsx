import React from 'react';
import { motion } from 'framer-motion';
import useAppStore from './../../../store/store.js';
import './TitleBar.css';

export default function TitleBar() {
    const currentPage = useAppStore((s) => s.currentPage);

    const titles = {
        main: "Today's Learning",
        history: 'Activity History',
        graph: 'Knowledge Graph',
        settings: 'Settings',
    };

    const subtitles = {
        main: 'Live view of what you\'re learning right now',
        history: 'Browse and revisit your previous sessions',
        graph: 'Explore how your knowledge connects',
        settings: 'Control privacy, tracking, and sync',
    };

    const icons = {
        main: '📚',
        history: '⏱️',
        graph: '🧠',
        settings: '⚙️',
    };

    return (
        <div className="title-bar">
            <motion.div
                key={currentPage}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.2 }}
                className="title-bar-content"
            >
                <div className="title-bar-left">
                    <div className="title-bar-icon">
                        {icons[currentPage] || '✨'}
                    </div>
                    <div className="title-bar-text">
                        <h1 className="title-bar-title">
                            {titles[currentPage] || 'CurioAI'}
                        </h1>
                        <p className="title-bar-subtitle">
                            {subtitles[currentPage] || ''}
                        </p>
                    </div>
                </div>
            </motion.div>

            <div className="title-bar-divider" />

            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.1 }}
                className="title-bar-right"
            >
                <div className="title-bar-badge">
                    <span className="title-bar-badge-dot" />
                    <span className="title-bar-badge-text">Local AI</span>
                </div>
                <div className="title-bar-privacy">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    </svg>
                    <span className="title-bar-privacy-text">Private by default</span>
                </div>
            </motion.div>
        </div>
    );
}