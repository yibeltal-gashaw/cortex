import React, { useState, useEffect, useRef } from 'react';
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
  Trash2
} from 'lucide-react';
import { ConversationSummary } from '../types/index.js';
import { DeleteModal } from './DeleteModal.js';

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
  onDeleteConversations?: (ids: string[]) => void;
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
  onSelectConversation,
  onSelectWorkspace,
  onSearchChange,
  onDeleteConversations,
}) => {
  const [showFilters, setShowFilters] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(selectedId);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const selectAllCheckboxRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (selectedId) {
      setExpandedId(selectedId);
    }
  }, [selectedId]);

  // Prune any selected IDs that are no longer in conversations
  useEffect(() => {
    setSelectedIds(prev => {
      if (prev.size === 0) return prev;
      const validIds = new Set(conversations.map(c => c.id));
      const next = new Set<string>();
      for (const id of prev) {
        if (validIds.has(id)) next.add(id);
      }
      return next.size === prev.size ? prev : next;
    });
  }, [conversations]);

  const visibleIds = conversations.map(c => c.id);
  const selectedCount = selectedIds.size;
  const isAllSelected = conversations.length > 0 && visibleIds.every(id => selectedIds.has(id));
  const hasSomeSelected = selectedCount > 0 && !isAllSelected;

  useEffect(() => {
    if (selectAllCheckboxRef.current) {
      selectAllCheckboxRef.current.indeterminate = hasSomeSelected;
    }
  }, [hasSomeSelected]);

  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(visibleIds));
    }
  };

  const handleToggleCard = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

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
          {/* <span className="brand-badge">v1.0</span> */}
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

      {/* 3.5 Selection & Bulk Actions Bar */}
      {conversations.length > 0 && (
        <div className={`drawer-selection-bar ${selectedCount > 0 ? 'has-selected' : ''}`}>
          <label className="drawer-select-all-label" title={isAllSelected ? "Deselect all sessions" : "Select all sessions"}>
            <input
              type="checkbox"
              ref={selectAllCheckboxRef}
              className="cortex-checkbox"
              checked={isAllSelected}
              onChange={handleToggleSelectAll}
            />
            <span className="drawer-select-all-text">
              {selectedCount > 0 ? (
                <>
                  <span className="drawer-select-count">{selectedCount}</span> of {conversations.length} selected
                </>
              ) : (
                `Select all (${conversations.length})`
              )}
            </span>
          </label>

          {selectedCount > 0 && (
            <div className="drawer-selection-actions">
              <button
                type="button"
                className="drawer-selection-clear-btn"
                onClick={() => setSelectedIds(new Set())}
                title="Clear selection"
              >
                Clear
              </button>
              <button
                type="button"
                className="drawer-bulk-delete-btn"
                onClick={() => setIsDeleteModalOpen(true)}
                title={`Delete ${selectedCount} selected session${selectedCount > 1 ? 's' : ''}`}
              >
                <Trash2 size={12} />
                <span>Delete {selectedCount === conversations.length ? 'All' : `(${selectedCount})`}</span>
              </button>
            </div>
          )}
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
            const isChecked = selectedIds.has(c.id);

            return (
              <div
                key={c.id}
                className={`hud-session-card ${isSelected ? 'selected' : ''} ${isChecked ? 'card-checked' : ''}`}
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
                      <input
                        type="checkbox"
                        className="cortex-checkbox card-item-checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          e.stopPropagation();
                          handleToggleCard(c.id);
                        }}
                        onClick={(e) => e.stopPropagation()}
                        title={isChecked ? `Deselect "${c.title || c.id}"` : `Select "${c.title || c.id}"`}
                        aria-label={`Select session ${c.title || c.id}`}
                      />
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

      {/* Batch / Select-All Delete Confirmation Modal */}
      <DeleteModal
        conversationIds={Array.from(selectedIds)}
        conversationTitles={conversations.reduce((acc, cur) => {
          acc[cur.id] = cur.title || cur.id;
          return acc;
        }, {} as Record<string, string>)}
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onDeleted={(deletedIds: string[]) => {
          const idsArray = Array.isArray(deletedIds) ? deletedIds : [deletedIds];
          setSelectedIds(new Set());
          setIsDeleteModalOpen(false);
          onDeleteConversations?.(idsArray);
        }}
      />
    </aside>
  );
};
