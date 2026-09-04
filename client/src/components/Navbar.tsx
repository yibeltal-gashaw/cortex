import React from 'react';
import { FolderGit2, Settings, Sun, Moon, ShieldCheck, MessageSquare } from 'lucide-react';
import { AppStatus } from '../types/index.js';
import { useAgentPermissions } from '../hooks/useAgentPermissions.js';

interface NavbarProps {
  status: AppStatus | null;
  totalConversations: number;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onOpenSettings: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  status,
  totalConversations,
  theme,
  onToggleTheme,
  onOpenSettings
}) => {
  const { currentView, setCurrentView, skills } = useAgentPermissions();
  const executingCount = Object.values(skills).filter((s) => s.status === 'executing').length;
  const allowedCount = Object.values(skills).filter((s) => s.level !== 'deny').length;

  return (
    <header className="navbar">
      <div className="nav-brand" onClick={() => setCurrentView('conversations')} style={{ cursor: 'pointer' }}>
        <div className="brand-icon-wrapper" style={{ padding: '2px', background: 'transparent', boxShadow: 'none' }}>
          <img src="/favicon.svg" alt="Cortex Logo" width="24" height="24" style={{ display: 'block' }} />
        </div>
        <div>
          <h1 className="brand-title">Antigravity Tracker</h1>
        </div>
        <span className="brand-badge">CORTEX HUD</span>
      </div>

      {/* Top-Level Page Navigation Tabs */}
      <div className="nav-top-tabs">
        <button
          className={`nav-tab-btn ${currentView === 'conversations' ? 'active' : ''}`}
          onClick={() => setCurrentView('conversations')}
          title="Conversation Inspector & Timelines"
        >
          <MessageSquare size={14} />
          <span>Conversations</span>
        </button>

        <button
          className={`nav-tab-btn ${currentView === 'permissions' ? 'active' : ''}`}
          onClick={() => setCurrentView('permissions')}
          title="Skills & Runtime Permissions Governance Hub"
        >
          <span className={`pulse-dot ${executingCount > 0 ? 'executing' : ''}`} />
          <ShieldCheck size={14} />
          <span>Skills & Permissions</span>
          <span className="mini-hud-counter">{allowedCount}/5</span>
        </button>
      </div>

      <div className="nav-actions">
        <div className="data-dir-tag" title={status?.dataDir || 'Default directory'}>
          <span className="pulse-dot" />
          <span style={{ maxWidth: '280px' }} className="truncate mono">
            {status?.dataDir ? status.dataDir.split(/[\\/]/).slice(-2).join('/') : 'Connecting...'}
          </span>
        </div>

        <div className="metric-pill" title="Total conversations detected">
          <FolderGit2 size={14} className="icon" />
          <span><strong>{totalConversations}</strong> Sessions</span>
        </div>

        <button
          className="theme-toggle-btn"
          onClick={onToggleTheme}
          title={`Switch to ${theme === 'light' ? 'Dark' : 'Cortex Light'} theme`}
        >
          {theme === 'light' ? <Moon size={15} /> : <Sun size={15} />}
        </button>

        <button
          className="metric-pill"
          onClick={onOpenSettings}
          title="Configure Antigravity Data Directory"
          style={{ cursor: 'pointer' }}
        >
          <Settings size={14} className="icon" />
          <span>Settings</span>
        </button>
      </div>
    </header>
  );
};

