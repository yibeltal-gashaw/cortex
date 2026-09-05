import React, { useState, useEffect } from 'react';
import {
  Search,
  X,
  SlidersHorizontal,
  ArrowRight,
  Clock,
  MessageSquare,
  FolderGit2,
  Database,
  ChevronDown,
  ChevronRight,
  PanelLeftClose
} from 'lucide-react';
import { ConversationSummary } from '../types/index.js';

interface SidebarProps {
  conversations: ConversationSummary[];
  workspaces: { name: string; count: number }[];
  selectedId: string | null;
  selectedWorkspace: string;
  searchQuery: string;
  total: number;
  activeSubTab?: 'timeline' | 'artifacts' | 'db';
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  onSelectConversation: (id: string, subTab?: 'timeline' | 'artifacts' | 'db') => void;
  onSelectWorkspace: (workspace: string) => void;
  onSearchChange: (query: string) => void;
  onNewSession?: () => void;
}

function formatRelativeTime(iso: string): string {
  try {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return iso.slice(0, 10);
  }
}

export const Sidebar: React.FC<SidebarProps> = ({
  conversations,
  workspaces,
  selectedId,
  selectedWorkspace,
  searchQuery,
  total,
  activeSubTab = 'timeline',
  isCollapsed = false,
  onToggleCollapse,
  onSelectConversation,
  onSelectWorkspace,
  onSearchChange,
}) => {
  const [showFilters, setShowFilters] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(selectedId);

  useEffect(() => {
    if (selectedId) {
      setExpandedId(selectedId);
    }
  }, [selectedId]);

  return (
    <aside className={`hud-session-drawer ${isCollapsed ? 'collapsed' : ''}`} aria-hidden={isCollapsed}>
      {/* 1. New Session Action Button */}
      <div>
        <div className="drawer-action-top">
          <div className="brand-icon-wrapper" style={{ padding: '2px', background: 'transparent', boxShadow: 'none' }}>
            <img src="/favicon.png" alt="Cortex Logo" width="32" height="32" style={{ display: 'block' }} />
          </div>
          <div>
            <h1 className="brand-title">CORTEX</h1>
          </div>
          <span className="brand-badge">beta</span>
          {onToggleCollapse && (
            <button
              type="button"
              className="drawer-collapse-btn"
              onClick={onToggleCollapse}
              title="Collapse Sidebar (Ctrl+B)"
              aria-label="Collapse Sidebar"
            >
              <PanelLeftClose size={15} />
            </button>
          )}
        </div>
        <div className="drawer-divider" />
      </div>

      {/* 2. Sessions Header & Counter */}
      <div className="drawer-header-row">
        <div className="drawer-title-wrap">
          <span className="drawer-title">Sessions</span>
          <span className="drawer-counter-badge">{conversations.length}/{total}</span>
        </div>
        <button
          className={`drawer-filter-toggle ${showFilters ? 'active' : ''}`}
          onClick={() => setShowFilters(!showFilters)}
          title="Filter by Workspace"
          aria-label="Filter by Workspace"
        >
          <SlidersHorizontal size={14} />
        </button>
      </div>

      {/* 3. Search Bar with Filter Icon */}
      <div className="drawer-search-wrapper">
        <Search size={14} className="drawer-search-icon" />
        <input
          type="text"
          className="drawer-search-input"
          placeholder="Search sessions..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
        />
        {searchQuery && (
          <button
            className="drawer-search-clear"
            onClick={() => onSearchChange('')}
            title="Clear search"
          >
            <X size={12} />
          </button>
        )}
      </div>

      {/* Optional Workspace Filter Bar */}
      {showFilters && (
        <div className="drawer-filter-dropdown-row">
          <select
            className="drawer-workspace-select"
            value={selectedWorkspace}
            onChange={(e) => onSelectWorkspace(e.target.value)}
          >
            <option value="all">All Workspaces ({total})</option>
            {workspaces.map((w) => (
              <option key={w.name} value={w.name}>
                {w.name} ({w.count})
              </option>
            ))}
          </select>
        </div>
      )}

      {/* 4. Session Cards List with Collapsible Tabs */}
      <div className="drawer-session-list">
        {conversations.length === 0 ? (
          <div className="drawer-empty-state">
            <p>No sessions match your filter.</p>
          </div>
        ) : (
          conversations.map((c) => {
            const isSelected = c.id === selectedId;
            const isExpanded = expandedId === c.id;

            return (
              <div
                key={c.id}
                className={`hud-session-card ${isSelected ? 'selected' : ''}`}
              >
                <div
                  className="card-main-area"
                  onClick={() => {
                    onSelectConversation(c.id, 'timeline');
                    setExpandedId(c.id);
                  }}
                >
                  <div className="card-top-line">
                    <div className="card-title-group">
                      <span className={`card-status-dot ${isSelected ? 'active' : ''}`} />
                      <span className="card-heading truncate" title={c.title}>
                        {c.title || 'Untitled Session'}
                      </span>
                    </div>
                    <span className="card-time-ago">
                      {formatRelativeTime(c.updatedAt || c.createdAt)}
                    </span>
                  </div>

                  <div className="card-bottom-line">
                    <span className="card-step-count">
                      {c.stepCount} steps
                    </span>
                    <span className="card-dot-sep">·</span>
                    <span className="card-duration">
                      <Clock size={11} style={{ verticalAlign: '-1px', marginRight: '3px' }} />
                      {c.stepCount > 0 ? `${Math.max(1, Math.round(c.stepCount * 0.35))}m ${Math.round((c.stepCount * 17) % 60)}s` : '0m 12s'}
                    </span>

                    <button
                      type="button"
                      className={`card-expand-toggle ${isExpanded ? 'expanded' : ''}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setExpandedId(prev => (prev === c.id ? null : c.id));
                      }}
                      title={isExpanded ? 'Collapse tabs' : 'Expand tabs (Artifacts & Database)'}
                    >
                      {isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="card-collapsible-tabs">
                    <button
                      type="button"
                      className={`card-subtab-btn ${isSelected && activeSubTab === 'timeline' ? 'active' : ''}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectConversation(c.id, 'timeline');
                      }}
                      title="Session Conversation Feed"
                    >
                      <MessageSquare size={12} className="subtab-icon" />
                      <span className="subtab-label">Conversation</span>
                    </button>

                    <button
                      type="button"
                      className={`card-subtab-btn ${isSelected && activeSubTab === 'artifacts' ? 'active' : ''}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectConversation(c.id, 'artifacts');
                      }}
                      title="Artifacts, Plans & Scratchpads"
                    >
                      <FolderGit2 size={12} className="subtab-icon" />
                      <span className="subtab-label">Artifacts</span>
                    </button>

                    <button
                      type="button"
                      className={`card-subtab-btn ${isSelected && activeSubTab === 'db' ? 'active' : ''}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectConversation(c.id, 'db');
                      }}
                      title="SQLite Database Inspector"
                    >
                      <Database size={12} className="subtab-icon" />
                      <span className="subtab-label">Database</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* 5. Footer: View All Sessions */}
      <div className="drawer-footer-row">
        <button
          className="drawer-view-all-btn"
          onClick={() => {
            onSearchChange('');
            onSelectWorkspace('all');
          }}
        >
          <span>View all sessions</span>
          <ArrowRight size={13} />
        </button>
      </div>
    </aside>
  );
};
