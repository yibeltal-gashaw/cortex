import React, { useState } from 'react';
import {
  Search,
  X,
  Plus,
  SlidersHorizontal,
  ArrowRight,
  Clock
} from 'lucide-react';
import { ConversationSummary } from '../types/index.js';

interface SidebarProps {
  conversations: ConversationSummary[];
  workspaces: { name: string; count: number }[];
  selectedId: string | null;
  selectedWorkspace: string;
  searchQuery: string;
  total: number;
  onSelectConversation: (id: string) => void;
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
  onSelectConversation,
  onSelectWorkspace,
  onSearchChange,
  onNewSession
}) => {
  const [showFilters, setShowFilters] = useState(false);

  return (
    <aside className="hud-session-drawer">
      {/* 1. New Session Action Button */}
      <div className="drawer-action-top">
        <button
          className="hud-new-session-btn"
          onClick={onNewSession || (() => {})}
          title="Start or prompt a new agent task (Cmd/Ctrl + K)"
        >
          <div className="btn-inner-left">
            <Plus size={16} className="plus-icon" />
            <span>New Session</span>
          </div>
          <kbd className="hud-kbd">⌘ K</kbd>
        </button>
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

      {/* 4. Session Cards List */}
      <div className="drawer-session-list">
        {conversations.length === 0 ? (
          <div className="drawer-empty-state">
            <p>No sessions match your filter.</p>
          </div>
        ) : (
          conversations.map((c) => {
            const isSelected = c.id === selectedId;
            return (
              <div
                key={c.id}
                className={`hud-session-card ${isSelected ? 'selected' : ''}`}
                onClick={() => onSelectConversation(c.id)}
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
                </div>
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
