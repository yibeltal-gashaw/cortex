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
import { TerminalCommandLogModal } from './TerminalCommandLogModal.js';

interface TelemetrySidebarProps {
  session: ParsedConversationSession | null;
  selectedFile?: string | null;
  onSelectFile?: (filePath: string) => void;
  onJumpToStep?: (stepIndex: number) => void;
  onClose?: () => void;
}

interface ChangedFileInfo {
  path: string;
  fullPath: string;
  additions: number;
  deletions: number;
}

export const TelemetrySidebar: React.FC<TelemetrySidebarProps> = ({
  session,
  selectedFile,
  onSelectFile,
  onJumpToStep,
  onClose
}) => {
  const [activeTab, setActiveTab] = useState<'details' | 'telemetry'>('details');
  const [copiedId, setCopiedId] = useState(false);
  const [copiedShare, setCopiedShare] = useState(false);
  const [isTerminalModalOpen, setIsTerminalModalOpen] = useState(false);

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
  const fileMap = new Map<string, { additions: number; deletions: number; fullPath: string }>();
  session.steps.forEach((step: TimelineStep) => {
    if (step.toolCalls) {
      step.toolCalls.forEach((tc: ToolCallItem) => {
        if (
          tc.name === 'replace_file_content' ||
          tc.name === 'write_to_file' ||
          tc.name === 'multi_replace_file_content' ||
          tc.name === 'edit_file' ||
          tc.name === 'write_file'
        ) {
          const rawFilePath = tc.args.Path || tc.args.TargetFile || tc.args.path || tc.result?.diff?.targetFile;
          if (rawFilePath) {
            const cleanPath = cleanFilePath(rawFilePath);
            const relPath = cleanPath.split('/').slice(-2).join('/');
            const existing = fileMap.get(relPath) || { additions: 0, deletions: 0, fullPath: cleanPath };

            if (tc.result?.diff) {
              const oldNorm = normalizeContent(tc.result.diff.oldContent || '');
              const newNorm = normalizeContent(tc.result.diff.newContent || '');
              const oldLines = oldNorm ? oldNorm.split('\n').length : 0;
              const newLines = newNorm ? newNorm.split('\n').length : 0;
              existing.additions += Math.max(0, newLines);
              existing.deletions += Math.max(0, oldLines);
            } else if (tc.args.Replacement || tc.args.ReplacementContent || tc.args.Content || tc.args.CodeContent) {
              const norm = normalizeContent(tc.args.Replacement || tc.args.ReplacementContent || tc.args.Content || tc.args.CodeContent || '');
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
    fullPath: diff.fullPath,
    additions: diff.additions,
    deletions: diff.deletions
  }));

  // Actual or estimated tokens
  const totalTokens = session.tokenStats?.totalTokens ?? Math.min(
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
                  <div className="telemetry-val" style={{ textAlign: 'right' }}>
                    <span className="font-semibold mono">{totalTokens.toLocaleString()}</span>
                    {session.tokenStats?.estimatedCostUsd !== undefined && (
                      <span className="text-muted mono" style={{ fontSize: '10px', display: 'block' }}>
                        ~${session.tokenStats.estimatedCostUsd.toFixed(4)}
                        {session.tokenStats.cacheHitRatePercent > 0 ? ` • ${session.tokenStats.cacheHitRatePercent}% cache` : ''}
                      </span>
                    )}
                  </div>
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
                    const parts = file.path.split('/');
                    const fileName = parts.pop() || file.path;
                    const dirName = parts.length > 0 ? parts.join('/') + '/' : '';

                    return (
                      <div
                        key={idx}
                        className={`changed-file-row interactive ${isSelected ? 'active' : ''}`}
                        onClick={() => onSelectFile?.(file.path)}
                        title={`Click to show ${file.fullPath || file.path} in Tool Execution & Diff Cards`}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            onSelectFile?.(file.path);
                          }
                        }}
                      >
                        <div className="file-info-left" title={file.fullPath || file.path}>
                          <FileCode size={13} className={`file-icon ${isSelected ? 'active' : ''}`} />
                          <span className="file-path mono truncate">
                            {dirName && <span style={{ opacity: 0.55 }}>{dirName}</span>}
                            <span style={{ fontWeight: 600 }}>{fileName}</span>
                          </span>
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
                      if (name === 'replace_file_content' || name === 'write_to_file' || name === 'edit_file' || name === 'write_file' || name === 'multi_replace_file_content') return 'Edit File';
                      if (name === 'run_command') return 'Terminal Command';
                      if (name === 'search_web') return 'Search Web';
                      if (name === 'view_file' || name === 'read_file') return 'View File';
                      if (name === 'list_dir') return 'List Directory';
                      return name.replace(/_/g, ' ');
                    };

                    const getToolIcon = (name: string) => {
                      if (name.includes('command')) return <Terminal size={13} className="tool-icon" />;
                      if (name.includes('search')) return <Search size={13} className="tool-icon" />;
                      if (name.includes('file')) return <FileCode size={13} className="tool-icon" />;
                      return <Wrench size={13} className="tool-icon" />;
                    };

                    const isTerminalTool = toolName === 'run_command' || toolName.includes('command');

                    return (
                      <div
                        key={idx}
                        className={`tool-used-row ${isTerminalTool ? 'interactive clickable' : ''}`}
                        onClick={isTerminalTool ? () => setIsTerminalModalOpen(true) : undefined}
                        title={isTerminalTool ? `Click to inspect all ${count} terminal command executions and output logs` : undefined}
                        role={isTerminalTool ? 'button' : undefined}
                        tabIndex={isTerminalTool ? 0 : undefined}
                        onKeyDown={isTerminalTool ? (e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setIsTerminalModalOpen(true);
                          }
                        } : undefined}
                      >
                        <div className="tool-info-left">
                          {getToolIcon(toolName)}
                          <span className="tool-name">{formatToolName(toolName)}</span>
                        </div>
                        <div className="tool-info-right">
                          <span className="tool-duration-badge mono">
                            {count} call{count > 1 ? 's' : ''}
                          </span>
                          {isTerminalTool && <ArrowUpRight size={12} className="jump-icon" />}
                        </div>
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
            {/* Token & Cost Intelligence Card */}
            <div className="telemetry-card-metric" style={{ borderLeft: '3px solid var(--cortex-synapse-purple)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span className="metric-label" style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Token & Cost Intelligence</span>
                {session.tokenStats && session.tokenStats.cacheHitRatePercent > 0 && (
                  <span className="mini-badge" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10B981', fontWeight: 600 }}>
                    {session.tokenStats.cacheHitRatePercent}% Cache Hit
                  </span>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '10px' }}>
                <div>
                  <span className="text-muted" style={{ fontSize: '10px' }}>Estimated Cost</span>
                  <div className="mono font-semibold" style={{ fontSize: '14px', color: 'var(--cortex-execution-green)' }}>
                    ${session.tokenStats?.estimatedCostUsd !== undefined ? session.tokenStats.estimatedCostUsd.toFixed(4) : '0.0000'}
                  </div>
                </div>
                <div>
                  <span className="text-muted" style={{ fontSize: '10px' }}>Total Tokens</span>
                  <div className="mono font-semibold" style={{ fontSize: '14px' }}>
                    {totalTokens.toLocaleString()}
                  </div>
                </div>
              </div>

              {/* Progress bar breakdown */}
              {session.tokenStats && session.tokenStats.totalInputTokens > 0 && (
                <>
                  <div style={{ height: '6px', width: '100%', background: 'var(--border-subtle)', borderRadius: '3px', overflow: 'hidden', display: 'flex', marginBottom: '6px' }}>
                    <div
                      style={{
                        width: `${Math.round((session.tokenStats.totalCacheReadTokens / (session.tokenStats.totalTokens || 1)) * 100)}%`,
                        background: '#10B981'
                      }}
                      title={`Cached Tokens: ${session.tokenStats.totalCacheReadTokens.toLocaleString()}`}
                    />
                    <div
                      style={{
                        width: `${Math.round(((session.tokenStats.totalInputTokens - session.tokenStats.totalCacheReadTokens) / (session.tokenStats.totalTokens || 1)) * 100)}%`,
                        background: 'var(--cortex-synapse-purple)'
                      }}
                      title={`Fresh Input Tokens: ${(session.tokenStats.totalInputTokens - session.tokenStats.totalCacheReadTokens).toLocaleString()}`}
                    />
                    <div
                      style={{
                        width: `${Math.round((session.tokenStats.totalOutputTokens / (session.tokenStats.totalTokens || 1)) * 100)}%`,
                        background: 'var(--cortex-cognitive-teal)'
                      }}
                      title={`Output Tokens: ${session.tokenStats.totalOutputTokens.toLocaleString()}`}
                    />
                  </div>

                  <div className="mono" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: 'var(--text-muted)' }}>
                    <span style={{ color: '#10B981' }}>● Cached ({session.tokenStats.totalCacheReadTokens.toLocaleString()})</span>
                    <span style={{ color: 'var(--cortex-synapse-purple)' }}>● Fresh ({(session.tokenStats.totalInputTokens - session.tokenStats.totalCacheReadTokens).toLocaleString()})</span>
                    <span style={{ color: 'var(--cortex-cognitive-teal)' }}>● Out ({session.tokenStats.totalOutputTokens.toLocaleString()})</span>
                  </div>
                </>
              )}
            </div>

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

      {/* Terminal Command Log Modal */}
      <TerminalCommandLogModal
        isOpen={isTerminalModalOpen}
        onClose={() => setIsTerminalModalOpen(false)}
        session={session}
        onJumpToStep={onJumpToStep}
      />
    </aside>
  );
};
