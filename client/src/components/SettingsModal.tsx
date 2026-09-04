import { useState } from 'react';
import { Settings, CheckCircle, AlertCircle, X } from 'lucide-react';
import { AppStatus } from '../types/index.js';
import { updateDataDir } from '../api/index.js';

interface SettingsModalProps {
  isOpen: boolean;
  status: AppStatus | null;
  onClose: () => void;
  onUpdated: (newStatus: AppStatus) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  status,
  onClose,
  onUpdated
}) => {
  const [customPath, setCustomPath] = useState(status?.dataDir || '');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  if (!isOpen) return null;

  const handleSave = async () => {
    if (!customPath.trim()) return;
    setSaving(true);
    setMessage(null);
    try {
      const res = await updateDataDir(customPath.trim());
      setMessage({ type: 'success', text: res.message });
      if (status) {
        onUpdated({ ...status, dataDir: res.dataDir });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to set directory' });
    } finally {
      setSaving(false);
    }
  };

  const handleResetDefault = () => {
    if (status?.defaultDataDir) {
      setCustomPath(status.defaultDataDir);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Settings size={18} color="var(--cortex-cognitive-teal)" />
            <span style={{ fontWeight: 700, color: 'var(--cortex-deep-thought)' }}>Data Source Settings</span>
          </div>
          <button className="copy-btn" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="modal-body">
          <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            The inspector automatically scans the Antigravity IDE app data folder for <code>brain/</code> and <code>conversations/</code>.
          </div>

          <div>
            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--cortex-deep-thought)', display: 'block', marginBottom: '6px' }}>
              Antigravity Data Directory Path:
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                className="search-input mono"
                value={customPath}
                onChange={(e) => setCustomPath(e.target.value)}
                placeholder="C:\Users\username\.gemini\antigravity-ide"
              />
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px', color: 'var(--cortex-grey-matter)' }}>
            <span>Default: <code className="mono">{status?.defaultDataDir}</code></span>
            <button
              style={{ color: 'var(--cortex-cognitive-teal)', textDecoration: 'underline', cursor: 'pointer' }}
              onClick={handleResetDefault}
            >
              Reset to default
            </button>
          </div>

          {message && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 14px',
                borderRadius: '8px',
                fontSize: '12px',
                background: message.type === 'success' ? 'var(--cortex-execution-green-bg)' : 'var(--cortex-memory-wipe-bg)',
                color: message.type === 'success' ? 'var(--cortex-execution-green)' : 'var(--cortex-memory-wipe)',
                border: `1px solid ${message.type === 'success' ? 'var(--cortex-execution-green-border)' : 'var(--cortex-memory-wipe-border)'}`
              }}
            >
              {message.type === 'success' ? <CheckCircle size={15} /> : <AlertCircle size={15} />}
              <span>{message.text}</span>
            </div>
          )}

          <div style={{ background: 'var(--bg-code)', padding: '12px', borderRadius: '8px', border: '1px solid var(--cortex-grey-matter-border)', fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            <div><strong>Platform:</strong> {status?.platform}</div>
            <div><strong>Node Version:</strong> {status?.nodeVersion}</div>
            <div><strong>Active Data Dir:</strong> {status?.dataDir}</div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="metric-pill" onClick={onClose}>
            Cancel
          </button>
          <button
            className="filter-btn active"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Testing & Saving...' : 'Save & Rescan'}
          </button>
        </div>
      </div>
    </div>
  );
};
