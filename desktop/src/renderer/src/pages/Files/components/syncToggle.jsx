import React from 'react';
import { Power, Loader2 } from 'lucide-react';
import './SyncToggle.css';

export default function SyncToggle({ enabled, loading, onToggle }) {
    return (
        <div className="sync-toggle">
            <label className="sync-toggle-label">
                <span className="sync-toggle-text">
                    <Power size={16} className={enabled ? 'sync-toggle-icon active' : 'sync-toggle-icon'} />
                    <span>File Sync</span>
                </span>
                <button
                    type="button"
                    className={`sync-toggle-switch ${enabled ? 'enabled' : ''}`}
                    onClick={onToggle}
                    disabled={loading}
                    aria-label={enabled ? 'Disable sync' : 'Enable sync'}
                >
                    {loading ? (
                        <Loader2 size={14} className="sync-toggle-loader" />
                    ) : (
                        <span className="sync-toggle-slider" />
                    )}
                </button>
            </label>
        </div>
    );
}