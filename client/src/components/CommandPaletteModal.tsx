import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  MessageSquare,
  Database,
  Layers,
  Moon,
  RotateCw,
  GitCompare,
  Settings,
  Download,
  PanelLeft,
  PanelRight,
  ArrowRight
} from 'lucide-react';
import { ConversationSummary } from '../types/index.js';

interface CommandPaletteModalProps {
  isOpen: boolean;
  onClose: () => void;
  conversations: ConversationSummary[];
  onSelectConversation: (id: string, subTab?: 'timeline' | 'artifacts' | 'db') => void;
  onToggleTheme: () => void;
  onToggleSidebar: () => void;
  onToggleTelemetry: () => void;
  onRefresh: () => void;
  onOpenComparison: () => void;
  onOpenSettings: () => void;
  currentSessionId?: string | null;
}

interface CommandItem {
  id: string;
  category: 'Actions' | 'Sessions';
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  shortcut?: string;
  action: () => void;
}

export const CommandPaletteModal: React.FC<CommandPaletteModalProps> = ({
  isOpen,
  onClose,
  conversations,
  onSelectConversation,
  onToggleTheme,
  onToggleSidebar,
  onToggleTelemetry,
  onRefresh,
  onOpenComparison,
  onOpenSettings,
  currentSessionId
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Build items list
  const actionItems: CommandItem[] = [
    {
      id: 'action-refresh',
      category: 'Actions',
      title: 'Refresh Data & Sync Sessions',
      subtitle: 'Force cache invalidation and reload active state',
      icon: <RotateCw size={14} />,
      shortcut: 'Ctrl+R',
      action: () => { onRefresh(); onClose(); }
    },
    {
      id: 'action-compare',
      category: 'Actions',
      title: 'Open A/B Session Comparison Mode',
      subtitle: 'Compare model execution, duration, tokens and costs side-by-side',
      icon: <GitCompare size={14} />,
      action: () => { onOpenComparison(); onClose(); }
    },
    {
      id: 'action-toggle-theme',
      category: 'Actions',
      title: 'Toggle Color Theme (Dark / Light)',
      subtitle: 'Switch application color palette',
      icon: <Moon size={14} />,
      action: () => { onToggleTheme(); onClose(); }
    },
    {
      id: 'action-toggle-sidebar',
      category: 'Actions',
      title: 'Toggle Left Session Sidebar',
      subtitle: 'Expand or collapse sessions drawer',
      icon: <PanelLeft size={14} />,
      shortcut: 'Ctrl+B',
      action: () => { onToggleSidebar(); onClose(); }
    },
    {
      id: 'action-toggle-telemetry',
      category: 'Actions',
      title: 'Toggle Right Telemetry & Inspector Panel',
      subtitle: 'Show or hide token stats, costs, and viewed files panel',
      icon: <PanelRight size={14} />,
      action: () => { onToggleTelemetry(); onClose(); }
    },
    {
      id: 'action-settings',
      category: 'Actions',
      title: 'Open Settings & Data Directory Configuration',
      subtitle: 'Manage local Antigravity directories and system preferences',
      icon: <Settings size={14} />,
      action: () => { onOpenSettings(); onClose(); }
    }
  ];

  if (currentSessionId) {
    actionItems.push(
      {
        id: 'action-export-md',
        category: 'Actions',
        title: 'Export Active Session as Markdown Runbook (.md)',
        subtitle: 'Download scrubbed execution audit trail',
        icon: <Download size={14} />,
        action: () => {
          window.location.href = `/api/conversations/${currentSessionId}/export/markdown`;
          onClose();
        }
      },
      {
        id: 'action-export-html',
        category: 'Actions',
        title: 'Export Active Session as Standalone HTML (.html)',
        subtitle: 'Download self-contained interactive incident runbook',
        icon: <Download size={14} />,
        action: () => {
          window.location.href = `/api/conversations/${currentSessionId}/export/html`;
          onClose();
        }
      },
      {
        id: 'action-subtab-artifacts',
        category: 'Actions',
        title: 'Switch to Generative UI & Artifacts View',
        subtitle: 'Inspect generated HTML widgets, plans, walkthroughs, media',
        icon: <Layers size={14} />,
        action: () => { onSelectConversation(currentSessionId, 'artifacts'); onClose(); }
      },
      {
        id: 'action-subtab-db',
        category: 'Actions',
        title: 'Switch to SQLite Database & Query Console',
        subtitle: 'Inspect conversation tables and execute read-only queries',
        icon: <Database size={14} />,
        action: () => { onSelectConversation(currentSessionId, 'db'); onClose(); }
      }
    );
  }

  const sessionItems: CommandItem[] = conversations.map(c => ({
    id: `session-${c.id}`,
    category: 'Sessions',
    title: c.title || `Session ${c.id.slice(0, 8)}`,
    subtitle: `${c.workspace || 'Workspace'} • ${c.model || 'Model'} • ${c.stepCount} steps`,
    icon: <MessageSquare size={14} />,
    action: () => { onSelectConversation(c.id, 'timeline'); onClose(); }
  }));

  const allItems = [...actionItems, ...sessionItems];
  const q = query.trim().toLowerCase();
  const filtered = q
    ? allItems.filter(item => item.title.toLowerCase().includes(q) || (item.subtitle && item.subtitle.toLowerCase().includes(q)))
    : allItems;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(idx => Math.min(filtered.length - 1, idx + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(idx => Math.max(0, idx - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[selectedIndex]) {
        filtered[selectedIndex].action();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose} style={{ alignItems: 'flex-start', paddingTop: '10vh' }}>
      <div
        className="modal-dialog"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '640px',
          width: '92%',
          background: 'var(--bg-card)',
          borderRadius: '12px',
          boxShadow: '0 16px 48px rgba(0, 0, 0, 0.45)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          border: '1px solid var(--cortex-grey-matter-border)'
        }}
      >
        {/* Search Input Bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '14px 18px',
            borderBottom: '1px solid var(--cortex-grey-matter-border)',
            background: 'var(--bg-main)'
          }}
        >
          <Search size={18} color="var(--cortex-synapse-purple)" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Type a command or search sessions (e.g. compare, dark, prompt)..."
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              fontSize: '14px',
              color: 'var(--cortex-deep-thought)',
              fontFamily: 'inherit'
            }}
          />
          <kbd
            className="mono"
            style={{
              background: 'var(--bg-subtle)',
              padding: '2px 6px',
              borderRadius: '4px',
              fontSize: '11px',
              color: 'var(--text-muted)',
              border: '1px solid var(--border-subtle)'
            }}
          >
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div
          style={{
            maxHeight: '400px',
            overflowY: 'auto',
            padding: '8px'
          }}
        >
          {filtered.length === 0 ? (
            <div style={{ padding: '36px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
              No commands or sessions match "{query}".
            </div>
          ) : (
            filtered.map((item, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={item.id}
                  onClick={() => item.action()}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    background: isSelected ? 'var(--cortex-cognitive-teal-bg)' : 'transparent',
                    cursor: 'pointer',
                    transition: 'all 0.1s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
                    <div
                      style={{
                        color: isSelected ? 'var(--cortex-synapse-purple)' : 'var(--text-secondary)',
                        display: 'flex',
                        alignItems: 'center'
                      }}
                    >
                      {item.icon}
                    </div>
                    <div style={{ overflow: 'hidden' }}>
                      <span
                        style={{
                          fontSize: '13px',
                          fontWeight: isSelected ? 600 : 500,
                          color: isSelected ? 'var(--cortex-deep-thought)' : 'var(--cortex-deep-thought)',
                          display: 'block'
                        }}
                        className="truncate"
                      >
                        {item.title}
                      </span>
                      {item.subtitle && (
                        <span
                          style={{
                            fontSize: '11px',
                            color: 'var(--text-muted)',
                            display: 'block'
                          }}
                          className="truncate"
                        >
                          {item.subtitle}
                        </span>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {item.shortcut && (
                      <kbd
                        className="mono"
                        style={{
                          fontSize: '10px',
                          padding: '1px 5px',
                          background: 'var(--bg-subtle)',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: '3px',
                          color: 'var(--text-muted)'
                        }}
                      >
                        {item.shortcut}
                      </kbd>
                    )}
                    {isSelected && <ArrowRight size={14} color="var(--cortex-synapse-purple)" />}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Hint */}
        <div
          style={{
            padding: '8px 16px',
            borderTop: '1px solid var(--cortex-grey-matter-border)',
            background: 'var(--bg-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '11px',
            color: 'var(--text-muted)'
          }}
        >
          <span>Use ↑ ↓ to navigate, Enter to select</span>
          <span className="mono">Command Palette</span>
        </div>
      </div>
    </div>
  );
};
