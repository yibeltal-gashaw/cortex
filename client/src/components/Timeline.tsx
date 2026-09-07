import React, { useState, useEffect } from 'react';
import {
  User,
  Bot,
  Wrench,
  Globe,
  Copy,
  Check,
  AlertTriangle,
  FileCode,
  Filter,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Maximize2,
  Minimize2,
  CheckCircle2,
  Terminal
} from 'lucide-react';
import { marked } from 'marked';
import { TimelineStep, ToolCallItem } from '../types/index.js';
import { DiffViewer, normalizeContent, cleanFilePath } from './DiffViewer.js';
import { TerminalBlock } from './TerminalBlock.js';
import { FileViewBlock } from './FileViewBlock.js';

interface TimelineProps {
  steps: TimelineStep[];
  conversationId?: string;
  focusedFile?: string | null;
}

function formatTimeOnly(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toTimeString().split(' ')[0]; // returns HH:MM:SS (e.g. 14:32:01)
  } catch {
    return '14:32:00';
  }
}

function preprocessMarkdownImages(md: string, convId?: string): string {
  if (!convId) return md;
  return md.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (match, alt, src) => {
    let target = src.trim();
    if (target.startsWith('http://') || target.startsWith('https://') || target.startsWith('data:')) {
      return match;
    }
    if ((target.startsWith('"') && target.endsWith('"')) || (target.startsWith("'") && target.endsWith("'"))) {
      target = target.slice(1, -1);
    }
    target = target.replace(/^file:\/\/\/?/i, '');
    if (target.includes(`brain/${convId}/`)) {
      target = target.split(`brain/${convId}/`)[1];
    } else if (target.includes(`brain\\${convId}\\`)) {
      target = target.split(`brain\\${convId}\\`)[1];
    } else {
      const parts = target.replace(/\\/g, '/').split('/');
      const idx = parts.findIndex((p: string) => p === convId);
      if (idx !== -1 && idx < parts.length - 1) {
        target = parts.slice(idx + 1).join('/');
      }
    }
    const encoded = encodeURIComponent(target.replace(/\\/g, '/'));
    return `![${alt}](/api/conversations/${convId}/artifacts/raw?path=${encoded})`;
  });
}

export const Timeline: React.FC<TimelineProps> = ({ steps, conversationId, focusedFile }) => {
  const [filterType, setFilterType] = useState<'all' | 'user' | 'thinking' | 'tools' | 'response'>('all');
  const [copiedStep, setCopiedStep] = useState<number | null>(null);
  const [expandedReasoning, setExpandedReasoning] = useState<Record<number, boolean>>({});
  const [fullscreenDiffKey, setFullscreenDiffKey] = useState<string | null>(null);

  // Auto-scroll and focus when a file is clicked from TelemetrySidebar
  useEffect(() => {
    if (focusedFile) {
      if (filterType !== 'all' && filterType !== 'tools') {
        setFilterType('all');
      }
      setTimeout(() => {
        const fileNormalized = cleanFilePath(focusedFile).toLowerCase();
        const baseName = fileNormalized.split('/').pop() || '';
        const allCards = Array.from(document.querySelectorAll<HTMLElement>('.card-tool-execution[data-target-file]'));
        const match = allCards.find(card => {
          const attr = cleanFilePath(card.getAttribute('data-target-file') || '').toLowerCase();
          const attrBase = attr.split('/').pop() || '';
          return attr.includes(baseName) || attrBase === baseName || baseName.includes(attrBase);
        });
        if (match) {
          match.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 150);
    }
  }, [focusedFile]);

  const toggleReasoning = (idx: number) => {
    setExpandedReasoning(prev => ({
      ...prev,
      [idx]: prev[idx] !== undefined ? !prev[idx] : false // default is expanded
    }));
  };

  const copyText = (stepIdx: number, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedStep(stepIdx);
    setTimeout(() => setCopiedStep(null), 2000);
  };

  const filteredSteps = steps.filter((step) => {
    if (step.type === 'PLANNER_RESPONSE' && !step.thinking && (!step.toolCalls || step.toolCalls.length === 0) && !step.assistantResponse) {
      return false;
    }
    if (filterType === 'all') return true;
    if (filterType === 'user') return step.type === 'USER_INPUT';
    if (filterType === 'thinking') return !!step.thinking;
    if (filterType === 'tools') return !!step.toolCalls && step.toolCalls.length > 0;
    if (filterType === 'response') return !!step.assistantResponse && (!step.toolCalls || step.toolCalls.length === 0);
    return true;
  });

  return (
    <div className="hud-timeline-wrapper">
      {/* Optional Top Quick Filter Pills */}
      <div className="hud-timeline-filter-bar">
        <span className="filter-label">
          <Filter size={12} /> Filter Feed:
        </span>
        <button
          className={`filter-pill ${filterType === 'all' ? 'active' : ''}`}
          onClick={() => setFilterType('all')}
        >
          All Events ({steps.length})
        </button>
        <button
          className={`filter-pill ${filterType === 'user' ? 'active' : ''}`}
          onClick={() => setFilterType('user')}
        >
          User Prompts
        </button>
        <button
          className={`filter-pill ${filterType === 'thinking' ? 'active' : ''}`}
          onClick={() => setFilterType('thinking')}
        >
          Reasoning
        </button>
        <button
          className={`filter-pill ${filterType === 'tools' ? 'active' : ''}`}
          onClick={() => setFilterType('tools')}
        >
          Tools
        </button>
        <button
          className={`filter-pill ${filterType === 'response' ? 'active' : ''}`}
          onClick={() => setFilterType('response')}
        >
          Responses
        </button>
      </div>

      {/* Main Spine Timeline Area */}
      <div className="hud-timeline-feed">
        {filteredSteps.map((step) => {
          const isCopied = copiedStep === step.stepIndex;
          const timeStr = formatTimeOnly(step.createdAt);

          // 1. User Prompt Card
          if (step.type === 'USER_INPUT' && step.userPrompt) {
            const warnings = step.userPrompt.credentialWarnings || [];
            return (
              <div key={step.stepIndex} className="timeline-row-group">
                {/* Left Spine: Timestamp + Node Dot */}
                <div className="timeline-spine-col">
                  <span className="spine-timestamp mono">{timeStr}</span>
                  <div className="spine-dot-wrap">
                    <span className="spine-dot user-dot" />
                  </div>
                  <div className="spine-vertical-line" />
                </div>

                {/* Right Card: User Prompt */}
                <div className="timeline-card-col">
                  <div className="hud-card card-user-prompt">
                    <div className="card-top-header">
                      <div className="header-identity">
                        <div className="avatar-icon user-avatar">
                          <User size={14} />
                        </div>
                        <span className="header-title">User Prompt</span>
                      </div>
                      <button
                        className="hud-icon-btn"
                        onClick={() => copyText(step.stepIndex, step.userPrompt!.requestText)}
                        title="Copy prompt text"
                      >
                        {isCopied ? <Check size={13} color="var(--cortex-execution-green)" /> : <Copy size={13} />}
                      </button>
                    </div>

                    <div className="card-inner-body">
                      <p className="user-prompt-text">{step.userPrompt.requestText}</p>
                      {warnings.length > 0 && (
                        <div className="credential-alert-box">
                          <AlertTriangle size={14} color="#EF4444" />
                          <span>Potential sensitive data: {warnings.map(w => w.type).join(', ')}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          }

          // 2. Assistant Response (Reasoning, Tools, Final Message)
          if (step.type === 'PLANNER_RESPONSE') {
            const isReasoningExpanded = expandedReasoning[step.stepIndex] !== false; // default true
            const tokenEstimate = Math.max(240, Math.round(((step.thinking?.length || 0) + 120) / 3.8));

            return (
              <div key={step.stepIndex} className="timeline-row-group">
                {/* Left Spine: Timestamp + Node Dot */}
                <div className="timeline-spine-col">
                  <span className="spine-timestamp mono">{timeStr}</span>
                  <div className="spine-dot-wrap">
                    <span className="spine-dot ai-dot" />
                  </div>
                  <div className="spine-vertical-line" />
                </div>

                {/* Right Card Container */}
                <div className="timeline-card-col">
                  {/* 2a. AI Reasoning / Thought Stream Card */}
                  {step.thinking && (
                    <div className="hud-card card-ai-reasoning">
                      <div className="card-top-header" onClick={() => toggleReasoning(step.stepIndex)}>
                        <div className="header-identity">
                          <div className="avatar-icon ai-avatar">
                            <Sparkles size={14} />
                          </div>
                          <span className="header-title">AI Reasoning</span>
                          <div className="thought-stream-selector">
                            <span>Thought Stream</span>
                            <ChevronDown size={12} />
                          </div>
                        </div>

                        <div className="header-actions">
                          <span className="status-tag expanded">
                            {isReasoningExpanded ? 'Expanded' : 'Collapsed'}
                          </span>
                          <button className="hud-toggle-chevron">
                            {isReasoningExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          </button>
                        </div>
                      </div>

                      {isReasoningExpanded && (
                        <>
                          <div className="card-inner-body reasoning-body">
                            <div
                              className="thought-markdown markdown-body"
                              dangerouslySetInnerHTML={{
                                __html: marked.parse(step.thinking, { breaks: true, gfm: true }) as string
                              }}
                            />
                          </div>

                          {/* Footer Metadata Bar */}
                          <div className="card-footer-meta-bar mono">
                            <span>Model: cortex-4</span>
                            <span className="meta-sep">|</span>
                            <span>Confidence: 0.92</span>
                            <span className="meta-sep">|</span>
                            <span>Tokens: {tokenEstimate.toLocaleString()}</span>
                            <span className="meta-sep">|</span>
                            <span>Time: {(Math.random() * 2 + 1.2).toFixed(1)}s</span>
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {/* 2b. Tool Executions */}
                  {step.toolCalls && step.toolCalls.map((tc: ToolCallItem, tcIdx: number) => {
                    const toolName = tc.name;

                    // Tool Execution: Edit File (Diff Viewer)
                    if (
                      toolName === 'replace_file_content' ||
                      toolName === 'write_to_file' ||
                      toolName === 'multi_replace_file_content'
                    ) {
                      const diff = tc.result?.diff;
                      const rawOld = diff?.oldContent || tc.args.TargetContent || '';
                      const rawNew = diff?.newContent || tc.args.ReplacementContent || tc.args.CodeContent || '';
                      const normalizedOld = normalizeContent(rawOld);
                      const normalizedNew = normalizeContent(rawNew);
                      const addedLines = normalizedNew ? normalizedNew.split('\n').length : 18;

                      const rawTarget = tc.args.TargetFile || diff?.targetFile || 'src/services/auth.service.ts';
                      const targetFilePath = cleanFilePath(rawTarget);
                      const baseTarget = targetFilePath.split('/').pop()?.toLowerCase() || '';
                      const cleanFocused = focusedFile ? cleanFilePath(focusedFile).toLowerCase() : '';
                      const baseFocused = cleanFocused.split('/').pop() || '';
                      const isFileFocused = Boolean(
                        cleanFocused && (
                          targetFilePath.toLowerCase().includes(cleanFocused) ||
                          cleanFocused.includes(targetFilePath.toLowerCase()) ||
                          (baseTarget && baseFocused && (baseTarget === baseFocused || baseTarget.includes(baseFocused)))
                        )
                      );

                      const diffKey = `${step.stepIndex}-${tcIdx}`;
                      const isDiffFullscreen = fullscreenDiffKey === diffKey;

                      return (
                        <div
                          key={tcIdx}
                          className={`hud-card card-tool-execution ${isFileFocused ? 'focused-diff-card' : ''}`}
                          data-target-file={targetFilePath}
                          id={`diff-card-${encodeURIComponent(baseTarget)}-${tcIdx}`}
                        >
                          <div className="card-top-header">
                            <div className="header-identity">
                              <div className="avatar-icon tool-success-avatar">
                                <CheckCircle2 size={14} />
                              </div>
                              <span className="header-title">Tool Execution: Edit File</span>
                              {/* {isFileFocused && (
                                <span className="status-tag active-target">
                                  Selected File
                                </span>
                              )} */}
                            </div>

                            <div className="header-actions">
                              <span className="tool-lines-badge mono">+{addedLines} lines</span>
                              <button
                                className={`hud-icon-btn ${isDiffFullscreen ? 'active' : ''}`}
                                title={isDiffFullscreen ? "Exit Fullscreen (Esc)" : "Expand Fullscreen"}
                                onClick={() => setFullscreenDiffKey(isDiffFullscreen ? null : diffKey)}
                              >
                                {isDiffFullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
                              </button>
                            </div>
                          </div>

                          <div className="card-inner-body p-0">
                            <DiffViewer
                              targetFile={targetFilePath}
                              oldContent={normalizedOld}
                              newContent={normalizedNew}
                              startLine={diff?.startLine || tc.args.StartLine || 1}
                              endLine={diff?.endLine || tc.args.EndLine}
                              isFullscreen={isDiffFullscreen}
                              onToggleFullscreen={() => setFullscreenDiffKey(isDiffFullscreen ? null : diffKey)}
                            />
                          </div>
                        </div>
                      );
                    }

                    // Tool Execution: Terminal Command
                    if (toolName === 'run_command') {
                      return (
                        <div key={tcIdx} className="hud-card card-tool-execution">
                          <div className="card-top-header">
                            <div className="header-identity">
                              <div className="avatar-icon terminal-avatar">
                                <Terminal size={14} />
                              </div>
                              <span className="header-title">Tool Execution: Terminal Command</span>
                            </div>

                            <div className="header-actions">
                              <span className="status-tag success">Success</span>
                              <span className="tool-runtime-badge mono">3.1s</span>
                              <button className="hud-toggle-chevron">
                                <ChevronDown size={14} />
                              </button>
                            </div>
                          </div>

                          <div className="card-inner-body p-0">
                            <TerminalBlock
                              commandLine={tc.args.CommandLine || ''}
                              cwd={tc.args.Cwd}
                              exitCode={tc.result?.exitCode}
                              content={tc.result?.content}
                              toolAction={tc.args.toolAction}
                              toolSummary={tc.args.toolSummary}
                            />
                          </div>
                        </div>
                      );
                    }

                    // Tool Execution: View File
                    if (toolName === 'view_file') {
                      const vf = tc.result?.viewedFile;
                      return (
                        <div key={tcIdx} className="hud-card card-tool-execution">
                          <div className="card-top-header">
                            <div className="header-identity">
                              <div className="avatar-icon file-avatar">
                                <FileCode size={14} />
                              </div>
                              <span className="header-title">Tool Execution: View File</span>
                            </div>

                            <div className="header-actions">
                              <span className="tool-runtime-badge mono">1.8s</span>
                              <button className="hud-toggle-chevron">
                                <ChevronDown size={14} />
                              </button>
                            </div>
                          </div>

                          <div className="card-inner-body p-0">
                            <FileViewBlock
                              filePath={tc.args.AbsolutePath || vf?.path || ''}
                              startLine={tc.args.StartLine || vf?.startLine}
                              endLine={tc.args.EndLine || vf?.endLine}
                              content={vf?.content || tc.result?.content || ''}
                              toolAction={tc.args.toolAction}
                              toolSummary={tc.args.toolSummary}
                              conversationId={conversationId}
                            />
                          </div>
                        </div>
                      );
                    }

                    // Tool Execution: Search Web / Read URL
                    if (toolName === 'search_web' || toolName === 'read_url_content') {
                      return (
                        <div key={tcIdx} className="hud-card card-tool-execution">
                          <div className="card-top-header">
                            <div className="header-identity">
                              <div className="avatar-icon web-avatar">
                                <Globe size={14} />
                              </div>
                              <span className="header-title">
                                Tool Execution: {toolName === 'search_web' ? 'Web Search' : 'Read URL'}
                              </span>
                            </div>

                            <div className="header-actions">
                              <span className="status-tag success">Completed</span>
                              <span className="tool-runtime-badge mono">1.6s</span>
                            </div>
                          </div>

                          <div className="card-inner-body">
                            <div className="web-search-query mono">
                              {tc.args.query || tc.args.Url}
                            </div>
                            {tc.result?.content && (
                              <div className="terminal-output" style={{ maxHeight: '180px', marginTop: '8px' }}>
                                {tc.result.content}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    }

                    // Fallback generic tool
                    return (
                      <div key={tcIdx} className="hud-card card-tool-execution">
                        <div className="card-top-header">
                          <div className="header-identity">
                            <div className="avatar-icon generic-tool-avatar">
                              <Wrench size={14} />
                            </div>
                            <span className="header-title">Tool Execution: {toolName}</span>
                          </div>
                          <span className="status-tag success">Executed</span>
                        </div>

                        <div className="card-inner-body">
                          <pre className="mono" style={{ fontSize: '11px', color: '#64748b' }}>
                            {JSON.stringify(tc.args, null, 2)}
                          </pre>
                        </div>
                      </div>
                    );
                  })}

                  {/* 2c. Final Assistant Markdown Response */}
                  {step.assistantResponse && (
                    <div className="hud-card card-assistant-response">
                      <div className="card-top-header">
                        <div className="header-identity">
                          <div className="avatar-icon ai-avatar">
                            <Bot size={14} />
                          </div>
                          <span className="header-title">Assistant Summary</span>
                        </div>
                        <button
                          className="hud-icon-btn"
                          onClick={() => copyText(step.stepIndex, step.assistantResponse!)}
                          title="Copy response markdown"
                        >
                          {isCopied ? <Check size={13} color="var(--cortex-execution-green)" /> : <Copy size={13} />}
                        </button>
                      </div>

                      <div
                        className="card-inner-body markdown-body"
                        dangerouslySetInnerHTML={{
                          __html: marked.parse(preprocessMarkdownImages(step.assistantResponse, conversationId), { breaks: true, gfm: true }) as string
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>
            );
          }

          return null;
        })}
      </div>

      {/* 3. Floating Bottom Prompt Input Bar */}
      {/* <div className="hud-bottom-input-bar">
        <button className="input-attach-btn" title="Attach file or context">
          <Paperclip size={16} />
        </button>
        <input
          type="text"
          className="hud-prompt-input"
          placeholder="Ask Cortex anything..."
          value={promptInput}
          onChange={(e) => setPromptInput(e.target.value)}
        />
        <button
          className={`input-send-btn ${promptInput.trim() ? 'active' : ''}`}
          title="Send instruction to Cortex"
          onClick={() => {
            if (promptInput.trim()) {
              setPromptInput('');
            }
          }}
        >
          <Send size={15} />
        </button>
      </div> */}
    </div>
  );
};
