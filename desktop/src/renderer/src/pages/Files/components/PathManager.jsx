import React, { useState, useEffect } from 'react';
import { Folder, Plus, Edit2, Trash2, Power, PowerOff } from 'lucide-react';
import useElectron from '@renderer/hooks/useElectron';
import PathConfigModal from './PathConfigModal';
import './PathManager.css';

export default function PathManager() {
    const electron = useElectron();
    const [paths, setPaths] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingPath, setEditingPath] = useState(null);

    const loadPaths = async () => {
        try {
            setLoading(true);
            const configs = await electron.getSyncConfigs?.();
            if (configs) {
                setPaths(configs);
            }
        } catch (error) {
            console.error('Failed to load paths:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadPaths();
    }, []);

    const handleAddPath = () => {
        setEditingPath(null);
        setShowModal(true);
    };

    const handleEditPath = (path) => {
        setEditingPath(path);
        setShowModal(true);
    };

    const handleDeletePath = async (id) => {
        if (!confirm('Are you sure you want to remove this path?')) {
            return;
        }
        try {
            await electron.removeSyncPath?.(id);
            await loadPaths();
        } catch (error) {
            console.error('Failed to delete path:', error);
        }
    };

    const handleTogglePath = async (id, enabled) => {
        try {
            await electron.updateSyncConfig?.(id, { enabled: !enabled });
            await loadPaths();
        } catch (error) {
            console.error('Failed to toggle path:', error);
        }
    };

    const handleModalClose = () => {
        setShowModal(false);
        setEditingPath(null);
        loadPaths();
    };

    if (loading) {
        return <div className="path-manager-loading">Loading paths...</div>;
    }

    return (
        <div className="path-manager">
            <div className="path-manager-header">
                <h3 className="path-manager-title">Sync Paths</h3>
                <button
                    className="path-manager-add-btn"
                    onClick={handleAddPath}
                    aria-label="Add path"
                >
                    <Plus size={16} />
                    <span>Add Path</span>
                </button>
            </div>

            {paths.length === 0 ? (
                <div className="path-manager-empty">
                    <Folder size={32} />
                    <p>No sync paths configured</p>
                    <p className="path-manager-empty-hint">Add a path to start syncing files</p>
                </div>
            ) : (
                <div className="path-manager-list">
                    {paths.map((path) => (
                        <div
                            key={path.id}
                            className={`path-manager-item ${!path.enabled ? 'disabled' : ''}`}
                        >
                            <div className="path-manager-item-main">
                                <div className="path-manager-item-icon">
                                    <Folder size={18} />
                                </div>
                                <div className="path-manager-item-content">
                                    <div className="path-manager-item-path">{path.path}</div>
                                    <div className="path-manager-item-meta">
                                        {path.recursive && (
                                            <span className="path-manager-badge">Recursive</span>
                                        )}
                                        {path.priority > 0 && (
                                            <span className="path-manager-badge">Priority {path.priority}</span>
                                        )}
                                        {path.lastSync && (
                                            <span className="path-manager-meta-text">
                                                Last sync: {new Date(path.lastSync).toLocaleDateString()}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <div className="path-manager-item-actions">
                                <button
                                    className="path-manager-action-btn"
                                    onClick={() => handleTogglePath(path.id, path.enabled)}
                                    aria-label={path.enabled ? 'Disable' : 'Enable'}
                                    title={path.enabled ? 'Disable' : 'Enable'}
                                >
                                    {path.enabled ? <Power size={16} /> : <PowerOff size={16} />}
                                </button>
                                <button
                                    className="path-manager-action-btn"
                                    onClick={() => handleEditPath(path)}
                                    aria-label="Edit"
                                    title="Edit"
                                >
                                    <Edit2 size={16} />
                                </button>
                                <button
                                    className="path-manager-action-btn danger"
                                    onClick={() => handleDeletePath(path.id)}
                                    aria-label="Delete"
                                    title="Delete"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {showModal && (
                <PathConfigModal
                    path={editingPath}
                    onClose={handleModalClose}
                />
            )}
        </div>
    );
}