import React, { useState } from 'react';
import { Sparkles, ChevronDown, ChevronUp } from 'lucide-react';
import { marked } from 'marked';
import { sanitizeHtml } from '../utils/sanitizeHtml.js';

interface ThinkingBlockProps {
  thinking: string;
}

export const ThinkingBlock: React.FC<ThinkingBlockProps> = ({ thinking }) => {
  const [isOpen, setIsOpen] = useState(false);

  if (!thinking) return null;

  const htmlContent = sanitizeHtml(marked.parse(thinking, { breaks: true, gfm: true }) as string);
  const wordCount = thinking.trim().split(/\s+/).length;

  return (
    <div className="thinking-block">
      <button
        className="thinking-header"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Sparkles size={14} color="var(--cortex-synapse-purple)" />
          <span>Model Reasoning & Planning</span>
          <span className="mono" style={{ fontSize: '11px', color: 'var(--cortex-grey-matter)', fontWeight: 400 }}>
            ({wordCount} words)
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '11px', color: 'var(--cortex-synapse-purple)' }}>
            {isOpen ? 'Collapse' : 'Expand thoughts'}
          </span>
          {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </div>
      </button>

      {isOpen && (
        <div
          className="thinking-content markdown-body"
          dangerouslySetInnerHTML={{ __html: htmlContent }}
        />
      )}
    </div>
  );
};
