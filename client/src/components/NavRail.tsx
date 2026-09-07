import React from 'react';
import {
  Activity,
  Settings,
  Sun,
  Moon
} from 'lucide-react';
import { AppStatus } from '../types/index.js';

interface NavRailProps {
  currentView: string;
  onSelectView: (view: 'conversations' | 'permissions') => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onOpenSettings: () => void;
  isSettingsOpen?: boolean;
  status: AppStatus | null;
}

export const NavRail: React.FC<NavRailProps> = ({
  currentView,
  onSelectView,
  theme,
  onToggleTheme,
  onOpenSettings,
  isSettingsOpen = false,
  status
}) => {
  return (
    <nav className="hud-nav-rail" aria-label="Main Navigation">
      {/* Top: Cortex Brain Brand Logo */}
      <div className="rail-brand-slot" title="Cortex Brain">
        <div className="rail-brain-logo" onClick={() => onSelectView('conversations')}>
          <svg
            width="26"
            height="26"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="brain-icon"
          >
            {/* Elegant Brain / Cortex neural SVG */}
            <path d="M12 4.5a3 3 0 0 0-3 3v.5a3.5 3.5 0 0 0-2.5 3.38 3.5 3.5 0 0 0 .5 5.62 3 3 0 0 0 5 2.5V4.5z" />
            <path d="M12 4.5a3 3 0 0 1 3 3v.5a3.5 3.5 0 0 1 2.5 3.38 3.5 3.5 0 0 1-.5 5.62 3 3 0 0 1-5 2.5V4.5z" />
            <path d="M12 8v11" />
            <path d="M8 10a2 2 0 0 0-2 2" />
            <path d="M16 10a2 2 0 0 1 2 2" />
            <path d="M7 14a2 2 0 0 0 1.5 1.9" />
            <path d="M17 14a2 2 0 0 1-1.5 1.9" />
          </svg>
        </div>
      </div>

      {/* Middle: Icon Rail Actions */}
      <div className="rail-action-group">
        <button
          className={`rail-item ${currentView === 'conversations' ? 'active' : ''}`}
          onClick={() => onSelectView('conversations')}
          title="Live Execution Activity & Sessions"
        >
          <Activity size={20} />
          <span className="rail-tooltip">Activity Stream</span>
        </button>
        <div className="rail-divider" />
      </div>

      {/* Bottom: Settings, Theme Toggle, and Antigravity Status */}
      <div className="rail-footer-group">
        <button
          className={`rail-item ${isSettingsOpen ? 'active' : ''}`}
          onClick={onOpenSettings}
          title={`Settings (Data Dir: ${status?.dataDir || 'Default'})`}
          aria-label="Settings"
          aria-current={isSettingsOpen ? 'page' : undefined}
        >
          <Settings size={20} />
          <span className="rail-tooltip">Settings</span>
        </button>

        <button
          className="rail-item theme-toggle"
          onClick={onToggleTheme}
          title={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} Mode`}
        >
          {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
          <span className="rail-tooltip">{theme === 'light' ? 'Dark Mode' : 'Light Mode'}</span>
        </button>

        <div
          className="rail-status-dot"
          title={`Connected to Antigravity (${status?.nodeVersion || 'Node.js'})`}
        >
          <span className="status-indicator-dot" />
        </div>
      </div>
    </nav>
  );
};
