import React from 'react';
import {
  ChevronDown,
  Trash2,
  PanelRightClose,
  PanelRightOpen,
  PanelLeftClose,
  PanelLeftOpen,
  RotateCw,
  Network,
  ArrowUpLeft,
  Download,
  FileText,
  Globe,
  GitCompare,
  Activity,
  FolderKanban,
  Database
} from 'lucide-react';
import { ParsedConversationSession } from '../types/index.js';
import { useAgentPermissions } from '../hooks/useAgentPermissions.js';
import { SubagentDagModal } from './SubagentDagModal.js';

interface HudHeaderProps {
  session: ParsedConversationSession | null;
  workspaceName?: string;
  isSidebarCollapsed?: boolean;
  onToggleSidebar?: () => void;
  isTelemetryOpen: boolean;
  onToggleTelemetry: () => void;
  onDeleteSession: () => void;
  isRefreshing?: boolean;
  onRefreshSession?: () => void;
  autoRefreshEnabled?: boolean;
  lastRefreshed?: Date | null;
  isLiveStreaming?: boolean;
  onSelectConversation?: (id: string) => void;
  onOpenComparison?: () => void;
  activeSubTab?: 'timeline' | 'artifacts' | 'db';
  onSelectSubTab?: (tab: 'timeline' | 'artifacts' | 'db') => void;
  artifactsCount?: number;
}

function formatRelativeTime(iso?: string): string {
  if (!iso) return 'just now';
  try {
    const d = new Date(iso);
    const now = new Date();
    const diffSecs = Math.floor((now.getTime() - d.getTime()) / 1000);
    if (diffSecs < 10) return 'just now';
    if (diffSecs < 60) return `${diffSecs}s ago`;
    const diffMins = Math.floor(diffSecs / 60);
    if (diffMins < 60) return `${diffMins}m ago`;
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return 'recently';
  }
}

export const HudHeader: React.FC<HudHeaderProps> = ({
  session,
  workspaceName = 'Antigravity Workspace',
  isSidebarCollapsed = false,
  onToggleSidebar,
  isTelemetryOpen,
  onToggleTelemetry,
  onDeleteSession,
  isRefreshing = false,
  onRefreshSession,
  autoRefreshEnabled = true,
  lastRefreshed = null,
  isLiveStreaming = false,
  onSelectConversation,
  onOpenComparison,
  activeSubTab = 'timeline',
  onSelectSubTab,
  artifactsCount = 0
}) => {
  const { interceptSkillExecution } = useAgentPermissions();
  const [isDagModalOpen, setIsDagModalOpen] = React.useState(false);
  const [isExportMenuOpen, setIsExportMenuOpen] = React.useState(false);
  const exportMenuRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setIsExportMenuOpen(false);
      }
    };
    if (isExportMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isExportMenuOpen]);

  const handleForgetClick = async () => {
    if (!session) return;
    const granted = await interceptSkillExecution({
      skillId: 'ide_memory',
      actionName: 'Permanent Memory Wipe & Session Deletion',
      resource: `Session ID: ${session.id}`,
      riskLevel: 'critical',
      details: `Agent requested permanent deletion of conversation artifacts, SQLite state, and timeline for session ${session.id}.`
    });

    if (granted) {
      onDeleteSession();
    }
  };

  return (
    <header className="hud-top-header">
      {/* Left: Breadcrumbs & Session Title Dropdown */}
      <div className="hud-header-left">
        {onToggleSidebar && (
          <button
            className={`hud-action-icon-btn ${isSidebarCollapsed ? 'sidebar-toggle-active' : ''}`}
            title={isSidebarCollapsed ? 'Expand Sidebar (Ctrl+B)' : 'Collapse Sidebar (Ctrl+B)'}
            onClick={onToggleSidebar}
          >
            {isSidebarCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
          </button>
        )}
        <div className="hud-breadcrumbs">
          <span className="hud-workspace-crumb">{workspaceName}</span>
          <span className="hud-crumb-slash">/</span>
          <div className="hud-session-title-wrap">
            <span className="hud-session-title">
              {session?.steps[0]?.userPrompt?.requestText
                ? session.steps[0].userPrompt.requestText.slice(0, 48) + (session.steps[0].userPrompt.requestText.length > 48 ? '...' : '')
                : session?.id || 'Select Session'}
            </span>
            <ChevronDown size={14} className="hud-chevron" />
          </div>
          {session?.model && (
            <span className="hud-version-badge" title={`Model: ${session.model}`}>
              {session.model}
            </span>
          )}

          {session?.parentSessionId && (
            <button
              className="metric-pill"
              onClick={() => onSelectConversation?.(session.parentSessionId!)}
              title={`Jump to parent orchestrator session (${session.parentSessionId})`}
              style={{ fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '3px', marginLeft: '4px' }}
            >
              <ArrowUpLeft size={11} />
              <span>Parent Agent</span>
            </button>
          )}

          {session?.subagents && session.subagents.length > 0 && (
            <button
              className="metric-pill"
              onClick={() => setIsDagModalOpen(true)}
              title="Inspect Multi-Agent Orchestration DAG"
              style={{
                fontSize: '11px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                marginLeft: '4px',
                background: 'rgba(139, 92, 246, 0.12)',
                borderColor: 'rgba(139, 92, 246, 0.3)',
                color: '#c084fc',
                fontWeight: 600
              }}
            >
              <Network size={12} />
              <span>Agent DAG ({session.subagents.length})</span>
            </button>
          )}
        </div>
      </div>

      {/* Center: Primary View Switcher Tabs */}
      {session && onSelectSubTab && (
        <div className="hud-header-center-nav">
          <button
            className={`hud-header-tab ${activeSubTab === 'timeline' ? 'active' : ''}`}
            onClick={() => onSelectSubTab('timeline')}
            title="Timeline feed of execution events & tool invocations"
          >
            <Activity size={13} />
            <span>Timeline</span>
            <span className="hud-tab-counter mono">{session.steps.length}</span>
          </button>

          <button
            className={`hud-header-tab ${activeSubTab === 'artifacts' ? 'active' : ''}`}
            onClick={() => onSelectSubTab('artifacts')}
            title="Session Artifacts, Sandboxed Web UI, and Background Tasks"
          >
            <FolderKanban size={13} />
            <span>Artifacts</span>
            {artifactsCount > 0 && (
              <span className="hud-tab-counter mono">{artifactsCount}</span>
            )}
          </button>

          <button
            className={`hud-header-tab ${activeSubTab === 'db' ? 'active' : ''}`}
            onClick={() => onSelectSubTab('db')}
            title="SQLite Database Tables & Ad-hoc SQL Query Console"
          >
            <Database size={13} />
            <span>Database</span>
          </button>
        </div>
      )}

      {/* Right: Actions, Fullscreen, Notifications, Profile Avatar & Sidebar Toggle */}
      <div className="hud-header-right">
        {isLiveStreaming && (
          <div className="hud-live-indicator" title="Connected to Real-Time SSE Stream (Delta updates enabled)">
            <span className="live-ping-dot" />
            <span className="live-text mono">LIVE</span>
          </div>
        )}

        {onRefreshSession && (
          <button
            className={`hud-action-icon-btn ${isRefreshing ? 'active' : ''}`}
            title={`Refresh active session (Ctrl+R / R)${autoRefreshEnabled ? ' • Live sync active' : ' • Live sync paused'}${lastRefreshed ? ` • Updated ${formatRelativeTime(lastRefreshed.toISOString())}` : ''}`}
            onClick={onRefreshSession}
            aria-label="Refresh active session"
          >
            <RotateCw size={15} className={isRefreshing ? 'spin-icon' : ''} />
          </button>
        )}

        {session && (
          <div ref={exportMenuRef} style={{ position: 'relative' }}>
            <button
              className={`hud-action-icon-btn ${isExportMenuOpen ? 'active' : ''}`}
              title="Export Incident & Audit Runbook (Markdown / HTML)"
              onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
            >
              <Download size={15} />
            </button>

            {isExportMenuOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  marginTop: '6px',
                  background: 'var(--bg-card)',
                  border: '1px solid var(--cortex-grey-matter-border)',
                  borderRadius: '8px',
                  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.3)',
                  zIndex: 1000,
                  width: '210px',
                  display: 'flex',
                  flexDirection: 'column',
                  padding: '4px',
                  gap: '2px'
                }}
              >
                <a
                  href={`/api/conversations/${session.id}/export/markdown`}
                  download={`cortex-runbook-${session.id.slice(0, 8)}.md`}
                  onClick={() => setIsExportMenuOpen(false)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 12px',
                    fontSize: '12px',
                    color: 'var(--cortex-deep-thought)',
                    textDecoration: 'none',
                    borderRadius: '4px'
                  }}
                  className="db-table-btn"
                >
                  <FileText size={13} color="var(--cortex-synapse-purple)" />
                  <span>Export Markdown (.md)</span>
                </a>

                <a
                  href={`/api/conversations/${session.id}/export/html`}
                  download={`cortex-runbook-${session.id.slice(0, 8)}.html`}
                  onClick={() => setIsExportMenuOpen(false)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 12px',
                    fontSize: '12px',
                    color: 'var(--cortex-deep-thought)',
                    textDecoration: 'none',
                    borderRadius: '4px'
                  }}
                  className="db-table-btn"
                >
                  <Globe size={13} color="var(--cortex-cognitive-teal)" />
                  <span>Export HTML (.html)</span>
                </a>
              </div>
            )}
          </div>
        )}

        {onOpenComparison && (
          <button
            className="hud-action-icon-btn"
            title="Compare Sessions (A/B Model Diff & Telemetry)"
            onClick={onOpenComparison}
          >
            <GitCompare size={15} />
          </button>
        )}

        {session && (
          <button
            className="hud-action-icon-btn danger"
            title="Forget & Delete Session Data (JIT Protected)"
            onClick={handleForgetClick}
          >
            <Trash2 size={16} />
          </button>
        )}

        <button
          className={`hud-action-icon-btn ${isTelemetryOpen ? 'active' : ''}`}
          title={isTelemetryOpen ? 'Hide Right Panel' : 'Show Right Panel'}
          onClick={onToggleTelemetry}
        >
          {isTelemetryOpen ? <PanelRightClose size={16} /> : <PanelRightOpen size={16} />}
        </button>

      </div>

      {session && (
        <SubagentDagModal
          isOpen={isDagModalOpen}
          onClose={() => setIsDagModalOpen(false)}
          session={session}
          onSelectConversation={onSelectConversation}
        />
      )}
    </header>
  );
};
