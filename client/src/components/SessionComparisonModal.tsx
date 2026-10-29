import React, { useState, useEffect } from 'react';
import {
  GitCompare,
  X
} from 'lucide-react';
import { ConversationSummary, ParsedConversationSession } from '../types/index.js';
import { fetchConversation } from '../api/index.js';

interface SessionComparisonModalProps {
  isOpen: boolean;
  onClose: () => void;
  conversations: ConversationSummary[];
  currentSessionId: string | null;
}

export const SessionComparisonModal: React.FC<SessionComparisonModalProps> = ({
  isOpen,
  onClose,
  conversations,
  currentSessionId
}) => {
  const [sessionAId, setSessionAId] = useState<string>(currentSessionId || '');
  const [sessionBId, setSessionBId] = useState<string>('');
  const [sessionA, setSessionA] = useState<ParsedConversationSession | null>(null);
  const [sessionB, setSessionB] = useState<ParsedConversationSession | null>(null);
  const [loadingA, setLoadingA] = useState<boolean>(false);
  const [loadingB, setLoadingB] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      if (currentSessionId) {
        setSessionAId(currentSessionId);
      } else if (conversations.length > 0) {
        setSessionAId(conversations[0].id);
      }
      if (conversations.length > 1) {
        const other = conversations.find(c => c.id !== (currentSessionId || conversations[0].id));
        if (other) setSessionBId(other.id);
      }
    }
  }, [isOpen, currentSessionId, conversations]);

  useEffect(() => {
    if (!sessionAId) return;
    setLoadingA(true);
    fetchConversation(sessionAId)
      .then(data => setSessionA(data))
      .catch(err => console.error('Failed to load session A:', err))
      .finally(() => setLoadingA(false));
  }, [sessionAId]);

  useEffect(() => {
    if (!sessionBId) {
      setSessionB(null);
      return;
    }
    setLoadingB(true);
    fetchConversation(sessionBId)
      .then(data => setSessionB(data))
      .catch(err => console.error('Failed to load session B:', err))
      .finally(() => setLoadingB(false));
  }, [sessionBId]);

  if (!isOpen) return null;

  const costA = sessionA?.tokenStats?.estimatedCostUsd || 0;
  const costB = sessionB?.tokenStats?.estimatedCostUsd || 0;
  const durA = sessionA?.durationMs || 0;
  const durB = sessionB?.durationMs || 0;
  const cacheA = sessionA?.tokenStats?.cacheHitRatePercent || 0;
  const cacheB = sessionB?.tokenStats?.cacheHitRatePercent || 0;
  const stepsA = sessionA?.totalSteps || 0;
  const stepsB = sessionB?.totalSteps || 0;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-dialog"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '1280px',
          width: '96%',
          height: '90vh',
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
            padding: '14px 20px',
            borderBottom: '1px solid var(--cortex-grey-matter-border)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <GitCompare size={20} color="var(--cortex-synapse-purple)" />
            <div>
              <span style={{ fontWeight: 700, fontSize: '15px', color: 'var(--cortex-deep-thought)' }}>
                Session Comparison Mode (A/B Model Diff)
              </span>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block' }}>
                Compare execution duration, model reasoning, cost efficiency, and tool precision side-by-side
              </span>
            </div>
          </div>

          <button className="copy-btn" onClick={onClose} style={{ padding: '6px 10px' }}>
            <X size={15} />
          </button>
        </div>

        {/* Comparison Control Toolbar */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '16px',
            padding: '12px 20px',
            background: 'var(--bg-card)',
            borderBottom: '1px solid var(--cortex-grey-matter-border)'
          }}
        >
          {/* Session A Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="mini-badge mono" style={{ background: 'var(--cortex-synapse-purple)', color: '#ffffff', fontWeight: 700 }}>
              Session A
            </span>
            <select
              value={sessionAId}
              onChange={(e) => setSessionAId(e.target.value)}
              style={{
                flex: 1,
                padding: '6px 10px',
                fontSize: '12px',
                background: 'var(--bg-main)',
                border: '1px solid var(--cortex-grey-matter-border)',
                borderRadius: '6px',
                color: 'var(--cortex-deep-thought)'
              }}
            >
              {conversations.map(c => (
                <option key={c.id} value={c.id}>
                  {c.title ? `${c.title.slice(0, 45)}...` : c.id} ({c.model || 'Unknown model'})
                </option>
              ))}
            </select>
          </div>

          {/* Session B Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="mini-badge mono" style={{ background: 'var(--cortex-cognitive-teal)', color: '#ffffff', fontWeight: 700 }}>
              Session B
            </span>
            <select
              value={sessionBId}
              onChange={(e) => setSessionBId(e.target.value)}
              style={{
                flex: 1,
                padding: '6px 10px',
                fontSize: '12px',
                background: 'var(--bg-main)',
                border: '1px solid var(--cortex-grey-matter-border)',
                borderRadius: '6px',
                color: 'var(--cortex-deep-thought)'
              }}
            >
              <option value="">-- Select session to compare --</option>
              {conversations.map(c => (
                <option key={c.id} value={c.id} disabled={c.id === sessionAId}>
                  {c.title ? `${c.title.slice(0, 45)}...` : c.id} ({c.model || 'Unknown model'})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Delta Telemetry Scorecard */}
        {sessionA && sessionB && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(5, 1fr)',
              gap: '12px',
              padding: '12px 20px',
              background: 'var(--bg-subtle)',
              borderBottom: '1px solid var(--cortex-grey-matter-border)'
            }}
          >
            {/* Metric 1: Model */}
            <div className="stat-card" style={{ padding: '8px 12px' }}>
              <span className="stat-label" style={{ fontSize: '10px' }}>Models</span>
              <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--cortex-deep-thought)', marginTop: '2px' }} className="truncate">
                {sessionA.model || 'A'} vs {sessionB.model || 'B'}
              </div>
            </div>

            {/* Metric 2: Steps Count */}
            <div className="stat-card" style={{ padding: '8px 12px' }}>
              <span className="stat-label" style={{ fontSize: '10px' }}>Steps Count</span>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '2px' }}>
                <span className="mono" style={{ fontSize: '13px', fontWeight: 700 }}>
                  {stepsA} vs {stepsB}
                </span>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    color: stepsA <= stepsB ? '#10b981' : '#f59e0b'
                  }}
                >
                  {stepsA === stepsB ? 'Equal' : stepsA < stepsB ? `A -${stepsB - stepsA}` : `B -${stepsA - stepsB}`}
                </span>
              </div>
            </div>

            {/* Metric 3: Duration */}
            <div className="stat-card" style={{ padding: '8px 12px' }}>
              <span className="stat-label" style={{ fontSize: '10px' }}>Duration</span>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '2px' }}>
                <span className="mono" style={{ fontSize: '12px', fontWeight: 700 }}>
                  {sessionA.durationFormatted} vs {sessionB.durationFormatted}
                </span>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    color: durA <= durB ? '#10b981' : '#f59e0b'
                  }}
                >
                  {durA === durB ? 'Equal' : durA < durB ? 'A Faster' : 'B Faster'}
                </span>
              </div>
            </div>

            {/* Metric 4: Cache Hit Rate */}
            <div className="stat-card" style={{ padding: '8px 12px' }}>
              <span className="stat-label" style={{ fontSize: '10px' }}>Cache Hit Rate</span>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '2px' }}>
                <span className="mono" style={{ fontSize: '13px', fontWeight: 700 }}>
                  {cacheA}% vs {cacheB}%
                </span>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    color: cacheA >= cacheB ? '#10b981' : '#0ea5e9'
                  }}
                >
                  {cacheA === cacheB ? 'Equal' : cacheA > cacheB ? `A +${cacheA - cacheB}%` : `B +${cacheB - cacheA}%`}
                </span>
              </div>
            </div>

            {/* Metric 5: Estimated Cost */}
            <div className="stat-card" style={{ padding: '8px 12px' }}>
              <span className="stat-label" style={{ fontSize: '10px' }}>Estimated Cost</span>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '2px' }}>
                <span className="mono" style={{ fontSize: '13px', fontWeight: 700 }}>
                  ${costA.toFixed(4)} vs ${costB.toFixed(4)}
                </span>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    color: costA <= costB ? '#10b981' : '#f59e0b'
                  }}
                >
                  {costA === costB ? 'Equal' : costA < costB ? `A Saves $${(costB - costA).toFixed(4)}` : `B Saves $${(costA - costB).toFixed(4)}`}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Side-by-Side Dual Execution Timelines */}
        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', overflow: 'hidden' }}>
          {/* Session A Column */}
          <div style={{ borderRight: '1px solid var(--cortex-grey-matter-border)', overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', background: 'var(--bg-main)' }}>
            {loadingA ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>Loading Session A...</div>
            ) : !sessionA ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>Select Session A</div>
            ) : (
              sessionA.steps.map((st, i) => (
                <div
                  key={i}
                  style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--cortex-grey-matter-border)',
                    borderRadius: '8px',
                    padding: '12px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span className="mini-badge mono" style={{ fontSize: '10px' }}>
                      Step #{st.stepIndex} ({st.type})
                    </span>
                    <span className="mono" style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                      {st.createdAt ? new Date(st.createdAt).toLocaleTimeString() : ''}
                    </span>
                  </div>

                  {st.userPrompt && (
                    <div style={{ fontSize: '12px', color: 'var(--cortex-deep-thought)', background: 'var(--bg-subtle)', padding: '8px', borderRadius: '4px' }}>
                      <span style={{ fontWeight: 600 }}>Prompt: </span>
                      {st.userPrompt.requestText}
                    </div>
                  )}

                  {st.thinking && (
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '6px', maxHeight: '120px', overflowY: 'auto', whiteSpace: 'pre-wrap', fontStyle: 'italic', borderLeft: '2px solid var(--cortex-synapse-purple)', paddingLeft: '8px' }}>
                      {st.thinking.slice(0, 300)}...
                    </div>
                  )}

                  {st.toolCalls && st.toolCalls.map((tc, tcIdx) => (
                    <div key={tcIdx} className="mono" style={{ fontSize: '11px', marginTop: '6px', background: 'var(--bg-code)', padding: '6px 8px', borderRadius: '4px', color: '#38bdf8' }}>
                      <span>&gt; {tc.name}</span>
                      {tc.args?.CommandLine && <div style={{ color: 'var(--text-muted)', fontSize: '10px' }}>$ {tc.args.CommandLine}</div>}
                    </div>
                  ))}

                  {st.assistantResponse && (
                    <div style={{ fontSize: '11px', color: 'var(--cortex-deep-thought)', marginTop: '6px', maxHeight: '120px', overflowY: 'auto' }}>
                      {st.assistantResponse.slice(0, 300)}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Session B Column */}
          <div style={{ overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', background: 'var(--bg-main)' }}>
            {loadingB ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>Loading Session B...</div>
            ) : !sessionB ? (
              <div style={{ padding: '60px', textAlign: 'center', color: '#64748b' }}>
                <GitCompare size={36} color="var(--border-subtle)" style={{ margin: '0 auto 12px auto', display: 'block' }} />
                <p>Select Session B above to compare side-by-side.</p>
              </div>
            ) : (
              sessionB.steps.map((st, i) => (
                <div
                  key={i}
                  style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--cortex-grey-matter-border)',
                    borderRadius: '8px',
                    padding: '12px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span className="mini-badge mono" style={{ fontSize: '10px', background: 'var(--cortex-cognitive-teal-bg)', color: 'var(--cortex-cognitive-teal)' }}>
                      Step #{st.stepIndex} ({st.type})
                    </span>
                    <span className="mono" style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                      {st.createdAt ? new Date(st.createdAt).toLocaleTimeString() : ''}
                    </span>
                  </div>

                  {st.userPrompt && (
                    <div style={{ fontSize: '12px', color: 'var(--cortex-deep-thought)', background: 'var(--bg-subtle)', padding: '8px', borderRadius: '4px' }}>
                      <span style={{ fontWeight: 600 }}>Prompt: </span>
                      {st.userPrompt.requestText}
                    </div>
                  )}

                  {st.thinking && (
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '6px', maxHeight: '120px', overflowY: 'auto', whiteSpace: 'pre-wrap', fontStyle: 'italic', borderLeft: '2px solid var(--cortex-cognitive-teal)', paddingLeft: '8px' }}>
                      {st.thinking.slice(0, 300)}...
                    </div>
                  )}

                  {st.toolCalls && st.toolCalls.map((tc, tcIdx) => (
                    <div key={tcIdx} className="mono" style={{ fontSize: '11px', marginTop: '6px', background: 'var(--bg-code)', padding: '6px 8px', borderRadius: '4px', color: '#38bdf8' }}>
                      <span>&gt; {tc.name}</span>
                      {tc.args?.CommandLine && <div style={{ color: 'var(--text-muted)', fontSize: '10px' }}>$ {tc.args.CommandLine}</div>}
                    </div>
                  ))}

                  {st.assistantResponse && (
                    <div style={{ fontSize: '11px', color: 'var(--cortex-deep-thought)', marginTop: '6px', maxHeight: '120px', overflowY: 'auto' }}>
                      {st.assistantResponse.slice(0, 300)}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Footer */}
        <div
          className="modal-footer"
          style={{
            padding: '12px 20px',
            borderTop: '1px solid var(--cortex-grey-matter-border)',
            display: 'flex',
            justifyContent: 'flex-end'
          }}
        >
          <button className="metric-pill" onClick={onClose}>
            Close (Esc)
          </button>
        </div>
      </div>
    </div>
  );
};
