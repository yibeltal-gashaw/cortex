import React from 'react';
import {
  ShieldCheck,
  ArrowLeft,
  Zap,
  Sliders,
  History,
  PlayCircle,
  FileCode,
  Terminal,
  Database,
  Globe,
  Bot,
  CheckCircle2,
  HelpCircle,
  Lock
} from 'lucide-react';
import { useAgentPermissions } from '../hooks/useAgentPermissions.js';
import { PermissionsManager } from './PermissionsManager.js';
import { AuditTrailFeed } from './AuditTrailFeed.js';
import { SkillId, PermissionLevel, PersistenceScope } from '../types/permissions.js';

export const SkillsPermissionsPage: React.FC = () => {
  const {
    skills,
    activeTab,
    sessionGrants,
    setCurrentView,
    setActiveTab,
    setPermissionLevel,
    simulateSkillExecution
  } = useAgentPermissions();

  const skillList: SkillId[] = [
    'workspace_files',
    'terminal_execution',
    'ide_memory',
    'network_access',
    'browser_agent'
  ];

  const totalSkills = skillList.length;
  const allowedSkills = skillList.filter((id) => skills[id].level === 'allow').length;
  const askSkills = skillList.filter((id) => skills[id].level === 'ask').length;
  const blockedSkills = skillList.filter((id) => skills[id].level === 'deny').length;
  const executingCount = skillList.filter((id) => skills[id].status === 'executing').length;

  const getSkillIcon = (id: SkillId) => {
    switch (id) {
      case 'workspace_files':
        return <FileCode size={20} color="var(--cortex-cognitive-teal)" />;
      case 'terminal_execution':
        return <Terminal size={20} color="var(--cortex-cognitive-teal)" />;
      case 'ide_memory':
        return <Database size={20} color="var(--cortex-synapse-purple)" />;
      case 'network_access':
        return <Globe size={20} color="var(--cortex-cognitive-teal)" />;
      case 'browser_agent':
        return <Bot size={20} color="var(--cortex-synapse-purple)" />;
    }
  };

  const handleLevelChange = (id: SkillId, level: PermissionLevel) => {
    setPermissionLevel(id, level, skills[id].scope);
  };

  const handleScopeChange = (id: SkillId, scope: PersistenceScope) => {
    setPermissionLevel(id, skills[id].level, scope);
  };

  return (
    <div className="permissions-page-container">
      {/* Top Breadcrumb & Actions Bar */}
      <div className="perm-page-nav-bar">
        <button
          className="back-to-tracker-btn"
          onClick={() => setCurrentView('conversations')}
          title="Return to Antigravity Conversation Inspector"
        >
          <ArrowLeft size={15} />
          <span>Back to Conversation Tracker</span>
        </button>

        <div className="perm-page-nav-right">
          <div className="live-shield-pill">
            <span className={`pulse-dot ${executingCount > 0 ? 'executing' : ''}`} />
            <ShieldCheck size={14} color="var(--cortex-execution-green)" />
            <span>Interception Middleware Armed</span>
          </div>
        </div>
      </div>

      <div className="perm-page-content">
        {/* Hero Section */}
        <div className="perm-hero-card">
          <div className="perm-hero-header">
            <div className="perm-hero-icon-box">
              <ShieldCheck size={28} color="#FFFFFF" />
            </div>
            <div className="perm-hero-text">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h1 className="perm-hero-title">Skills & Permissions Governance Hub</h1>
                <span className="hud-accent-tag">CORTEX HUD</span>
              </div>
              <p className="perm-hero-subtitle">
                Inspect active agent capabilities, configure runtime permission policies, and govern Just-In-Time (JIT) consent.
              </p>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="perm-metrics-grid">
            <div className="perm-metric-card">
              <span className="metric-card-label">Monitored Capabilities</span>
              <div className="metric-card-val-row">
                <span className="metric-card-value">{totalSkills}</span>
                <span className="metric-card-pill">All Systems</span>
              </div>
              <span className="metric-card-desc">Active agent tools</span>
            </div>

            <div className="perm-metric-card">
              <span className="metric-card-label">Allowed (Continuous)</span>
              <div className="metric-card-val-row">
                <span className="metric-card-value" style={{ color: 'var(--cortex-execution-green)' }}>
                  {allowedSkills}
                </span>
                <span className="metric-card-pill allow">
                  <CheckCircle2 size={11} />
                  <span>Unrestricted</span>
                </span>
              </div>
              <span className="metric-card-desc">Execution without prompt</span>
            </div>

            <div className="perm-metric-card">
              <span className="metric-card-label">Strict JIT Consent</span>
              <div className="metric-card-val-row">
                <span className="metric-card-value" style={{ color: '#d97706' }}>
                  {askSkills}
                </span>
                <span className="metric-card-pill ask">
                  <HelpCircle size={11} />
                  <span>Interactive</span>
                </span>
              </div>
              <span className="metric-card-desc">Prompts JIT authorization</span>
            </div>

            <div className="perm-metric-card">
              <span className="metric-card-label">Blocked by Policy</span>
              <div className="metric-card-val-row">
                <span className="metric-card-value" style={{ color: blockedSkills > 0 ? 'var(--cortex-memory-wipe)' : 'var(--cortex-grey-matter)' }}>
                  {blockedSkills}
                </span>
                <span className="metric-card-pill deny">
                  <Lock size={11} />
                  <span>Restricted</span>
                </span>
              </div>
              <span className="metric-card-desc">Completely disallowed</span>
            </div>
          </div>
        </div>

        {/* Tab Sub-Navigation */}
        <div className="perm-page-tabs">
          <button
            className={`perm-page-tab ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            <Zap size={14} />
            <span>Capabilities & Policies</span>
          </button>

          <button
            className={`perm-page-tab ${activeTab === 'granular' ? 'active' : ''}`}
            onClick={() => setActiveTab('granular')}
          >
            <Sliders size={14} />
            <span>Granular Scopes & Whitelists</span>
          </button>

          <button
            className={`perm-page-tab ${activeTab === 'audit' ? 'active' : ''}`}
            onClick={() => setActiveTab('audit')}
          >
            <History size={14} />
            <span>Security Audit Trail</span>
          </button>

          <button
            className={`perm-page-tab ${activeTab === 'simulator' ? 'active' : ''}`}
            onClick={() => setActiveTab('simulator')}
          >
            <PlayCircle size={14} />
            <span>Capability Simulator</span>
          </button>
        </div>

        {/* Tab 1: Capabilities & Policies */}
        {activeTab === 'overview' && (
          <div className="perm-tab-pane">
            <div className="pane-intro-row">
              <div>
                <h3 className="pane-title">Active Capabilities Matrix</h3>
                <p className="pane-desc">
                  Select default authorization behavior for each capability. Changes take effect instantly across the runtime workspace.
                </p>
              </div>
            </div>

            <div className="standalone-skills-list">
              {skillList.map((skillId) => {
                const skill = skills[skillId];
                const isAi = skill.category === 'ai_operation';
                const isExecuting = skill.status === 'executing';
                const isBlocked = skill.status === 'blocked' || skill.level === 'deny';
                const isSessionActive = sessionGrants[skillId];

                return (
                  <div
                    key={skillId}
                    className={`standalone-skill-card ${isAi ? 'ai-skill' : 'workspace-skill'} ${isBlocked ? 'blocked-skill' : ''}`}
                  >
                    <div className="skill-card-main-row">
                      {/* Left: Identity & Live Status */}
                      <div className="skill-identity-col">
                        <div className={`skill-icon-avatar ${isAi ? 'ai' : 'workspace'}`}>
                          {getSkillIcon(skillId)}
                        </div>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <h4 className="skill-card-name">{skill.name}</h4>
                            <span className={`skill-category-badge ${isAi ? 'ai' : 'workspace'}`}>
                              {isAi ? 'AI OPERATION' : 'WORKSPACE TOOLING'}
                            </span>
                            {isSessionActive && (
                              <span className="session-active-pill">Session Authorized</span>
                            )}
                          </div>
                          <p className="skill-card-description">{skill.description}</p>
                        </div>
                      </div>

                      {/* Middle: Live Radar Status */}
                      <div className="skill-status-col">
                        <div className={`skill-status-box ${isExecuting ? 'executing' : isBlocked ? 'blocked' : 'idle'}`}>
                          <div className="status-radar-cluster">
                            {isExecuting && <span className="radar-wave" />}
                            <span className="status-core-dot" />
                          </div>
                          <span className="status-text-label">
                            {isExecuting ? 'ACTIVELY EXECUTING' : isBlocked ? 'POLICY BLOCKED' : 'IDLE / ARMED'}
                          </span>
                        </div>
                        <span className="execution-stat-label">
                          {skill.executionCount} total invocations
                        </span>
                      </div>

                      {/* Right: Controls (Scope + Level) */}
                      <div className="skill-controls-col">
                        {/* Scope Toggle: Session vs Permanent */}
                        <div className="standalone-scope-switch" title="Persistence mode">
                          <button
                            className={`scope-switch-btn ${skill.scope === 'session' ? 'active' : ''}`}
                            onClick={() => handleScopeChange(skillId, 'session')}
                          >
                            Session
                          </button>
                          <button
                            className={`scope-switch-btn ${skill.scope === 'permanent' ? 'active' : ''}`}
                            onClick={() => handleScopeChange(skillId, 'permanent')}
                          >
                            Permanent
                          </button>
                        </div>

                        {/* 3-State Permission Level Selector */}
                        <div className="standalone-level-switch">
                          <button
                            className={`level-btn-choice allow ${skill.level === 'allow' ? 'selected' : ''}`}
                            onClick={() => handleLevelChange(skillId, 'allow')}
                            title="Continuous execution without prompts"
                          >
                            <CheckCircle2 size={13} />
                            <span>Allow</span>
                          </button>
                          <button
                            className={`level-btn-choice ask ${skill.level === 'ask' ? 'selected' : ''}`}
                            onClick={() => handleLevelChange(skillId, 'ask')}
                            title="Enforce Just-In-Time consent modal on invocation"
                          >
                            <HelpCircle size={13} />
                            <span>Ask JIT</span>
                          </button>
                          <button
                            className={`level-btn-choice deny ${skill.level === 'deny' ? 'selected' : ''}`}
                            onClick={() => handleLevelChange(skillId, 'deny')}
                            title="Block all tool calls for this capability"
                          >
                            <Lock size={13} />
                            <span>Block</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Tab 2: Granular Scopes & Whitelists */}
        {activeTab === 'granular' && (
          <div className="perm-tab-pane">
            <div className="pane-intro-row">
              <div>
                <h3 className="pane-title">Granular Scopes & Security Whitelists</h3>
                <p className="pane-desc">
                  Fine-tune allowed command whitelists, workspace root path boundaries, and memory protection policies.
                </p>
              </div>
            </div>
            <div className="standalone-granular-container">
              <PermissionsManager />
            </div>
          </div>
        )}

        {/* Tab 3: Security Audit Trail */}
        {activeTab === 'audit' && (
          <div className="perm-tab-pane">
            <div className="pane-intro-row">
              <div>
                <h3 className="pane-title">Security & Permission Audit Trail</h3>
                <p className="pane-desc">
                  Chronological event feed recording all runtime capability invocations, permission grants, and policy denials.
                </p>
              </div>
            </div>
            <div className="standalone-audit-container">
              <AuditTrailFeed />
            </div>
          </div>
        )}

        {/* Tab 4: Capability Simulator */}
        {activeTab === 'simulator' && (
          <div className="perm-tab-pane">
            <div className="pane-intro-row">
              <div>
                <h3 className="pane-title">Interactive Capability Simulator</h3>
                <p className="pane-desc">
                  Test-fire sample tool invocations to observe the real-time interception middleware, live radar status transitions, and JIT consent modals.
                </p>
              </div>
            </div>

            <div className="simulator-cards-grid">
              <div className="sim-standalone-card">
                <div className="sim-card-badge-row">
                  <span className="sim-category-tag workspace">WORKSPACE TOOL</span>
                  <span className="sim-risk-tag low">LOW RISK</span>
                </div>
                <div className="sim-card-body">
                  <div className="sim-card-icon-title">
                    <Terminal size={18} color="var(--cortex-cognitive-teal)" />
                    <h4>Whitelisted Shell Execution</h4>
                  </div>
                  <p className="sim-card-desc">
                    Executes a whitelisted terminal build command scoped to the active project.
                  </p>
                  <code className="sim-command-sample mono">npm run build</code>
                </div>
                <button
                  className="sim-execute-btn"
                  onClick={() => simulateSkillExecution('terminal_execution', 'Execute Terminal Command', 'npm run build')}
                >
                  <PlayCircle size={14} />
                  <span>Execute Command</span>
                </button>
              </div>

              <div className="sim-standalone-card">
                <div className="sim-card-badge-row">
                  <span className="sim-category-tag workspace">WORKSPACE TOOL</span>
                  <span className="sim-risk-tag high">HIGH RISK / JIT</span>
                </div>
                <div className="sim-card-body">
                  <div className="sim-card-icon-title">
                    <Terminal size={18} color="#d97706" />
                    <h4>Unwhitelisted Terminal Command</h4>
                  </div>
                  <p className="sim-card-desc">
                    Invokes a command not in the whitelist, triggering the Just-In-Time consent dialog.
                  </p>
                  <code className="sim-command-sample mono">cargo build --release</code>
                </div>
                <button
                  className="sim-execute-btn warning"
                  onClick={() => simulateSkillExecution('terminal_execution', 'Execute Unwhitelisted Command', 'cargo build --release')}
                >
                  <PlayCircle size={14} />
                  <span>Trigger Execution (JIT)</span>
                </button>
              </div>

              <div className="sim-standalone-card">
                <div className="sim-card-badge-row">
                  <span className="sim-category-tag workspace">WORKSPACE TOOL</span>
                  <span className="sim-risk-tag low">SAFE SCOPED</span>
                </div>
                <div className="sim-card-body">
                  <div className="sim-card-icon-title">
                    <FileCode size={18} color="var(--cortex-cognitive-teal)" />
                    <h4>Workspace File Edit</h4>
                  </div>
                  <p className="sim-card-desc">
                    Modifies project source code within the scoped workspace directory.
                  </p>
                  <code className="sim-command-sample mono">replace_file_content (App.tsx)</code>
                </div>
                <button
                  className="sim-execute-btn"
                  onClick={() => simulateSkillExecution('workspace_files', 'Workspace File Modification', 'd:/project/me/cortex/client/src/App.tsx')}
                >
                  <PlayCircle size={14} />
                  <span>Execute File Modification</span>
                </button>
              </div>

              <div className="sim-standalone-card critical-border">
                <div className="sim-card-badge-row">
                  <span className="sim-category-tag ai">AI MEMORY</span>
                  <span className="sim-risk-tag critical">CRITICAL RISK</span>
                </div>
                <div className="sim-card-body">
                  <div className="sim-card-icon-title">
                    <Database size={18} color="var(--cortex-memory-wipe)" />
                    <h4>Memory Wipe (Session Deletion)</h4>
                  </div>
                  <p className="sim-card-desc">
                    Permanently purges conversation session history and SQLite cache. Requires strict JIT consent.
                  </p>
                  <code className="sim-command-sample mono">DELETE /api/conversations/:id</code>
                </div>
                <button
                  className="sim-execute-btn critical"
                  onClick={() => simulateSkillExecution('ide_memory', 'Permanent Memory Wipe & Session Deletion', 'Session DB Cache & Artifacts')}
                >
                  <PlayCircle size={14} />
                  <span>Test Memory Wipe (JIT)</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
