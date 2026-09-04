import React, { useState } from 'react';
import { Copy, Check, AlertTriangle, ChevronDown, ChevronUp, Wrench } from 'lucide-react';
import { scanForCredentials } from '../utils/credentialScanner.js';
import { normalizeContent } from './DiffViewer.js';

interface TerminalBlockProps {
  commandLine: string;
  cwd?: string;
  exitCode?: number;
  content?: string;
  toolAction?: string;
  toolSummary?: string;
}

export const TerminalBlock: React.FC<TerminalBlockProps> = ({
  commandLine,
  cwd,
  exitCode,
  content,
  toolAction,
  toolSummary
}) => {
  const [copiedCmd, setCopiedCmd] = useState(false);
  const [copiedOutput, setCopiedOutput] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);

  let displayCmd = (commandLine || '').trim();
  if (displayCmd.startsWith('"') && displayCmd.endsWith('"')) {
    try {
      displayCmd = JSON.parse(displayCmd);
    } catch {
      displayCmd = displayCmd.slice(1, -1);
    }
  }

  const normalizedOutput = content ? normalizeContent(content) : '';
  const outputCredentials = normalizedOutput ? scanForCredentials(normalizedOutput) : [];

  const copyCommand = () => {
    navigator.clipboard.writeText(displayCmd);
    setCopiedCmd(true);
    setTimeout(() => setCopiedCmd(false), 2000);
  };

  const copyOut = () => {
    navigator.clipboard.writeText(normalizedOutput);
    setCopiedOutput(true);
    setTimeout(() => setCopiedOutput(false), 2000);
  };

  const isSuccess = exitCode === undefined || exitCode === 0;

  return (
    <div className="terminal-card">
      <div className="terminal-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Synapse Purple Tool Badge */}
          <Wrench size={13} color="var(--cortex-synapse-purple)" />
          <span style={{ color: '#cbd5e1', fontWeight: 600 }}>
            {toolAction || toolSummary || 'Terminal Execution'}
          </span>
          {cwd && (
            <span className="mono truncate" style={{ color: 'var(--cortex-grey-matter)', maxWidth: '300px' }} title={cwd}>
              ({cwd.replace(/\\/g, '/').split('/').slice(-2).join('/')})
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Action Indicator: Execution Green for 0, Memory Wipe Crimson for non-zero */}
          {exitCode !== undefined && (
            <span className={`exit-code-badge ${isSuccess ? 'success' : 'error'}`}>
              exit: {exitCode}
            </span>
          )}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            style={{ color: 'var(--cortex-grey-matter)', display: 'flex', alignItems: 'center', gap: '4px' }}
          >
            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
      </div>

      <div className="terminal-cmd-row">
        {/* Cognitive Teal Focus Command Prompt */}
        <span style={{ color: 'var(--cortex-execution-green)', userSelect: 'none', fontWeight: 700 }}>$</span>
        <span style={{ flex: 1, color: 'var(--cortex-cognitive-teal)' }} className="truncate mono" title={displayCmd}>
          {displayCmd}
        </span>
        <button className="copy-btn" onClick={copyCommand} title="Copy command">
          {copiedCmd ? <Check size={13} color="var(--cortex-execution-green)" /> : <Copy size={13} />}
        </button>
      </div>

      {isExpanded && content && (
        <>
          {outputCredentials.length > 0 && (
            <div style={{ margin: '8px 12px 0 12px' }} className="credential-alert">
              <AlertTriangle size={14} color="var(--cortex-memory-wipe)" />
              <span>
                Credential Warning: Detected <strong>{outputCredentials.map(c => c.type).join(', ')}</strong> in command output!
              </span>
            </div>
          )}

          <div style={{ position: 'relative' }}>
            <button
              className="copy-btn"
              onClick={copyOut}
              title="Copy output"
              style={{ position: 'absolute', right: '12px', top: '8px', zIndex: 5, background: 'rgba(0,0,0,0.5)' }}
            >
              {copiedOutput ? <Check size={12} color="var(--cortex-execution-green)" /> : <Copy size={12} />}
            </button>
            <div className="terminal-output">
              {normalizedOutput}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
