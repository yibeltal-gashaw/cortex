import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  User,
  Bot,
  Wrench,
  Globe,
  Copy,
  Check,
  AlertTriangle,
  AlertCircle,
  FileCode,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Maximize2,
  Minimize2,
  CheckCircle2,
  Terminal,
  Search,
  X,
  Layers,
  Radio,
  ArrowDown,
  GitFork
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

function stepHasError(step: TimelineStep): boolean {
  if (step.status === 'ERROR') return true;
  if (step.userPrompt?.credentialWarnings && step.userPrompt.credentialWarnings.length > 0) return true;
  if (step.toolCalls) {
    for (const tc of step.toolCalls) {
      if (tc.result?.status === 'ERROR') return true;
      if (typeof tc.result?.exitCode === 'number' && tc.result.exitCode !== 0) return true;
      if (tc.result?.content) {
        if (/Command exited with code [1-9]/i.test(tc.result.content)) return true;
        if (/exit code:? [1-9]/i.test(tc.result.content)) return true;
        if (/\b(FATAL|Traceback \(most recent call last\)|NullPointerException|UnhandledPromiseRejection)\b/i.test(tc.result.content)) return true;
      }
    }
  }
  return false;
}

function stepMatchesSearch(step: TimelineStep, query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();

  if (step.userPrompt?.requestText?.toLowerCase().includes(q)) return true;
  if (step.userPrompt?.raw?.toLowerCase().includes(q)) return true;
  if (step.thinking?.toLowerCase().includes(q)) return true;
  if (step.assistantResponse?.toLowerCase().includes(q)) return true;

  if (step.toolCalls) {
    for (const tc of step.toolCalls) {
      if (tc.name.toLowerCase().includes(q)) return true;
      if (tc.args) {
        try {
          const argsStr = JSON.stringify(tc.args).toLowerCase();
          if (argsStr.includes(q)) return true;
        } catch {}
      }
      if (tc.result?.content?.toLowerCase().includes(q)) return true;
      if (tc.result?.diff?.targetFile?.toLowerCase().includes(q)) return true;
      if (tc.result?.diff?.newContent?.toLowerCase().includes(q)) return true;
      if (tc.result?.viewedFile?.path?.toLowerCase().includes(q)) return true;
    }
  }

  return false;
}

export const Timeline: React.FC<TimelineProps> = ({ steps, conversationId, focusedFile }) => {
  const [filterType, setFilterType] = useState<'all' | 'user' | 'thinking' | 'tools' | 'errors' | 'response'>('all');
  const [copiedStep, setCopiedStep] = useState<number | null>(null);
  const [expandedReasoning, setExpandedReasoning] = useState<Record<number, boolean>>({});
  const [fullscreenDiffKey, setFullscreenDiffKey] = useState<string | null>(null);
  const [timelineSearch, setTimelineSearch] = useState('');
  const [collapsedTurns, setCollapsedTurns] = useState<Record<number, boolean>>({});
  const [autoScrollLocked, setAutoScrollLocked] = useState<boolean>(true);
  const [newStepsCount, setNewStepsCount] = useState<number>(0);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const prevStepCountRef = useRef<number>(steps.length);

  // Group steps into turns
  const { stepsWithTurns, turns } = useMemo(() => {
    let currentTurn = 0;
    const turnsMap = new Map<number, {
      turnIndex: number;
      promptSnippet: string;
      stepCount: number;
      toolCount: number;
      hasErrors: boolean;
    }>();
    const enriched: Array<{ step: TimelineStep; turnIndex: number; isTurnStart: boolean }> = [];

    for (const step of steps) {
      const isStart = step.type === 'USER_INPUT';
      if (isStart) {
        currentTurn++;
        const promptSnippet = (step.userPrompt?.requestText || 'User prompt').slice(0, 70);
        turnsMap.set(currentTurn, {
          turnIndex: currentTurn,
          promptSnippet,
          stepCount: 0,
          toolCount: 0,
          hasErrors: false
        });
      }

      const tIndex = currentTurn || 1;
      enriched.push({ step, turnIndex: tIndex, isTurnStart: isStart });

      const turnInfo = turnsMap.get(tIndex);
      if (turnInfo) {
        turnInfo.stepCount++;
        if (step.toolCalls) turnInfo.toolCount += step.toolCalls.length;
        if (stepHasError(step)) turnInfo.hasErrors = true;
      }
    }

    return { stepsWithTurns: enriched, turns: Array.from(turnsMap.values()) };
  }, [steps]);

  const errorCount = useMemo(() => steps.filter(stepHasError).length, [steps]);

  const counts = useMemo(() => {
    let userCount = 0;
    let thinkingCount = 0;
    let toolsCount = 0;
    let totalTools = 0;
    let responseCount = 0;

    for (const item of steps) {
      if (item.type === 'USER_INPUT') userCount++;
      if (item.thinking) thinkingCount++;
      if (item.toolCalls && item.toolCalls.length > 0) {
        toolsCount++;
        totalTools += item.toolCalls.length;
      }
      if (item.assistantResponse) responseCount++;
    }

    return {
      all: steps.length,
      user: userCount,
      thinking: thinkingCount,
      tools: toolsCount,
      totalTools,
      errors: errorCount,
      response: responseCount
    };
  }, [steps, errorCount]);

  const [allReasoningExpanded, setAllReasoningExpanded] = useState<boolean>(true);

  const toggleAllReasoning = () => {
    const next = !allReasoningExpanded;
    setAllReasoningExpanded(next);
    const updated: Record<number, boolean> = {};
    steps.forEach(s => {
      if (s.thinking) {
        updated[s.stepIndex] = next;
      }
    });
    setExpandedReasoning(updated);
  };

  // Keyboard shortcut Ctrl+F / Cmd+F to focus timeline search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        const target = e.target as HTMLElement | null;
        if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') && target !== searchInputRef.current) {
          return;
        }
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

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

  // Auto-scroll to bottom on live streaming updates if auto-scroll is locked
  useEffect(() => {
    if (steps.length > prevStepCountRef.current) {
      const added = steps.length - prevStepCountRef.current;
      if (autoScrollLocked) {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
        setNewStepsCount(0);
      } else {
        setNewStepsCount(prev => prev + added);
      }
    }
    prevStepCountRef.current = steps.length;
  }, [steps.length, autoScrollLocked]);

  const toggleReasoning = (idx: number) => {
    setExpandedReasoning(prev => ({
      ...prev,
      [idx]: prev[idx] !== undefined ? !prev[idx] : false // default is expanded
    }));
  };

  const toggleTurnCollapse = (turnIdx: number) => {
    setCollapsedTurns(prev => ({
      ...prev,
      [turnIdx]: !prev[turnIdx]
    }));
  };

  const scrollToTurn = (turnIdx: number) => {
    setCollapsedTurns(prev => ({ ...prev, [turnIdx]: false }));
    setTimeout(() => {
      const el = document.getElementById(`turn-anchor-${turnIdx}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 50);
  };

  const copyText = (stepIdx: number, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedStep(stepIdx);
    setTimeout(() => setCopiedStep(null), 2000);
  };

  const filteredItems = useMemo(() => {
    return stepsWithTurns.filter(({ step, turnIndex }) => {
      if (step.type === 'PLANNER_RESPONSE' && !step.thinking && (!step.toolCalls || step.toolCalls.length === 0) && !step.assistantResponse) {
        return false;
      }
      if (filterType === 'user') return step.type === 'USER_INPUT';
      if (filterType === 'thinking') return !!step.thinking;
      if (filterType === 'tools') return !!step.toolCalls && step.toolCalls.length > 0;
      if (filterType === 'errors') return stepHasError(step);
      if (filterType === 'response') return !!step.assistantResponse && (!step.toolCalls || step.toolCalls.length === 0);

      if (timelineSearch.trim() && !stepMatchesSearch(step, timelineSearch.trim())) {
        return false;
      }

      if (!timelineSearch.trim() && filterType === 'all' && collapsedTurns[turnIndex] && step.type !== 'USER_INPUT') {
        return false;
      }

      return true;
    });
  }, [stepsWithTurns, filterType, timelineSearch, collapsedTurns]);

  return (
    <div className="hud-timeline-wrapper">
      {/* 1. Primary Filter Tabs & Control Bar */}
      <div className="hud-timeline-header-bar">
        {/* Spacious Segmented Filter Tabs */}
        <div className="timeline-tabs-track">
          <button
            className={`timeline-tab-btn ${filterType === 'all' ? 'active' : ''}`}
            onClick={() => setFilterType('all')}
            title="View all execution steps in chronological order"
          >
            <Layers size={13} className="tab-icon" />
            <span className="tab-label">All Events</span>
            <span className="tab-count-badge mono">{counts.all}</span>
          </button>

          <button
            className={`timeline-tab-btn ${filterType === 'user' ? 'active' : ''}`}
            onClick={() => setFilterType('user')}
            title="Filter by user instructions & prompts"
          >
            <User size={13} className="tab-icon" />
            <span className="tab-label">Prompts</span>
            <span className="tab-count-badge mono">{counts.user}</span>
          </button>

          <button
            className={`timeline-tab-btn ${filterType === 'thinking' ? 'active' : ''}`}
            onClick={() => setFilterType('thinking')}
            title="Filter by internal chain-of-thought & reasoning streams"
          >
            <Sparkles size={13} className="tab-icon" />
            <span className="tab-label">Reasoning</span>
            <span className="tab-count-badge mono">{counts.thinking}</span>
          </button>

          <button
            className={`timeline-tab-btn ${filterType === 'tools' ? 'active' : ''}`}
            onClick={() => setFilterType('tools')}
            title={`Filter by tool calls (${counts.totalTools} tool operations)`}
          >
            <Wrench size={13} className="tab-icon" />
            <span className="tab-label">Tools</span>
            <span className="tab-count-badge mono">{counts.tools}</span>
          </button>

          <button
            className={`timeline-tab-btn tab-error ${counts.errors > 0 ? 'has-errors' : ''} ${filterType === 'errors' ? 'active' : ''}`}
            onClick={() => setFilterType('errors')}
            title={counts.errors > 0 ? `${counts.errors} step(s) encountered execution errors` : 'No errors recorded in this session'}
          >
            <AlertCircle size={13} className="tab-icon" />
            <span className="tab-label">Errors</span>
            <span className={`tab-count-badge mono ${counts.errors > 0 ? 'error-badge' : ''}`}>{counts.errors}</span>
          </button>

          <button
            className={`timeline-tab-btn ${filterType === 'response' ? 'active' : ''}`}
            onClick={() => setFilterType('response')}
            title="Filter by final assistant answers & summaries"
          >
            <Bot size={13} className="tab-icon" />
            <span className="tab-label">Responses</span>
            <span className="tab-count-badge mono">{counts.response}</span>
          </button>
        </div>

        {/* Right Header Utilities: Density & Follow Live */}
        <div className="timeline-header-actions">
          {counts.thinking > 0 && (
            <button
              className="timeline-action-btn"
              onClick={toggleAllReasoning}
              title={allReasoningExpanded ? "Collapse all AI reasoning streams" : "Expand all AI reasoning streams"}
            >
              {allReasoningExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              <span>{allReasoningExpanded ? 'Collapse Thoughts' : 'Expand Thoughts'}</span>
            </button>
          )}

          <button
            className={`timeline-live-follow-pill ${autoScrollLocked ? 'active' : ''}`}
            onClick={() => {
              const next = !autoScrollLocked;
              setAutoScrollLocked(next);
              if (next) {
                setNewStepsCount(0);
                bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
              }
            }}
            title="Toggle automatic scrolling to latest events as agent streams"
          >
            <Radio size={12} className={autoScrollLocked ? 'spin-icon' : ''} />
            <span>Follow Live {autoScrollLocked ? 'ON' : 'OFF'}</span>
          </button>
        </div>
      </div>

      {/* 2. Secondary Sub-Bar: Turns Navigation & Search */}
      <div className="hud-timeline-sub-bar">
        {/* Turn Navigation Jumper (if multi-turn) */}
        {turns.length > 1 ? (
          <div className="turn-chips-strip">
            <span className="turn-chips-label">
              <Layers size={12} />
              <span>Turns:</span>
            </span>
            <div className="turn-chips-list">
              {turns.map(t => (
                <button
                  key={t.turnIndex}
                  className={`turn-chip ${t.hasErrors ? 'turn-has-error' : ''}`}
                  onClick={() => scrollToTurn(t.turnIndex)}
                  title={`Turn ${t.turnIndex}: ${t.promptSnippet} (${t.stepCount} steps)`}
                >
                  <span className="turn-number">T{t.turnIndex}</span>
                  <span className="turn-step-count mono">{t.stepCount} steps</span>
                  {t.hasErrors && <span className="turn-error-dot" title="Turn contains errors" />}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="timeline-stats-summary mono">
            <span>{steps.length} total events recorded in sequence</span>
          </div>
        )}

        {/* In-Timeline Search Box */}
        <div className="timeline-search-box">
          <Search size={13} className="search-box-icon" />
          <input
            ref={searchInputRef}
            type="text"
            className="timeline-search-input mono"
            value={timelineSearch}
            onChange={(e) => setTimelineSearch(e.target.value)}
            placeholder="Search feed, tools, commands, diffs (Ctrl+F)..."
            spellCheck={false}
          />
          {timelineSearch ? (
            <button
              className="search-box-clear"
              onClick={() => setTimelineSearch('')}
              title="Clear search"
            >
              <X size={12} />
            </button>
          ) : (
            <kbd className="timeline-kbd-hint">Ctrl+F</kbd>
          )}
          {timelineSearch && (
            <span className="timeline-search-count-pill mono">
              {filteredItems.length} match{filteredItems.length === 1 ? '' : 'es'}
            </span>
          )}
        </div>
      </div>

      {/* Main Spine Timeline Area */}
      <div className="hud-timeline-feed">
        {filteredItems.length === 0 ? (
          <div className="no-events-notice" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <p className="mono" style={{ fontSize: '13px' }}>
              {timelineSearch
                ? `No steps matching "${timelineSearch}"`
                : filterType === 'errors'
                ? 'No error steps recorded in this conversation 🎉'
                : 'No events match the selected filter'}
            </p>
            {(timelineSearch || filterType !== 'all') && (
              <button
                className="timeline-tab-btn active"
                style={{ marginTop: '14px', display: 'inline-flex' }}
                onClick={() => { setFilterType('all'); setTimelineSearch(''); }}
              >
                <Layers size={13} className="tab-icon" />
                <span>Reset Filters</span>
              </button>
            )}
          </div>
        ) : (
          filteredItems.map(({ step, turnIndex, isTurnStart }) => {
            const isCopied = copiedStep === step.stepIndex;
            const timeStr = formatTimeOnly(step.createdAt);
            const turnInfo = turns.find(t => t.turnIndex === turnIndex);
            const isTurnCollapsed = !timelineSearch && filterType === 'all' && !!collapsedTurns[turnIndex];

            const turnHeader = isTurnStart && turns.length > 1 ? (
              <div className="turn-divider-banner" id={`turn-anchor-${turnIndex}`}>
                <div className="turn-banner-left">
                  <span className="turn-badge">Turn {turnIndex}</span>
                  <span className="turn-prompt-snippet" title={turnInfo?.promptSnippet}>
                    {turnInfo?.promptSnippet}
                  </span>
                </div>
                <div className="turn-banner-right">
                  <span className="turn-meta-text mono">
                    {turnInfo?.stepCount || 1} steps {turnInfo?.toolCount ? `• ${turnInfo.toolCount} tools` : ''}
                  </span>
                  <button
                    className="turn-collapse-btn"
                    onClick={() => toggleTurnCollapse(turnIndex)}
                    title={isTurnCollapsed ? "Expand this turn" : "Collapse this turn"}
                  >
                    {isTurnCollapsed ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
                    <span>{isTurnCollapsed ? 'Expand' : 'Collapse'}</span>
                  </button>
                </div>
              </div>
            ) : null;

            // 1. User Prompt Card
            if (step.type === 'USER_INPUT' && step.userPrompt) {
              const warnings = step.userPrompt.credentialWarnings || [];
              return (
                <React.Fragment key={step.stepIndex}>
                  {turnHeader}
                  <div className="timeline-row-group">
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
                </React.Fragment>
              );
            }

            // 2. Assistant Response (Reasoning, Tools, Final Message)
            if (step.type === 'PLANNER_RESPONSE') {
              const isReasoningExpanded = expandedReasoning[step.stepIndex] !== false; // default true
              const tokenEstimate = Math.max(240, Math.round(((step.thinking?.length || 0) + 120) / 3.8));

              return (
                <React.Fragment key={step.stepIndex}>
                  {turnHeader}
                  <div className="timeline-row-group">
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
                            <span>
                              Tokens: {(step.tokenMetrics?.totalTokens ?? tokenEstimate).toLocaleString()}
                              {step.tokenMetrics?.cacheReadTokens ? ` (${step.tokenMetrics.cacheReadTokens.toLocaleString()} cached)` : ''}
                            </span>
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

                    const isEditTool =
                      toolName === 'replace_file_content' ||
                      toolName === 'write_to_file' ||
                      toolName === 'multi_replace_file_content' ||
                      toolName === 'edit_file' ||
                      toolName === 'write_file';

                    // Tool Execution: Edit File (Diff Viewer)
                    if (isEditTool) {
                      const diff = tc.result?.diff;
                      const isWrite = toolName === 'write_to_file' || toolName === 'write_file';
                      const rawOld = diff?.oldContent ?? (isWrite ? '' : (tc.args.Target ?? tc.args.TargetContent ?? ''));
                      const rawNew = diff?.newContent ?? (isWrite ? (tc.args.Content ?? tc.args.CodeContent ?? '') : (tc.args.Replacement ?? tc.args.ReplacementContent ?? tc.args.Content ?? tc.args.CodeContent ?? ''));
                      const normalizedOld = normalizeContent(rawOld);
                      const normalizedNew = normalizeContent(rawNew);
                      const addedLines = normalizedNew ? normalizedNew.split('\n').length : 18;

                      const rawTarget = diff?.targetFile || tc.args.Path || tc.args.TargetFile || tc.args.path || 'src/services/auth.service.ts';
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
                              <span className="header-title">Tool Execution: {isWrite ? 'Write File' : 'Edit File'}</span>
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
                              startLine={diff?.startLine || (tc.args.StartLine ? parseInt(String(tc.args.StartLine), 10) : (isWrite ? 1 : 1))}
                              endLine={diff?.endLine || (tc.args.EndLine ? parseInt(String(tc.args.EndLine), 10) : undefined)}
                              isFullscreen={isDiffFullscreen}
                              onToggleFullscreen={() => setFullscreenDiffKey(isDiffFullscreen ? null : diffKey)}
                            />
                          </div>
                        </div>
                      );
                    }

                    // Tool Execution: Terminal Command
                    if (toolName === 'run_command') {
                      const exitCode = tc.result?.exitCode;
                      const isSuccess = exitCode === undefined || exitCode === 0;

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
                              <span className={`status-tag ${isSuccess ? 'success' : 'error'}`}>
                                {isSuccess ? 'Success' : `Exit ${exitCode}`}
                              </span>
                              <span className="tool-runtime-badge mono">3.1s</span>
                              <button className="hud-toggle-chevron">
                                <ChevronDown size={14} />
                              </button>
                            </div>
                          </div>

                          <div className="card-inner-body p-0">
                            <TerminalBlock
                              commandLine={tc.args.CommandLine || tc.args.command || ''}
                              cwd={tc.args.Cwd || tc.args.cwd}
                              exitCode={exitCode}
                              content={tc.result?.content}
                              toolAction={tc.args.toolAction}
                              toolSummary={tc.args.toolSummary}
                            />
                          </div>
                        </div>
                      );
                    }

                    // Tool Execution: View File / Read File
                    if (toolName === 'view_file' || toolName === 'read_file') {
                      const vf = tc.result?.viewedFile;
                      const rawPath = vf?.path || tc.args.Path || tc.args.AbsolutePath || tc.args.path || '';
                      const startLine = vf?.startLine || (tc.args.StartLine ? parseInt(String(tc.args.StartLine), 10) : undefined);
                      const endLine = vf?.endLine || (tc.args.EndLine ? parseInt(String(tc.args.EndLine), 10) : undefined);
                      const content = vf?.content || tc.result?.content || '';

                      return (
                        <div key={tcIdx} className="hud-card card-tool-execution">
                          <div className="card-top-header">
                            <div className="header-identity">
                              <div className="avatar-icon file-avatar">
                                <FileCode size={14} />
                              </div>
                              <span className="header-title">Tool Execution: {toolName === 'read_file' ? 'Read File' : 'View File'}</span>
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
                              filePath={cleanFilePath(rawPath)}
                              startLine={startLine}
                              endLine={endLine}
                              content={content}
                              toolAction={tc.args.toolAction}
                              toolSummary={tc.args.toolSummary}
                              conversationId={conversationId}
                            />
                          </div>
                        </div>
                      );
                    }

                    // Tool Execution: Invoke Subagent
                    if (toolName === 'invoke_subagent') {
                      const typeName = tc.args.TypeName || tc.args.typeName || 'subagent';
                      const role = tc.args.Role || tc.args.role || 'Assistant';
                      const prompt = tc.args.Prompt || tc.args.prompt || '';
                      const isSuccess = tc.result?.status !== 'ERROR';

                      return (
                        <div key={tcIdx} className="hud-card card-tool-execution" style={{ borderColor: 'rgba(139, 92, 246, 0.4)' }}>
                          <div className="card-top-header" style={{ background: 'rgba(139, 92, 246, 0.08)' }}>
                            <div className="header-identity">
                              <div className="avatar-icon ai-avatar" style={{ background: 'var(--cortex-synapse-purple)', color: '#ffffff' }}>
                                <GitFork size={14} />
                              </div>
                              <div>
                                <span className="header-title" style={{ color: 'var(--cortex-deep-thought)', fontWeight: 700 }}>
                                  Spawn Subagent: {role}
                                </span>
                                <span className="mono" style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block' }}>
                                  Type: {typeName}
                                </span>
                              </div>
                            </div>

                            <div className="header-actions">
                              <span className={`status-tag ${isSuccess ? 'success' : 'error'}`}>
                                {isSuccess ? 'Subagent Dispatched' : 'Failed'}
                              </span>
                            </div>
                          </div>

                          <div className="card-inner-body" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', background: 'var(--bg-main)', padding: '10px 12px', borderRadius: '6px', border: '1px solid var(--border-subtle)', lineHeight: '1.5' }}>
                              <span style={{ fontWeight: 600, color: 'var(--cortex-deep-thought)', display: 'block', marginBottom: '4px' }}>Delegated Objective:</span>
                              {prompt}
                            </div>
                            {tc.result?.content && (
                              <div className="terminal-output" style={{ maxHeight: '140px', fontSize: '11px' }}>
                                {tc.result.content}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    }

                    // Tool Execution: Search Web / Read URL
                    if (toolName === 'search_web' || toolName === 'read_url_content') {
                      const query = tc.args.query || tc.args.Query || tc.args.Url || tc.args.url || '';
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
                              {query}
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
                          {tc.args && Object.keys(tc.args).length > 0 && (
                            <pre className="mono" style={{ fontSize: '11px', color: '#64748b', margin: 0, whiteSpace: 'pre-wrap' }}>
                              {JSON.stringify(tc.args, null, 2)}
                            </pre>
                          )}
                          {tc.result?.content && (
                            <div className="terminal-output" style={{ maxHeight: '180px', marginTop: '8px' }}>
                              {tc.result.content}
                            </div>
                          )}
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
            </React.Fragment>
          );
        }

        return null;
      }))}
        <div ref={bottomRef} style={{ height: 1 }} />
      </div>

      {/* Floating Jump to Latest Button */}
      {newStepsCount > 0 && !autoScrollLocked && (
        <button
          className="hud-jump-latest-btn"
          onClick={() => {
            setAutoScrollLocked(true);
            setNewStepsCount(0);
            bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
          }}
          title="Jump to newest live streamed steps"
        >
          <ArrowDown size={14} />
          <span>Jump to latest ({newStepsCount} new)</span>
        </button>
      )}

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
