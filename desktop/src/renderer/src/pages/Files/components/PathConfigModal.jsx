import React, { useState, useEffect } from 'react';
import { X, FolderOpen } from 'lucide-react';
import useElectron from '@renderer/hooks/useElectron';
import './PathConfigModal.css';

export default function PathConfigModal({ path, onClose }) {
    const electron = useElectron();
    const [formData, setFormData] = useState({
        path: path?.path || '',
        enabled: path?.enabled !== false,
        recursive: path?.recursive !== false,
        patterns: path?.patterns?.join(', ') || '',
        excludedPatterns: path?.excludedPatterns?.join(', ') || '',
        priority: path?.priority || 0,
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        try {
            const config = {
                path: formData.path,
                enabled: formData.enabled,
                recursive: formData.recursive,
                patterns: formData.patterns
                    .split(',')
                    .map(p => p.trim())
                    .filter(p => p.length > 0),
                excludedPatterns: formData.excludedPatterns
                    .split(',')
                    .map(p => p.trim())
                    .filter(p => p.length > 0),
                priority: parseInt(formData.priority) || 0,
            };

            if (path) {
                await electron.updateSyncConfig?.(path.id, config);
            } else {
                await electron.addSyncPath?.(config);
            }

            onClose();
        } catch (err) {
            setError(err.message || 'Failed to save path configuration');
        } finally {
            setLoading(false);
        }
    };

    const handleBrowsePath = async () => {
        try {
            // Note: You'll need to implement a file dialog IPC handler
            // For now, this is a placeholder
            const selectedPath = await electron.selectDirectory?.();
            if (selectedPath) {
                setFormData(prev => ({ ...prev, path: selectedPath }));
            }
        } catch (error) {
            console.error('Failed to browse path:', error);
        }
    };

    return (
        <div className="path-config-modal-overlay" onClick={onClose}>
            <div className="path-config-modal" onClick={(e) => e.stopPropagation()}>
                <div className="path-config-modal-header">
                    <h2 className="path-config-modal-title">
                        {path ? 'Edit Sync Path' : 'Add Sync Path'}
                    </h2>
                    <button
                        className="path-config-modal-close"
                        onClick={onClose}
                        aria-label="Close"
                    >
                        <X size={20} />
                    </button>
                </div>

                <form className="path-config-modal-form" onSubmit={handleSubmit}>
                    <div className="path-config-field">
                        <label className="path-config-label">
                            Path *
                            <span className="path-config-hint">Directory to sync</span>
                        </label>
                        <div className="path-config-input-group">
                            <input
                                type="text"
                                className="path-config-input"
                                value={formData.path}
                                onChange={(e) => setFormData(prev => ({ ...prev, path: e.target.value }))}
                                placeholder="/path/to/directory"
                                required
                            />
                            <button
                                type="button"
                                className="path-config-browse-btn"
                                onClick={handleBrowsePath}
                            >
                                <FolderOpen size={16} />
                            </button>
                        </div>
                    </div>

                    <div className="path-config-field">
                        <label className="path-config-checkbox-label">
                            <input
                                type="checkbox"
                                checked={formData.enabled}
                                onChange={(e) => setFormData(prev => ({ ...prev, enabled: e.target.checked }))}
                            />
                            <span>Enable sync for this path</span>
                        </label>
                    </div>

                    <div className="path-config-field">
                        <label className="path-config-checkbox-label">
                            <input
                                type="checkbox"
                                checked={formData.recursive}
                                onChange={(e) => setFormData(prev => ({ ...prev, recursive: e.target.checked }))}
                            />
                            <span>Include subdirectories (recursive)</span>
                        </label>
                    </div>

                    <div className="path-config-field">
                        <label className="path-config-label">
                            Include Patterns
                            <span className="path-config-hint">Comma-separated (e.g., *.pdf, *.docx, *.jpg)</span>
                        </label>
                        <input
                            type="text"
                            className="path-config-input"
                            value={formData.patterns}
                            onChange={(e) => setFormData(prev => ({ ...prev, patterns: e.target.value }))}
                            placeholder="*.pdf, *.docx, *.jpg"
                        />
                    </div>

                    <div className="path-config-field">
                        <label className="path-config-label">
                            Exclude Patterns
                            <span className="path-config-hint">Comma-separated (e.g., node_modules, *.tmp)</span>
                        </label>
                        <input
                            type="text"
                            className="path-config-input"
                            value={formData.excludedPatterns}
                            onChange={(e) => setFormData(prev => ({ ...prev, excludedPatterns: e.target.value }))}
                            placeholder="node_modules, *.tmp, .git"
                        />
                    </div>

                    <div className="path-config-field">
                        <label className="path-config-label">
                            Priority
                            <span className="path-config-hint">Higher priority paths sync first (0-100)</span>
                        </label>
                        <input
                            type="number"
                            className="path-config-input"
                            value={formData.priority}
                            onChange={(e) => setFormData(prev => ({ ...prev, priority: e.target.value }))}
                            min="0"
                            max="100"
                            placeholder="0"
                        />
                    </div>

                    {error && (
                        <div className="path-config-error">
                            {error}
                        </div>
                    )}

                    <div className="path-config-actions">
                        <button
                            type="button"
                            className="path-config-btn secondary"
                            onClick={onClose}
                            disabled={loading}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="path-config-btn primary"
                            disabled={loading}
                        >
                            {loading ? 'Saving...' : path ? 'Update' : 'Add'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}