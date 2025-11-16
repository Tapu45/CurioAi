import React from 'react';
import useAppStore from './../../../store/store.js';

export default function TitleBar() {
    const currentPage = useAppStore((s) => s.currentPage);

    const titles = {
        main: 'Today’s Learning',
        history: 'Activity History',
        graph: 'Knowledge Graph',
        settings: 'Settings',
    };

    const subtitles = {
        main: 'Live view of what you’re learning right now',
        history: 'Browse and revisit your previous sessions',
        graph: 'Explore how your knowledge connects',
        settings: 'Control privacy, tracking, and sync',
    };

    return (
        <div className="title-bar">
            <div>
                <div style={{ fontSize: 15, fontWeight: 600 }}>{titles[currentPage] || 'CurioAI'}</div>
                <div style={{ fontSize: 12, color: '#9ca3af' }}>{subtitles[currentPage] || ''}</div>
            </div>
            <div style={{ fontSize: 11, color: '#9ca3af' }}>Local AI • Private by default</div>
        </div>
    );
}