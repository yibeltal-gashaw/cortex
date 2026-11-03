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
  Search,
  Play,
  Download,
  RotateCcw,
  Sparkles,
  Globe,
  PanelLeftClose,
  PanelLeftOpen
} from 'lucide-react';
import JsonView from '@uiw/react-json-view';
import { lightTheme } from '@uiw/react-json-view/light';
import { vscodeTheme } from '@uiw/react-json-view/vscode';
import { DatabaseInfo, FormattedBlob, SqlQueryResult } from '../types/index.js';
import { fetchTableRows, fetchDatabaseInfo, executeSqlQuery } from '../api/index.js';

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

function downloadCsv(columns: string[], rows: any[], filename = 'cortex-query-results.csv') {
  const header = columns.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',');
  const rowLines = rows.map(r => {
    return columns.map(c => {
      const val = r[c];
      if (val === null || val === undefined) return '""';
      if (typeof val === 'object') return `"${JSON.stringify(val).replace(/"/g, '""')}"`;
      return `"${String(val).replace(/"/g, '""')}"`;
    }).join(',');
  });
  const csvContent = [header, ...rowLines].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
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
  dbInfo: initialDbInfo
}) => {
  const [isTableListCollapsed, setIsTableListCollapsed] = useState<boolean>(false);
  const [currentDbInfo, setCurrentDbInfo] = useState<DatabaseInfo>(initialDbInfo);
  const [isGlobalMode, setIsGlobalMode] = useState<boolean>(Boolean(initialDbInfo.isGlobal));
  const [viewMode, setViewMode] = useState<'table' | 'sql'>('table');

  // Table viewer state
  const [selectedTable, setSelectedTable] = useState<string>('');
  const [rows, setRows] = useState<any[]>([]);
  const [totalRows, setTotalRows] = useState<number>(0);
  const [page, setPage] = useState<number>(0);
  const [tableSearch, setTableSearch] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [activeBlobModal, setActiveBlobModal] = useState<{ col: string; rowIdx: number; blob: FormattedBlob } | null>(null);
  const [modalTab, setModalTab] = useState<'decoded' | 'text' | 'hex'>('decoded');
  const [modalFilter, setModalFilter] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);

  // SQL console state
  const [sqlQuery, setSqlQuery] = useState<string>('');
  const [sqlResult, setSqlResult] = useState<SqlQueryResult | null>(null);
  const [sqlLoading, setSqlLoading] = useState<boolean>(false);
  const [sqlError, setSqlError] = useState<string | null>(null);
  const [switchingDb, setSwitchingDb] = useState<boolean>(false);

  const pageSize = 25;

  useEffect(() => {
    setCurrentDbInfo(initialDbInfo);
    setIsGlobalMode(Boolean(initialDbInfo.isGlobal));
  }, [initialDbInfo]);

  useEffect(() => {
    if (currentDbInfo.tables && currentDbInfo.tables.length > 0) {
      const defaultTable = currentDbInfo.tables.find(t => t.rowCount > 0)?.name || currentDbInfo.tables[0].name;
      setSelectedTable(defaultTable);
      setPage(0);
      setSqlQuery(`SELECT * FROM ${defaultTable} LIMIT 25;`);
    } else {
      setSelectedTable('');
      setRows([]);
      setTotalRows(0);
    }
  }, [currentDbInfo]);

  useEffect(() => {
    if (!selectedTable || viewMode !== 'table') return;
    loadRows(selectedTable, page, tableSearch);
  }, [selectedTable, page, conversationId, isGlobalMode, viewMode]);

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

  const toggleDbSource = async (targetGlobal: boolean) => {
    if (targetGlobal === isGlobalMode || switchingDb) return;
    setSwitchingDb(true);
    try {
      const freshInfo = await fetchDatabaseInfo(conversationId, targetGlobal);
      setCurrentDbInfo(freshInfo);
      setIsGlobalMode(targetGlobal);
    } catch (err) {
      console.error('Failed to switch database source:', err);
    } finally {
      setSwitchingDb(false);
    }
  };

  const loadRows = async (table: string, p: number, search?: string) => {
    setLoading(true);
    try {
      const res = await fetchTableRows(conversationId, table, {
        limit: pageSize,
        offset: p * pageSize,
        search: search?.trim() || undefined,
        isGlobal: isGlobalMode
      });
      setRows(res.rows);
      setTotalRows(res.total);
    } catch (err) {
      console.error('Error loading table rows:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(0);
    loadRows(selectedTable, 0, tableSearch);
  };

  const handleRunQuery = async () => {
    if (!sqlQuery.trim() || sqlLoading) return;
    setSqlLoading(true);
    setSqlError(null);
    try {
      const result = await executeSqlQuery(conversationId, sqlQuery, isGlobalMode);
      if (!result.success) {
        setSqlError(result.error || 'Query failed');
        setSqlResult(null);
      } else {
        setSqlResult(result);
        setSqlError(null);
      }
    } catch (err: any) {
      setSqlError(err.message || 'Error executing query');
      setSqlResult(null);
    } finally {
      setSqlLoading(false);
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

  const currentTableObj = currentDbInfo.tables?.find(t => t.name === selectedTable);
  const columns = currentTableObj?.columns || [];
  const maxPages = Math.ceil(totalRows / pageSize);

  if (!currentDbInfo.exists) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#64748b', gap: '12px' }}>
        <Database size={40} color="#334155" />
        <p>No SQLite database file found for this session.</p>
        <span className="mono" style={{ fontSize: '11px', color: '#475569' }}>{currentDbInfo.dbPath}</span>
      </div>
    );
  }

  return (
    <div className="db-view">
      {/* 1. Left Sidebar: Table List (Collapsible) */}
      {!isTableListCollapsed && (
        <div className="db-sidebar">
          <div className="db-sidebar-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div className="db-sidebar-title">
                <Database size={14} color="var(--cortex-synapse-purple)" />
                <span>SQLite Tables ({currentDbInfo.tables?.length || 0})</span>
              </div>
              <span className="db-sidebar-sub mono truncate" title={currentDbInfo.dbPath}>
                {currentDbInfo.dbPath.split(/[\\/]/).pop()}
              </span>
            </div>
            <button
              className="hud-action-icon-btn"
              style={{ width: '24px', height: '24px', padding: 0, flexShrink: 0 }}
              onClick={() => setIsTableListCollapsed(true)}
              title="Collapse Table List"
              aria-label="Collapse Table List"
            >
              <PanelLeftClose size={13} />
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {currentDbInfo.tables?.map((t) => {
              const isActive = t.name === selectedTable;
              return (
                <button
                  key={t.name}
                  className={`db-table-btn ${isActive ? 'active' : ''}`}
                  onClick={() => {
                    setSelectedTable(t.name);
                    setPage(0);
                    if (viewMode === 'sql') {
                      setSqlQuery(`SELECT * FROM ${t.name} LIMIT 25;`);
                    }
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

      {/* 2. Main Panel */}
      <div className="db-main-panel">
        {/* Top Control Bar: Mode Selector & Source Switcher */}
        <div className="db-table-toolbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {isTableListCollapsed && (
              <button
                className="metric-pill"
                onClick={() => setIsTableListCollapsed(false)}
                title="Expand SQLite Table List"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '11px', padding: '4px 8px' }}
              >
                <PanelLeftOpen size={13} />
                <span>Tables ({currentDbInfo.tables?.length || 0})</span>
              </button>
            )}

            <div className="db-mode-selector">
              <button
                className={`db-mode-btn ${viewMode === 'table' ? 'active' : ''}`}
                onClick={() => setViewMode('table')}
              >
                <Table size={13} />
                <span>Table Viewer</span>
              </button>
              <button
                className={`db-mode-btn ${viewMode === 'sql' ? 'active' : ''}`}
                onClick={() => {
                  setViewMode('sql');
                  if (!sqlQuery) {
                    setSqlQuery(`SELECT * FROM ${selectedTable || 'conversations'} LIMIT 25;`);
                  }
                }}
              >
                <Terminal size={13} />
                <span>SQL Console</span>
              </button>
            </div>

            {/* DB Source Badge & Toggle */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span
                className="mini-badge"
                style={{
                  background: isGlobalMode ? 'rgba(16, 185, 129, 0.15)' : 'rgba(168, 85, 247, 0.15)',
                  color: isGlobalMode ? '#10b981' : '#a855f7',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '3px 8px',
                  fontSize: '11px'
                }}
                title={currentDbInfo.dbPath}
              >
                {isGlobalMode ? <Globe size={11} /> : <Database size={11} />}
                <span>{isGlobalMode ? 'Global DB (conversation_summaries.db)' : 'Session DB'}</span>
              </span>

              {currentDbInfo.hasBoth && (
                <button
                  className="copy-btn"
                  onClick={() => toggleDbSource(!isGlobalMode)}
                  disabled={switchingDb}
                  style={{ fontSize: '11px', padding: '3px 8px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                  title="Toggle between session-specific database and global Antigravity database"
                >
                  <RotateCcw size={11} className={switchingDb ? 'spin-icon' : ''} />
                  <span>Switch to {isGlobalMode ? 'Session DB' : 'Global DB'}</span>
                </button>
              )}
            </div>
          </div>

          {viewMode === 'table' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {/* Row Search Filter */}
              <form onSubmit={handleSearchSubmit} style={{ display: 'flex', alignItems: 'center', position: 'relative' }}>
                <Search size={12} style={{ position: 'absolute', left: '8px', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  placeholder="Filter rows..."
                  value={tableSearch}
                  onChange={(e) => setTableSearch(e.target.value)}
                  style={{
                    padding: '4px 8px 4px 24px',
                    fontSize: '11px',
                    background: 'var(--bg-main)',
                    border: '1px solid var(--cortex-grey-matter-border)',
                    borderRadius: '4px',
                    color: 'var(--cortex-deep-thought)',
                    width: '160px'
                  }}
                />
              </form>

              {/* Pagination */}
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
                <span className="db-pagination-text mono">
                  {page + 1} / {Math.max(1, maxPages)}
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
          )}
        </div>

        {/* View Mode 1: Table Viewer */}
        {viewMode === 'table' && (
          <>
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
                  {tableSearch ? 'No rows match filter criteria.' : 'Table is empty.'}
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
          </>
        )}

        {/* View Mode 2: Ad-Hoc SQL Query Console */}
        {viewMode === 'sql' && (
          <div className="db-sql-container">
            {/* Editor Panel */}
            <div className="db-sql-editor-panel">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div className="db-sql-chips">
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <Sparkles size={11} color="var(--cortex-synapse-purple)" />
                    Templates:
                  </span>
                  <button
                    className="db-sql-chip"
                    onClick={() => setSqlQuery(`SELECT * FROM ${selectedTable || 'conversations'} LIMIT 25;`)}
                  >
                    Select {selectedTable || 'conversations'}
                  </button>
                  <button
                    className="db-sql-chip"
                    onClick={() => setSqlQuery(`SELECT count(*) as total_rows FROM ${selectedTable || 'conversations'};`)}
                  >
                    Count rows
                  </button>
                  <button
                    className="db-sql-chip"
                    onClick={() => setSqlQuery(`SELECT type, name, sql FROM sqlite_master WHERE type='table';`)}
                  >
                    List schema
                  </button>
                  <button
                    className="db-sql-chip"
                    onClick={() => setSqlQuery(`PRAGMA table_info(${selectedTable || 'conversations'});`)}
                  >
                    Pragma columns
                  </button>
                </div>

                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  Press <kbd className="mono" style={{ background: 'var(--bg-subtle)', padding: '2px 4px', borderRadius: '3px' }}>Ctrl+Enter</kbd> to run
                </span>
              </div>

              <textarea
                className="db-sql-textarea"
                value={sqlQuery}
                onChange={(e) => setSqlQuery(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                    e.preventDefault();
                    handleRunQuery();
                  }
                }}
                placeholder="Enter SQL statement (e.g. SELECT * FROM conversations LIMIT 25;)"
                spellCheck={false}
              />

              <div className="db-sql-actions">
                <button
                  className="metric-pill"
                  onClick={() => setSqlQuery('')}
                  style={{ fontSize: '11px' }}
                >
                  Clear Editor
                </button>

                <button
                  className="metric-pill"
                  onClick={handleRunQuery}
                  disabled={sqlLoading || !sqlQuery.trim()}
                  style={{
                    background: 'var(--cortex-synapse-purple)',
                    color: '#ffffff',
                    fontWeight: 600,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <Play size={13} fill={sqlLoading ? 'none' : 'currentColor'} />
                  <span>{sqlLoading ? 'Executing...' : 'Run Query (Ctrl+Enter)'}</span>
                </button>
              </div>
            </div>

            {/* Error Message */}
            {sqlError && (
              <div style={{ padding: '12px 20px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', borderBottom: '1px solid rgba(239, 68, 68, 0.2)', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertCircle size={15} />
                <span className="mono">{sqlError}</span>
              </div>
            )}

            {/* SQL Results Panel */}
            <div className="db-sql-result-panel">
              {sqlResult && (
                <>
                  <div className="db-sql-status-bar">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span className="mini-badge" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}>
                        ✓ {sqlResult.rowCount} rows returned
                      </span>
                      <span className="mono" style={{ color: 'var(--text-muted)' }}>
                        Execution time: {sqlResult.durationMs}ms
                      </span>
                    </div>

                    {sqlResult.rows.length > 0 && (
                      <button
                        className="copy-btn"
                        onClick={() => downloadCsv(sqlResult.columns, sqlResult.rows)}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '11px', padding: '4px 8px' }}
                        title="Download query results as CSV"
                      >
                        <Download size={12} />
                        <span>Export CSV</span>
                      </button>
                    )}
                  </div>

                  <div className="db-grid-container">
                    {sqlResult.rows.length === 0 ? (
                      <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
                        Query executed successfully. 0 rows returned.
                      </div>
                    ) : (
                      <table className="data-table">
                        <thead>
                          <tr>
                            {sqlResult.columns.map((c) => (
                              <th key={c}>
                                <span>{c}</span>
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {sqlResult.rows.map((row, rIdx) => (
                            <tr key={rIdx}>
                              {sqlResult.columns.map((col) => {
                                const val = row[col];
                                return (
                                  <td key={col} title={typeof val === 'object' ? JSON.stringify(val) : String(val)}>
                                    {val === null || val === undefined ? (
                                      <span style={{ color: '#475569', fontStyle: 'italic' }}>NULL</span>
                                    ) : typeof val === 'object' ? (
                                      <span className="mono" style={{ fontSize: '11px' }}>{JSON.stringify(val)}</span>
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
                </>
              )}

              {!sqlResult && !sqlError && (
                <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                  <Code2 size={36} color="var(--border-subtle)" />
                  <p style={{ fontSize: '13px' }}>Run a query above to inspect custom SQLite projections and aggregations.</p>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Only read-only queries (SELECT, PRAGMA, EXPLAIN) are permitted.</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Multi-Tab Blob Inspection Modal */}
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
