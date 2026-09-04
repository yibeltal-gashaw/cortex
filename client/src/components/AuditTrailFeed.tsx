import React, { useState } from 'react';
import {
  History,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  FileCode,
  Terminal,
  Database,
  Globe,
  Bot,
  Trash2,
  Download,
  Filter
} from 'lucide-react';
import { useAgentPermissions } from '../hooks/useAgentPermissions.js';
import { AuditLogEntry, SkillId } from '../types/permissions.js';

export const AuditTrailFeed: React.FC = () => {
  const { auditLogs, clearAuditLogs } = useAgentPermissions();
  const [filterSeverity, setFilterSeverity] = useState<'all' | 'success' | 'warning' | 'error'>('all');

  const filtered = auditLogs.filter((entry) => {
    if (filterSeverity === 'all') return true;
    return entry.severity === filterSeverity;
  });

  const getSkillIcon = (skillId: SkillId) => {
    switch (skillId) {
      case 'workspace_files':
        return <FileCode size={13} color="var(--cortex-cognitive-teal)" />;
      case 'terminal_execution':
        return <Terminal size={13} color="var(--cortex-cognitive-teal)" />;
      case 'ide_memory':
        return <Database size={13} color="var(--cortex-synapse-purple)" />;
      case 'network_access':
        return <Globe size={13} color="var(--cortex-cognitive-teal)" />;
      case 'browser_agent':
        return <Bot size={13} color="var(--cortex-synapse-purple)" />;
      default:
        return <History size={13} />;
    }
  };

  const getActionBadge = (entry: AuditLogEntry) => {
    switch (entry.action) {
      case 'grant':
      case 'jit_allow_once':
      case 'jit_allow_session':
        return (
          <span className="audit-action-badge success">
            <CheckCircle2 size={11} />
            <span>{entry.action === 'jit_allow_session' ? 'SESSION GRANT' : entry.action === 'jit_allow_once' ? '1-TIME GRANT' : 'GRANTED'}</span>
          </span>
        );
      case 'revoke':
      case 'jit_deny':
      case 'tool_blocked':
        return (
          <span className="audit-action-badge error">
            <XCircle size={11} />
            <span>{entry.action === 'tool_blocked' ? 'POLICY BLOCKED' : 'DENIED'}</span>
          </span>
        );
      case 'tool_executed':
        return (
          <span className="audit-action-badge executed">
            <CheckCircle2 size={11} />
            <span>EXECUTED</span>
          </span>
        );
      case 'scope_updated':
        return (
          <span className="audit-action-badge warning">
            <AlertTriangle size={11} />
            <span>CONFIG UPDATED</span>
          </span>
        );
      default:
        return (
          <span className="audit-action-badge info">
            <span>INFO</span>
          </span>
        );
    }
  };

  const exportAuditLog = () => {
    const dataStr = JSON.stringify(auditLogs, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cortex_permissions_audit_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="audit-feed-wrapper">
      <div className="audit-feed-toolbar">
        <div className="audit-filter-tabs">
          <span style={{ fontSize: '11px', color: 'var(--cortex-grey-matter)', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Filter size={11} /> Filter:
          </span>
          <button
            className={`audit-filter-btn ${filterSeverity === 'all' ? 'active' : ''}`}
            onClick={() => setFilterSeverity('all')}
          >
            All ({auditLogs.length})
          </button>
          <button
            className={`audit-filter-btn ${filterSeverity === 'success' ? 'active' : ''}`}
            onClick={() => setFilterSeverity('success')}
          >
            Grants
          </button>
          <button
            className={`audit-filter-btn ${filterSeverity === 'error' ? 'active' : ''}`}
            onClick={() => setFilterSeverity('error')}
          >
            Blocked / Denied
          </button>
          <button
            className={`audit-filter-btn ${filterSeverity === 'warning' ? 'active' : ''}`}
            onClick={() => setFilterSeverity('warning')}
          >
            Policy Changes
          </button>
        </div>

        <div className="audit-actions">
          <button
            className="audit-mini-btn"
            onClick={exportAuditLog}
            title="Export Audit Trail as JSON"
          >
            <Download size={12} />
            <span>Export</span>
          </button>
          <button
            className="audit-mini-btn"
            onClick={clearAuditLogs}
            title="Clear Audit Feed"
          >
            <Trash2 size={12} />
            <span>Clear</span>
          </button>
        </div>
      </div>

      <div className="audit-feed-scroll">
        {filtered.length === 0 ? (
          <div className="audit-empty-state">
            <History size={24} color="var(--cortex-grey-matter)" />
            <p>No permission events matching filter.</p>
          </div>
        ) : (
          <div className="audit-feed-list">
            {filtered.map((item) => (
              <div key={item.id} className={`audit-entry-card severity-${item.severity}`}>
                <div className="audit-entry-top">
                  <div className="audit-entry-identity">
                    {getSkillIcon(item.skillId)}
                    <span className="audit-skill-name">{item.skillName}</span>
                    {getActionBadge(item)}
                  </div>
                  <span className="audit-timestamp mono">{item.timestamp}</span>
                </div>

                <div className="audit-entry-body">
                  <p className="audit-details-text">{item.details}</p>
                  {item.resource && (
                    <div className="audit-resource-tag truncate mono" title={item.resource}>
                      {item.resource}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
