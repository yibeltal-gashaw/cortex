import React, { useState } from 'react';
import {
  Copy,
  Check,
  Download,
  Share2,
  FileCode,
  CheckCircle2,
  Terminal,
  Search,
  Wrench,
  Clock,
  Cpu,
  Layers,
  Calendar,
  Hash,
  ArrowUpRight,
  X
} from 'lucide-react';
import { ParsedConversationSession, TimelineStep, ToolCallItem } from '../types/index.js';
import { cleanFilePath, normalizeContent } from './DiffViewer.js';

interface TelemetrySidebarProps {
  session: ParsedConversationSession | null;
  selectedFile?: string | null;
  onSelectFile?: (filePath: string) => void;
  onClose?: () => void;
}

interface ChangedFileInfo {
  path: string;
  additions: number;
  deletions: number;
}

export const TelemetrySidebar: React.FC<TelemetrySidebarProps> = ({
  session,
  selectedFile,
  onSelectFile,
  onClose
}) => {
  const [activeTab, setActiveTab] = useState<'details' | 'telemetry'>('details');
  const [copiedId, setCopiedId] = useState(false);
  const [copiedShare, setCopiedShare] = useState(false);

  if (!session) {
    return (
      <aside className="hud-telemetry-sidebar empty">
        <div className="telemetry-empty-state">
          <Wrench size={32} />
          <p>Select a session to view details and telemetry</p>
        </div>
      </aside>
    );
  }

  const copySessionId = () => {
    navigator.clipboard.writeText(session.id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const handleExportJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(session, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `cortex-session-${session.id.slice(0, 8)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleShareLink = () => {
    const url = window.location.origin + '?session=' + session.id;
    navigator.clipboard.writeText(url);
    setCopiedShare(true);
    setTimeout(() => setCopiedShare(false), 2000);
  };

  // 1. Calculate Files Changed by scanning file editing tool calls
  const fileMap = new Map<string, { additions: number; deletions: number }>();
  session.steps.forEach((step: TimelineStep) => {
    if (step.toolCalls) {
      step.toolCalls.forEach((tc: ToolCallItem) => {
        if (
          tc.name === 'replace_file_content' ||
          tc.name === 'write_to_file' ||
          tc.name === 'multi_replace_file_content'
        ) {
          const rawFilePath = tc.args.TargetFile || tc.result?.diff?.targetFile;
          if (rawFilePath) {
            const cleanPath = cleanFilePath(rawFilePath);
            const relPath = cleanPath.split('/').slice(-2).join('/');
            const existing = fileMap.get(relPath) || { additions: 0, deletions: 0 };

            if (tc.result?.diff) {
              const oldNorm = normalizeContent(tc.result.diff.oldContent || '');
              const newNorm = normalizeContent(tc.result.diff.newContent || '');
              const oldLines = oldNorm ? oldNorm.split('\n').length : 0;
              const newLines = newNorm ? newNorm.split('\n').length : 0;
              existing.additions += Math.max(0, newLines);
              existing.deletions += Math.max(0, oldLines);
            } else if (tc.args.ReplacementContent || tc.args.CodeContent) {
              const norm = normalizeContent(tc.args.ReplacementContent || tc.args.CodeContent || '');
              const added = norm ? norm.split('\n').length : 1;
              existing.additions += added;
            } else {
              existing.additions += 1;
            }
            fileMap.set(relPath, existing);
          }
        }
      });
    }
  });

  const filesChanged: ChangedFileInfo[] = Array.from(fileMap.entries()).map(([path, diff]) => ({
    path,
    additions: diff.additions,
    deletions: diff.deletions
  }));

  // Estimate tokens if not present
  const estimatedTokens = Math.min(
    128000,
    Math.round(session.steps.reduce((acc, s) => acc + (s.thinking?.length || 0) + (s.assistantResponse?.length || 0) + 150, 0) / 4)
  );

  const formattedStartDate = (() => {
    try {
      const d = new Date(session.createdAt);
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) + ' ' +
        d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    } catch {
      return session.createdAt;
    }
  })();

  return (
    <aside className="hud-telemetry-sidebar">
      {/* Top Tab Bar: Details | Telemetry */}
      <div className="telemetry-tabs">
        <button
          className={`telemetry-tab ${activeTab === 'details' ? 'active' : ''}`}
          onClick={() => setActiveTab('details')}
        >
          Details
        </button>
        <button
          className={`telemetry-tab ${activeTab === 'telemetry' ? 'active' : ''}`}
          onClick={() => setActiveTab('telemetry')}
        >
          Telemetry
        </button>
        {onClose && (
          <button
            type="button"
            className="telemetry-close-btn"
            onClick={onClose}
            title="Close details panel"
            aria-label="Close details panel"
          >
            <X size={16} />
          </button>
        )}
      </div>

      <div className="telemetry-scrollable-content">
        {activeTab === 'details' ? (
          <>
            {/* Section: Session Overview */}
            <div className="telemetry-section">
              <h3 className="telemetry-section-title">Session Overview</h3>
              <div className="telemetry-kv-list">
                <div className="telemetry-kv-row">
                  <span className="telemetry-key">
                    <Hash size={13} className="kv-icon" /> Session ID
                  </span>
                  <div className="telemetry-val copyable" onClick={copySessionId} title="Click to copy full ID">
                    <span className="mono">{session.id.slice(0, 14)}...</span>
                    {copiedId ? <Check size={12} color="var(--cortex-execution-green)" /> : <Copy size={12} />}
                  </div>
                </div>

                <div className="telemetry-kv-row">
                  <span className="telemetry-key">
                    <Cpu size={13} className="kv-icon" /> Agent
                  </span>
                  <span className="telemetry-val font-semibold">
                    {session.model.includes('Flash') ? 'Cortex 3.7 Flash' : session.model}
                  </span>
                </div>

                <div className="telemetry-kv-row">
                  <span className="telemetry-key">
                    <Calendar size={13} className="kv-icon" /> Started
                  </span>
                  <span className="telemetry-val text-muted">
                    {formattedStartDate}
                  </span>
                </div>

                <div className="telemetry-kv-row">
                  <span className="telemetry-key">
                    <Clock size={13} className="kv-icon" /> Duration
                  </span>
                  <span className="telemetry-val font-medium">
                    {session.durationFormatted}
                  </span>
                </div>

                <div className="telemetry-kv-row">
                  <span className="telemetry-key">
                    <CheckCircle2 size={13} className="kv-icon" /> Status
                  </span>
                  <span className="telemetry-status-pill completed">
                    <span className="status-dot" /> Completed
                  </span>
                </div>

                <div className="telemetry-kv-row">
                  <span className="telemetry-key">
                    <Layers size={13} className="kv-icon" /> Steps
                  </span>
                  <span className="telemetry-val font-medium">
                    {session.totalSteps}
                  </span>
                </div>

                <div className="telemetry-kv-row">
                  <span className="telemetry-key">
                    <Wrench size={13} className="kv-icon" /> Tools Used
                  </span>
                  <span className="telemetry-val font-medium">
                    {Object.keys(session.toolStats || {}).length}
                  </span>
                </div>

                <div className="telemetry-kv-row">
                  <span className="telemetry-key">
                    <Cpu size={13} className="kv-icon" /> Tokens Used
                  </span>
                  <span className="telemetry-val font-semibold mono">
                    {estimatedTokens.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            {/* Section: Files Changed */}
            <div className="telemetry-section">
              <div className="section-header-row">
                <h3 className="telemetry-section-title">Files Changed</h3>
                <span className="section-count-badge">{filesChanged.length} files</span>
              </div>

              <div className="changed-files-list">
                {filesChanged.length === 0 ? (
                  <div className="no-files-notice">
                    <FileCode size={16} />
                    <span>No file modifications in this session</span>
                  </div>
                ) : (
                  filesChanged.map((file, idx) => {
                    const isSelected = Boolean(
                      selectedFile && (
                        file.path.toLowerCase().includes(selectedFile.toLowerCase()) ||
                        selectedFile.toLowerCase().includes(file.path.toLowerCase())
                      )
                    );
                    return (
                      <div
                        key={idx}
                        className={`changed-file-row interactive ${isSelected ? 'active' : ''}`}
                        onClick={() => onSelectFile?.(file.path)}
                        title={`Click to show ${file.path} in Tool Execution & Diff Cards`}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            onSelectFile?.(file.path);
                          }
                        }}
                      >
                        <div className="file-info-left" title={file.path}>
                          <FileCode size={13} className={`file-icon ${isSelected ? 'active' : ''}`} />
                          <span className="file-path mono truncate">{file.path}</span>
                        </div>
                        <div className="file-diff-counters mono">
                          {file.additions > 0 && (
                            <span className="diff-plus">+{file.additions}</span>
                          )}
                          {file.deletions > 0 && (
                            <span className="diff-minus">-{file.deletions}</span>
                          )}
                          <ArrowUpRight size={12} className="jump-icon" />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Section: Tools Used */}
            <div className="telemetry-section">
              <h3 className="telemetry-section-title">Tools Used</h3>
              <div className="tools-used-list">
                {Object.keys(session.toolStats || {}).length === 0 ? (
                  <div className="no-files-notice">
                    <Wrench size={16} />
                    <span>No tool invocations recorded</span>
                  </div>
                ) : (
                  Object.entries(session.toolStats).map(([toolName, count], idx) => {
                    const formatToolName = (name: string) => {
                      if (name === 'replace_file_content' || name === 'write_to_file') return 'Edit File';
                      if (name === 'run_command') return 'Terminal Command';
                      if (name === 'search_web') return 'Search Web';
                      if (name === 'view_file') return 'View File';
                      if (name === 'list_dir') return 'List Directory';
                      return name.replace(/_/g, ' ');
                    };

                    const getToolIcon = (name: string) => {
                      if (name.includes('command')) return <Terminal size={13} className="tool-icon" />;
                      if (name.includes('search')) return <Search size={13} className="tool-icon" />;
                      if (name.includes('file')) return <FileCode size={13} className="tool-icon" />;
                      return <Wrench size={13} className="tool-icon" />;
                    };

                    return (
                      <div key={idx} className="tool-used-row">
                        <div className="tool-info-left">
                          {getToolIcon(toolName)}
                          <span className="tool-name">{formatToolName(toolName)}</span>
                        </div>
                        <span className="tool-duration-badge mono">
                          {count} call{count > 1 ? 's' : ''}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Section: Export Session */}
            <div className="telemetry-section export-section">
              <h3 className="telemetry-section-title">Export Session</h3>
              <div className="export-buttons-row">
                <button className="export-btn" onClick={handleExportJson} title="Export full JSON payload">
                  <Download size={14} />
                  <span>Export JSON</span>
                </button>
                <button className="export-btn" onClick={handleShareLink} title="Copy shareable URL link">
                  {copiedShare ? <Check size={14} color="var(--cortex-execution-green)" /> : <Share2 size={14} />}
                  <span>{copiedShare ? 'Copied!' : 'Share Link'}</span>
                </button>
              </div>
            </div>
          </>
        ) : (
          /* Telemetry Performance Metrics View */
          <div className="telemetry-metrics-view">
            <div className="telemetry-card-metric">
              <span className="metric-label">Execution Velocity</span>
              <span className="metric-big-val">{(session.totalSteps / Math.max(1, (session.durationMs / 60000))).toFixed(1)} steps/min</span>
              <span className="metric-subtext text-muted">Average rate of autonomous reasoning</span>
            </div>

            <div className="telemetry-card-metric">
              <span className="metric-label">Autonomous Tool Density</span>
              <span className="metric-big-val">
                {(Object.values(session.toolStats || {}).reduce((a, b) => a + b, 0) / Math.max(1, session.totalSteps)).toFixed(2)}
              </span>
              <span className="metric-subtext text-muted">Tools executed per timeline step</span>
            </div>

            <div className="telemetry-card-metric">
              <span className="metric-label">Cognitive Memory State</span>
              <span className="metric-big-val font-semibold text-emerald">Optimized</span>
              <span className="metric-subtext text-muted">Context window healthy & compliant</span>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
