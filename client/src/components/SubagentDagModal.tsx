import React from 'react';
import {
  Network,
  Bot,
  ArrowUpLeft,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  GitFork,
  X
} from 'lucide-react';
import { ParsedConversationSession } from '../types/index.js';

interface SubagentDagModalProps {
  isOpen: boolean;
  onClose: () => void;
  session: ParsedConversationSession;
  onSelectConversation?: (id: string) => void;
}

export const SubagentDagModal: React.FC<SubagentDagModalProps> = ({
  isOpen,
  onClose,
  session,
  onSelectConversation
}) => {
  if (!isOpen) return null;

  const subagents = session.subagents || [];
  const parentId = session.parentSessionId;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-dialog"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '780px',
          width: '92%',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {/* Header */}
        <div
          className="modal-header"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 22px',
            borderBottom: '1px solid var(--cortex-grey-matter-border)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Network size={20} color="var(--cortex-synapse-purple)" />
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontWeight: 700, fontSize: '15px', color: 'var(--cortex-deep-thought)' }}>
                  Multi-Agent Orchestration DAG
                </span>
                <span className="mini-badge mono" style={{ fontSize: '11px', background: 'rgba(139, 92, 246, 0.15)', color: '#c084fc' }}>
                  {subagents.length} Child Subagent{subagents.length === 1 ? '' : 's'}
                </span>
              </div>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                Hierarchy tree of autonomous sub-processes spawned by this session
              </span>
            </div>
          </div>

          <button
            className="copy-btn"
            onClick={onClose}
            style={{ padding: '6px 10px', fontSize: '12px' }}
          >
            <X size={14} />
          </button>
        </div>

        {/* DAG Visual Canvas */}
        <div
          className="modal-body"
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px'
          }}
        >
          {/* Optional Parent Up-Link Node */}
          {parentId && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div
                style={{
                  background: 'var(--bg-card)',
                  border: '1px dashed var(--cortex-synapse-purple)',
                  borderRadius: '8px',
                  padding: '10px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  maxWidth: '480px',
                  width: '100%',
                  justifyContent: 'space-between'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <ArrowUpLeft size={16} color="var(--cortex-synapse-purple)" />
                  <div>
                    <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block' }}>
                      Parent Root Orchestrator
                    </span>
                    <span className="mono" style={{ fontSize: '12px', color: 'var(--cortex-deep-thought)' }}>
                      {parentId.slice(0, 16)}...
                    </span>
                  </div>
                </div>

                {onSelectConversation && (
                  <button
                    className="metric-pill"
                    onClick={() => {
                      onSelectConversation(parentId);
                      onClose();
                    }}
                    style={{ fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                  >
                    <span>Inspect Parent</span>
                    <ExternalLink size={11} />
                  </button>
                )}
              </div>

              {/* Connecting Line Down to Current Agent */}
              <div style={{ width: '2px', height: '24px', background: 'var(--cortex-synapse-purple)', opacity: 0.6 }} />
            </div>
          )}

          {/* Root/Active Agent Node */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div
              style={{
                background: 'var(--bg-card)',
                border: '2px solid var(--cortex-synapse-purple)',
                borderRadius: '10px',
                padding: '14px 20px',
                maxWidth: '520px',
                width: '100%',
                boxShadow: '0 4px 14px rgba(139, 92, 246, 0.15)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div
                    style={{
                      width: '26px',
                      height: '26px',
                      borderRadius: '50%',
                      background: 'var(--cortex-synapse-purple)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#ffffff'
                    }}
                  >
                    <Bot size={15} />
                  </div>
                  <div>
                    <span style={{ fontWeight: 700, fontSize: '13px', color: 'var(--cortex-deep-thought)' }}>
                      Primary Agent ({session.model || 'Antigravity Core'})
                    </span>
                    <span className="mono" style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block' }}>
                      Session ID: {session.id}
                    </span>
                  </div>
                </div>
                <span className="mini-badge" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', fontSize: '10px' }}>
                  {session.totalSteps} steps
                </span>
              </div>

              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', background: 'var(--bg-subtle)', padding: '8px 12px', borderRadius: '6px' }}>
                <span style={{ fontWeight: 600, color: 'var(--cortex-deep-thought)' }}>Initial Prompt: </span>
                {session.steps[0]?.userPrompt?.requestText?.slice(0, 140) || 'Active conversational workflow'}...
              </div>
            </div>

            {/* Tree Branch Splitter */}
            {subagents.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
                <div style={{ width: '2px', height: '24px', background: 'var(--cortex-grey-matter-border)' }} />
                <div style={{ width: subagents.length > 1 ? '70%' : '2px', height: '2px', background: 'var(--cortex-grey-matter-border)' }} />
              </div>
            )}
          </div>

          {/* Child Subagents Grid / Branches */}
          {subagents.length > 0 ? (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: subagents.length === 1 ? '1fr' : 'repeat(auto-fit, minmax(300px, 1fr))',
                gap: '16px',
                marginTop: '4px'
              }}
            >
              {subagents.map((sub, idx) => (
                <div
                  key={idx}
                  style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--cortex-grey-matter-border)',
                    borderRadius: '8px',
                    padding: '14px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                    position: 'relative'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <GitFork size={15} color="var(--cortex-cognitive-teal)" />
                      <div>
                        <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--cortex-deep-thought)' }}>
                          {sub.role}
                        </span>
                        <span className="mono" style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block' }}>
                          Type: {sub.typeName} • Spawned at Step #{sub.stepIndex}
                        </span>
                      </div>
                    </div>

                    <span
                      className="mini-badge"
                      style={{
                        background: sub.status === 'ERROR' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                        color: sub.status === 'ERROR' ? '#ef4444' : '#10b981',
                        fontSize: '10px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '3px'
                      }}
                    >
                      {sub.status === 'ERROR' ? <AlertCircle size={10} /> : <CheckCircle2 size={10} />}
                      {sub.status || 'DONE'}
                    </span>
                  </div>

                  <div
                    style={{
                      fontSize: '11px',
                      color: 'var(--text-secondary)',
                      background: 'var(--bg-main)',
                      padding: '8px 10px',
                      borderRadius: '6px',
                      border: '1px solid var(--border-subtle)',
                      lineHeight: '1.4',
                      maxHeight: '100px',
                      overflowY: 'auto'
                    }}
                  >
                    <span style={{ fontWeight: 600, color: 'var(--cortex-deep-thought)' }}>Task: </span>
                    {sub.prompt}
                  </div>

                  {sub.conversationId && onSelectConversation && (
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
                      <button
                        className="metric-pill"
                        onClick={() => {
                          onSelectConversation(sub.conversationId!);
                          onClose();
                        }}
                        style={{
                          fontSize: '11px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          background: 'var(--cortex-cognitive-teal-bg)',
                          color: 'var(--cortex-cognitive-teal)',
                          borderColor: 'var(--cortex-cognitive-teal-border)'
                        }}
                      >
                        <span>Open Subagent Session</span>
                        <ExternalLink size={11} />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>
              No child subagents were spawned by this session.
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="modal-footer"
          style={{
            padding: '12px 22px',
            borderTop: '1px solid var(--cortex-grey-matter-border)',
            display: 'flex',
            justifyContent: 'flex-end'
          }}
        >
          <button className="metric-pill" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
