import React, { useState, useEffect, useRef } from 'react';
import {
  Terminal,
  Radio,
  Copy,
  Check,
  Search,
  AlertCircle,
  CheckCircle2,
  Download
} from 'lucide-react';

interface TaskTerminalViewerProps {
  conversationId: string;
  taskPath: string; // e.g. ".system_generated/tasks/task-151.log"
  initialContent?: string;
}

export const TaskTerminalViewer: React.FC<TaskTerminalViewerProps> = ({
  conversationId,
  taskPath,
  initialContent = ''
}) => {
  const [content, setContent] = useState<string>(initialContent);
  const [isLive, setIsLive] = useState<boolean>(true);
  const [autoScroll, setAutoScroll] = useState<boolean>(true);
  const [filterQuery, setFilterQuery] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const terminalEndRef = useRef<HTMLDivElement>(null);
  const terminalContainerRef = useRef<HTMLDivElement>(null);

  const taskId = taskPath.split(/[\\/]/).pop()?.replace(/^task-/, '').replace(/\.log$/, '') || taskPath;

  useEffect(() => {
    setContent(initialContent);
    let eventSource: EventSource | null = null;

    try {
      eventSource = new EventSource(`/api/conversations/${conversationId}/tasks/${encodeURIComponent(taskId)}/stream`);

      eventSource.addEventListener('initial', (e) => {
        try {
          const data = JSON.parse(e.data);
          setContent(data.content || '');
        } catch {}
      });

      eventSource.addEventListener('chunk', (e) => {
        try {
          const data = JSON.parse(e.data);
          setContent(prev => prev + (data.chunk || ''));
        } catch {}
      });

      eventSource.onopen = () => {
        setIsLive(true);
      };

      eventSource.onerror = () => {
        setIsLive(false);
      };
    } catch {
      setIsLive(false);
    }

    return () => {
      if (eventSource) {
        eventSource.close();
      }
    };
  }, [conversationId, taskId]);

  useEffect(() => {
    if (autoScroll) {
      terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [content, autoScroll]);

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = taskPath.split(/[\\/]/).pop() || 'task.log';
    a.click();
    URL.revokeObjectURL(url);
  };

  const lines = content.split('\n');
  const filteredLines = filterQuery.trim()
    ? lines.filter(l => l.toLowerCase().includes(filterQuery.toLowerCase()))
    : lines;

  const hasFailed = /Command exited with code [1-9]/i.test(content) || /error:|fatal:/i.test(content.slice(-400));
  const hasCompleted = content.includes('Command exited with code 0') || content.includes('Exit code: 0');

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: 'var(--bg-main)',
        borderRadius: '8px',
        overflow: 'hidden',
        border: '1px solid var(--cortex-grey-matter-border)'
      }}
    >
      {/* Header Toolbar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 16px',
          background: 'var(--bg-card)',
          borderBottom: '1px solid var(--cortex-grey-matter-border)',
          gap: '12px',
          flexWrap: 'wrap'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Terminal size={16} color="var(--cortex-synapse-purple)" />
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="mono" style={{ fontWeight: 700, fontSize: '13px', color: 'var(--cortex-deep-thought)' }}>
                {taskPath.split(/[\\/]/).pop()}
              </span>
              <span
                className="mini-badge mono"
                style={{
                  background: isLive ? 'rgba(16, 185, 129, 0.15)' : hasFailed ? 'rgba(239, 68, 68, 0.15)' : 'rgba(148, 163, 184, 0.15)',
                  color: isLive ? '#10b981' : hasFailed ? '#ef4444' : '#94a3b8',
                  fontSize: '10px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                {isLive ? <Radio size={10} className="pulse-icon" /> : hasFailed ? <AlertCircle size={10} /> : <CheckCircle2 size={10} />}
                <span>{isLive ? 'Live Streaming' : hasFailed ? 'Exit Non-Zero' : hasCompleted ? 'Completed (0)' : 'Finished'}</span>
              </span>
            </div>
            <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
              {lines.length} lines • {(new Blob([content]).size / 1024).toFixed(1)} KB buffer
            </span>
          </div>
        </div>

        {/* Actions Cluster */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Search Box */}
          <div style={{ position: 'relative', width: '160px' }}>
            <Search size={11} style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Filter output..."
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '4px 8px 4px 24px',
                fontSize: '11px',
                background: 'var(--bg-main)',
                border: '1px solid var(--cortex-grey-matter-border)',
                borderRadius: '4px',
                color: 'var(--cortex-deep-thought)',
                fontFamily: 'var(--font-mono)'
              }}
            />
          </div>

          <button
            className={`live-follow-pill ${autoScroll ? 'active' : ''}`}
            onClick={() => setAutoScroll(!autoScroll)}
            title="Auto-scroll to latest incoming output"
          >
            <Radio size={11} className={autoScroll ? 'spin-icon' : ''} />
            <span>Follow</span>
          </button>

          <button
            className="copy-btn"
            onClick={handleCopy}
            title="Copy log text"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 8px', fontSize: '11px' }}
          >
            {copied ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>

          <button
            className="copy-btn"
            onClick={handleDownload}
            title="Download full log"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 8px', fontSize: '11px' }}
          >
            <Download size={12} />
          </button>
        </div>
      </div>

      {/* Terminal Viewport */}
      <div
        ref={terminalContainerRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          background: '#090D14',
          color: '#E2E8F0',
          fontFamily: 'var(--font-mono)',
          fontSize: '11.5px',
          lineHeight: '1.5',
          padding: '12px 16px'
        }}
      >
        {filteredLines.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
            {filterQuery ? 'No lines match filter.' : 'Task output is empty.'}
          </div>
        ) : (
          filteredLines.map((line, idx) => {
            const isError = /error|failed|fatal|exception/i.test(line);
            const isSuccess = /success|passed|done|✓/i.test(line);
            const isCommand = line.startsWith('>') || line.startsWith('$');

            let lineColor = '#CBD5E1';
            if (isError) lineColor = '#F87171';
            else if (isSuccess) lineColor = '#34D399';
            else if (isCommand) lineColor = '#38BDF8';

            return (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  gap: '12px',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all'
                }}
              >
                <span
                  style={{
                    color: '#475569',
                    userSelect: 'none',
                    minWidth: '32px',
                    textAlign: 'right',
                    fontSize: '10px'
                  }}
                >
                  {idx + 1}
                </span>
                <span style={{ color: lineColor }}>{line}</span>
              </div>
            );
          })
        )}
        <div ref={terminalEndRef} style={{ height: '1px' }} />
      </div>
    </div>
  );
};
