import React, { useState } from 'react';
import {
  Maximize2,
  ChevronDown,
  Trash2,
  PanelRightClose,
  PanelRightOpen
} from 'lucide-react';
import { ParsedConversationSession } from '../types/index.js';
import { useAgentPermissions } from '../hooks/useAgentPermissions.js';

interface HudHeaderProps {
  session: ParsedConversationSession | null;
  workspaceName?: string;
  isTelemetryOpen: boolean;
  onToggleTelemetry: () => void;
  onDeleteSession: () => void;
}

export const HudHeader: React.FC<HudHeaderProps> = ({
  session,
  workspaceName = 'Antigravity Workspace',
  isTelemetryOpen,
  onToggleTelemetry,
  onDeleteSession
}) => {
  const { interceptSkillExecution } = useAgentPermissions();
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

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
              {session.model.includes('Flash') ? 'v3.7-flash' : session.model.slice(0, 10)}
            </span>
          )}
        </div>
      </div>

      {/* Right: Actions, Fullscreen, Notifications, Profile Avatar & Sidebar Toggle */}
      <div className="hud-header-right">
        <button
          className={`hud-action-icon-btn ${isFullscreen ? 'active' : ''}`}
          title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen Mode'}
          onClick={toggleFullscreen}
        >
          <Maximize2 size={16} />
        </button>

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
          title={isTelemetryOpen ? 'Hide Telemetry Panel' : 'Show Telemetry Panel'}
          onClick={onToggleTelemetry}
        >
          {isTelemetryOpen ? <PanelRightClose size={16} /> : <PanelRightOpen size={16} />}
        </button>

      </div>
    </header>
  );
};
