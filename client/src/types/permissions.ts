export type SkillId =
  | 'workspace_files'
  | 'terminal_execution'
  | 'ide_memory'
  | 'network_access'
  | 'browser_agent';

export type SkillCategory = 'ai_operation' | 'workspace_tooling';

export type SkillStatus = 'idle' | 'executing' | 'blocked';

export type PermissionLevel = 'allow' | 'ask' | 'deny';

export type PersistenceScope = 'session' | 'permanent';

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface WorkspaceFilesConfig {
  accessMode: 'read-write' | 'read-only';
  scopedPath: string;
  restrictedPatterns: string[];
}

export interface TerminalExecutionConfig {
  mode: 'write-execute' | 'read-stdout';
  commandWhitelist: string[];
  blockedCommands: string[];
}

export interface IdeMemoryConfig {
  allowReadHistory: boolean;
  allowMemoryWipe: boolean;
  requireConsentForWipe: boolean;
}

export interface NetworkAccessConfig {
  enabled: boolean;
  allowedDomains: string[];
  blockExternalRequests: boolean;
}

export interface BrowserAgentConfig {
  enabled: boolean;
  headless: boolean;
  allowNavigation: boolean;
}

export interface GranularSkillConfig {
  workspace_files: WorkspaceFilesConfig;
  terminal_execution: TerminalExecutionConfig;
  ide_memory: IdeMemoryConfig;
  network_access: NetworkAccessConfig;
  browser_agent: BrowserAgentConfig;
}

export interface SkillDefinition {
  id: SkillId;
  name: string;
  category: SkillCategory;
  description: string;
  iconName: string;
  level: PermissionLevel;
  scope: PersistenceScope;
  status: SkillStatus;
  lastExecutedAt?: string;
  executionCount: number;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  skillId: SkillId;
  skillName: string;
  action:
    | 'grant'
    | 'revoke'
    | 'jit_allow_once'
    | 'jit_allow_session'
    | 'jit_deny'
    | 'tool_executed'
    | 'tool_blocked'
    | 'scope_updated';
  resource?: string;
  details: string;
  severity: 'info' | 'warning' | 'error' | 'success';
}

export interface JitConsentRequest {
  id: string;
  skillId: SkillId;
  skillName: string;
  actionName: string;
  resource: string;
  riskLevel: RiskLevel;
  details: string;
  onDecision: (decision: 'allow_once' | 'allow_session' | 'deny') => void;
}
