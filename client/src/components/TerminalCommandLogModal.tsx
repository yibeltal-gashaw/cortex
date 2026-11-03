import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Terminal,
  X,
  Search,
  Copy,
  Check,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  ArrowUpRight,
  Clock,
  Folder
} from 'lucide-react';
import { ParsedConversationSession, TimelineStep, ToolCallItem } from '../types/index.js';
import { scanForCredentials } from '../utils/credentialScanner.js';
import { normalizeContent } from './DiffViewer.js';

export interface ExecutedTerminalCommand {
  id: string;
  orderNumber: number;
  stepIndex: number;
  tcIdx: number;
  commandLine: string;
  displayCmd: string;
  cwd?: string;
  toolSummary?: string;
  toolAction?: string;
  exitCode?: number;
  isSuccess: boolean;
  content?: string;
  durationMs?: number;
  createdAt?: string;
}

interface TerminalCommandLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  session: ParsedConversationSession | null;
  onJumpToStep?: (stepIndex: number) => void;
}

function formatDuration(ms?: number): string | null {
  if (ms === undefined || ms === null || isNaN(ms)) return null;
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export const TerminalCommandLogModal: React.FC<TerminalCommandLogModalProps> = ({
  isOpen,
  onClose,
  session,
  onJumpToStep
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'success' | 'failed'>('all');
  const [expandedOutputs, setExpandedOutputs] = useState<Record<string, boolean>>({});
  const [copiedCmdId, setCopiedCmdId] = useState<string | null>(null);
  const [copiedOutputId, setCopiedOutputId] = useState<string | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, onClose]);

  // Reset search when opened
  useEffect(() => {
    if (isOpen) {
      setSearchQuery('');
      setStatusFilter('all');
      setCopiedCmdId(null);
      setCopiedOutputId(null);
      setCopiedAll(false);
    }
  }, [isOpen]);

  // Extract all terminal commands sequentially from session steps
  const commands: ExecutedTerminalCommand[] = useMemo(() => {
    if (!session?.steps) return [];
    const list: ExecutedTerminalCommand[] = [];
    let order = 1;

    session.steps.forEach((step: TimelineStep) => {
      if (!step.toolCalls) return;
      step.toolCalls.forEach((tc: ToolCallItem, tcIdx: number) => {
        if (tc.name === 'run_command' || tc.name === 'run_terminal_cmd') {
          const rawCmd = (tc.args.CommandLine || tc.args.command || '').trim();
          let displayCmd = rawCmd;
          if (displayCmd.startsWith('"') && displayCmd.endsWith('"')) {
            try {
              displayCmd = JSON.parse(displayCmd);
            } catch {
              displayCmd = displayCmd.slice(1, -1);
            }
          }

          const exitCode = tc.result?.exitCode;
          const isSuccess = exitCode === undefined || exitCode === 0;

          list.push({
            id: `step-${step.stepIndex}-tc-${tcIdx}-${order}`,
            orderNumber: order++,
            stepIndex: step.stepIndex,
            tcIdx,
            commandLine: rawCmd,
            displayCmd,
            cwd: tc.args.Cwd || tc.args.cwd,
            toolSummary: tc.args.toolSummary,
            toolAction: tc.args.toolAction,
            exitCode,
            isSuccess,
            content: tc.result?.content,
            durationMs: tc.result?.durationMs,
            createdAt: step.createdAt
          });
        }
      });
    });

    return list;
  }, [session]);

  const totalCount = commands.length;
  const successCount = commands.filter(c => c.isSuccess).length;
  const failedCount = commands.filter(c => !c.isSuccess).length;

  // Filter commands by search query & status
  const filteredCommands = useMemo(() => {
    return commands.filter(cmd => {
      if (statusFilter === 'success' && !cmd.isSuccess) return false;
      if (statusFilter === 'failed' && cmd.isSuccess) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchCmd = cmd.displayCmd.toLowerCase().includes(q);
        const matchSummary = (cmd.toolSummary || '').toLowerCase().includes(q);
        const matchAction = (cmd.toolAction || '').toLowerCase().includes(q);
        const matchCwd = (cmd.cwd || '').toLowerCase().includes(q);
        const matchContent = (cmd.content || '').toLowerCase().includes(q);
        return matchCmd || matchSummary || matchAction || matchCwd || matchContent;
      }
      return true;
    });
  }, [commands, statusFilter, searchQuery]);

  // Toggle single output expansion
  const toggleOutput = (id: string) => {
    setExpandedOutputs(prev => ({
      ...prev,
      [id]: prev[id] === undefined ? false : !prev[id] // default is true if has output
    }));
  };

  // Expand / Collapse all outputs
  const handleToggleAllOutputs = (expand: boolean) => {
    const updated: Record<string, boolean> = {};
    filteredCommands.forEach(cmd => {
      updated[cmd.id] = expand;
    });
    setExpandedOutputs(updated);
  };

  // Copy single command
  const handleCopyCommand = (cmd: ExecutedTerminalCommand) => {
    navigator.clipboard.writeText(cmd.displayCmd);
    setCopiedCmdId(cmd.id);
    setTimeout(() => setCopiedCmdId(null), 2000);
  };

  // Copy single output
  const handleCopyOutput = (cmd: ExecutedTerminalCommand) => {
    if (!cmd.content) return;
    navigator.clipboard.writeText(normalizeContent(cmd.content));
    setCopiedOutputId(cmd.id);
    setTimeout(() => setCopiedOutputId(null), 2000);
  };

  // Copy all filtered commands as a runnable shell script
  const handleCopyAll = () => {
    if (filteredCommands.length === 0) return;
    const scriptLines: string[] = [
      `# Cortex Terminal Executions (${filteredCommands.length} commands)`,
      `# Session: ${session?.id || 'current'}`,
      `# Exported: ${new Date().toISOString()}`,
      ''
    ];

    filteredCommands.forEach(cmd => {
      const summaryText = cmd.toolSummary || cmd.toolAction || 'Terminal Command';
      const statusText = cmd.isSuccess ? 'Success' : `Exit ${cmd.exitCode}`;
      scriptLines.push(`# [${cmd.orderNumber}/${totalCount}] Step ${cmd.stepIndex} - ${summaryText} (${statusText})`);
      if (cmd.cwd) {
        scriptLines.push(`# CWD: ${cmd.cwd}`);
      }
      scriptLines.push(cmd.displayCmd);
      scriptLines.push('');
    });

    navigator.clipboard.writeText(scriptLines.join('\n'));
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  };

  // Jump to step in Timeline
  const handleJump = (cmd: ExecutedTerminalCommand) => {
    onClose();
    if (onJumpToStep) {
      onJumpToStep(cmd.stepIndex);
    }
    setTimeout(() => {
      const cardEl = document.getElementById(`tool-run-cmd-${cmd.stepIndex}-${cmd.tcIdx}`);
      const stepEl = document.getElementById(`timeline-step-${cmd.stepIndex}`);
      const target = cardEl || stepEl;
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        target.classList.add('focused-terminal-highlight');
        setTimeout(() => target.classList.remove('focused-terminal-highlight'), 2500);
      }
    }, 150);
  };

  if (!isOpen) return null;

  const modalContent = (
    <div className="modal-backdrop terminal-log-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className="modal-dialog terminal-log-dialog"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="modal-header terminal-log-header">
          <div className="terminal-header-title-wrap">
            <div className="terminal-modal-icon-badge">
              <Terminal size={18} />
            </div>
            <div>
              <div className="terminal-title-row">
                <span className="terminal-title-text">Terminal Command Executions</span>
                <span className="terminal-count-badge mono">
                  {totalCount} call{totalCount !== 1 ? 's' : ''}
                </span>
              </div>
              <span className="terminal-subtitle-text">
                Sequential record of all terminal commands and standard output streams executed in this session
              </span>
            </div>
          </div>

          <div className="terminal-header-actions">
            <button
              className="terminal-copy-all-btn"
              onClick={handleCopyAll}
              title="Copy all commands as a shell script"
              disabled={filteredCommands.length === 0}
            >
              {copiedAll ? <Check size={14} color="var(--cortex-execution-green)" /> : <Copy size={14} />}
              <span>{copiedAll ? 'Copied All!' : 'Copy All Commands'}</span>
            </button>
            <button
              className="copy-btn terminal-modal-close-btn"
              onClick={onClose}
              title="Close (Esc)"
              aria-label="Close modal"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="terminal-filter-bar">
          <div className="terminal-search-wrap">
            <Search size={14} className="terminal-search-icon" />
            <input
              type="text"
              placeholder="Search command, output, summary, or directory..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="terminal-search-input"
              autoFocus
            />
            {searchQuery && (
              <button
                className="terminal-clear-search-btn"
                onClick={() => setSearchQuery('')}
                title="Clear search"
              >
                <X size={12} />
              </button>
            )}
          </div>

          <div className="terminal-status-filters">
            <button
              className={`status-filter-chip ${statusFilter === 'all' ? 'active' : ''}`}
              onClick={() => setStatusFilter('all')}
            >
              All ({totalCount})
            </button>
            <button
              className={`status-filter-chip chip-success ${statusFilter === 'success' ? 'active' : ''}`}
              onClick={() => setStatusFilter('success')}
            >
              <CheckCircle2 size={11} />
              <span>Success ({successCount})</span>
            </button>
            {failedCount > 0 && (
              <button
                className={`status-filter-chip chip-failed ${statusFilter === 'failed' ? 'active' : ''}`}
                onClick={() => setStatusFilter('failed')}
              >
                <AlertCircle size={11} />
                <span>Failed ({failedCount})</span>
              </button>
            )}
          </div>

          <div className="terminal-expand-toggles">
            <button
              className="terminal-toggle-btn"
              onClick={() => handleToggleAllOutputs(true)}
              title="Expand all outputs"
            >
              Expand All
            </button>
            <span className="terminal-toggle-sep">|</span>
            <button
              className="terminal-toggle-btn"
              onClick={() => handleToggleAllOutputs(false)}
              title="Collapse all outputs"
            >
              Collapse All
            </button>
          </div>
        </div>

        {/* Modal Body: Command List */}
        <div className="terminal-log-body">
          {filteredCommands.length === 0 ? (
            <div className="terminal-empty-results">
              <Terminal size={32} />
              <p>
                {commands.length === 0
                  ? 'No terminal command executions recorded in this session'
                  : `No commands matching "${searchQuery}"`}
              </p>
              {searchQuery && (
                <button
                  className="terminal-reset-btn"
                  onClick={() => setSearchQuery('')}
                >
                  Clear search filter
                </button>
              )}
            </div>
          ) : (
            <div className="terminal-commands-stack">
              {filteredCommands.map((cmd) => {
                const isOutputExpanded = expandedOutputs[cmd.id] !== false; // default open
                const normalizedOutput = cmd.content ? normalizeContent(cmd.content) : '';
                const detectedCredentials = normalizedOutput ? scanForCredentials(normalizedOutput) : [];
                const isCmdCopied = copiedCmdId === cmd.id;
                const isOutCopied = copiedOutputId === cmd.id;
                const duration = formatDuration(cmd.durationMs);

                return (
                  <div key={cmd.id} className="terminal-command-entry">
                    {/* Header: Order, Step, Status, Meta */}
                    <div className="terminal-entry-header">
                      <div className="entry-header-left">
                        <span className="entry-order-badge mono">#{cmd.orderNumber}</span>
                        <button
                          className="entry-step-jump-btn"
                          onClick={() => handleJump(cmd)}
                          title={`Click to scroll to Step ${cmd.stepIndex} in Timeline`}
                        >
                          <span>Step {cmd.stepIndex}</span>
                          <ArrowUpRight size={11} />
                        </button>
                        <span className={`entry-status-tag ${cmd.isSuccess ? 'success' : 'error'}`}>
                          {cmd.isSuccess ? 'Success' : `Exit ${cmd.exitCode}`}
                        </span>
                        {duration && (
                          <span className="entry-duration-tag mono" title="Execution duration">
                            <Clock size={11} />
                            <span>{duration}</span>
                          </span>
                        )}
                        {(cmd.toolSummary || cmd.toolAction) && (
                          <span className="entry-summary-text truncate" title={cmd.toolSummary || cmd.toolAction}>
                            {cmd.toolSummary || cmd.toolAction}
                          </span>
                        )}
                      </div>

                      <div className="entry-header-right">
                        {cmd.cwd && (
                          <span className="entry-cwd-badge mono truncate" title={`Working Directory: ${cmd.cwd}`}>
                            <Folder size={11} />
                            <span>{cmd.cwd.replace(/\\/g, '/').split('/').slice(-2).join('/')}</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Command Prompt Box */}
                    <div className="terminal-prompt-box">
                      <span className="terminal-prompt-char">$</span>
                      <div className="terminal-prompt-command mono" title={cmd.displayCmd}>
                        {cmd.displayCmd}
                      </div>
                      <button
                        className="terminal-cmd-copy-btn"
                        onClick={() => handleCopyCommand(cmd)}
                        title="Copy command"
                      >
                        {isCmdCopied ? (
                          <>
                            <Check size={12} color="var(--cortex-execution-green)" />
                            <span className="mono">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy size={12} />
                            <span className="mono">Copy</span>
                          </>
                        )}
                      </button>
                    </div>

                    {/* Output Section */}
                    {normalizedOutput ? (
                      <div className="terminal-output-section">
                        <div
                          className="terminal-output-header"
                          onClick={() => toggleOutput(cmd.id)}
                        >
                          <div className="output-header-left">
                            <span className="output-toggle-chevron">
                              {isOutputExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                            </span>
                            <span className="output-label">Command Output</span>
                            <span className="output-lines-count mono">
                              ({normalizedOutput.split('\n').length} lines)
                            </span>
                          </div>

                          <div className="output-header-right" onClick={(e) => e.stopPropagation()}>
                            <button
                              className="terminal-output-copy-btn"
                              onClick={() => handleCopyOutput(cmd)}
                              title="Copy command output"
                            >
                              {isOutCopied ? (
                                <>
                                  <Check size={11} color="var(--cortex-execution-green)" />
                                  <span>Copied</span>
                                </>
                              ) : (
                                <>
                                  <Copy size={11} />
                                  <span>Copy Output</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>

                        {detectedCredentials.length > 0 && isOutputExpanded && (
                          <div className="credential-alert terminal-cred-alert">
                            <AlertTriangle size={13} color="var(--cortex-memory-wipe)" />
                            <span>
                              Credential Alert: Detected <strong>{detectedCredentials.map(c => c.type).join(', ')}</strong> in output
                            </span>
                          </div>
                        )}

                        {isOutputExpanded && (
                          <div className="terminal-output-pre-container">
                            <pre className="terminal-output-pre mono">
                              {normalizedOutput}
                            </pre>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="terminal-no-output-hint">
                        <span>(Command finished with no output)</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="modal-footer terminal-log-footer">
          <span className="terminal-footer-meta mono">
            Showing {filteredCommands.length} of {totalCount} terminal executions
          </span>
          <button className="export-btn terminal-done-btn" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : null;
};
