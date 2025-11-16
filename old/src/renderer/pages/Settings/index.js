import React, { useEffect, useState, useCallback } from 'react';
import useAppStore from '../../store/store.js';
import useElectron from '../../hooks/useElectron.js';
import Button from '../../components/common/Button/index.js';

export default function SettingsPage() {
    const electron = useElectron();
    const settings = useAppStore((s) => s.settings);
    const setSettings = useAppStore((s) => s.setSettings);
    const [saving, setSaving] = useState(false);

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
        };
        if (!settings) {
            load();
        }
    }, [electron, settings, setSettings]);

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

    const privacy = settings?.privacyConfig || {};
    const appConfig = settings?.appConfig || {};
    const whitelist = settings?.whitelist || { domains: [], apps: [] };

    const toggle = (path, current) => {
        updateSetting(path, !current);
    };

    const trackingMinutes = Math.round((appConfig.trackingInterval || 60000) / 60000);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
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
                                border: '1px solid rgba(75,85,99,0.9)',
                                background: 'rgba(15,23,42,0.8)',
                                color: '#e5e7eb',
                                padding: '4px 6px',
                                fontSize: 12,
                                outline: 'none',
                                textAlign: 'center',
                            }}
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
                        >
                            <div className="toggle-switch-inner" />
                        </div>
                    </div>

                    <div style={{ marginTop: 12 }}>
                        <div className="section-title">Storage</div>
                        <div className="section-description">
                            Current storage limit:{' '}
                            <strong>{Math.round((appConfig.storageLimit || 1073741824) / (1024 * 1024))} MB</strong>
                        </div>
                    </div>

                    <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
                        <Button variant="secondary" size="sm">
                            Export data
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                                if (window.confirm('This will permanently delete your local data. Continue?')) {
                                    // You can wire to db:clear-data IPC later
                                    console.log('TODO: clear data');
                                }
                            }}
                        >
                            Delete all data
                        </Button>
                    </div>
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