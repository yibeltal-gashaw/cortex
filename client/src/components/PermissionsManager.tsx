import React, { useState } from 'react';
import {
  FileCode,
  Terminal,
  Database,
  Globe,
  Bot,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  HelpCircle,
  Lock,
  Plus,
  X,
  Sliders
} from 'lucide-react';
import { useAgentPermissions } from '../hooks/useAgentPermissions.js';
import { SkillId, PermissionLevel, PersistenceScope } from '../types/permissions.js';

export const PermissionsManager: React.FC = () => {
  const {
    skills,
    granularConfigs,
    sessionGrants,
    setPermissionLevel,
    updateGranularConfig
  } = useAgentPermissions();

  const [expandedSkill, setExpandedSkill] = useState<SkillId | null>(null);
  const [newCmd, setNewCmd] = useState('');
  const [newDomain, setNewDomain] = useState('');
  const [newPattern, setNewPattern] = useState('');

  const toggleExpand = (id: SkillId) => {
    setExpandedSkill((prev) => (prev === id ? null : id));
  };

  const handleLevelChange = (id: SkillId, newLevel: PermissionLevel) => {
    const currentScope = skills[id].scope;
    setPermissionLevel(id, newLevel, currentScope);
  };

  const handleScopeChange = (id: SkillId, newScope: PersistenceScope) => {
    const currentLevel = skills[id].level;
    setPermissionLevel(id, currentLevel, newScope);
  };

  const addCommand = () => {
    if (!newCmd.trim()) return;
    const current = granularConfigs.terminal_execution.commandWhitelist;
    if (!current.includes(newCmd.trim())) {
      updateGranularConfig('terminal_execution', {
        commandWhitelist: [...current, newCmd.trim()]
      });
    }
    setNewCmd('');
  };

  const removeCommand = (cmd: string) => {
    updateGranularConfig('terminal_execution', {
      commandWhitelist: granularConfigs.terminal_execution.commandWhitelist.filter((c) => c !== cmd)
    });
  };

  const addDomain = () => {
    if (!newDomain.trim()) return;
    const current = granularConfigs.network_access.allowedDomains;
    if (!current.includes(newDomain.trim())) {
      updateGranularConfig('network_access', {
        allowedDomains: [...current, newDomain.trim()]
      });
    }
    setNewDomain('');
  };

  const removeDomain = (domain: string) => {
    updateGranularConfig('network_access', {
      allowedDomains: granularConfigs.network_access.allowedDomains.filter((d) => d !== domain)
    });
  };

  const addRestrictedPattern = () => {
    if (!newPattern.trim()) return;
    const current = granularConfigs.workspace_files.restrictedPatterns;
    if (!current.includes(newPattern.trim())) {
      updateGranularConfig('workspace_files', {
        restrictedPatterns: [...current, newPattern.trim()]
      });
    }
    setNewPattern('');
  };

  const removeRestrictedPattern = (pat: string) => {
    updateGranularConfig('workspace_files', {
      restrictedPatterns: granularConfigs.workspace_files.restrictedPatterns.filter((p) => p !== pat)
    });
  };

  const skillList: SkillId[] = [
    'workspace_files',
    'terminal_execution',
    'ide_memory',
    'network_access',
    'browser_agent'
  ];

  const getSkillIcon = (id: SkillId) => {
    switch (id) {
      case 'workspace_files':
        return <FileCode size={16} color="var(--cortex-cognitive-teal)" />;
      case 'terminal_execution':
        return <Terminal size={16} color="var(--cortex-cognitive-teal)" />;
      case 'ide_memory':
        return <Database size={16} color="var(--cortex-synapse-purple)" />;
      case 'network_access':
        return <Globe size={16} color="var(--cortex-cognitive-teal)" />;
      case 'browser_agent':
        return <Bot size={16} color="var(--cortex-synapse-purple)" />;
    }
  };

  return (
    <div className="permissions-manager-wrapper">
      <div className="perm-section-intro">
        <p>
          Configure runtime authorization levels and fine-grained sandbox scopes. Toggles can be stored permanently in local preferences or scoped to the active session.
        </p>
      </div>

      <div className="perm-skill-cards">
        {skillList.map((skillId) => {
          const skill = skills[skillId];
          const isExpanded = expandedSkill === skillId;
          const isSessionActive = sessionGrants[skillId];

          return (
            <div key={skillId} className={`perm-card ${skill.level === 'deny' ? 'blocked' : ''}`}>
              <div className="perm-card-main">
                {/* Left: Icon & Info */}
                <div className="perm-card-left">
                  <div className={`perm-icon-box ${skill.category === 'ai_operation' ? 'ai' : 'workspace'}`}>
                    {getSkillIcon(skillId)}
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <h4 className="perm-title">{skill.name}</h4>
                      {isSessionActive && (
                        <span className="session-active-tag">Active Session Grant</span>
                      )}
                    </div>
                    <p className="perm-desc">{skill.description}</p>
                  </div>
                </div>

                {/* Right: Permission Selector & Scope */}
                <div className="perm-card-right">
                  {/* Scope Selector: Session vs Permanent */}
                  <div className="scope-toggle-group" title="Persistence mode">
                    <button
                      className={`scope-btn ${skill.scope === 'session' ? 'active' : ''}`}
                      onClick={() => handleScopeChange(skillId, 'session')}
                    >
                      Session
                    </button>
                    <button
                      className={`scope-btn ${skill.scope === 'permanent' ? 'active' : ''}`}
                      onClick={() => handleScopeChange(skillId, 'permanent')}
                    >
                      Permanent
                    </button>
                  </div>

                  {/* Level Controls: Allow / Ask / Deny */}
                  <div className="level-btn-group">
                    <button
                      className={`level-btn allow ${skill.level === 'allow' ? 'active' : ''}`}
                      onClick={() => handleLevelChange(skillId, 'allow')}
                      title="Grant continuous permission"
                    >
                      <ShieldCheck size={12} />
                      <span>Allow</span>
                    </button>
                    <button
                      className={`level-btn ask ${skill.level === 'ask' ? 'active' : ''}`}
                      onClick={() => handleLevelChange(skillId, 'ask')}
                      title="Prompt Just-In-Time consent dialog before execution"
                    >
                      <HelpCircle size={12} />
                      <span>Ask (JIT)</span>
                    </button>
                    <button
                      className={`level-btn deny ${skill.level === 'deny' ? 'active' : ''}`}
                      onClick={() => handleLevelChange(skillId, 'deny')}
                      title="Block all tool invocations for this capability"
                    >
                      <Lock size={12} />
                      <span>Block</span>
                    </button>
                  </div>

                  {/* Expand Granular Settings */}
                  <button
                    className={`expand-settings-btn ${isExpanded ? 'active' : ''}`}
                    onClick={() => toggleExpand(skillId)}
                    title="Configure granular scopes"
                  >
                    <Sliders size={13} />
                    {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>
                </div>
              </div>

              {/* Expandable Granular Scope Drawer */}
              {isExpanded && (
                <div className="granular-scope-drawer">
                  {skillId === 'workspace_files' && (
                    <div className="granular-content">
                      <div className="granular-row">
                        <span className="granular-label">Access Mode:</span>
                        <div className="toggle-pill-group">
                          <button
                            className={`toggle-pill ${granularConfigs.workspace_files.accessMode === 'read-write' ? 'active' : ''}`}
                            onClick={() => updateGranularConfig('workspace_files', { accessMode: 'read-write' })}
                          >
                            Read & Write
                          </button>
                          <button
                            className={`toggle-pill ${granularConfigs.workspace_files.accessMode === 'read-only' ? 'active' : ''}`}
                            onClick={() => updateGranularConfig('workspace_files', { accessMode: 'read-only' })}
                          >
                            Read-Only
                          </button>
                        </div>
                      </div>

                      <div className="granular-row">
                        <span className="granular-label">Scoped Root Path:</span>
                        <input
                          type="text"
                          className="granular-input mono"
                          value={granularConfigs.workspace_files.scopedPath}
                          onChange={(e) => updateGranularConfig('workspace_files', { scopedPath: e.target.value })}
                          placeholder="Scoped workspace root (e.g. d:/project/me/cortex)"
                        />
                      </div>

                      <div className="granular-row-block">
                        <span className="granular-label">Restricted Patterns / Paths:</span>
                        <div className="tag-chips-list">
                          {granularConfigs.workspace_files.restrictedPatterns.map((pat) => (
                            <span key={pat} className="tag-chip">
                              <span>{pat}</span>
                              <button onClick={() => removeRestrictedPattern(pat)}>
                                <X size={11} />
                              </button>
                            </span>
                          ))}
                        </div>
                        <div className="add-tag-inline">
                          <input
                            type="text"
                            placeholder="Add blocked pattern (e.g., .env, secrets/)"
                            value={newPattern}
                            onChange={(e) => setNewPattern(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && addRestrictedPattern()}
                          />
                          <button onClick={addRestrictedPattern}>
                            <Plus size={12} /> Add
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {skillId === 'terminal_execution' && (
                    <div className="granular-content">
                      <div className="granular-row">
                        <span className="granular-label">Execution Mode:</span>
                        <div className="toggle-pill-group">
                          <button
                            className={`toggle-pill ${granularConfigs.terminal_execution.mode === 'write-execute' ? 'active' : ''}`}
                            onClick={() => updateGranularConfig('terminal_execution', { mode: 'write-execute' })}
                          >
                            Write & Execute
                          </button>
                          <button
                            className={`toggle-pill ${granularConfigs.terminal_execution.mode === 'read-stdout' ? 'active' : ''}`}
                            onClick={() => updateGranularConfig('terminal_execution', { mode: 'read-stdout' })}
                          >
                            Read Stdout Only
                          </button>
                        </div>
                      </div>

                      <div className="granular-row-block">
                        <span className="granular-label">Allowed Commands Whitelist:</span>
                        <div className="tag-chips-list">
                          {granularConfigs.terminal_execution.commandWhitelist.map((cmd) => (
                            <span key={cmd} className="tag-chip">
                              <span>{cmd}</span>
                              <button onClick={() => removeCommand(cmd)}>
                                <X size={11} />
                              </button>
                            </span>
                          ))}
                        </div>
                        <div className="add-tag-inline">
                          <input
                            type="text"
                            placeholder="Add command to whitelist (e.g. pytest, make)"
                            value={newCmd}
                            onChange={(e) => setNewCmd(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && addCommand()}
                          />
                          <button onClick={addCommand}>
                            <Plus size={12} /> Add
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {skillId === 'ide_memory' && (
                    <div className="granular-content">
                      <div className="granular-row">
                        <span className="granular-label">Read Conversation & DB History:</span>
                        <button
                          className={`toggle-pill ${granularConfigs.ide_memory.allowReadHistory ? 'active' : ''}`}
                          onClick={() => updateGranularConfig('ide_memory', { allowReadHistory: !granularConfigs.ide_memory.allowReadHistory })}
                        >
                          {granularConfigs.ide_memory.allowReadHistory ? 'Enabled' : 'Disabled'}
                        </button>
                      </div>

                      <div className="granular-row">
                        <span className="granular-label">Memory Wipe / Session Deletion:</span>
                        <button
                          className={`toggle-pill ${granularConfigs.ide_memory.allowMemoryWipe ? 'active' : ''}`}
                          onClick={() => updateGranularConfig('ide_memory', { allowMemoryWipe: !granularConfigs.ide_memory.allowMemoryWipe })}
                        >
                          {granularConfigs.ide_memory.allowMemoryWipe ? 'Allowed' : 'Disallowed'}
                        </button>
                      </div>

                      <div className="granular-row">
                        <span className="granular-label">Require Mandatory JIT Consent for Memory Wipe:</span>
                        <button
                          className={`toggle-pill ${granularConfigs.ide_memory.requireConsentForWipe ? 'active' : ''}`}
                          onClick={() => updateGranularConfig('ide_memory', { requireConsentForWipe: !granularConfigs.ide_memory.requireConsentForWipe })}
                        >
                          {granularConfigs.ide_memory.requireConsentForWipe ? 'Strict JIT Consent (Recommended)' : 'Bypass'}
                        </button>
                      </div>
                    </div>
                  )}

                  {skillId === 'network_access' && (
                    <div className="granular-content">
                      <div className="granular-row">
                        <span className="granular-label">Network Queries:</span>
                        <button
                          className={`toggle-pill ${granularConfigs.network_access.enabled ? 'active' : ''}`}
                          onClick={() => updateGranularConfig('network_access', { enabled: !granularConfigs.network_access.enabled })}
                        >
                          {granularConfigs.network_access.enabled ? 'Enabled' : 'Disabled'}
                        </button>
                      </div>

                      <div className="granular-row-block">
                        <span className="granular-label">Whitelisted Domains:</span>
                        <div className="tag-chips-list">
                          {granularConfigs.network_access.allowedDomains.map((dom) => (
                            <span key={dom} className="tag-chip">
                              <span>{dom}</span>
                              <button onClick={() => removeDomain(dom)}>
                                <X size={11} />
                              </button>
                            </span>
                          ))}
                        </div>
                        <div className="add-tag-inline">
                          <input
                            type="text"
                            placeholder="Add domain (e.g. stackoverflow.com)"
                            value={newDomain}
                            onChange={(e) => setNewDomain(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && addDomain()}
                          />
                          <button onClick={addDomain}>
                            <Plus size={12} /> Add
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {skillId === 'browser_agent' && (
                    <div className="granular-content">
                      <div className="granular-row">
                        <span className="granular-label">Headless Execution:</span>
                        <button
                          className={`toggle-pill ${granularConfigs.browser_agent.headless ? 'active' : ''}`}
                          onClick={() => updateGranularConfig('browser_agent', { headless: !granularConfigs.browser_agent.headless })}
                        >
                          {granularConfigs.browser_agent.headless ? 'Headless' : 'Visible Window'}
                        </button>
                      </div>

                      <div className="granular-row">
                        <span className="granular-label">Arbitrary Page Navigation:</span>
                        <button
                          className={`toggle-pill ${granularConfigs.browser_agent.allowNavigation ? 'active' : ''}`}
                          onClick={() => updateGranularConfig('browser_agent', { allowNavigation: !granularConfigs.browser_agent.allowNavigation })}
                        >
                          {granularConfigs.browser_agent.allowNavigation ? 'Allowed' : 'Restricted'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
