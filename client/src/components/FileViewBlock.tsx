import React, { useState } from 'react';
import { Eye, Copy, Check, ChevronDown, ChevronUp, Image as ImageIcon } from 'lucide-react';
import { normalizeContent, cleanFilePath, getLanguage, highlightCode } from './DiffViewer.js';

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg', '.bmp', '.ico', '.avif']);

interface FileViewBlockProps {
  filePath: string;
  startLine?: number;
  endLine?: number;
  content: string;
  toolAction?: string;
  toolSummary?: string;
  conversationId?: string;
}

export const FileViewBlock: React.FC<FileViewBlockProps> = ({
  filePath,
  startLine = 1,
  endLine,
  content,
  toolAction,
  toolSummary,
  conversationId
}) => {
  const [copied, setCopied] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);

  const safePath = cleanFilePath(filePath);
  const ext = '.' + safePath.split('.').pop()?.toLowerCase();
  const isImage = IMAGE_EXTENSIONS.has(ext);
  const lang = getLanguage(safePath);

  const normalized = normalizeContent(content);

  const copyContent = () => {
    navigator.clipboard.writeText(normalized);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const lines = normalized.split('\n');
  if (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();

  return (
    <div className="terminal-card" style={{ border: '1px solid var(--cortex-grey-matter-border)' }}>
      <div className="terminal-header" style={{ background: '#090e17' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {isImage ? <ImageIcon size={14} color="var(--cortex-insight-amber)" /> : <Eye size={14} color="var(--cortex-execution-green)" />}
          <span style={{ color: 'var(--cortex-grey-matter)', fontSize: '11px' }}>
            {toolAction || toolSummary || (isImage ? 'Image Viewer' : 'File Viewer')}:
          </span>
          <span className="mono truncate" style={{ color: 'var(--cortex-cognitive-teal)', fontWeight: 600, maxWidth: '400px' }} title={safePath}>
            {safePath.split('/').slice(-2).join('/')}
          </span>
          {startLine && !isImage && (
            <span className="mini-badge mono" style={{ background: 'rgba(255, 255, 255, 0.08)' }}>
              lines {startLine}{endLine ? `-${endLine}` : ''}
            </span>
          )}
          {isImage && (
            <span className="mini-badge mono" style={{ background: 'var(--cortex-insight-amber-bg)', color: '#B45309' }}>
              Image Asset
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {!isImage && (
            <button className="copy-btn" onClick={copyContent} title="Copy viewed file contents">
              {copied ? <Check size={12} color="var(--cortex-execution-green)" /> : <Copy size={12} />}
            </button>
          )}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            style={{ color: 'var(--cortex-grey-matter)', display: 'flex', alignItems: 'center', gap: '4px' }}
          >
            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
      </div>

      {isExpanded && (
        isImage && conversationId ? (
          <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', background: 'var(--bg-card)', gap: '10px' }}>
            <img
              src={`/api/conversations/${conversationId}/artifacts/raw?path=${encodeURIComponent(safePath)}`}
              alt={safePath}
              style={{ maxWidth: '100%', maxHeight: '350px', objectFit: 'contain', borderRadius: '6px', boxShadow: 'var(--shadow-sm)', border: '1px solid var(--cortex-grey-matter-border)' }}
            />
            <span className="mono" style={{ fontSize: '11px', color: 'var(--cortex-grey-matter)' }}>
              Rendered Image Preview
            </span>
          </div>
        ) : (
          <div style={{ maxHeight: '350px', overflowY: 'auto', background: '#030712', fontFamily: 'var(--font-mono)', fontSize: '12px', padding: '6px 0' }}>
            {lines.map((line, idx) => (
              <div key={idx} style={{ display: 'flex', padding: '1px 12px', lineHeight: 1.45 }}>
                <span style={{ width: '40px', color: '#475569', textAlign: 'right', paddingRight: '14px', userSelect: 'none', flexShrink: 0 }}>
                  {(startLine || 1) + idx}
                </span>
                <span
                  style={{ color: '#cbd5e1', whiteSpace: 'pre-wrap', wordBreak: 'break-all', flex: 1 }}
                  dangerouslySetInnerHTML={{ __html: highlightCode(line, lang) }}
                />
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
};
