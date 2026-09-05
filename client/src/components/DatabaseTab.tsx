import React, { useState, useEffect } from 'react';
import {
  Database,
  Table,
  Key,
  Layers,
  ChevronLeft,
  ChevronRight,
  Copy,
  Check,
  Code2,
  FileText,
  Binary,
  User,
  Terminal,
  Bot,
  CheckCircle2,
  AlertCircle,
  Clock,
  Search
} from 'lucide-react';
import JsonView from '@uiw/react-json-view';
import { lightTheme } from '@uiw/react-json-view/light';
import { vscodeTheme } from '@uiw/react-json-view/vscode';
import { DatabaseInfo, FormattedBlob } from '../types/index.js';
import { fetchTableRows } from '../api/index.js';

interface DatabaseTabProps {
  conversationId: string;
  dbInfo: DatabaseInfo;
  isRightPanelOpen?: boolean;
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes === 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function renderStepType(typeVal: number) {
  switch (typeVal) {
    case 14:
      return (
        <span className="mini-badge" style={{ background: 'rgba(6, 182, 212, 0.15)', color: '#06b6d4', display: 'inline-flex', alignItems: 'center', gap: '3px' }} title="User Input / Prompt (type 14)">
          <User size={10} />
          Prompt
        </span>
      );
    case 8:
      return (
        <span className="mini-badge" style={{ background: 'rgba(168, 85, 247, 0.15)', color: '#a855f7', display: 'inline-flex', alignItems: 'center', gap: '3px' }} title="Tool Call / Action (type 8)">
          <Terminal size={10} />
          Tool Call
        </span>
      );
    case 15:
      return (
        <span className="mini-badge" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', display: 'inline-flex', alignItems: 'center', gap: '3px' }} title="Assistant Model Response (type 15)">
          <Bot size={10} />
          Assistant
        </span>
      );
    case 9:
      return (
        <span className="mini-badge" style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6', display: 'inline-flex', alignItems: 'center', gap: '3px' }} title="Tool Output / Result (type 9)">
          <CheckCircle2 size={10} />
          Result
        </span>
      );
    case 98:
      return (
        <span className="mini-badge" style={{ background: 'rgba(148, 163, 184, 0.15)', color: '#94a3b8' }} title="Turn Start Delimiter (type 98)">
          Turn Start
        </span>
      );
    case 99:
      return (
        <span className="mini-badge" style={{ background: 'rgba(148, 163, 184, 0.15)', color: '#94a3b8' }} title="Turn End Delimiter (type 99)">
          Turn End
        </span>
      );
    case 23:
      return (
        <span className="mini-badge" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', display: 'inline-flex', alignItems: 'center', gap: '3px' }} title="Heartbeat / Liveness Ping (type 23)">
          <Clock size={10} />
          Heartbeat
        </span>
      );
    default:
      return <span className="mono" style={{ fontSize: '11px', color: '#94a3b8' }}>{typeVal}</span>;
  }
}

function renderStatus(statusVal: number) {
  switch (statusVal) {
    case 3:
      return (
        <span className="mini-badge" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', display: 'inline-flex', alignItems: 'center', gap: '3px' }} title="Status: Completed (3)">
          <CheckCircle2 size={10} />
          Done
        </span>
      );
    case 4:
      return (
        <span className="mini-badge" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', display: 'inline-flex', alignItems: 'center', gap: '3px' }} title="Status: Failed / Error (4)">
          <AlertCircle size={10} />
          Error
        </span>
      );
    case 1:
      return (
        <span className="mini-badge" style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa' }} title="Status: Running (1)">
          Running
        </span>
      );
    default:
      return <span className="mono" style={{ fontSize: '11px', color: '#94a3b8' }}>{statusVal}</span>;
  }
}

export const DatabaseTab: React.FC<DatabaseTabProps> = ({
  conversationId,
  dbInfo,
  isRightPanelOpen = true
}) => {
  const [selectedTable, setSelectedTable] = useState<string>('');
  const [rows, setRows] = useState<any[]>([]);
  const [totalRows, setTotalRows] = useState<number>(0);
  const [page, setPage] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [activeBlobModal, setActiveBlobModal] = useState<{ col: string; rowIdx: number; blob: FormattedBlob } | null>(null);
  const [modalTab, setModalTab] = useState<'decoded' | 'text' | 'hex'>('decoded');
  const [modalFilter, setModalFilter] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);

  const pageSize = 25;

  useEffect(() => {
    if (dbInfo.tables && dbInfo.tables.length > 0) {
      const defaultTable = dbInfo.tables.find(t => t.rowCount > 0)?.name || dbInfo.tables[0].name;
      setSelectedTable(defaultTable);
      setPage(0);
    }
  }, [dbInfo]);

  useEffect(() => {
    if (!selectedTable) return;
    loadRows(selectedTable, page);
  }, [selectedTable, page, conversationId]);

  useEffect(() => {
    if (activeBlobModal) {
      if (activeBlobModal.blob.parsedJson) {
        setModalTab('decoded');
      } else if (activeBlobModal.blob.extractedStrings && activeBlobModal.blob.extractedStrings.length > 0) {
        setModalTab('text');
      } else {
        setModalTab('hex');
      }
      setModalFilter('');
      setCopied(false);
    }
  }, [activeBlobModal]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && activeBlobModal) {
        setActiveBlobModal(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeBlobModal]);

  const loadRows = async (table: string, p: number) => {
    setLoading(true);
    try {
      const res = await fetchTableRows(conversationId, table, {
        limit: pageSize,
        offset: p * pageSize
      });
      setRows(res.rows);
      setTotalRows(res.total);
    } catch (err) {
      console.error('Error loading table rows:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!activeBlobModal) return;
    let textToCopy = '';
    if (modalTab === 'decoded') {
      textToCopy = JSON.stringify(activeBlobModal.blob.parsedJson || activeBlobModal.blob.summary, null, 2);
    } else if (modalTab === 'text') {
      textToCopy = (activeBlobModal.blob.extractedStrings || []).join('\n') || activeBlobModal.blob.textPreview || '';
    } else {
      textToCopy = activeBlobModal.blob.hex || '';
    }
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const currentTableObj = dbInfo.tables.find(t => t.name === selectedTable);
  const columns = currentTableObj?.columns || [];
  const maxPages = Math.ceil(totalRows / pageSize);

  if (!dbInfo.exists) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#64748b', gap: '12px' }}>
        <Database size={40} color="#334155" />
        <p>No SQLite database file found for this conversation session.</p>
        <span className="mono" style={{ fontSize: '11px', color: '#475569' }}>{dbInfo.dbPath}</span>
      </div>
    );
  }

  return (
    <div className="db-view">
      <div className="db-main-panel">
        {/* Table schema summary bar */}
        <div className="db-table-toolbar">
          <div className="db-table-title">
            <span className="mono">{selectedTable}</span>
            <span className="db-table-count">({totalRows} total rows)</span>
          </div>

          <div className="db-pagination">
            <button
              className="copy-btn"
              disabled={page === 0}
              onClick={() => setPage(page - 1)}
              style={{ opacity: page === 0 ? 0.4 : 1 }}
              title="Previous page"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="db-pagination-text">
              Page {page + 1} of {Math.max(1, maxPages)}
            </span>
            <button
              className="copy-btn"
              disabled={page >= maxPages - 1}
              onClick={() => setPage(page + 1)}
              style={{ opacity: page >= maxPages - 1 ? 0.4 : 1 }}
              title="Next page"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        {/* Column schema list tag row */}
        <div className="db-schema-bar">
          <span className="db-schema-label">Schema:</span>
          {columns.map((c) => (
            <span key={c.name} className="db-schema-badge mono">
              {c.pk > 0 && <Key size={9} color="#f59e0b" style={{ marginRight: '2px' }} />}
              <span className="db-schema-name">{c.name}</span>: <span className="db-schema-type">{c.type || 'ANY'}</span>
            </span>
          ))}
        </div>

        {/* Table data grid */}
        <div className="db-grid-container">
          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
              Querying table records...
            </div>
          ) : rows.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
              Table is empty.
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  {columns.map((c) => (
                    <th key={c.name} style={c.type === 'BLOB' ? { minWidth: '220px' } : undefined}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        {c.pk > 0 && <Key size={10} color="#f59e0b" />}
                        <span>{c.name}</span>
                        {c.type && (
                          <span style={{ fontSize: '9px', opacity: 0.5, fontWeight: 'normal' }}>
                            ({c.type})
                          </span>
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, rowIdx) => (
                  <tr key={rowIdx}>
                    {columns.map((col) => {
                      const val = row[col.name];
                      if (val && typeof val === 'object' && val.__isBlob) {
                        const blob = val as FormattedBlob;
                        const kind = blob.kind || 'binary';
                        let badgeColor = '#94a3b8';
                        let badgeBg = 'rgba(148, 163, 184, 0.15)';
                        let tagLabel = 'BIN';

                        if (kind === 'json') {
                          badgeColor = '#10b981';
                          badgeBg = 'rgba(16, 185, 129, 0.15)';
                          tagLabel = 'JSON';
                        } else if (kind === 'protobuf') {
                          badgeColor = '#a855f7';
                          badgeBg = 'rgba(168, 85, 247, 0.15)';
                          tagLabel = 'PROTO';
                        } else if (kind === 'text') {
                          badgeColor = '#0ea5e9';
                          badgeBg = 'rgba(14, 165, 233, 0.15)';
                          tagLabel = 'TEXT';
                        }

                        const displayText = blob.summary || (blob.textPreview ? blob.textPreview.slice(0, 80) : `${blob.size} bytes`);

                        return (
                          <td key={col.name} style={{ maxWidth: '440px' }}>
                            <div
                              className="db-blob-cell"
                              onClick={() => setActiveBlobModal({ col: col.name, rowIdx, blob })}
                              title={`${col.name} (${blob.size} bytes) - Click to inspect full decoded content\n\n${blob.summary || ''}`}
                            >
                              <span className="db-blob-tag mono" style={{ background: badgeBg, color: badgeColor }}>
                                {tagLabel}
                              </span>
                              <span className="db-blob-summary truncate">
                                {displayText}
                              </span>
                              <span className="db-blob-size mono">
                                {formatBytes(blob.size)}
                              </span>
                            </div>
                          </td>
                        );
                      }

                      if (selectedTable === 'steps' && col.name === 'step_type' && typeof val === 'number') {
                        return (
                          <td key={col.name} title={`step_type: ${val}`}>
                            {renderStepType(val)}
                          </td>
                        );
                      }

                      if (selectedTable === 'steps' && col.name === 'status' && typeof val === 'number') {
                        return (
                          <td key={col.name} title={`status: ${val}`}>
                            {renderStatus(val)}
                          </td>
                        );
                      }

                      return (
                        <td key={col.name} title={String(val)}>
                          {val === null || val === undefined ? (
                            <span style={{ color: '#475569', fontStyle: 'italic' }}>NULL</span>
                          ) : (
                            String(val)
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {isRightPanelOpen && (
        <div className="db-sidebar">
          <div className="db-sidebar-header">
            <div className="db-sidebar-title">
              <Database size={15} color="var(--cortex-synapse-purple)" />
              <span>SQLite Tables ({dbInfo.tables.length})</span>
            </div>
            <span className="db-sidebar-sub mono truncate" title={dbInfo.dbPath}>
              {dbInfo.dbPath.split(/[\\/]/).pop()}
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {dbInfo.tables.map((t) => {
              const isActive = t.name === selectedTable;
              return (
                <button
                  key={t.name}
                  className={`db-table-btn ${isActive ? 'active' : ''}`}
                  onClick={() => {
                    setSelectedTable(t.name);
                    setPage(0);
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Table size={13} color={isActive ? 'var(--cortex-synapse-purple)' : 'var(--text-muted)'} />
                    <span className="mono">{t.name}</span>
                  </div>
                  <span className="mini-badge mono" style={{ background: t.rowCount > 0 ? 'var(--cortex-cognitive-teal-bg)' : 'var(--bg-subtle)', color: t.rowCount > 0 ? 'var(--cortex-cognitive-teal)' : 'var(--text-muted)' }}>
                    {t.rowCount}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Enhanced Multi-Tab Blob Inspection Modal */}
      {activeBlobModal && (() => {
        const { col, rowIdx, blob } = activeBlobModal;
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        const strings = blob.extractedStrings || (blob.textPreview ? blob.textPreview.split('\n') : []);
        const filteredStrings = modalFilter.trim()
          ? strings.filter(s => s.toLowerCase().includes(modalFilter.toLowerCase()))
          : strings;

        return (
          <div className="modal-backdrop" onClick={() => setActiveBlobModal(null)}>
            <div
              className="modal-dialog"
              onClick={(e) => e.stopPropagation()}
              style={{ maxWidth: '820px', width: '92%', maxHeight: '88vh', display: 'flex', flexDirection: 'column' }}
            >
              {/* Header */}
              <div className="modal-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Layers size={18} color="var(--cortex-synapse-purple)" />
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontWeight: 700, fontSize: '14px', color: 'var(--cortex-deep-thought)' }}>
                        {selectedTable}.{col}
                      </span>
                      <span className="mini-badge mono" style={{ fontSize: '10px' }}>
                        Row #{rowIdx + page * pageSize}
                      </span>
                      <span className="mini-badge mono" style={{ fontSize: '10px', background: 'var(--cortex-cognitive-teal-bg)', color: 'var(--cortex-cognitive-teal)' }}>
                        {formatBytes(blob.size)} ({blob.size} bytes)
                      </span>
                    </div>
                    {blob.summary && (
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px', maxWidth: '540px' }} className="truncate">
                        {blob.summary}
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    className="copy-btn"
                    onClick={handleCopy}
                    title="Copy current tab view content to clipboard"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '5px 10px', fontSize: '11px' }}
                  >
                    {copied ? <Check size={13} color="#10b981" /> : <Copy size={13} />}
                    <span>{copied ? 'Copied!' : 'Copy View'}</span>
                  </button>
                  <button
                    className="copy-btn"
                    onClick={() => setActiveBlobModal(null)}
                    style={{ padding: '5px 10px', fontSize: '11px' }}
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* Modal Navigation Tabs */}
              <div className="db-modal-tabs">
                <button
                  className={`db-modal-tab-btn ${modalTab === 'decoded' ? 'active' : ''}`}
                  onClick={() => setModalTab('decoded')}
                  disabled={!blob.parsedJson}
                  style={{ opacity: blob.parsedJson ? 1 : 0.4 }}
                >
                  <Code2 size={14} />
                  <span>Decoded Structure {blob.parsedJson ? '(JSON/Proto)' : ''}</span>
                </button>

                <button
                  className={`db-modal-tab-btn ${modalTab === 'text' ? 'active' : ''}`}
                  onClick={() => setModalTab('text')}
                >
                  <FileText size={14} />
                  <span>Extracted Strings ({strings.length})</span>
                </button>

                <button
                  className={`db-modal-tab-btn ${modalTab === 'hex' ? 'active' : ''}`}
                  onClick={() => setModalTab('hex')}
                >
                  <Binary size={14} />
                  <span>Hex Dump</span>
                </button>
              </div>

              {/* Modal Body */}
              <div className="modal-body" style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {modalTab === 'decoded' && (
                  blob.parsedJson ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', height: '100%' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                          Interactive Object Tree (Generic Wire Decoded):
                        </span>
                        <span className="mini-badge mono" style={{ fontSize: '10px', background: 'rgba(168, 85, 247, 0.15)', color: '#c084fc' }}>
                          {blob.kind?.toUpperCase() || 'STRUCTURED'}
                        </span>
                      </div>
                      <div style={{ background: 'var(--bg-card)', padding: '14px', borderRadius: '8px', border: '1px solid var(--cortex-grey-matter-border)', overflowY: 'auto', maxHeight: '420px' }}>
                        <JsonView
                          value={blob.parsedJson}
                          style={isDark ? vscodeTheme : lightTheme}
                          collapsed={2}
                          displayDataTypes={true}
                          displayObjectSize={true}
                          enableClipboard={true}
                          indentWidth={18}
                        />
                      </div>
                    </div>
                  ) : (
                    <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      No structured JSON or Protobuf payload decoded for this BLOB.
                    </div>
                  )
                )}

                {modalTab === 'text' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1 }}>
                        <div style={{ position: 'relative', width: '100%', maxWidth: '300px' }}>
                          <Search size={13} style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                          <input
                            type="text"
                            placeholder="Filter strings..."
                            value={modalFilter}
                            onChange={(e) => setModalFilter(e.target.value)}
                            style={{ width: '100%', padding: '4px 8px 4px 26px', fontSize: '11px', background: 'var(--bg-main)', border: '1px solid var(--cortex-grey-matter-border)', borderRadius: '4px', color: 'var(--cortex-deep-thought)' }}
                          />
                        </div>
                      </div>
                      <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                        Showing {filteredStrings.length} of {strings.length} string segments
                      </span>
                    </div>

                    <div style={{ background: 'var(--bg-code)', borderRadius: '8px', border: '1px solid var(--cortex-grey-matter-border)', maxHeight: '400px', overflowY: 'auto', padding: '8px' }}>
                      {filteredStrings.length === 0 ? (
                        <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
                          No matching strings found.
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          {filteredStrings.map((str, i) => (
                            <div
                              key={i}
                              className="mono"
                              style={{
                                fontSize: '11px',
                                padding: '6px 10px',
                                borderRadius: '4px',
                                background: 'var(--bg-card)',
                                color: 'var(--cortex-deep-thought)',
                                whiteSpace: 'pre-wrap',
                                wordBreak: 'break-word',
                                lineHeight: '1.5',
                                border: '1px solid rgba(255,255,255,0.03)'
                              }}
                            >
                              <span style={{ color: 'var(--text-muted)', marginRight: '8px', userSelect: 'none', fontSize: '10px' }}>
                                #{i + 1}
                              </span>
                              {str}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {modalTab === 'hex' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                        Hexadecimal Byte Stream (First 64+ bytes):
                      </span>
                      <span className="mono" style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                        Total {blob.size} bytes
                      </span>
                    </div>
                    <pre
                      className="mono"
                      style={{
                        background: 'var(--bg-code)',
                        padding: '14px',
                        borderRadius: '8px',
                        fontSize: '11px',
                        color: 'var(--cortex-cognitive-teal)',
                        whiteSpace: 'pre-wrap',
                        border: '1px solid var(--cortex-grey-matter-border)',
                        maxHeight: '380px',
                        overflowY: 'auto',
                        lineHeight: '1.6'
                      }}
                    >
                      {blob.hex}
                    </pre>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="modal-footer" style={{ padding: '12px 20px', borderTop: '1px solid var(--cortex-grey-matter-border)', display: 'flex', justifyContent: 'flex-end' }}>
                <button className="metric-pill" onClick={() => setActiveBlobModal(null)}>
                  Close (Esc)
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
