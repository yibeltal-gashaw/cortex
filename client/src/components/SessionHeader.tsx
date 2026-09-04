import React, { useState } from 'react';
import {
  Copy,
  Check,
  Clock,
  Cpu,
  Trash2,
  ChevronDown,
  ChevronUp,
  FileCode,
  Terminal,
  Layers,
  Calendar
} from 'lucide-react';
import { ParsedConversationSession } from '../types/index.js';
import { useAgentPermissions } from '../hooks/useAgentPermissions.js';

interface SessionHeaderProps {
  session: ParsedConversationSession;
  onDeleteClick: () => void;
}

export const SessionHeader: React.FC<SessionHeaderProps> = ({
  session,
  onDeleteClick
}) => {
  const { interceptSkillExecution } = useAgentPermissions();
  const [copied, setCopied] = useState(false);
  const [envOpen, setEnvOpen] = useState(true);

  const copyId = () => {
    navigator.clipboard.writeText(session.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleForgetClick = async () => {
    const granted = await interceptSkillExecution({
      skillId: 'ide_memory',
      actionName: 'Permanent Memory Wipe & Session Deletion',
      resource: `Session ID: ${session.id}`,
      riskLevel: 'critical',
      details: `Agent requested permanent deletion of conversation artifacts, SQLite state, and timeline for session ${session.id}.`
    });

    if (granted) {
      onDeleteClick();
    }
  };

  const env = session.environmentSnapshot;

  return (
    <div className="session-header">
      <div className="header-top">
        <div className="id-badge-group">
          <div className="session-id-text" title="Click to copy full ID">
            <span>{session.id}</span>
            <button className="copy-btn" onClick={copyId} title="Copy Conversation ID">
              {copied ? <Check size={13} color="var(--cortex-execution-green)" /> : <Copy size={13} />}
            </button>
          </div>
        </div>

        <div className="header-metrics">
          <div className="metric-pill" title="Model Used">
            <Cpu size={14} className="icon" />
            <span>{session.model}</span>
          </div>

          <div className="metric-pill" title="Execution Duration">
            <Clock size={14} className="icon" />
            <span>{session.durationFormatted}</span>
          </div>

          <div className="metric-pill" title="Total Steps">
            <Layers size={14} className="icon" />
            <span>{session.totalSteps} Steps</span>
          </div>

          <div className="metric-pill" title="Start Time">
            <Calendar size={14} className="icon" />
            <span>{new Date(session.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </div>

          {/* Action: Memory Wipe Crimson Permanent Forget Action */}
          <button
            className="danger-btn"
            onClick={handleForgetClick}
            title="Permanently wipe session data & SQLite cache (Protected by JIT consent)"
            style={{
              color: 'var(--cortex-memory-wipe)',
              background: 'var(--cortex-memory-wipe-bg)',
              borderColor: 'var(--cortex-memory-wipe-border)'
            }}
          >
            <Trash2 size={13} />
            <span>Forget Session</span>
          </button>
        </div>
      </div>

      {env && (
        <div className="env-drawer">
          <button
            className="env-drawer-toggle"
            onClick={() => setEnvOpen(!envOpen)}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Terminal size={14} color="var(--cortex-cognitive-teal)" />
              <span>Environment Snapshot</span>
              {env.localTime && <span className="mono" style={{ color: 'var(--cortex-grey-matter)' }}>({env.localTime})</span>}
            </span>
            {envOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </button>

          {envOpen && (
            <div className="env-drawer-content">
              {/* Cognitive Teal Active Focus: Active Document */}
              {env.activeDocument && (
                <div className="env-row">
                  <span className="env-label">Active Document:</span>
                  <div className="env-tags">
                    <span className="file-tag active">
                      <FileCode size={11} style={{ marginRight: '4px', verticalAlign: '-1px' }} />
                      {env.activeDocument.path}
                      {env.cursorLine !== undefined && ` : line ${env.cursorLine}`}
                      {env.activeDocument.language && ` (${env.activeDocument.language})`}
                    </span>
                  </div>
                </div>
              )}

              {env.openDocuments && env.openDocuments.length > 0 && (
                <div className="env-row">
                  <span className="env-label">Open Editor Tabs ({env.openDocuments.length}):</span>
                  <div className="env-tags">
                    {env.openDocuments.map((doc, idx) => (
                      <span key={idx} className="file-tag" title={doc}>
                        {doc.split(/[\\/]/).pop()}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Cognitive Teal Active Focus: Running Terminal Processes */}
              {env.terminalProcesses && env.terminalProcesses.length > 0 && (
                <div className="env-row">
                  <span className="env-label">Terminal Focus:</span>
                  <div className="env-tags">
                    {env.terminalProcesses.map((proc, idx) => (
                      <span key={idx} className="process-tag" title={proc.cwd || ''}>
                        <Terminal size={11} color="var(--cortex-cognitive-teal)" />
                        <span>{proc.command}</span>
                        {proc.duration && (
                          <span style={{ color: 'var(--cortex-cognitive-teal)', opacity: 0.85 }}>
                            ({proc.duration})
                          </span>
                        )}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
