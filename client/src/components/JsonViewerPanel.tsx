import React, { useState, useMemo } from 'react';
import JsonView from '@uiw/react-json-view';
import { lightTheme } from '@uiw/react-json-view/light';
import { vscodeTheme } from '@uiw/react-json-view/vscode';
import {
  Copy,
  Check,
  Download,
  Search,
  Maximize2,
  Minimize2,
  Code,
  ListTree,
  FileText,
  AlertCircle,
  Layers,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

interface JsonViewerPanelProps {
  content: string;
  filePath: string;
  isJsonl?: boolean;
}

export const JsonViewerPanel: React.FC<JsonViewerPanelProps> = ({
  content,
  filePath,
  isJsonl: forcedJsonl
}) => {
  const isJsonl = forcedJsonl ?? filePath.toLowerCase().endsWith('.jsonl');
  const [viewMode, setViewMode] = useState<'tree' | 'code' | 'raw'>('tree');
  const [jsonlSubMode, setJsonlSubMode] = useState<'records' | 'combined'>('records');
  const [collapsedLevel, setCollapsedLevel] = useState<number | boolean>(1);
  const [searchFilter, setSearchFilter] = useState('');
  const [copied, setCopied] = useState(false);
  const [expandedRecordIdx, setExpandedRecordIdx] = useState<Record<number, boolean>>({});

  // Detect dark theme from document attribute
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';

  const themeStyles = useMemo(() => {
    if (isDark) {
      return {
        ...vscodeTheme,
        '--w-rjv-font-family': 'var(--font-mono)',
        '--w-rjv-background-color': 'transparent',
        '--w-rjv-line-color': 'rgba(255, 255, 255, 0.08)',
        '--w-rjv-copied-success-color': 'var(--cortex-execution-green)'
      };
    }
    return {
      ...lightTheme,
      '--w-rjv-font-family': 'var(--font-mono)',
      '--w-rjv-background-color': 'transparent',
      '--w-rjv-color': 'var(--cortex-deep-thought)',
      '--w-rjv-key-string': 'var(--cortex-cognitive-teal)',
      '--w-rjv-line-color': 'var(--cortex-grey-matter-border)',
      '--w-rjv-type-string-color': '#0d9488',
      '--w-rjv-type-int-color': 'var(--cortex-synapse-purple)',
      '--w-rjv-type-float-color': 'var(--cortex-synapse-purple)',
      '--w-rjv-type-boolean-color': '#d97706',
      '--w-rjv-copied-success-color': 'var(--cortex-execution-green)'
    };
  }, [isDark]);

  // Single JSON parsing
  const singleJsonResult = useMemo(() => {
    if (isJsonl) return null;
    try {
      const parsed = JSON.parse(content);
      const prettyStr = JSON.stringify(parsed, null, 2);
      return { valid: true, data: parsed, prettyStr, error: null };
    } catch (err: any) {
      return { valid: false, data: null, prettyStr: content, error: err.message };
    }
  }, [content, isJsonl]);

  // JSONL lines parsing
  const jsonlRecords = useMemo(() => {
    if (!isJsonl) return [];
    const lines = content.split('\n');
    const results = [];
    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i].trim();
      if (!trimmed) continue;
      try {
        results.push({
          index: i + 1,
          valid: true,
          data: JSON.parse(trimmed),
          raw: trimmed,
          error: null
        });
      } catch (err: any) {
        results.push({
          index: i + 1,
          valid: false,
          data: null,
          raw: trimmed,
          error: err.message
        });
      }
    }
    return results;
  }, [content, isJsonl]);

  // Combined JSONL array
  const combinedJsonlArray = useMemo(() => {
    return jsonlRecords.filter(r => r.valid).map(r => r.data);
  }, [jsonlRecords]);

  // Filtered JSONL records
  const filteredJsonlRecords = useMemo(() => {
    if (!searchFilter.trim()) return jsonlRecords;
    const lower = searchFilter.toLowerCase();
    return jsonlRecords.filter(r => r.raw.toLowerCase().includes(lower));
  }, [jsonlRecords, searchFilter]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadFile = (text: string, filename: string) => {
    const blob = new Blob([text], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Toggle record accordion in JSONL
  const toggleRecord = (idx: number) => {
    setExpandedRecordIdx(prev => ({
      ...prev,
      [idx]: prev[idx] !== undefined ? !prev[idx] : false
    }));
  };

  // --- JSONL Render ---
  if (isJsonl) {
    const validCount = jsonlRecords.filter(r => r.valid).length;
    const errorCount = jsonlRecords.length - validCount;

    return (
      <div className="json-viewer-wrapper">
        <div className="json-viewer-toolbar">
          <div className="json-viewer-meta">
            <span className="artifact-image-badge" style={{ background: 'var(--cortex-synapse-purple-bg)', color: 'var(--cortex-synapse-purple)', borderColor: 'var(--cortex-synapse-purple-border)' }}>
              JSONL
            </span>
            <span className="metric-pill">
              <Layers size={13} className="icon" />
              <span>{jsonlRecords.length} Lines ({validCount} Valid{errorCount > 0 ? `, ${errorCount} Errors` : ''})</span>
            </span>
            <span className="metric-pill" style={{ color: 'var(--cortex-execution-green)' }}>
              <Check size={13} />
              <span>Prettified Stream</span>
            </span>
          </div>

          <div className="json-viewer-controls">
            {/* JSONL Submode toggles */}
            <div className="btn-group" style={{ display: 'flex', borderRadius: '6px', overflow: 'hidden', border: '1px solid var(--cortex-grey-matter-border)' }}>
              <button
                className={`artifact-control-btn ${jsonlSubMode === 'records' && viewMode === 'tree' ? 'active' : ''}`}
                style={{ borderRadius: 0, border: 'none', background: jsonlSubMode === 'records' && viewMode === 'tree' ? 'var(--cortex-cognitive-teal-bg)' : 'transparent', color: jsonlSubMode === 'records' && viewMode === 'tree' ? 'var(--cortex-cognitive-teal)' : 'inherit' }}
                onClick={() => { setJsonlSubMode('records'); setViewMode('tree'); }}
                title="View as Individual Record Cards"
              >
                <ListTree size={13} />
                <span>Cards</span>
              </button>
              <button
                className={`artifact-control-btn ${jsonlSubMode === 'combined' && viewMode === 'tree' ? 'active' : ''}`}
                style={{ borderRadius: 0, border: 'none', borderLeft: '1px solid var(--cortex-grey-matter-border)', background: jsonlSubMode === 'combined' && viewMode === 'tree' ? 'var(--cortex-cognitive-teal-bg)' : 'transparent', color: jsonlSubMode === 'combined' && viewMode === 'tree' ? 'var(--cortex-cognitive-teal)' : 'inherit' }}
                onClick={() => { setJsonlSubMode('combined'); setViewMode('tree'); }}
                title="View as Combined JSON Array"
              >
                <Code size={13} />
                <span>Array Tree</span>
              </button>
              <button
                className={`artifact-control-btn ${viewMode === 'raw' ? 'active' : ''}`}
                style={{ borderRadius: 0, border: 'none', borderLeft: '1px solid var(--cortex-grey-matter-border)', background: viewMode === 'raw' ? 'var(--cortex-cognitive-teal-bg)' : 'transparent', color: viewMode === 'raw' ? 'var(--cortex-cognitive-teal)' : 'inherit' }}
                onClick={() => setViewMode('raw')}
                title="View Raw JSON Lines"
              >
                <FileText size={13} />
                <span>Raw</span>
              </button>
            </div>

            {/* Collapse depth selector */}
            {viewMode === 'tree' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <button
                  className="artifact-control-btn"
                  onClick={() => setCollapsedLevel(false)}
                  title="Expand All Nodes"
                >
                  <Maximize2 size={13} />
                  <span>Expand</span>
                </button>
                <button
                  className="artifact-control-btn"
                  onClick={() => setCollapsedLevel(1)}
                  title="Collapse to Level 1"
                >
                  <Minimize2 size={13} />
                  <span>Collapse</span>
                </button>
              </div>
            )}

            {/* Copy & Download */}
            <button
              className="artifact-control-btn"
              onClick={() => copyToClipboard(content)}
              title="Copy Entire Content"
            >
              {copied ? <Check size={13} color="var(--cortex-execution-green)" /> : <Copy size={13} />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
            <button
              className="artifact-control-btn"
              onClick={() => downloadFile(content, filePath.split('/').pop() || 'file.jsonl')}
              title="Download File"
            >
              <Download size={13} />
            </button>
          </div>
        </div>

        {/* Search filter for JSONL lines */}
        {viewMode === 'tree' && jsonlSubMode === 'records' && (
          <div style={{ padding: '8px 16px', background: 'var(--bg-subtle)', borderBottom: '1px solid var(--cortex-grey-matter-border)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Search size={14} color="var(--cortex-grey-matter)" />
            <input
              type="text"
              className="search-input"
              style={{ padding: '4px 8px', fontSize: '12px', background: 'var(--bg-card)' }}
              placeholder="Search across JSONL records (keys, values, steps)..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
            />
            {searchFilter && (
              <span className="mono" style={{ fontSize: '11px', color: 'var(--cortex-grey-matter)', flexShrink: 0 }}>
                Matched {filteredJsonlRecords.length} of {jsonlRecords.length} records
              </span>
            )}
          </div>
        )}

        {/* Content Body */}
        <div className="json-viewer-content" style={{ padding: '16px', overflowY: 'auto', maxHeight: '72vh' }}>
          {viewMode === 'raw' ? (
            <pre className="mono" style={{ fontSize: '12px', whiteSpace: 'pre-wrap', color: 'var(--cortex-deep-thought)', background: 'var(--bg-code)', padding: '14px', borderRadius: '8px', border: '1px solid var(--cortex-grey-matter-border)' }}>
              {content}
            </pre>
          ) : jsonlSubMode === 'combined' ? (
            <div style={{ background: 'var(--bg-card)', padding: '16px', borderRadius: '8px', border: '1px solid var(--cortex-grey-matter-border)' }}>
              <JsonView
                value={combinedJsonlArray}
                style={themeStyles}
                collapsed={collapsedLevel}
                displayDataTypes={true}
                displayObjectSize={true}
                enableClipboard={true}
                indentWidth={16}
              />
            </div>
          ) : (
            /* Records Card View */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {filteredJsonlRecords.map((rec) => {
                const isExpanded = expandedRecordIdx[rec.index] ?? true;
                const quickType = rec.data?.type || rec.data?.event || rec.data?.name || (rec.data?.step_index !== undefined ? `Step #${rec.data.step_index}` : null);

                return (
                  <div key={rec.index} className="jsonl-card" style={{ border: '1px solid var(--cortex-grey-matter-border)', borderRadius: '8px', background: 'var(--bg-card)', overflow: 'hidden' }}>
                    <div
                      className="jsonl-card-header"
                      style={{ padding: '8px 14px', background: 'rgba(140, 149, 172, 0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', borderBottom: isExpanded ? '1px solid var(--cortex-grey-matter-border)' : 'none' }}
                      onClick={() => toggleRecord(rec.index)}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span className="mono" style={{ fontSize: '11px', fontWeight: 700, color: 'var(--cortex-synapse-purple)' }}>
                          Line #{rec.index}
                        </span>
                        {quickType && (
                          <span className="mini-badge mono" style={{ background: 'var(--cortex-cognitive-teal-bg)', color: 'var(--cortex-cognitive-teal)', fontSize: '10px', padding: '1px 6px', borderRadius: '4px' }}>
                            {String(quickType)}
                          </span>
                        )}
                        {!rec.valid && (
                          <span className="mini-badge" style={{ background: 'var(--cortex-memory-wipe-bg)', color: 'var(--cortex-memory-wipe)', fontSize: '10px' }}>
                            Invalid JSON
                          </span>
                        )}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <button
                          className="copy-btn"
                          onClick={(e) => { e.stopPropagation(); copyToClipboard(rec.raw); }}
                          title="Copy line JSON"
                        >
                          <Copy size={12} />
                        </button>
                        {isExpanded ? <ChevronUp size={14} color="var(--cortex-grey-matter)" /> : <ChevronDown size={14} color="var(--cortex-grey-matter)" />}
                      </div>
                    </div>

                    {isExpanded && (
                      <div style={{ padding: '12px 16px' }}>
                        {rec.valid ? (
                          <JsonView
                            value={rec.data}
                            style={themeStyles}
                            collapsed={collapsedLevel}
                            displayDataTypes={true}
                            displayObjectSize={true}
                            enableClipboard={true}
                            indentWidth={16}
                          />
                        ) : (
                          <div>
                            <div style={{ color: 'var(--cortex-memory-wipe)', fontSize: '12px', marginBottom: '6px' }}>
                              Parse Error: {rec.error}
                            </div>
                            <pre className="mono" style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                              {rec.raw}
                            </pre>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  // --- Single JSON Render ---
  const { valid, data, prettyStr, error } = singleJsonResult!;

  return (
    <div className="json-viewer-wrapper">
      <div className="json-viewer-toolbar">
        <div className="json-viewer-meta">
          <span className="artifact-image-badge" style={{ background: 'var(--cortex-cognitive-teal-bg)', color: 'var(--cortex-cognitive-teal)', borderColor: 'var(--cortex-cognitive-teal-border)' }}>
            JSON
          </span>
          {valid && (
            <span className="metric-pill">
              <Layers size={13} className="icon" />
              <span>
                {Array.isArray(data)
                  ? `${data.length} Array Items`
                  : typeof data === 'object' && data !== null
                  ? `${Object.keys(data).length} Object Keys`
                  : typeof data}
              </span>
            </span>
          )}
          <span className="metric-pill" style={{ color: valid ? 'var(--cortex-execution-green)' : 'var(--cortex-memory-wipe)' }}>
            {valid ? <Check size={13} /> : <AlertCircle size={13} />}
            <span>{valid ? 'Prettified Mode' : 'Invalid JSON'}</span>
          </span>
        </div>

        <div className="json-viewer-controls">
          {/* Mode Switcher */}
          <div className="btn-group" style={{ display: 'flex', borderRadius: '6px', overflow: 'hidden', border: '1px solid var(--cortex-grey-matter-border)' }}>
            <button
              className={`artifact-control-btn ${viewMode === 'tree' ? 'active' : ''}`}
              style={{ borderRadius: 0, border: 'none', background: viewMode === 'tree' ? 'var(--cortex-cognitive-teal-bg)' : 'transparent', color: viewMode === 'tree' ? 'var(--cortex-cognitive-teal)' : 'inherit' }}
              onClick={() => setViewMode('tree')}
              title="Interactive Prettified Tree View (@uiw/react-json-view)"
            >
              <ListTree size={13} />
              <span>Tree View</span>
            </button>
            <button
              className={`artifact-control-btn ${viewMode === 'code' ? 'active' : ''}`}
              style={{ borderRadius: 0, border: 'none', borderLeft: '1px solid var(--cortex-grey-matter-border)', background: viewMode === 'code' ? 'var(--cortex-cognitive-teal-bg)' : 'transparent', color: viewMode === 'code' ? 'var(--cortex-cognitive-teal)' : 'inherit' }}
              onClick={() => setViewMode('code')}
              title="Prettified Code (2 Spaces Indent)"
            >
              <Code size={13} />
              <span>Prettified Code</span>
            </button>
            <button
              className={`artifact-control-btn ${viewMode === 'raw' ? 'active' : ''}`}
              style={{ borderRadius: 0, border: 'none', borderLeft: '1px solid var(--cortex-grey-matter-border)', background: viewMode === 'raw' ? 'var(--cortex-cognitive-teal-bg)' : 'transparent', color: viewMode === 'raw' ? 'var(--cortex-cognitive-teal)' : 'inherit' }}
              onClick={() => setViewMode('raw')}
              title="Raw Unformatted JSON"
            >
              <FileText size={13} />
              <span>Raw</span>
            </button>
          </div>

          {/* Tree Collapse Depth */}
          {viewMode === 'tree' && valid && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <button
                className="artifact-control-btn"
                onClick={() => setCollapsedLevel(false)}
                title="Expand All Nodes"
              >
                <Maximize2 size={13} />
                <span>Expand</span>
              </button>
              <button
                className="artifact-control-btn"
                onClick={() => setCollapsedLevel(1)}
                title="Collapse to Root"
              >
                <Minimize2 size={13} />
                <span>Collapse</span>
              </button>
            </div>
          )}

          {/* Actions */}
          <button
            className="artifact-control-btn"
            onClick={() => copyToClipboard(viewMode === 'raw' ? content : prettyStr)}
            title="Copy JSON to Clipboard"
          >
            {copied ? <Check size={13} color="var(--cortex-execution-green)" /> : <Copy size={13} />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
          <button
            className="artifact-control-btn"
            onClick={() => downloadFile(prettyStr, filePath.split('/').pop() || 'data.json')}
            title="Download JSON File"
          >
            <Download size={13} />
          </button>
        </div>
      </div>

      {/* Parse Error Banner */}
      {!valid && (
        <div style={{ margin: '14px 16px 0', padding: '10px 14px', borderRadius: '8px', background: 'var(--cortex-memory-wipe-bg)', border: '1px solid var(--cortex-memory-wipe-border)', color: 'var(--cortex-memory-wipe)', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AlertCircle size={16} />
          <span>JSON Syntax Error: {error}. Displaying raw content below.</span>
        </div>
      )}

      {/* Main Content Area */}
      <div className="json-viewer-content" style={{ padding: '16px', overflowY: 'auto', maxHeight: '72vh' }}>
        {valid && viewMode === 'tree' ? (
          <div style={{ background: 'var(--bg-card)', padding: '16px', borderRadius: '8px', border: '1px solid var(--cortex-grey-matter-border)', boxShadow: 'var(--shadow-sm)' }}>
            <JsonView
              value={data}
              style={themeStyles}
              collapsed={collapsedLevel}
              displayDataTypes={true}
              displayObjectSize={true}
              enableClipboard={true}
              indentWidth={16}
            />
          </div>
        ) : viewMode === 'code' && valid ? (
          <pre className="mono" style={{ fontSize: '12px', whiteSpace: 'pre-wrap', color: 'var(--cortex-deep-thought)', background: 'var(--bg-code)', padding: '16px', borderRadius: '8px', border: '1px solid var(--cortex-grey-matter-border)' }}>
            {prettyStr}
          </pre>
        ) : (
          <pre className="mono" style={{ fontSize: '12px', whiteSpace: 'pre-wrap', color: 'var(--cortex-deep-thought)', background: 'var(--bg-code)', padding: '16px', borderRadius: '8px', border: '1px solid var(--cortex-grey-matter-border)' }}>
            {content}
          </pre>
        )}
      </div>
    </div>
  );
};
