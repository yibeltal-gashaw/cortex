import React, { useState, useEffect } from 'react';
import { Database, Table, Key, Layers, ChevronLeft, ChevronRight } from 'lucide-react';
import JsonView from '@uiw/react-json-view';
import { lightTheme } from '@uiw/react-json-view/light';
import { vscodeTheme } from '@uiw/react-json-view/vscode';
import { DatabaseInfo, FormattedBlob } from '../types/index.js';
import { fetchTableRows } from '../api/index.js';

interface DatabaseTabProps {
  conversationId: string;
  dbInfo: DatabaseInfo;
}

export const DatabaseTab: React.FC<DatabaseTabProps> = ({
  conversationId,
  dbInfo
}) => {
  const [selectedTable, setSelectedTable] = useState<string>('');
  const [rows, setRows] = useState<any[]>([]);
  const [totalRows, setTotalRows] = useState<number>(0);
  const [page, setPage] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [activeBlobModal, setActiveBlobModal] = useState<{ col: string; blob: FormattedBlob } | null>(null);

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
      <div className="db-sidebar">
        <div style={{ padding: '6px 8px 10px 8px', borderBottom: '1px solid var(--border-subtle)', marginBottom: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#f8fafc', fontWeight: 600, fontSize: '13px' }}>
            <Database size={15} color="#3b82f6" />
            <span>SQLite Tables ({dbInfo.tables.length})</span>
          </div>
          <span className="mono truncate" style={{ fontSize: '10px', color: '#64748b', marginTop: '4px', display: 'block' }}>
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
                  <Table size={13} color={isActive ? '#60a5fa' : '#64748b'} />
                  <span className="mono">{t.name}</span>
                </div>
                <span className="mini-badge mono" style={{ background: t.rowCount > 0 ? 'rgba(59, 130, 246, 0.2)' : 'rgba(255,255,255,0.05)' }}>
                  {t.rowCount}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="db-main-panel">
        {/* Table schema summary bar */}
        <div style={{ padding: '12px 20px', background: 'rgba(15, 23, 42, 0.6)', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '15px', fontWeight: 700, color: '#f8fafc' }} className="mono">
              {selectedTable}
            </span>
            <span style={{ fontSize: '12px', color: '#64748b' }}>
              ({totalRows} total rows)
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              className="copy-btn"
              disabled={page === 0}
              onClick={() => setPage(page - 1)}
              style={{ opacity: page === 0 ? 0.4 : 1 }}
            >
              <ChevronLeft size={16} />
            </button>
            <span style={{ fontSize: '12px', color: '#94a3b8' }}>
              Page {page + 1} of {Math.max(1, maxPages)}
            </span>
            <button
              className="copy-btn"
              disabled={page >= maxPages - 1}
              onClick={() => setPage(page + 1)}
              style={{ opacity: page >= maxPages - 1 ? 0.4 : 1 }}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        {/* Column schema list tag row */}
        <div style={{ padding: '8px 20px', background: 'rgba(0,0,0,0.2)', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: '6px', overflowX: 'auto' }}>
          <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>Schema:</span>
          {columns.map((c) => (
            <span key={c.name} className="mini-badge mono" style={{ fontSize: '10px' }}>
              {c.pk > 0 && <Key size={9} color="#f59e0b" style={{ marginRight: '2px' }} />}
              <span style={{ color: '#cbd5e1' }}>{c.name}</span>: <span style={{ color: '#60a5fa' }}>{c.type || 'ANY'}</span>
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
                    <th key={c.name}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        {c.pk > 0 && <Key size={10} color="#f59e0b" />}
                        <span>{c.name}</span>
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
                        return (
                          <td key={col.name}>
                            <button
                              className="mini-badge"
                              onClick={() => setActiveBlobModal({ col: col.name, blob })}
                              style={{ background: 'rgba(139, 92, 246, 0.2)', color: '#c084fc', cursor: 'pointer', border: 'none' }}
                              title="Click to view full BLOB content"
                            >
                              <Layers size={10} />
                              BLOB ({blob.size} B)
                            </button>
                            {blob.textPreview && (
                              <span style={{ fontSize: '11px', color: '#64748b', marginLeft: '6px' }}>
                                {blob.textPreview.slice(0, 30)}
                              </span>
                            )}
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

      {/* Blob Inspection Modal */}
      {activeBlobModal && (() => {
        let parsedBlobJson: any = null;
        if (activeBlobModal.blob.textPreview) {
          const str = activeBlobModal.blob.textPreview.trim();
          if ((str.startsWith('{') && str.endsWith('}')) || (str.startsWith('[') && str.endsWith(']'))) {
            try {
              parsedBlobJson = JSON.parse(str);
            } catch {}
          }
        }
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';

        return (
          <div className="modal-backdrop" onClick={() => setActiveBlobModal(null)}>
            <div className="modal-dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '640px' }}>
              <div className="modal-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Layers size={16} color="var(--cortex-synapse-purple)" />
                  <span style={{ fontWeight: 600, color: 'var(--cortex-deep-thought)' }}>
                    BLOB Inspector: {activeBlobModal.col} ({activeBlobModal.blob.size} bytes)
                  </span>
                </div>
              </div>
              <div className="modal-body">
                {parsedBlobJson ? (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--cortex-deep-thought)' }}>
                        Prettified JSON Content:
                      </span>
                      <span className="mini-badge" style={{ background: 'var(--cortex-execution-green-bg)', color: 'var(--cortex-execution-green)' }}>
                        Valid JSON
                      </span>
                    </div>
                    <div style={{ background: 'var(--bg-card)', padding: '14px', borderRadius: '8px', border: '1px solid var(--cortex-grey-matter-border)', maxHeight: '300px', overflowY: 'auto' }}>
                      <JsonView
                        value={parsedBlobJson}
                        style={isDark ? vscodeTheme : lightTheme}
                        collapsed={1}
                        displayDataTypes={true}
                        displayObjectSize={true}
                        enableClipboard={true}
                        indentWidth={16}
                      />
                    </div>
                  </div>
                ) : (
                  <div>
                    <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>ASCII / Text Content Preview:</span>
                    <pre className="mono" style={{ background: 'var(--bg-code)', padding: '12px', borderRadius: '8px', fontSize: '12px', marginTop: '6px', whiteSpace: 'pre-wrap', maxHeight: '200px', overflowY: 'auto', border: '1px solid var(--cortex-grey-matter-border)', color: 'var(--cortex-deep-thought)' }}>
                      {activeBlobModal.blob.textPreview || '<No printable text>'}
                    </pre>
                  </div>
                )}

                <div>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>Hex Dump Preview:</span>
                  <pre className="mono" style={{ background: 'var(--bg-code)', padding: '12px', borderRadius: '8px', fontSize: '11px', color: 'var(--cortex-grey-matter)', marginTop: '6px', whiteSpace: 'pre-wrap', border: '1px solid var(--cortex-grey-matter-border)' }}>
                    {activeBlobModal.blob.hex}
                  </pre>
                </div>
              </div>
              <div className="modal-footer">
                <button className="metric-pill" onClick={() => setActiveBlobModal(null)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
