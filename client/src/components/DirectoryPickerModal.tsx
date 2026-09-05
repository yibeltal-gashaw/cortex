import React, { useState, useEffect } from 'react';
import {
  Folder,
  FolderOpen,
  FolderCheck,
  ChevronRight,
  ArrowUp,
  Home,
  HardDrive,
  Sparkles,
  ExternalLink,
  X,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { DirectoryBrowseResult } from '../types/index.js';
import { browseDirectory, selectDirectoryNative } from '../api/index.js';

interface DirectoryPickerModalProps {
  isOpen: boolean;
  initialPath?: string;
  onClose: () => void;
  onSelect: (selectedPath: string) => void;
}

export const DirectoryPickerModal: React.FC<DirectoryPickerModalProps> = ({
  isOpen,
  initialPath,
  onClose,
  onSelect
}) => {
  const [browseData, setBrowseData] = useState<DirectoryBrowseResult | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [nativeLoading, setNativeLoading] = useState<boolean>(false);

  const loadDirectory = async (targetPath?: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await browseDirectory(targetPath);
      setBrowseData(data);
    } catch (err: any) {
      setError(err.message || 'Failed to browse directory');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadDirectory(initialPath);
    }
  }, [isOpen, initialPath]);

  // Handle native OS directory picker
  const handleOpenNativeDialog = async () => {
    setNativeLoading(true);
    try {
      if (typeof window !== 'undefined' && window.electronAPI?.selectDirectory) {
        const picked = await window.electronAPI.selectDirectory(browseData?.currentPath || initialPath);
        if (picked) {
          onSelect(picked);
          onClose();
          return;
        }
      } else {
        const picked = await selectDirectoryNative(browseData?.currentPath || initialPath);
        if (picked) {
          onSelect(picked);
          onClose();
          return;
        }
      }
    } catch (err: any) {
      setError(err.message || 'Native picker failed');
    } finally {
      setNativeLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-dialog directory-picker-dialog"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dir-picker-title"
      >
        {/* Header */}
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FolderOpen size={18} color="var(--cortex-cognitive-teal)" />
            <span id="dir-picker-title" style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
              Select Antigravity Storage Directory
            </span>
          </div>
          <button className="copy-btn" onClick={onClose} aria-label="Close directory picker">
            <X size={16} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="modal-body dir-picker-body">
          {/* Quick Shortcuts Bar */}
          <div className="dir-picker-shortcuts">
            {browseData?.drives && browseData.drives.length > 0 && (
              <div className="dir-picker-drives">
                {browseData.drives.map((drive) => (
                  <button
                    key={drive}
                    type="button"
                    className={`dir-shortcut-btn ${browseData.currentPath.toLowerCase().startsWith(drive.toLowerCase()) ? 'active' : ''}`}
                    onClick={() => loadDirectory(drive)}
                    title={`Drive ${drive}`}
                  >
                    <HardDrive size={13} />
                    <span>{drive}</span>
                  </button>
                ))}
              </div>
            )}

            {browseData?.homeDir && (
              <button
                type="button"
                className="dir-shortcut-btn"
                onClick={() => loadDirectory(browseData.homeDir)}
                title="User Home Directory"
              >
                <Home size={13} />
                <span>Home</span>
              </button>
            )}

            {browseData?.defaultDataDir && (
              <button
                type="button"
                className="dir-shortcut-btn highlight"
                onClick={() => loadDirectory(browseData.defaultDataDir)}
                title="Default Antigravity IDE Path"
              >
                <Sparkles size={13} color="var(--cortex-cognitive-teal)" />
                <span>Default AppData</span>
              </button>
            )}

            <button
              type="button"
              className="dir-native-dialog-btn"
              onClick={handleOpenNativeDialog}
              disabled={nativeLoading}
              title="Launch native Windows folder picker"
            >
              {nativeLoading ? (
                <Loader2 size={13} className="spin-icon" />
              ) : (
                <ExternalLink size={13} />
              )}
              <span>System Picker</span>
            </button>
          </div>

          {/* Current Path & Breadcrumbs */}
          <div className="dir-picker-breadcrumbs-wrap">
            <button
              type="button"
              className="dir-up-btn"
              disabled={!browseData?.parentPath || loading}
              onClick={() => browseData?.parentPath && loadDirectory(browseData.parentPath)}
              title="Go to parent directory"
            >
              <ArrowUp size={14} />
            </button>

            <div className="dir-breadcrumbs-list mono">
              {browseData?.currentPath ? (
                <span className="dir-current-path-text" title={browseData.currentPath}>
                  {browseData.currentPath}
                </span>
              ) : (
                <span>Loading...</span>
              )}
            </div>
          </div>

          {/* Antigravity Detected Banner */}
          {browseData?.hasAntigravityData && (
            <div className="dir-detected-badge">
              <FolderCheck size={16} color="var(--cortex-execution-green)" />
              <div>
                <strong>Antigravity Data Detected Here!</strong>
                <span> Contains <code>brain/</code> or <code>conversations/</code>.</span>
              </div>
            </div>
          )}

          {error && (
            <div className="settings-feedback-banner error" style={{ margin: '8px 0' }}>
              <AlertCircle size={15} />
              <span>{error}</span>
            </div>
          )}

          {/* Directory Items List */}
          <div className="dir-picker-items-scroll">
            {loading ? (
              <div className="dir-picker-loading">
                <Loader2 size={24} className="spin-icon" />
                <span>Scanning folders...</span>
              </div>
            ) : browseData?.directories && browseData.directories.length > 0 ? (
              <div className="dir-items-grid">
                {browseData.directories.map((dir) => (
                  <div
                    key={dir.path}
                    className={`dir-item-row ${dir.hasAntigravityData ? 'has-antigravity' : ''}`}
                    onClick={() => loadDirectory(dir.path)}
                    title={`Click to open: ${dir.path}`}
                  >
                    <div className="dir-item-icon">
                      {dir.hasAntigravityData ? (
                        <FolderCheck size={16} color="var(--cortex-execution-green)" />
                      ) : (
                        <Folder size={16} color="var(--cortex-cognitive-teal)" />
                      )}
                    </div>
                    <span className="dir-item-name">{dir.name}</span>
                    {dir.hasAntigravityData && (
                      <span className="dir-item-badge">Antigravity</span>
                    )}
                    <ChevronRight size={14} className="dir-item-chevron" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="dir-picker-empty">
                <Folder size={28} color="var(--text-muted)" />
                <p>No subdirectories found in this folder.</p>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="modal-footer dir-picker-footer">
          <div className="dir-selected-preview mono">
            <span>Selected:</span>
            <code>{browseData?.currentPath || 'None'}</code>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button type="button" className="metric-pill" onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className="filter-btn active"
              disabled={!browseData?.currentPath}
              onClick={() => {
                if (browseData?.currentPath) {
                  onSelect(browseData.currentPath);
                  onClose();
                }
              }}
            >
              Select This Folder
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
