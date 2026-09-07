import React from 'react';
import {
  ChevronDown,
  Trash2,
  PanelRightClose,
  PanelRightOpen,
  PanelLeftClose,
  PanelLeftOpen,
  RotateCw
} from 'lucide-react';
import { ParsedConversationSession } from '../types/index.js';
import { useAgentPermissions } from '../hooks/useAgentPermissions.js';

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
  lastRefreshed = null
}) => {
  const { interceptSkillExecution } = useAgentPermissions();

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
        </div>
      </div>

      {/* Right: Actions, Fullscreen, Notifications, Profile Avatar & Sidebar Toggle */}
      <div className="hud-header-right">
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
    </header>
  );
};
