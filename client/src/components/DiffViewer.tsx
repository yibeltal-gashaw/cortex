import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { diffLines, Change } from 'diff';
import { Copy, Check, Columns, AlignLeft, FileCode, X } from 'lucide-react';
import Prism from 'prismjs';
import 'prismjs/components/prism-typescript.js';
import 'prismjs/components/prism-json.js';
import 'prismjs/components/prism-bash.js';
import 'prismjs/components/prism-jsx.js';
import 'prismjs/components/prism-tsx.js';

interface DiffViewerProps {
  targetFile: string;
  oldContent: string;
  newContent: string;
  startLine?: number;
  endLine?: number;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
}

interface SplitDiffLine {
  lineNum: number;
  content: string;
  type: 'del' | 'add' | 'ctx';
}

interface SplitDiffRow {
  left?: SplitDiffLine;
  right?: SplitDiffLine;
}

export function cleanFilePath(filePath: string): string {
  if (!filePath) return '';
  let p = String(filePath).trim();
  p = p.replace(/^["']+|["']+$/g, '');
  p = p.replace(/\\/g, '/');
  p = p.replace(/\/+/g, '/');
  return p;
}

export function normalizeContent(content: string): string {
  if (!content) return '';
  let str = String(content).trim();

  // Strip leading and trailing quotes if the string was serialized as a JSON string literal
  if (str.startsWith('"') && (str.endsWith('"') || str.includes('\\n') || str.includes('<truncated'))) {
    if (str.startsWith('"')) {
      str = str.slice(1);
    }
    if (str.endsWith('"')) {
      str = str.slice(0, -1);
    }
  }

  // Always unescape literal "\\r\\n" and "\\n" to actual newline characters
  // regardless of whether the string already contains other newlines
  str = str
    .replace(/\\r\\n/g, '\n')
    .replace(/\\n/g, '\n')
    .replace(/\\t/g, '  ')
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, '\\');

  return str.replace(/\r\n/g, '\n');
}

export function getLanguage(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  if (['ts', 'mts', 'cts'].includes(ext)) return 'typescript';
  if (['tsx'].includes(ext)) return 'tsx';
  if (['js', 'mjs', 'cjs'].includes(ext)) return 'javascript';
  if (['jsx'].includes(ext)) return 'jsx';
  if (['json'].includes(ext)) return 'json';
  if (['css', 'scss', 'less'].includes(ext)) return 'css';
  if (['html', 'htm', 'xml', 'svg'].includes(ext)) return 'markup';
  if (['sh', 'bash', 'zsh'].includes(ext)) return 'bash';
  return 'typescript'; // default for modern TS/JS codebases
}

export function highlightCode(code: string, lang: string): string {
  if (!code || code === ' ') return '&nbsp;';
  if (code.includes('<truncated') || code.includes('&lt;truncated')) {
    return `<span class="diff-truncated-note" style="color: var(--text-dim); font-style: italic;">${code}</span>`;
  }
  try {
    const grammar = Prism.languages[lang] || Prism.languages.typescript || Prism.languages.javascript;
    return Prism.highlight(code, grammar, lang);
  } catch {
    return code
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
}

export const DiffViewer: React.FC<DiffViewerProps> = ({
  targetFile,
  oldContent,
  newContent,
  startLine = 1,
  isFullscreen: externalFullscreen,
  onToggleFullscreen
}) => {
  const [internalFullscreen, setInternalFullscreen] = useState(false);
  const [viewMode, setViewMode] = useState<'split' | 'unified'>('split');
  const [copied, setCopied] = useState(false);

  const isFullscreen = externalFullscreen !== undefined ? externalFullscreen : internalFullscreen;

  const toggleFullscreen = () => {
    if (onToggleFullscreen) {
      onToggleFullscreen();
    } else {
      setInternalFullscreen(prev => !prev);
    }
  };

  // Keyboard shortcut: Esc to exit fullscreen
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        toggleFullscreen();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen, onToggleFullscreen]);

  // Lock body scroll in fullscreen
  useEffect(() => {
    if (isFullscreen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isFullscreen]);

  const safeOld = normalizeContent(oldContent);
  const safeNew = normalizeContent(newContent);
  const safeTargetFile = cleanFilePath(targetFile || 'unnamed-file');
  const lang = getLanguage(safeTargetFile);

  const changes: Change[] = useMemo(() => {
    return diffLines(safeOld, safeNew);
  }, [safeOld, safeNew]);

  // Compute stats
  const { addedCount, removedCount } = useMemo(() => {
    let added = 0;
    let removed = 0;
    changes.forEach((c) => {
      const lineCount = c.value.replace(/\n$/, '').split('\n').length;
      if (c.added) added += lineCount;
      if (c.removed) removed += lineCount;
    });
    return { addedCount: added, removedCount: removed };
  }, [changes]);

  // Build aligned side-by-side diff rows
  const splitRows: SplitDiffRow[] = useMemo(() => {
    const rows: SplitDiffRow[] = [];
    let leftNum = startLine || 1;
    let rightNum = startLine || 1;

    for (let i = 0; i < changes.length; i++) {
      const chunk = changes[i];
      const nextChunk = i + 1 < changes.length ? changes[i + 1] : null;

      // 1. Unchanged Context
      if (!chunk.added && !chunk.removed) {
        const lines = chunk.value.replace(/\n$/, '').split('\n');
        for (const line of lines) {
          rows.push({
            left: { lineNum: leftNum++, content: line, type: 'ctx' },
            right: { lineNum: rightNum++, content: line, type: 'ctx' }
          });
        }
      }
      // 2. Modified block: Removed followed immediately by Added
      else if (chunk.removed && nextChunk && nextChunk.added) {
        const removedLines = chunk.value.replace(/\n$/, '').split('\n');
        const addedLines = nextChunk.value.replace(/\n$/, '').split('\n');
        const maxLen = Math.max(removedLines.length, addedLines.length);

        for (let j = 0; j < maxLen; j++) {
          rows.push({
            left: j < removedLines.length ? { lineNum: leftNum++, content: removedLines[j], type: 'del' } : undefined,
            right: j < addedLines.length ? { lineNum: rightNum++, content: addedLines[j], type: 'add' } : undefined
          });
        }
        i++; // consumed nextChunk
      }
      // 3. Removed only
      else if (chunk.removed) {
        const removedLines = chunk.value.replace(/\n$/, '').split('\n');
        for (const line of removedLines) {
          rows.push({
            left: { lineNum: leftNum++, content: line, type: 'del' },
            right: undefined
          });
        }
      }
      // 4. Added only
      else if (chunk.added) {
        const addedLines = chunk.value.replace(/\n$/, '').split('\n');
        for (const line of addedLines) {
          rows.push({
            left: undefined,
            right: { lineNum: rightNum++, content: line, type: 'add' }
          });
        }
      }
    }

    return rows;
  }, [changes, startLine]);

  const copyDiff = () => {
    const diffText = changes.map(c => {
      const prefix = c.added ? '+ ' : c.removed ? '- ' : '  ';
      return c.value.split('\n').filter(Boolean).map(l => prefix + l).join('\n');
    }).join('\n');
    navigator.clipboard.writeText(diffText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const relativePath = safeTargetFile.split('/').slice(-2).join('/');

  const renderDiffContent = (inModal: boolean) => (
    <>
      {/* 1. Header Toolbar Bar */}
      <div className="diff-filename-bar">
        <div className="filename-left">
          <FileCode size={14} className="diff-file-icon" />
          <span className="file-path-text mono truncate" title={safeTargetFile}>
            {inModal ? safeTargetFile : relativePath}
          </span>
          <span className="diff-lang-badge mono">{lang.toUpperCase()}</span>
          {addedCount > 0 && <span className="diff-stat add mono">+{addedCount}</span>}
          {removedCount > 0 && <span className="diff-stat del mono">-{removedCount}</span>}
          <button className="diff-copy-btn" onClick={copyDiff} title="Copy git diff patch">
            {copied ? <Check size={12} color="var(--cortex-execution-green)" /> : <Copy size={12} />}
          </button>
        </div>

        <div className="filename-right">
          <div className="diff-view-toggle">
            <button
              className={`toggle-btn ${viewMode === 'split' ? 'active' : ''}`}
              onClick={() => setViewMode('split')}
              title="Side-by-Side Split View"
            >
              <Columns size={12} />
              <span>Split</span>
            </button>
            <button
              className={`toggle-btn ${viewMode === 'unified' ? 'active' : ''}`}
              onClick={() => setViewMode('unified')}
              title="Unified View"
            >
              <AlignLeft size={12} />
              <span>Unified</span>
            </button>
          </div>

          {/* <button
            className={`diff-fullscreen-btn ${inModal ? 'active' : ''}`}
            onClick={toggleFullscreen}
            title={inModal ? "Exit Fullscreen (Esc)" : "Expand Fullscreen"}
          >
            {inModal ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
            <span>{inModal ? 'Exit Fullscreen' : 'Fullscreen'}</span>
          </button> */}

          {inModal && (
            <button
              className="diff-close-modal-btn"
              onClick={toggleFullscreen}
              title="Close Fullscreen (Esc)"
            >
              <X size={15} />
            </button>
          )}
        </div>
      </div>

      {/* 2. Side-by-Side Aligned Split View */}
      {viewMode === 'split' ? (
        <div className="hud-code-diff-scroll">
          {/* Header Row */}
          <div className="diff-column-headers">
            <div className="diff-header-cell before">
              <span className="header-label">- Before</span>
            </div>
            <div className="diff-header-cell after">
              <span className="header-label">+ After</span>
            </div>
          </div>

          {/* Code Rows */}
          <div className="diff-split-rows-container">
            {splitRows.map((row, rowIdx) => {
              const left = row.left;
              const right = row.right;

              return (
                <div key={rowIdx} className="diff-split-row">
                  {/* Left Cell */}
                  <div className={`diff-split-cell left ${left ? left.type : 'empty'}`}>
                    {left ? (
                      <>
                        <span className="line-num mono">{left.lineNum}</span>
                        <span className="line-sign mono">{left.type === 'del' ? '-' : ' '}</span>
                        <span
                          className="line-code mono"
                          dangerouslySetInnerHTML={{ __html: highlightCode(left.content, lang) }}
                        />
                      </>
                    ) : (
                      <div className="empty-cell-spacer" />
                    )}
                  </div>

                  {/* Right Cell */}
                  <div className={`diff-split-cell right ${right ? right.type : 'empty'}`}>
                    {right ? (
                      <>
                        <span className="line-num mono">{right.lineNum}</span>
                        <span className="line-sign mono">{right.type === 'add' ? '+' : ' '}</span>
                        <span
                          className="line-code mono"
                          dangerouslySetInnerHTML={{ __html: highlightCode(right.content, lang) }}
                        />
                      </>
                    ) : (
                      <div className="empty-cell-spacer" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* 3. Unified View */
        <div className="hud-code-diff-scroll">
          <div className="diff-unified-container">
            {changes.map((chunk, chunkIdx) => {
              const lines = chunk.value.replace(/\n$/, '').split('\n');
              const typeClass = chunk.added ? 'add' : chunk.removed ? 'del' : 'ctx';
              const sign = chunk.added ? '+' : chunk.removed ? '-' : ' ';

              return lines.map((line, lineIdx) => (
                <div key={`${chunkIdx}-${lineIdx}`} className={`diff-unified-row ${typeClass}`}>
                  <span className="line-sign mono">{sign}</span>
                  <span
                    className="line-code mono"
                    dangerouslySetInnerHTML={{ __html: highlightCode(line, lang) }}
                  />
                </div>
              ));
            })}
          </div>
        </div>
      )}
    </>
  );

  return (
    <>
      <div className="hud-diff-container">
        {renderDiffContent(false)}
      </div>

      {isFullscreen && createPortal(
        <div className="hud-diff-fullscreen-overlay" onClick={toggleFullscreen}>
          <div className="hud-diff-fullscreen-window" onClick={(e) => e.stopPropagation()}>
            {renderDiffContent(true)}
          </div>
        </div>,
        document.body
      )}
    </>
  );
};
