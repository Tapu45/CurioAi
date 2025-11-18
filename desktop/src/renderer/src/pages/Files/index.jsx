import React, { useEffect, useState, useCallback } from 'react';
import useElectron from '@renderer/hooks/useElectron';
import { FileText, Search, Filter, X, File, Image, Code, FileType, Loader2 } from 'lucide-react';
import SyncToggle from './components/SyncToggle';
import SyncProgress from './components/SyncProgress';
import SyncStats from './components/SyncStats';
import PathManager from './components/PathManager';
import { useSyncStatus } from './hooks/useSyncStatus';
import { useSyncProgress } from './hooks/useSyncProgress';
import './Files.css';


export default function FilesPage() {
    const electron = useElectron();
    const [files, setFiles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [typeFilter, setTypeFilter] = useState('all');
    const [selectedFile, setSelectedFile] = useState(null);
    const [watcherStatus, setWatcherStatus] = useState(null);
    const [page, setPage] = useState(0);
    const [hasMore, setHasMore] = useState(true);
    const limit = 50;

    const loadFiles = useCallback(async () => {
        try {
            setLoading(true);
            const result = await electron.getFiles?.({
                limit,
                offset: page * limit,
                filters: {
                    search: searchQuery || undefined,
                    type: typeFilter !== 'all' ? typeFilter : undefined,
                },
            });

            if (result) {
                if (page === 0) {
                    setFiles(result);
                } else {
                    setFiles(prev => [...prev, ...result]);
                }
                setHasMore(result.length === limit);
            }
        } catch (error) {
            console.error('Failed to load files:', error);
        } finally {
            setLoading(false);
        }
    }, [electron, page, searchQuery, typeFilter]);

    const loadWatcherStatus = useCallback(async () => {
        try {
            const status = await electron.getFileWatcherStatus?.();
            if (status) {
                setWatcherStatus(status);
            }
        } catch (error) {
            console.error('Failed to load watcher status:', error);
        }
    }, [electron]);

    useEffect(() => {
        loadFiles();
    }, [loadFiles]);

    useEffect(() => {
        loadWatcherStatus();
        const interval = setInterval(loadWatcherStatus, 5000);
        return () => clearInterval(interval);
    }, [loadWatcherStatus]);

    const { status: syncStatus, startSync, stopSync, pauseSync, resumeSync } = useSyncStatus();
    const { currentFile, progress } = useSyncProgress();

    // Add sync toggle handler
    const handleSyncToggle = async () => {
        if (syncStatus.isRunning) {
            await stopSync();
        } else {
            await startSync({ scanExisting: true });
        }
    };

    // Add sync control handlers
    const handlePauseResume = async () => {
        if (syncStatus.isPaused) {
            await resumeSync();
        } else {
            await pauseSync();
        }
    };

    const handleSearch = useCallback((query) => {
        setSearchQuery(query);
        setPage(0);
    }, []);

    const handleTypeFilter = useCallback((type) => {
        setTypeFilter(type);
        setPage(0);
    }, []);

    const handleFileClick = useCallback(async (file) => {
        try {
            const chunks = await electron.getFileChunks?.(file.id);
            setSelectedFile({ ...file, chunks: chunks || [] });
        } catch (error) {
            console.error('Failed to load file chunks:', error);
        }
    }, [electron]);

    const getFileIcon = (type) => {
        if (type?.startsWith('image')) return Image;
        if (['js', 'ts', 'jsx', 'tsx', 'py', 'java', 'cpp', 'c', 'go', 'rs'].includes(type)) return Code;
        if (['pdf', 'docx', 'xlsx', 'pptx', 'txt', 'md'].includes(type)) return FileText;
        return FileType;
    };

    const formatFileSize = (bytes) => {
        if (!bytes) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return `${Math.round(bytes / Math.pow(k, i) * 100) / 100} ${sizes[i]}`;
    };

    const fileTypes = [
        { id: 'all', label: 'All Files', count: files.length },
        { id: 'pdf', label: 'PDFs', count: files.filter(f => f.type === 'pdf').length },
        { id: 'docx', label: 'Documents', count: files.filter(f => ['docx', 'xlsx', 'pptx'].includes(f.type)).length },
        { id: 'image', label: 'Images', count: files.filter(f => f.type?.startsWith('image')).length },
        { id: 'code', label: 'Code', count: files.filter(f => ['js', 'ts', 'py', 'java'].includes(f.type)).length },
    ];

    return (
        <div className="files-page">
            {/* Header */}
            <div className="files-header">
                <div>
                    <h1 className="files-title">Files</h1>
                    <p className="files-subtitle">
                        {files.length} indexed file{files.length !== 1 ? 's' : ''}
                        {watcherStatus?.isWatching && (
                            <span className="files-watcher-badge">
                                {watcherStatus.queueLength > 0 && `${watcherStatus.queueLength} in queue`}
                            </span>
                        )}
                    </p>
                </div>
            </div>

            {/* Sync Section */}
            {syncStatus.isRunning && (
                <>
                    <SyncProgress
                        status={syncStatus}
                        currentFile={currentFile}
                        progress={progress}
                    />
                    <div className="files-sync-controls">
                        <button
                            className="files-sync-control-btn"
                            onClick={handlePauseResume}
                        >
                            {syncStatus.isPaused ? 'Resume' : 'Pause'}
                        </button>
                        <button
                            className="files-sync-control-btn danger"
                            onClick={stopSync}
                        >
                            Stop
                        </button>
                    </div>
                </>
            )}

            <SyncStats
                stats={syncStatus.stats}
                lastSync={syncStatus.queue?.stats?.lastSync}
            />

            <PathManager />

            {/* Search and Filters */}
            <div className="files-controls">
                <div className="files-search-wrapper">
                    <Search size={18} className="files-search-icon" />
                    <input
                        type="text"
                        placeholder="Search files..."
                        value={searchQuery}
                        onChange={(e) => handleSearch(e.target.value)}
                        className="files-search-input"
                    />
                    {searchQuery && (
                        <button
                            onClick={() => handleSearch('')}
                            className="files-search-clear"
                            aria-label="Clear search"
                        >
                            <X size={16} />
                        </button>
                    )}
                </div>

                <div className="files-type-filters">
                    {fileTypes.map((type) => (
                        <button
                            key={type.id}
                            onClick={() => handleTypeFilter(type.id)}
                            className={`files-type-filter ${typeFilter === type.id ? 'active' : ''}`}
                        >
                            {type.label}
                            {type.count > 0 && <span className="files-type-count">{type.count}</span>}
                        </button>
                    ))}
                </div>
            </div>

            {/* Files Grid */}
            {loading && files.length === 0 ? (
                <div className="files-loading">
                    <Loader2 size={24} className="files-loading-spinner" />
                    <p>Loading files...</p>
                </div>
            ) : files.length === 0 ? (
                <div className="files-empty">
                    <File size={48} className="files-empty-icon" />
                    <h3>No files found</h3>
                    <p>
                        {searchQuery || typeFilter !== 'all'
                            ? 'Try adjusting your search or filters'
                            : 'Files will appear here once indexed'}
                    </p>
                </div>
            ) : (
                <>
                    <div className="files-grid">
                        {files.map((file) => {
                            const Icon = getFileIcon(file.type);
                            return (
                                <div
                                    key={file.id}
                                    className="files-card"
                                    onClick={() => handleFileClick(file)}
                                >
                                    <div className="files-card-header">
                                        <div className="files-card-icon">
                                            <Icon size={20} />
                                        </div>
                                        <div className="files-card-meta">
                                            <div className="files-card-name" title={file.name}>
                                                {file.name}
                                            </div>
                                            <div className="files-card-info">
                                                <span className="files-card-type">{file.type}</span>
                                                {file.size && (
                                                    <span className="files-card-size">{formatFileSize(file.size)}</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    {file.extracted_text && (
                                        <div className="files-card-preview">
                                            {file.extracted_text.substring(0, 100)}
                                            {file.extracted_text.length > 100 && '...'}
                                        </div>
                                    )}
                                    {file.processed_at && (
                                        <div className="files-card-date">
                                            {new Date(file.processed_at).toLocaleDateString()}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {hasMore && (
                        <div className="files-load-more">
                            <button
                                onClick={() => setPage(prev => prev + 1)}
                                className="files-load-more-btn"
                                disabled={loading}
                            >
                                {loading ? 'Loading...' : 'Load More'}
                            </button>
                        </div>
                    )}
                </>
            )}

            {/* File Detail Sidebar */}
            {selectedFile && (
                <div className="files-detail-overlay" onClick={() => setSelectedFile(null)}>
                    <div className="files-detail-panel" onClick={(e) => e.stopPropagation()}>
                        <div className="files-detail-header">
                            <h2 className="files-detail-title">{selectedFile.name}</h2>
                            <button
                                onClick={() => setSelectedFile(null)}
                                className="files-detail-close"
                                aria-label="Close"
                            >
                                <X size={20} />
                            </button>
                        </div>
                        <div className="files-detail-content">
                            <div className="files-detail-section">
                                <h3 className="files-detail-section-title">File Information</h3>
                                <div className="files-detail-info">
                                    <div className="files-detail-info-item">
                                        <span className="files-detail-info-label">Type:</span>
                                        <span className="files-detail-info-value">{selectedFile.type}</span>
                                    </div>
                                    {selectedFile.size && (
                                        <div className="files-detail-info-item">
                                            <span className="files-detail-info-label">Size:</span>
                                            <span className="files-detail-info-value">{formatFileSize(selectedFile.size)}</span>
                                        </div>
                                    )}
                                    {selectedFile.processed_at && (
                                        <div className="files-detail-info-item">
                                            <span className="files-detail-info-label">Indexed:</span>
                                            <span className="files-detail-info-value">
                                                {new Date(selectedFile.processed_at).toLocaleString()}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {selectedFile.extracted_text && (
                                <div className="files-detail-section">
                                    <h3 className="files-detail-section-title">Content</h3>
                                    <div className="files-detail-text">
                                        {selectedFile.extracted_text}
                                    </div>
                                </div>
                            )}

                            {selectedFile.chunks && selectedFile.chunks.length > 0 && (
                                <div className="files-detail-section">
                                    <h3 className="files-detail-section-title">
                                        Chunks ({selectedFile.chunks.length})
                                    </h3>
                                    <div className="files-detail-chunks">
                                        {selectedFile.chunks.map((chunk, idx) => (
                                            <div key={chunk.id || idx} className="files-detail-chunk">
                                                <div className="files-detail-chunk-header">
                                                    <span className="files-detail-chunk-index">Chunk {chunk.chunk_index + 1}</span>
                                                </div>
                                                <div className="files-detail-chunk-content">
                                                    {chunk.content}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}