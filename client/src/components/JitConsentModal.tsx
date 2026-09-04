import React from 'react';
import {
  ShieldAlert,
  AlertTriangle,
  Check,
  X,
  Clock,
  Terminal,
  Database,
  FileCode,
  Globe,
  Bot,
  Zap
} from 'lucide-react';
import { useAgentPermissions } from '../hooks/useAgentPermissions.js';

export const JitConsentModal: React.FC = () => {
  const { activeJitRequest, respondToJit } = useAgentPermissions();

  if (!activeJitRequest) return null;

  const { skillId, skillName, actionName, resource, riskLevel, details } = activeJitRequest;

  const renderIcon = () => {
    switch (skillId) {
      case 'terminal_execution':
        return <Terminal size={22} color="var(--cortex-cognitive-teal)" />;
      case 'ide_memory':
        return <Database size={22} color="var(--cortex-memory-wipe)" />;
      case 'workspace_files':
        return <FileCode size={22} color="var(--cortex-cognitive-teal)" />;
      case 'network_access':
        return <Globe size={22} color="var(--cortex-synapse-purple)" />;
      case 'browser_agent':
        return <Bot size={22} color="var(--cortex-synapse-purple)" />;
      default:
        return <Zap size={22} color="var(--cortex-insight-amber)" />;
    }
  };

  const getRiskColor = () => {
    switch (riskLevel) {
      case 'critical':
        return {
          badge: 'var(--cortex-memory-wipe)',
          bg: 'var(--cortex-memory-wipe-bg)',
          border: 'var(--cortex-memory-wipe-border)',
          label: 'CRITICAL RISK'
        };
      case 'high':
        return {
          badge: '#d97706',
          bg: 'rgba(217, 119, 6, 0.12)',
          border: 'rgba(217, 119, 6, 0.35)',
          label: 'HIGH RISK'
        };
      case 'medium':
        return {
          badge: 'var(--cortex-cognitive-teal)',
          bg: 'var(--cortex-cognitive-teal-bg)',
          border: 'var(--cortex-cognitive-teal-border)',
          label: 'MODERATE RISK'
        };
      default:
        return {
          badge: 'var(--cortex-grey-matter)',
          bg: 'var(--cortex-grey-matter-subtle)',
          border: 'var(--cortex-grey-matter-border)',
          label: 'CONSENT REQUIRED'
        };
    }
  };

  const risk = getRiskColor();

  return (
    <div className="jit-modal-overlay">
      <div className="jit-modal-card">
        {/* Header */}
        <div className="jit-header">
          <div className="jit-title-group">
            <div className="jit-icon-bubble" style={{ background: risk.bg, borderColor: risk.border }}>
              {renderIcon()}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 className="jit-title">Authorization Required</h3>
                <span
                  className="jit-risk-badge"
                  style={{ color: risk.badge, background: risk.bg, borderColor: risk.border }}
                >
                  <ShieldAlert size={11} style={{ marginRight: '4px', verticalAlign: '-1px' }} />
                  {risk.label}
                </span>
              </div>
              <p className="jit-subtitle">
                An agent tool is requesting runtime access to system resources.
              </p>
            </div>
          </div>
        </div>

        {/* Payload Context */}
        <div className="jit-body">
          <div className="jit-field-group">
            <span className="jit-field-label">Capability:</span>
            <span className="jit-field-value skill-pill">
              {skillName}
            </span>
          </div>

          <div className="jit-field-group">
            <span className="jit-field-label">Action:</span>
            <span className="jit-field-value bold-action">
              {actionName}
            </span>
          </div>

          <div className="jit-field-group">
            <span className="jit-field-label">Target Resource:</span>
            <div className="jit-resource-box truncate mono">
              {resource || 'Local workspace system call'}
            </div>
          </div>

          {details && (
            <div className="jit-field-group">
              <span className="jit-field-label">Context:</span>
              <p className="jit-context-text">{details}</p>
            </div>
          )}

          {riskLevel === 'critical' && (
            <div className="jit-warning-banner">
              <AlertTriangle size={15} color="var(--cortex-memory-wipe)" />
              <span>
                <strong>Warning:</strong> This operation performs irreversible modifications to IDE state or cache.
              </span>
            </div>
          )}
        </div>

        {/* 3 Decision Handlers */}
        <div className="jit-actions">
          <button
            className="jit-btn deny-btn"
            onClick={() => respondToJit('deny')}
            title="Reject execution and log policy violation"
          >
            <X size={14} />
            <span>Deny</span>
          </button>

          <button
            className="jit-btn allow-once-btn"
            onClick={() => respondToJit('allow_once')}
            title="Authorize this specific execution only"
          >
            <Clock size={14} />
            <span>Allow Once</span>
          </button>

          <button
            className="jit-btn allow-session-btn"
            onClick={() => respondToJit('allow_session')}
            title="Authorize all matching invocations for this browser session"
          >
            <Check size={14} />
            <span>Allow for Session</span>
          </button>
        </div>
      </div>
    </div>
  );
};
