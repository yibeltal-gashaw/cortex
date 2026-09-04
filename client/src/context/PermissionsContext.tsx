import React, { createContext, useState, useEffect, useCallback, ReactNode } from 'react';
import {
  SkillId,
  SkillDefinition,
  GranularSkillConfig,
  AuditLogEntry,
  JitConsentRequest,
  PermissionLevel,
  PersistenceScope,
  RiskLevel
} from '../types/permissions.js';

interface InterceptParams {
  skillId: SkillId;
  actionName: string;
  resource: string;
  riskLevel?: RiskLevel;
  details?: string;
}

interface PermissionsContextType {
  skills: Record<SkillId, SkillDefinition>;
  granularConfigs: GranularSkillConfig;
  auditLogs: AuditLogEntry[];
  activeJitRequest: JitConsentRequest | null;
  currentView: 'conversations' | 'permissions';
  isInspectorOpen: boolean;
  activeTab: 'overview' | 'granular' | 'audit' | 'simulator';
  sessionGrants: Record<SkillId, boolean>;
  setCurrentView: (view: 'conversations' | 'permissions') => void;
  setIsInspectorOpen: (open: boolean) => void;
  setActiveTab: (tab: 'overview' | 'granular' | 'audit' | 'simulator') => void;
  setPermissionLevel: (skillId: SkillId, level: PermissionLevel, scope: PersistenceScope) => void;
  updateGranularConfig: <K extends SkillId>(skillId: K, updates: Partial<GranularSkillConfig[K]>) => void;
  interceptSkillExecution: (params: InterceptParams) => Promise<boolean>;
  respondToJit: (decision: 'allow_once' | 'allow_session' | 'deny') => void;
  simulateSkillExecution: (skillId: SkillId, actionName: string, resource: string) => Promise<boolean>;
  clearAuditLogs: () => void;
}

const DEFAULT_SKILLS: Record<SkillId, SkillDefinition> = {
  workspace_files: {
    id: 'workspace_files',
    name: 'Workspace File Operations',
    category: 'workspace_tooling',
    description: 'Read, write, diff, and inspect project workspace code files',
    iconName: 'FileCode',
    level: 'allow',
    scope: 'permanent',
    status: 'idle',
    executionCount: 24,
    lastExecutedAt: new Date(Date.now() - 1000 * 60 * 3).toISOString()
  },
  terminal_execution: {
    id: 'terminal_execution',
    name: 'Terminal Interception',
    category: 'workspace_tooling',
    description: 'Intercept and execute command-line shell processes & stdout',
    iconName: 'Terminal',
    level: 'ask',
    scope: 'permanent',
    status: 'idle',
    executionCount: 12,
    lastExecutedAt: new Date(Date.now() - 1000 * 60 * 8).toISOString()
  },
  ide_memory: {
    id: 'ide_memory',
    name: 'IDE DB Sync & Memory',
    category: 'ai_operation',
    description: 'Read conversation state, SQLite BLOB cache, and memory wipes',
    iconName: 'Database',
    level: 'ask',
    scope: 'permanent',
    status: 'idle',
    executionCount: 8,
    lastExecutedAt: new Date(Date.now() - 1000 * 60 * 15).toISOString()
  },
  network_access: {
    id: 'network_access',
    name: 'Web Querying & Network',
    category: 'workspace_tooling',
    description: 'Documentation search, online repository indexing, and web fetch',
    iconName: 'Globe',
    level: 'allow',
    scope: 'permanent',
    status: 'idle',
    executionCount: 5,
    lastExecutedAt: new Date(Date.now() - 1000 * 60 * 30).toISOString()
  },
  browser_agent: {
    id: 'browser_agent',
    name: 'Browser Subagent',
    category: 'ai_operation',
    description: 'Headless DOM interaction, automated testing, and recording',
    iconName: 'Bot',
    level: 'ask',
    scope: 'session',
    status: 'idle',
    executionCount: 2,
    lastExecutedAt: new Date(Date.now() - 1000 * 60 * 60).toISOString()
  }
};

const DEFAULT_GRANULAR: GranularSkillConfig = {
  workspace_files: {
    accessMode: 'read-write',
    scopedPath: 'd:/project/me/cortex',
    restrictedPatterns: ['.env', 'credentials', '.git', 'id_rsa']
  },
  terminal_execution: {
    mode: 'write-execute',
    commandWhitelist: ['npm', 'git', 'node', 'npx', 'dir', 'ls', 'grep', 'cat', 'cargo'],
    blockedCommands: ['rm -rf', 'format', 'drop', 'del /f', 'mkfs']
  },
  ide_memory: {
    allowReadHistory: true,
    allowMemoryWipe: true,
    requireConsentForWipe: true
  },
  network_access: {
    enabled: true,
    allowedDomains: ['google.com', 'github.com', 'npmjs.com', 'nodejs.org', 'developer.mozilla.org'],
    blockExternalRequests: false
  },
  browser_agent: {
    enabled: true,
    headless: true,
    allowNavigation: true
  }
};

const INITIAL_AUDIT_LOGS: AuditLogEntry[] = [
  {
    id: 'audit-001',
    timestamp: new Date(Date.now() - 1000 * 60 * 20).toLocaleTimeString(),
    skillId: 'workspace_files',
    skillName: 'Workspace File Operations',
    action: 'grant',
    resource: 'd:/project/me/cortex',
    details: 'Workspace scoped read-write permission activated',
    severity: 'info'
  },
  {
    id: 'audit-002',
    timestamp: new Date(Date.now() - 1000 * 60 * 12).toLocaleTimeString(),
    skillId: 'terminal_execution',
    skillName: 'Terminal Interception',
    action: 'scope_updated',
    resource: 'Whitelist (8 commands)',
    details: 'JIT policy enabled for terminal command executions',
    severity: 'warning'
  },
  {
    id: 'audit-003',
    timestamp: new Date(Date.now() - 1000 * 60 * 4).toLocaleTimeString(),
    skillId: 'ide_memory',
    skillName: 'IDE DB Sync & Memory',
    action: 'scope_updated',
    resource: 'Memory Wipe Policy',
    details: 'Mandatory JIT authorization enforced for session deletion',
    severity: 'info'
  }
];

export const PermissionsContext = createContext<PermissionsContextType | null>(null);

export const PermissionsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Load persisted skills configuration
  const [skills, setSkills] = useState<Record<SkillId, SkillDefinition>>(() => {
    try {
      const saved = localStorage.getItem('cortex_agent_permissions');
      if (saved) {
        const parsed = JSON.parse(saved);
        const merged = { ...DEFAULT_SKILLS };
        Object.keys(parsed).forEach((k) => {
          const key = k as SkillId;
          if (merged[key]) {
            merged[key] = {
              ...merged[key],
              level: parsed[key].level,
              scope: parsed[key].scope
            };
          }
        });
        return merged;
      }
    } catch (e) {
      console.error('Failed to load permissions from storage', e);
    }
    return DEFAULT_SKILLS;
  });

  // Load granular configuration
  const [granularConfigs, setGranularConfigs] = useState<GranularSkillConfig>(() => {
    try {
      const saved = localStorage.getItem('cortex_agent_granular_configs');
      if (saved) {
        return { ...DEFAULT_GRANULAR, ...JSON.parse(saved) };
      }
    } catch (e) {
      console.error('Failed to load granular configs', e);
    }
    return DEFAULT_GRANULAR;
  });

  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>(INITIAL_AUDIT_LOGS);
  const [activeJitRequest, setActiveJitRequest] = useState<JitConsentRequest | null>(null);
  const [sessionGrants, setSessionGrants] = useState<Record<SkillId, boolean>>({
    workspace_files: false,
    terminal_execution: false,
    ide_memory: false,
    network_access: false,
    browser_agent: false
  });

  const [currentView, setCurrentView] = useState<'conversations' | 'permissions'>('conversations');
  const isInspectorOpen = currentView === 'permissions';
  const setIsInspectorOpen = useCallback((open: boolean) => {
    setCurrentView(open ? 'permissions' : 'conversations');
  }, []);

  const [activeTab, setActiveTab] = useState<'overview' | 'granular' | 'audit' | 'simulator'>('overview');

  // Sync to localStorage
  useEffect(() => {
    try {
      const toSave: Record<string, { level: PermissionLevel; scope: PersistenceScope }> = {};
      Object.keys(skills).forEach((k) => {
        const key = k as SkillId;
        toSave[key] = {
          level: skills[key].level,
          scope: skills[key].scope
        };
      });
      localStorage.setItem('cortex_agent_permissions', JSON.stringify(toSave));
    } catch (e) {
      console.error('Failed to save permissions to storage', e);
    }
  }, [skills]);

  useEffect(() => {
    try {
      localStorage.setItem('cortex_agent_granular_configs', JSON.stringify(granularConfigs));
    } catch (e) {
      console.error('Failed to save granular configs to storage', e);
    }
  }, [granularConfigs]);

  const addAuditEntry = useCallback((entry: Omit<AuditLogEntry, 'id' | 'timestamp'>) => {
    const newEntry: AuditLogEntry = {
      id: `audit-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      timestamp: new Date().toLocaleTimeString(),
      ...entry
    };
    setAuditLogs((prev) => [newEntry, ...prev.slice(0, 99)]);
  }, []);

  const setPermissionLevel = useCallback((skillId: SkillId, level: PermissionLevel, scope: PersistenceScope) => {
    setSkills((prev) => {
      const target = prev[skillId];
      if (!target) return prev;
      return {
        ...prev,
        [skillId]: {
          ...target,
          level,
          scope,
          status: level === 'deny' ? 'blocked' : 'idle'
        }
      };
    });

    addAuditEntry({
      skillId,
      skillName: skills[skillId]?.name || skillId,
      action: level === 'deny' ? 'revoke' : 'grant',
      details: `Permission changed to ${level.toUpperCase()} (${scope} scope)`,
      severity: level === 'deny' ? 'error' : level === 'ask' ? 'warning' : 'success'
    });
  }, [skills, addAuditEntry]);

  const updateGranularConfig = useCallback(<K extends SkillId>(skillId: K, updates: Partial<GranularSkillConfig[K]>) => {
    setGranularConfigs((prev) => ({
      ...prev,
      [skillId]: {
        ...prev[skillId],
        ...updates
      }
    }));

    addAuditEntry({
      skillId,
      skillName: skills[skillId]?.name || skillId,
      action: 'scope_updated',
      details: `Granular scope settings updated`,
      severity: 'info'
    });
  }, [skills, addAuditEntry]);

  // Interception Middleware
  const interceptSkillExecution = useCallback(async (params: InterceptParams): Promise<boolean> => {
    const { skillId, actionName, resource, riskLevel = 'medium', details = '' } = params;
    const skill = skills[skillId];
    if (!skill) return false;

    // 1. Check if outright Denied / Blocked
    if (skill.level === 'deny') {
      setSkills((prev) => ({
        ...prev,
        [skillId]: { ...prev[skillId], status: 'blocked' }
      }));

      addAuditEntry({
        skillId,
        skillName: skill.name,
        action: 'tool_blocked',
        resource,
        details: `Blocked by policy: ${actionName}`,
        severity: 'error'
      });

      return false;
    }

    // 2. Check if already granted for this session
    if (sessionGrants[skillId]) {
      // Execute directly
      setSkills((prev) => ({
        ...prev,
        [skillId]: {
          ...prev[skillId],
          status: 'executing',
          executionCount: prev[skillId].executionCount + 1,
          lastExecutedAt: new Date().toISOString()
        }
      }));

      addAuditEntry({
        skillId,
        skillName: skill.name,
        action: 'tool_executed',
        resource,
        details: `${actionName} (Session Grant)`,
        severity: 'success'
      });

      // Reset to idle after execution pulse
      setTimeout(() => {
        setSkills((prev) => ({
          ...prev,
          [skillId]: { ...prev[skillId], status: 'idle' }
        }));
      }, 1200);

      return true;
    }

    // 3. Check if action is high risk and requires JIT (e.g. Memory Wipe or command execution)
    const requiresJit =
      skill.level === 'ask' ||
      riskLevel === 'critical' ||
      (skillId === 'ide_memory' && granularConfigs.ide_memory.requireConsentForWipe && actionName.toLowerCase().includes('wipe'));

    if (!requiresJit && skill.level === 'allow') {
      // Allowed without JIT
      setSkills((prev) => ({
        ...prev,
        [skillId]: {
          ...prev[skillId],
          status: 'executing',
          executionCount: prev[skillId].executionCount + 1,
          lastExecutedAt: new Date().toISOString()
        }
      }));

      addAuditEntry({
        skillId,
        skillName: skill.name,
        action: 'tool_executed',
        resource,
        details: actionName,
        severity: 'success'
      });

      setTimeout(() => {
        setSkills((prev) => ({
          ...prev,
          [skillId]: { ...prev[skillId], status: 'idle' }
        }));
      }, 1200);

      return true;
    }

    // 4. Trigger JIT Consent Modal
    return new Promise<boolean>((resolve) => {
      const jitRequest: JitConsentRequest = {
        id: `jit-${Date.now()}`,
        skillId,
        skillName: skill.name,
        actionName,
        resource,
        riskLevel,
        details,
        onDecision: (decision) => {
          setActiveJitRequest(null);

          if (decision === 'deny') {
            setSkills((prev) => ({
              ...prev,
              [skillId]: { ...prev[skillId], status: 'blocked' }
            }));

            addAuditEntry({
              skillId,
              skillName: skill.name,
              action: 'jit_deny',
              resource,
              details: `User denied consent for ${actionName}`,
              severity: 'error'
            });

            setTimeout(() => {
              setSkills((prev) => ({
                ...prev,
                [skillId]: { ...prev[skillId], status: skill.level === 'deny' ? 'blocked' : 'idle' }
              }));
            }, 1500);

            resolve(false);
          } else {
            // Allowed
            if (decision === 'allow_session') {
              setSessionGrants((prev) => ({ ...prev, [skillId]: true }));
            }

            setSkills((prev) => ({
              ...prev,
              [skillId]: {
                ...prev[skillId],
                status: 'executing',
                executionCount: prev[skillId].executionCount + 1,
                lastExecutedAt: new Date().toISOString()
              }
            }));

            addAuditEntry({
              skillId,
              skillName: skill.name,
              action: decision === 'allow_session' ? 'jit_allow_session' : 'jit_allow_once',
              resource,
              details: `Authorized: ${actionName} (${decision === 'allow_session' ? 'Session' : 'Once'})`,
              severity: 'success'
            });

            setTimeout(() => {
              setSkills((prev) => ({
                ...prev,
                [skillId]: { ...prev[skillId], status: 'idle' }
              }));
            }, 1200);

            resolve(true);
          }
        }
      };

      setActiveJitRequest(jitRequest);
    });
  }, [skills, granularConfigs, sessionGrants, addAuditEntry]);

  const respondToJit = useCallback((decision: 'allow_once' | 'allow_session' | 'deny') => {
    if (activeJitRequest) {
      activeJitRequest.onDecision(decision);
    }
  }, [activeJitRequest]);

  // Utility to test-fire skill execution in simulation mode
  const simulateSkillExecution = useCallback(async (skillId: SkillId, actionName: string, resource: string): Promise<boolean> => {
    const risk: RiskLevel =
      skillId === 'ide_memory' ? 'critical' : skillId === 'terminal_execution' ? 'high' : 'medium';

    return interceptSkillExecution({
      skillId,
      actionName,
      resource,
      riskLevel: risk,
      details: `Simulated execution test via Cortex Skills Inspector`
    });
  }, [interceptSkillExecution]);

  const clearAuditLogs = useCallback(() => {
    setAuditLogs([]);
  }, []);

  return (
    <PermissionsContext.Provider
      value={{
        skills,
        granularConfigs,
        auditLogs,
        activeJitRequest,
        currentView,
        isInspectorOpen,
        activeTab,
        sessionGrants,
        setCurrentView,
        setIsInspectorOpen,
        setActiveTab,
        setPermissionLevel,
        updateGranularConfig,
        interceptSkillExecution,
        respondToJit,
        simulateSkillExecution,
        clearAuditLogs
      }}
    >
      {children}
    </PermissionsContext.Provider>
  );
};
