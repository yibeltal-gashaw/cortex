import React, { useState, useEffect } from 'react';
import {
  Settings,
  CheckCircle,
  AlertCircle,
  X,
  RotateCw,
  FolderOpen,
  Server,
  Activity,
  Sun,
  Moon,
  Keyboard,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  MessageSquare,
  Loader2
} from 'lucide-react';
import { AppStatus } from '../types/index.js';
import { updateDataDir, selectDirectoryNative } from '../api/index.js';

interface SettingsPageProps {
  status: AppStatus | null;
  onClose: () => void;
  onUpdated: (newStatus: AppStatus) => void;
  autoRefreshEnabled?: boolean;
  autoRefreshInterval?: number;
  onToggleAutoRefresh?: () => void;
  onChangeInterval?: (intervalSeconds: number) => void;
  theme?: 'light' | 'dark';
  onToggleTheme?: () => void;
  isSidebarCollapsed?: boolean;
  onToggleSidebar?: () => void;
  isTelemetryOpen?: boolean;
  onToggleTelemetry?: () => void;
  activeSessionTitle?: string | null;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({
  status,
  onClose,
  onUpdated,
  autoRefreshEnabled = true,
  autoRefreshInterval = 5,
  onToggleAutoRefresh,
  onChangeInterval,
  theme = 'light',
  onToggleTheme,
  isSidebarCollapsed = false,
  onToggleSidebar,
  isTelemetryOpen = true,
  onToggleTelemetry,
  activeSessionTitle
}) => {
  const [customPath, setCustomPath] = useState(status?.dataDir || '');
  const [saving, setSaving] = useState(false);
  const [browsing, setBrowsing] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Sync customPath when status changes
  useEffect(() => {
    if (status?.dataDir) {
      setCustomPath(status.dataDir);
    }
  }, [status?.dataDir]);

  // Esc key listener to close Settings page
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleSave = async () => {
    if (!customPath.trim()) return;
    setSaving(true);
    setMessage(null);
    try {
      const res = await updateDataDir(customPath.trim());
      setMessage({ type: 'success', text: res.message || 'Data directory updated successfully.' });
      if (status) {
        onUpdated({ ...status, dataDir: res.dataDir });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to update data directory' });
    } finally {
      setSaving(false);
    }
  };

  const handleResetDefault = () => {
    if (status?.defaultDataDir) {
      setCustomPath(status.defaultDataDir);
    }
  };

  const handleBrowseDirectory = async () => {
    setBrowsing(true);
    try {
      if (typeof window !== 'undefined' && window.electronAPI?.selectDirectory) {
        const picked = await window.electronAPI.selectDirectory(customPath || status?.dataDir || status?.defaultDataDir);
        if (picked) {
          setCustomPath(picked);
        }
      } else {
        const picked = await selectDirectoryNative(customPath || status?.dataDir || status?.defaultDataDir);
        if (picked) {
          setCustomPath(picked);
        }
      }
    } catch (err: any) {
      console.error('Failed to open system directory picker:', err);
    } finally {
      setBrowsing(false);
    }
  };

  return (
    <div className="settings-page-wrapper">
      {/* 1. Top Tab Strip / Header */}
      <header className="settings-tab-strip">
        <div className="settings-tab-strip-left">
          {onToggleSidebar && (
            <button
              className={`hud-action-icon-btn ${isSidebarCollapsed ? 'sidebar-toggle-active' : ''}`}
              title={isSidebarCollapsed ? 'Expand Sidebar (Ctrl+B)' : 'Collapse Sidebar (Ctrl+B)'}
              onClick={onToggleSidebar}
              aria-label="Toggle sessions sidebar"
            >
              {isSidebarCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
            </button>
          )}

          {/* Editor-Style Tab Strip */}
          <div className="hud-editor-tab-list">
            {activeSessionTitle && (
              <button
                className="hud-editor-tab inactive"
                onClick={onClose}
                title={`Switch back to: ${activeSessionTitle}`}
              >
                <MessageSquare size={13} className="tab-icon" />
                <span className="tab-title">
                  {activeSessionTitle.length > 28
                    ? activeSessionTitle.slice(0, 28) + '...'
                    : activeSessionTitle}
                </span>
              </button>
            )}

            <div className="hud-editor-tab active" title="Settings tab (Active)">
              <Settings size={14} className="tab-icon" color="var(--cortex-cognitive-teal)" />
              <span className="tab-title">Settings</span>
              <button
                className="hud-tab-close-btn"
                onClick={onClose}
                title="Close Tab (Esc)"
                aria-label="Close Settings tab"
              >
                <X size={14} />
              </button>
            </div>
          </div>
        </div>

        <div className="settings-tab-strip-right">
          {onToggleTelemetry && (
            <button
              className={`hud-action-icon-btn ${isTelemetryOpen ? 'active' : ''}`}
              title={isTelemetryOpen ? 'Hide Right Panel' : 'Show Right Panel'}
              onClick={onToggleTelemetry}
              aria-label="Toggle right inspector panel"
            >
              {isTelemetryOpen ? <PanelRightClose size={16} /> : <PanelRightOpen size={16} />}
            </button>
          )}

          <button
            className="hud-action-icon-btn"
            onClick={onClose}
            title="Close Settings (Esc)"
            aria-label="Close Settings"
          >
            <X size={16} />
          </button>
        </div>
      </header>

      {/* 2. Scrollable Settings Content Body */}
      <div className="settings-page-scroll">
        <div className="settings-page-container">
          {/* Hero Header */}
          <div className="settings-hero-header">
            <div className="settings-hero-icon-wrap">
              <Settings size={28} color="var(--cortex-cognitive-teal)" />
            </div>
            <div className="settings-hero-text">
              <h2 className="settings-hero-title">Data Source & System Settings</h2>
              <p className="settings-hero-subtitle">
                Configure Antigravity IDE storage directories, real-time live sync polling, and system preferences.
              </p>
            </div>
          </div>

          {/* Section 1: Antigravity Data Directory */}
          <section className="settings-card">
            <div className="settings-card-header">
              <div className="settings-card-header-icon">
                <FolderOpen size={18} color="var(--cortex-cognitive-teal)" />
              </div>
              <div>
                <h3 className="settings-card-title">Antigravity Storage Directory</h3>
                <p className="settings-card-desc">
                  Cortex scans this path for <code>brain/</code> conversations, SQLite sessions, artifacts, and execution logs.
                </p>
              </div>
            </div>

            <div className="settings-card-body">
              <div className="settings-field-group">
                <label className="settings-label" htmlFor="antigravity-dir-input">
                  Active Data Directory Path
                </label>
                <div className="settings-input-row">
                  <input
                    id="antigravity-dir-input"
                    type="text"
                    className="settings-text-input mono"
                    value={customPath}
                    onChange={(e) => setCustomPath(e.target.value)}
                    placeholder="C:\Users\username\.gemini\antigravity-ide"
                    spellCheck={false}
                  />
                  <button
                    type="button"
                    className="settings-browse-btn"
                    onClick={handleBrowseDirectory}
                    disabled={browsing}
                    title="Browse and select directory using system folder picker"
                    aria-label="Browse and select directory"
                  >
                    {browsing ? (
                      <>
                        <Loader2 size={15} className="spin-icon" />
                        <span>Opening...</span>
                      </>
                    ) : (
                      <>
                        <FolderOpen size={15} />
                        <span>Browse...</span>
                      </>
                    )}
                  </button>
                  <button
                    className="settings-save-btn"
                    onClick={handleSave}
                    disabled={saving || !customPath.trim()}
                  >
                    {saving ? (
                      <>
                        <Loader2 size={15} className="spin-icon" />
                        <span>Validating...</span>
                      </>
                    ) : (
                      <>
                        <RotateCw size={15} />
                        <span>Save & Rescan</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="settings-field-subtext">
                <div className="settings-default-path">
                  <span>Default Path:</span>
                  <code className="mono">{status?.defaultDataDir || 'Not detected'}</code>
                </div>
                {status?.defaultDataDir && customPath !== status.defaultDataDir && (
                  <button
                    type="button"
                    className="settings-link-btn"
                    onClick={handleResetDefault}
                  >
                    Reset to default
                  </button>
                )}
              </div>

              {message && (
                <div
                  className={`settings-feedback-banner ${message.type}`}
                  role="alert"
                >
                  {message.type === 'success' ? (
                    <CheckCircle size={16} className="feedback-icon" />
                  ) : (
                    <AlertCircle size={16} className="feedback-icon" />
                  )}
                  <span>{message.text}</span>
                </div>
              )}
            </div>
          </section>

          {/* Section 2: Real-time Live Sync Settings */}
          {onChangeInterval && (
            <section className="settings-card">
              <div className="settings-card-header">
                <div className="settings-card-header-icon">
                  <Activity size={18} color="var(--cortex-synapse-purple)" />
                </div>
                <div>
                  <h3 className="settings-card-title">Real-Time Live Sync</h3>
                  <p className="settings-card-desc">
                    Automatically poll and stream real-time updates from active Antigravity agent sessions.
                  </p>
                </div>
              </div>

              <div className="settings-card-body">
                <div className="settings-sync-toggle-row">
                  <div className="settings-sync-meta">
                    <span className="settings-sync-name">Live Sync Daemon</span>
                    <span className="settings-sync-help">
                      When enabled, Cortex silently refreshes session timeline steps and tool invocations.
                    </span>
                  </div>
                  <button
                    type="button"
                    className={`drawer-live-pill ${autoRefreshEnabled ? 'active' : 'paused'}`}
                    onClick={onToggleAutoRefresh}
                    style={{ cursor: 'pointer' }}
                    aria-label={`Live sync is ${autoRefreshEnabled ? 'Enabled' : 'Paused'}. Click to toggle.`}
                  >
                    <span className={`drawer-live-dot ${autoRefreshEnabled ? 'pulsing' : ''}`} />
                    <span className="drawer-live-text">{autoRefreshEnabled ? 'ENABLED' : 'PAUSED'}</span>
                  </button>
                </div>

                {autoRefreshEnabled && (
                  <div className="settings-interval-selector-row">
                    <label className="settings-label" htmlFor="polling-interval-select">
                      Sync Polling Frequency
                    </label>
                    <select
                      id="polling-interval-select"
                      className="settings-select"
                      value={autoRefreshInterval}
                      onChange={(e) => onChangeInterval(parseInt(e.target.value, 10))}
                    >
                      <option value={3}>3 seconds — Rapid (Instant live tracking)</option>
                      <option value={5}>5 seconds — Balanced (Recommended)</option>
                      <option value={10}>10 seconds — Standard</option>
                      <option value={30}>30 seconds — Low resource usage</option>
                    </select>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Section 3: Runtime Diagnostics & System Information */}
          <section className="settings-card">
            <div className="settings-card-header">
              <div className="settings-card-header-icon">
                <Server size={18} color="var(--cortex-cognitive-teal)" />
              </div>
              <div>
                <h3 className="settings-card-title">Runtime & Environment Diagnostics</h3>
                <p className="settings-card-desc">
                  Active environment variables and host process details for this Cortex instance.
                </p>
              </div>
            </div>

            <div className="settings-card-body">
              <div className="settings-diagnostics-grid">
                <div className="diagnostic-tile">
                  <div className="diagnostic-label">Host Platform</div>
                  <div className="diagnostic-value mono">{status?.platform || 'Unknown'}</div>
                </div>

                <div className="diagnostic-tile">
                  <div className="diagnostic-label">Node.js Engine</div>
                  <div className="diagnostic-value mono">{status?.nodeVersion || 'Unknown'}</div>
                </div>

                <div className="diagnostic-tile full-width">
                  <div className="diagnostic-label">Active Storage Path</div>
                  <div className="diagnostic-value mono break-all">
                    {status?.dataDir || 'None configured'}
                  </div>
                </div>

                <div className="diagnostic-tile full-width">
                  <div className="diagnostic-label">Default Antigravity Path</div>
                  <div className="diagnostic-value mono break-all">
                    {status?.defaultDataDir || 'None'}
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Section 4: Interface & Keyboard Shortcuts */}
          <section className="settings-card">
            <div className="settings-card-header">
              <div className="settings-card-header-icon">
                <Keyboard size={18} color="var(--cortex-cognitive-teal)" />
              </div>
              <div>
                <h3 className="settings-card-title">Appearance & Shortcuts</h3>
                <p className="settings-card-desc">
                  Manage display theme and view available productivity shortcuts.
                </p>
              </div>
            </div>

            <div className="settings-card-body">
              {onToggleTheme && (
                <div className="settings-theme-row">
                  <div>
                    <span className="settings-theme-title">Theme Mode</span>
                    <span className="settings-theme-desc">
                      Current theme is {theme === 'dark' ? 'Dark' : 'Light'}.
                    </span>
                  </div>
                  <button
                    type="button"
                    className="settings-theme-toggle-btn"
                    onClick={onToggleTheme}
                  >
                    {theme === 'light' ? (
                      <>
                        <Moon size={15} />
                        <span>Switch to Dark</span>
                      </>
                    ) : (
                      <>
                        <Sun size={15} />
                        <span>Switch to Light</span>
                      </>
                    )}
                  </button>
                </div>
              )}

              <div className="settings-shortcuts-list">
                <div className="shortcut-item">
                  <span className="shortcut-desc">Toggle Sessions Drawer</span>
                  <div className="shortcut-keys">
                    <kbd>Ctrl</kbd> + <kbd>B</kbd>
                  </div>
                </div>
                <div className="shortcut-item">
                  <span className="shortcut-desc">Force Refresh Active Session</span>
                  <div className="shortcut-keys">
                    <kbd>Ctrl</kbd> + <kbd>R</kbd> or <kbd>R</kbd>
                  </div>
                </div>
                <div className="shortcut-item">
                  <span className="shortcut-desc">Close Settings Tab / Dismiss Overlays</span>
                  <div className="shortcut-keys">
                    <kbd>Esc</kbd>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
