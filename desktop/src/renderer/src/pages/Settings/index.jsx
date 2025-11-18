import React, { useEffect, useState, useCallback } from 'react';
import { Cpu, HardDrive, Zap, Settings as SettingsIcon } from 'lucide-react';
import useAppStore from '@renderer/store/store';
import useElectron from '@renderer/hooks/useElectron';
import Button from '@renderer/components/common/Button/index.jsx';

export default function SettingsPage() {
    const electron = useElectron();
    const settings = useAppStore((s) => s.settings);
    const setSettings = useAppStore((s) => s.setSettings);
    const [saving, setSaving] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [storageUsage, setStorageUsage] = useState(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [modelInfo, setModelInfo] = useState(null);
    const [systemResources, setSystemResources] = useState(null);
    const [availableModels, setAvailableModels] = useState(null);
    const [loadingModels, setLoadingModels] = useState(false);

    useEffect(() => {
        const loadModelInfo = async () => {
            try {
                const [current, resources, available] = await Promise.all([
                    electron.getCurrentModels?.(),
                    electron.getModelResources?.(),
                    electron.getAvailableModels?.(),
                ]);
                if (current) setModelInfo(current);
                if (resources) setSystemResources(resources);
                if (available) setAvailableModels(available);
            } catch (error) {
                console.error('Failed to load model info:', error);
            }
        };
        loadModelInfo();
    }, [electron]);

    const handleModelTierChange = useCallback(async (tier) => {
        setLoadingModels(true);
        try {
            await electron.setModelTier?.(tier);
            const updated = await electron.getCurrentModels?.();
            if (updated) setModelInfo(updated);
        } catch (error) {
            console.error('Failed to change model tier:', error);
            alert('Failed to change model tier');
        } finally {
            setLoadingModels(false);
        }
    }, [electron]);

    useEffect(() => {
        const load = async () => {
            try {
                const s = await electron.getSettings();
                if (s) {
                    setSettings(s);
                }
            } catch (e) {
                console.error('Failed to load settings', e);
            }

            // Load storage usage
            try {
                const usage = await electron.getStorageUsage?.();
                if (usage) {
                    setStorageUsage(usage);
                }
            } catch (e) {
                console.error('Failed to load storage usage', e);
            }
        };
        load();
    }, [electron, setSettings]);

    const updateSetting = (path, value) => {
        if (!settings) return;
        const [root, key] = path.split('.');
        const updated = {
            ...settings,
            [root]: {
                ...(settings[root] || {}),
                [key]: value,
            },
        };
        setSettings(updated);
    };

    const handleSave = useCallback(async () => {
        if (!settings) return;
        setSaving(true);
        try {
            await electron.updateSettings(settings);
        } catch (e) {
            console.error('Failed to save settings', e);
        } finally {
            setSaving(false);
        }
    }, [electron, settings]);

    const handleExport = useCallback(async (format = 'json') => {
        setExporting(true);
        try {
            const result = await electron.exportData?.(format);
            if (result?.success) {
                alert(`Data exported successfully to:\n${result.filePath}`);
            } else if (result?.canceled) {
                // User canceled, do nothing
            } else {
                alert('Failed to export data');
            }
        } catch (e) {
            console.error('Failed to export data', e);
            alert('Failed to export data');
        } finally {
            setExporting(false);
        }
    }, [electron]);

    const handleDeleteAll = useCallback(async () => {
        if (!showDeleteConfirm) {
            setShowDeleteConfirm(true);
            return;
        }

        const confirmed = window.confirm(
            'This will permanently delete ALL your local data (activities, summaries, graph, embeddings). This action cannot be undone. Continue?'
        );

        if (!confirmed) {
            setShowDeleteConfirm(false);
            return;
        }

        setDeleting(true);
        try {
            await electron.clearAllData?.();
            alert('All data deleted successfully');
            setShowDeleteConfirm(false);
            // Reload storage usage
            const usage = await electron.getStorageUsage?.();
            if (usage) {
                setStorageUsage(usage);
            }
        } catch (e) {
            console.error('Failed to delete data', e);
            alert('Failed to delete data');
        } finally {
            setDeleting(false);
        }
    }, [electron, showDeleteConfirm]);

    const privacy = settings?.privacyConfig || {};
    const appConfig = settings?.appConfig || {};
    const whitelist = settings?.whitelist || { domains: [], apps: [] };

    const toggle = (path, current) => {
        updateSetting(path, !current);
    };

    const trackingMinutes = Math.round((appConfig.trackingInterval || 60000) / 60000);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }} role="main" aria-label="Settings">
            <div className="card">
                <div className="card-header">
                    <div>
                        <div className="card-title">Privacy</div>
                        <div className="card-subtitle">Control what CurioAI is allowed to see</div>
                    </div>
                </div>

                <div className="toggle-row">
                    <div>
                        <div className="toggle-label">Enable tracking</div>
                        <div className="toggle-description">
                            Turn this off to completely stop all activity capture.
                        </div>
                    </div>
                    <div
                        className={`toggle-switch ${privacy.enableTracking ? 'on' : ''}`}
                        onClick={() => toggle('privacyConfig.enableTracking', privacy.enableTracking)}
                        role="switch"
                        aria-checked={privacy.enableTracking}
                        aria-label="Enable tracking"
                    >
                        <div className="toggle-switch-inner" />
                    </div>
                </div>

                <div className="toggle-row">
                    <div>
                        <div className="toggle-label">Remove PII from content</div>
                        <div className="toggle-description">
                            Strip emails, phone numbers, and other sensitive info from text.
                        </div>
                    </div>
                    <div
                        className={`toggle-switch ${privacy.removePII ? 'on' : ''}`}
                        onClick={() => toggle('privacyConfig.removePII', privacy.removePII)}
                        role="switch"
                        aria-checked={privacy.removePII}
                        aria-label="Remove PII from content"
                    >
                        <div className="toggle-switch-inner" />
                    </div>
                </div>

                <div className="toggle-row">
                    <div>
                        <div className="toggle-label">Anonymize data</div>
                        <div className="toggle-description">
                            Replace names and identifiers with generic tokens.
                        </div>
                    </div>
                    <div
                        className={`toggle-switch ${privacy.anonymizeData ? 'on' : ''}`}
                        onClick={() => toggle('privacyConfig.anonymizeData', privacy.anonymizeData)}
                        role="switch"
                        aria-checked={privacy.anonymizeData}
                        aria-label="Anonymize data"
                    >
                        <div className="toggle-switch-inner" />
                    </div>
                </div>
            </div>

            <div className="section-grid">
                <div className="card">
                    <div className="card-header">
                        <div>
                            <div className="card-title">Tracking</div>
                            <div className="card-subtitle">Frequency & scope</div>
                        </div>
                    </div>

                    <div className="toggle-row">
                        <div>
                            <div className="toggle-label">Check interval</div>
                            <div className="toggle-description">
                                How often to sample your active window (in minutes).
                            </div>
                        </div>
                        <input
                            type="number"
                            min={1}
                            max={30}
                            value={trackingMinutes}
                            onChange={(e) =>
                                updateSetting('appConfig.trackingInterval', Number(e.target.value || 1) * 60000)
                            }
                            style={{
                                width: 60,
                                borderRadius: 6,
                                border: '1px solid var(--border)',
                                background: 'var(--input)',
                                color: 'var(--foreground)',
                                padding: '4px 6px',
                                fontSize: 12,
                                outline: 'none',
                                textAlign: 'center',
                            }}
                            aria-label="Tracking interval in minutes"
                        />
                    </div>

                    <div style={{ marginTop: 12 }}>
                        <div className="section-title">Whitelist</div>
                        <div className="section-description">
                            Only these domains & apps are considered for learning activity.
                        </div>
                        <div style={{ marginTop: 8 }}>
                            <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 4 }}>Domains</div>
                            <div className="chip-row">
                                {(whitelist.domains || []).map((d) => (
                                    <span key={d} className="chip">
                                        {d}
                                    </span>
                                ))}
                            </div>
                        </div>
                        <div style={{ marginTop: 8 }}>
                            <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 4 }}>Apps</div>
                            <div className="chip-row">
                                {(whitelist.apps || []).map((a) => (
                                    <span key={a} className="chip">
                                        {a}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="card">
                    <div className="card-header">
                        <div>
                            <div className="card-title">Sync & Storage</div>
                            <div className="card-subtitle">Control where your data lives</div>
                        </div>
                    </div>

                    <div className="toggle-row">
                        <div>
                            <div className="toggle-label">Enable cloud sync</div>
                            <div className="toggle-description">
                                Keep data only on this device, or sync to your CurioAI account.
                            </div>
                        </div>
                        <div
                            className={`toggle-switch ${appConfig.enableSync ? 'on' : ''}`}
                            onClick={() => toggle('appConfig.enableSync', appConfig.enableSync)}
                            role="switch"
                            aria-checked={appConfig.enableSync}
                            aria-label="Enable cloud sync"
                        >
                            <div className="toggle-switch-inner" />
                        </div>
                    </div>

                    <div style={{ marginTop: 12 }}>
                        <div className="section-title">Storage Usage</div>
                        <div className="section-description">
                            {storageUsage ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    <div>
                                        Total: <strong>{storageUsage.formatted?.total || '0 B'}</strong>
                                    </div>
                                    <div style={{ display: 'flex', gap: 16, fontSize: 11, color: 'var(--muted-foreground)', flexWrap: 'wrap' }}>
                                        <span>SQLite: {storageUsage.formatted?.sqlite || '0 B'}</span>
                                        <span>ChromaDB: {storageUsage.formatted?.chromadb || '0 B'}</span>
                                        <span>Graph: {storageUsage.formatted?.graph || '0 B'}</span>
                                    </div>
                                </div>
                            ) : (
                                'Calculating...'
                            )}
                        </div>
                    </div>

                    <div style={{ marginTop: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handleExport('json')}
                            disabled={exporting}
                            aria-label="Export data as JSON"
                        >
                            {exporting ? 'Exporting...' : 'Export as JSON'}
                        </Button>
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handleExport('csv')}
                            disabled={exporting}
                            aria-label="Export data as CSV"
                        >
                            {exporting ? 'Exporting...' : 'Export as CSV'}
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleDeleteAll}
                            disabled={deleting}
                            aria-label="Delete all local data"
                            style={showDeleteConfirm ? { color: 'var(--destructive)', borderColor: 'var(--destructive)' } : {}}
                        >
                            {deleting
                                ? 'Deleting...'
                                : showDeleteConfirm
                                    ? 'Confirm Delete'
                                    : 'Delete All Data'}
                        </Button>
                        {showDeleteConfirm && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setShowDeleteConfirm(false)}
                            >
                                Cancel
                            </Button>
                        )}
                    </div>
                </div>

                <div className="card">
                    <div className="card-header">
                        <div>
                            <div className="card-title">AI Model Selection</div>
                            <div className="card-subtitle">Choose models optimized for your system</div>
                        </div>
                    </div>

                    {systemResources && (
                        <div style={{ marginBottom: 16, padding: 12, background: 'var(--muted)', borderRadius: 'var(--radius)', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <HardDrive size={16} style={{ color: 'var(--primary)' }} />
                                <span style={{ fontSize: 12, color: 'var(--foreground)' }}>
                                    RAM: {systemResources.ram?.total}GB ({systemResources.ram?.usagePercent}% used)
                                </span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <Cpu size={16} style={{ color: 'var(--primary)' }} />
                                <span style={{ fontSize: 12, color: 'var(--foreground)' }}>
                                    CPU: {systemResources.cpu?.cores} cores ({systemResources.cpu?.usagePercent}% used)
                                </span>
                            </div>
                        </div>
                    )}

                    {availableModels && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            {availableModels.tiers?.map((tier) => (
                                <div
                                    key={tier.id}
                                    style={{
                                        padding: 12,
                                        border: `1px solid ${modelInfo?.tier === tier.id ? 'var(--primary)' : 'var(--border)'}`,
                                        borderRadius: 'var(--radius)',
                                        background: modelInfo?.tier === tier.id ? 'oklch(from var(--primary) l c h / 0.1)' : 'var(--card)',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s ease',
                                    }}
                                    onClick={() => handleModelTierChange(tier.id)}
                                >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                        <div>
                                            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--foreground)' }}>
                                                {tier.name}
                                            </div>
                                            <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginTop: 4 }}>
                                                {tier.description}
                                            </div>
                                        </div>
                                        {modelInfo?.tier === tier.id && (
                                            <Zap size={16} style={{ color: 'var(--primary)' }} />
                                        )}
                                    </div>
                                    <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--muted-foreground)' }}>
                                        <span>LLM: {tier.llm?.model}</span>
                                        <span>•</span>
                                        <span>{tier.llm?.size}GB</span>
                                        <span>•</span>
                                        <span>{tier.llm?.params}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {modelInfo && (
                        <div style={{ marginTop: 16, padding: 12, background: 'var(--muted)', borderRadius: 'var(--radius)' }}>
                            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--foreground)', marginBottom: 8 }}>
                                Current Configuration
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11, color: 'var(--muted-foreground)' }}>
                                <div>LLM: {modelInfo.llm?.model}</div>
                                <div>Embedding: {modelInfo.embedding?.model}</div>
                                <div>NLP: {modelInfo.nlp?.model}</div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                <Button onClick={handleSave} disabled={saving}>
                    {saving ? 'Saving…' : 'Save Changes'}
                </Button>
            </div>
        </div>
    );
}