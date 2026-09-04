import React, { useState } from 'react';
import {
  ShieldCheck,
  Zap,
  Sliders,
  History,
  PlayCircle,
  Minimize2,
  Maximize2,
  X,
  AlertTriangle,
  ChevronRight,
  Terminal,
  FileCode,
  Database,
  Globe
} from 'lucide-react';
import { useAgentPermissions } from '../hooks/useAgentPermissions.js';
import { SkillBadge } from './SkillBadge.js';
import { PermissionsManager } from './PermissionsManager.js';
import { AuditTrailFeed } from './AuditTrailFeed.js';
import { SkillId } from '../types/permissions.js';

export const SkillsPermissionsInspector: React.FC = () => {
  const {
    skills,
    isInspectorOpen,
    activeTab,
    sessionGrants,
    setIsInspectorOpen,
    setActiveTab,
    simulateSkillExecution
  } = useAgentPermissions();

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [simulatingSkill, setSimulatingSkill] = useState<SkillId | null>(null);

  if (!isInspectorOpen) return null;

  const skillList: SkillId[] = [
    'workspace_files',
    'terminal_execution',
    'ide_memory',
    'network_access',
    'browser_agent'
  ];

  const allowedCount = skillList.filter((id) => skills[id].level !== 'deny').length;
  const executingCount = skillList.filter((id) => skills[id].status === 'executing').length;

  const runSimulation = async (id: SkillId, action: string, resource: string) => {
    setSimulatingSkill(id);
    try {
      await simulateSkillExecution(id, action, resource);
    } catch (e) {
      console.error(e);
    } finally {
      setSimulatingSkill(null);
    }
  };

  return (
    <div className={`skills-inspector-floating ${isCollapsed ? 'collapsed' : ''}`}>
      {/* Floating HUD Header */}
      <div className="inspector-header">
        <div className="inspector-header-left">
          <div className="inspector-badge-icon">
            <ShieldCheck size={16} color="#FFFFFF" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h3 className="inspector-title">Skills & Permissions</h3>
              <span className="hud-accent-tag">CORTEX HUD</span>
            </div>
            {!isCollapsed && (
              <p className="inspector-subtitle">
                Active capabilities & dynamic runtime consent
              </p>
            )}
          </div>
        </div>

        <div className="inspector-header-right">
          {/* Active capability metric */}
          <div className="status-counter-pill" title={`${allowedCount} enabled capabilities`}>
            <span className={`pulse-dot ${executingCount > 0 ? 'executing' : ''}`} />
            <span><strong>{allowedCount}</strong>/5 Active</span>
          </div>

          <button
            className="inspector-control-btn"
            onClick={() => setIsCollapsed(!isCollapsed)}
            title={isCollapsed ? 'Expand panel' : 'Collapse panel'}
          >
            {isCollapsed ? <Maximize2 size={13} /> : <Minimize2 size={13} />}
          </button>

          <button
            className="inspector-control-btn close"
            onClick={() => setIsInspectorOpen(false)}
            title="Close Inspector"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {!isCollapsed && (
        <>
          {/* Navigation Sub-Tabs */}
          <div className="inspector-tabs">
            <button
              className={`inspector-tab ${activeTab === 'overview' ? 'active' : ''}`}
              onClick={() => setActiveTab('overview')}
            >
              <Zap size={13} />
              <span>Active Skills</span>
            </button>

            <button
              className={`inspector-tab ${activeTab === 'granular' ? 'active' : ''}`}
              onClick={() => setActiveTab('granular')}
            >
              <Sliders size={13} />
              <span>Permissions & Scopes</span>
            </button>

            <button
              className={`inspector-tab ${activeTab === 'audit' ? 'active' : ''}`}
              onClick={() => setActiveTab('audit')}
            >
              <History size={13} />
              <span>Audit Feed</span>
            </button>

            <button
              className={`inspector-tab ${activeTab === 'simulator' ? 'active' : ''}`}
              onClick={() => setActiveTab('simulator')}
            >
              <PlayCircle size={13} />
              <span>Simulator</span>
            </button>
          </div>

          {/* Tab Body */}
          <div className="inspector-body">
            {/* 1. Overview Tab: Badges & Live Status */}
            {activeTab === 'overview' && (
              <div className="inspector-overview">
                <div className="badges-showcase-section">
                  <div className="section-subtitle-row">
                    <span>ACTIVE CAPABILITIES</span>
                    <span style={{ fontSize: '11px', color: 'var(--cortex-grey-matter)' }}>
                      Color-coded: Synapse Purple (AI) / Cognitive Teal (Workspace)
                    </span>
                  </div>

                  <div className="badges-grid">
                    {skillList.map((id) => (
                      <SkillBadge
                        key={id}
                        skill={skills[id]}
                        isSessionGranted={sessionGrants[id]}
                        onClick={() => setActiveTab('granular')}
                      />
                    ))}
                  </div>
                </div>

                <div className="quick-status-cards">
                  <div className="quick-card">
                    <div className="quick-card-header">
                      <FileCode size={14} color="var(--cortex-cognitive-teal)" />
                      <span>Workspace Scoped</span>
                    </div>
                    <p className="quick-card-value">d:/project/me/cortex</p>
                    <span className="quick-card-meta">Read-Write Enabled</span>
                  </div>

                  <div className="quick-card">
                    <div className="quick-card-header">
                      <Terminal size={14} color="var(--cortex-cognitive-teal)" />
                      <span>Terminal Policy</span>
                    </div>
                    <p className="quick-card-value">{skills.terminal_execution.level.toUpperCase()}</p>
                    <span className="quick-card-meta">9 Whitelisted Commands</span>
                  </div>

                  <div className="quick-card">
                    <div className="quick-card-header">
                      <Database size={14} color="var(--cortex-synapse-purple)" />
                      <span>Memory Wipe</span>
                    </div>
                    <p className="quick-card-value">MANDATORY JIT</p>
                    <span className="quick-card-meta">Irreversible Protection</span>
                  </div>
                </div>

                <div className="overview-footer-banner">
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <ShieldCheck size={14} color="var(--cortex-execution-green)" />
                    <span>Real-time Interception Middleware is actively protecting runtime operations.</span>
                  </span>
                  <button
                    className="simulator-jump-btn"
                    onClick={() => setActiveTab('simulator')}
                  >
                    <span>Test Sandbox</span>
                    <ChevronRight size={12} />
                  </button>
                </div>
              </div>
            )}

            {/* 2. Granular Permissions Tab */}
            {activeTab === 'granular' && <PermissionsManager />}

            {/* 3. Audit Feed Tab */}
            {activeTab === 'audit' && <AuditTrailFeed />}

            {/* 4. Execution Simulator Sandbox */}
            {activeTab === 'simulator' && (
              <div className="simulator-view">
                <div className="simulator-intro">
                  <h4>Interactive Capability Simulator</h4>
                  <p>
                    Trigger sample tool actions to observe the live interception middleware in real time. Actions will pulse the execution status indicator (`idle` ➔ `executing` ➔ `idle`), request JIT consent if ungranted or high-risk, or get blocked if policy is denied.
                  </p>
                </div>

                <div className="simulator-actions-grid">
                  <div className="sim-card">
                    <div className="sim-card-top">
                      <Terminal size={16} color="var(--cortex-cognitive-teal)" />
                      <div>
                        <h5>Test Whitelisted Terminal Command</h5>
                        <p className="mono">npm run build</p>
                      </div>
                    </div>
                    <button
                      className="sim-run-btn"
                      disabled={simulatingSkill !== null}
                      onClick={() => runSimulation('terminal_execution', 'Execute Terminal Command', 'npm run build')}
                    >
                      <PlayCircle size={13} />
                      <span>Execute</span>
                    </button>
                  </div>

                  <div className="sim-card">
                    <div className="sim-card-top">
                      <Terminal size={16} color="#d97706" />
                      <div>
                        <h5>Test Non-Whitelisted Terminal Command</h5>
                        <p className="mono">cargo build --release</p>
                      </div>
                    </div>
                    <button
                      className="sim-run-btn warning"
                      disabled={simulatingSkill !== null}
                      onClick={() => runSimulation('terminal_execution', 'Execute Unwhitelisted Command', 'cargo build --release')}
                    >
                      <PlayCircle size={13} />
                      <span>Execute (Triggers JIT)</span>
                    </button>
                  </div>

                  <div className="sim-card">
                    <div className="sim-card-top">
                      <FileCode size={16} color="var(--cortex-cognitive-teal)" />
                      <div>
                        <h5>Test Code File Edit</h5>
                        <p className="mono">replace_file_content (App.tsx)</p>
                      </div>
                    </div>
                    <button
                      className="sim-run-btn"
                      disabled={simulatingSkill !== null}
                      onClick={() => runSimulation('workspace_files', 'Workspace File Modification', 'd:/project/me/cortex/client/src/App.tsx')}
                    >
                      <PlayCircle size={13} />
                      <span>Execute</span>
                    </button>
                  </div>

                  <div className="sim-card critical">
                    <div className="sim-card-top">
                      <Database size={16} color="var(--cortex-memory-wipe)" />
                      <div>
                        <h5>Test Memory Wipe (High-Risk)</h5>
                        <p className="mono">delete_session_cache & storage</p>
                      </div>
                    </div>
                    <button
                      className="sim-run-btn critical"
                      disabled={simulatingSkill !== null}
                      onClick={() => runSimulation('ide_memory', 'Memory Wipe Session Deletion', 'Session DB Cache & Artifacts')}
                    >
                      <AlertTriangle size={13} />
                      <span>Test Memory Wipe (JIT)</span>
                    </button>
                  </div>

                  <div className="sim-card">
                    <div className="sim-card-top">
                      <Globe size={16} color="var(--cortex-synapse-purple)" />
                      <div>
                        <h5>Test Web Documentation Query</h5>
                        <p className="mono">search_web ("React Context")</p>
                      </div>
                    </div>
                    <button
                      className="sim-run-btn"
                      disabled={simulatingSkill !== null}
                      onClick={() => runSimulation('network_access', 'Web Documentation Query', 'google.com/search?q=react+context')}
                    >
                      <PlayCircle size={13} />
                      <span>Execute</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
