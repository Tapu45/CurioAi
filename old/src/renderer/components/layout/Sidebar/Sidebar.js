import React from 'react';
import useAppStore from '../../../store/store.js'; // adjust path if needed

// If path is different, update to: '../../../store/store.js'

export default function Sidebar() {
    const currentPage = useAppStore((s) => s.currentPage);
    const setCurrentPage = useAppStore((s) => s.setCurrentPage);

    const items = [
        { id: 'main', label: 'Today', icon: '📊' },
        { id: 'history', label: 'History', icon: '🕒' },
        { id: 'graph', label: 'Graph', icon: '🧠' },
        { id: 'settings', label: 'Settings', icon: '⚙️' },
    ];

    return (
        <div className="sidebar">
            <div style={{ padding: '4px 8px 12px 8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div
                        style={{
                            width: 28,
                            height: 28,
                            borderRadius: 8,
                            background:
                                'radial-gradient(circle at 30% 30%, #4ade80, #22c55e, #16a34a)',
                        }}
                    />
                    <div>
                        <div style={{ fontSize: 15, fontWeight: 600 }}>CurioAI</div>
                        <div style={{ fontSize: 11, color: '#9ca3af' }}>Stay curious ✨</div>
                    </div>
                </div>
            </div>

            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {items.map((item) => {
                    const active = currentPage === item.id;
                    return (
                        <button
                            key={item.id}
                            onClick={() => setCurrentPage(item.id)}
                            style={{
                                border: 'none',
                                outline: 'none',
                                borderRadius: 8,
                                padding: '8px 10px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                                cursor: 'pointer',
                                background: active ? 'rgba(37, 99, 235, 0.25)' : 'transparent',
                                color: active ? '#e5e7eb' : '#9ca3af',
                                fontSize: 13,
                                fontWeight: active ? 600 : 500,
                            }}
                        >
                            <span style={{ fontSize: 16 }}>{item.icon}</span>
                            <span>{item.label}</span>
                        </button>
                    );
                })}
            </div>

            <div style={{ marginTop: 'auto', fontSize: 11, color: '#6b7280', padding: '8px 8px 0 8px' }}>
                <div>v1.0.0 • Local-first</div>
                <div>Ollama / SQLite / Chroma / Neo4j</div>
            </div>
        </div>
    );
}