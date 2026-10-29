export interface CredentialMatch {
  type: string;
  matchedText: string;
  maskedText: string;
  startIndex: number;
  endIndex: number;
  severity: 'high' | 'medium' | 'info';
}

export interface SubagentNode {
  id?: string;
  conversationId?: string;
  typeName: string;
  role: string;
  prompt: string;
  stepIndex: number;
  status?: string;
}

export interface ConversationSummary {
  id: string;
  title: string;
  promptPreview: string;
  workspace: string;
  workspacePath: string;
  model: string;
  createdAt: string;
  updatedAt: string;
  stepCount: number;
  fileSizeBytes: number;
  parentId?: string;
  isSubagent?: boolean;
  subagentRole?: string;
  subagentCount?: number;
  artifacts: {
    hasPlan: boolean;
    hasWalkthrough: boolean;
    scratchCount: number;
    uploadCount: number;
    taskCount: number;
    hasDb: boolean;
  };
}

export interface EnvironmentSnapshot {
  activeDocument?: {
    path: string;
    language?: string;
  };
  cursorLine?: number;
  openDocuments: string[];
  terminalProcesses: Array<{
    command: string;
    cwd?: string;
    duration?: string;
  }>;
  browserPages?: string[];
  localTime?: string;
}

export interface ToolCallItem {
  id?: string;
  name: string;
  args: Record<string, any>;
  result?: {
    type: string;
    status?: string;
    exitCode?: number;
    content?: string;
    diff?: {
      targetFile: string;
      oldContent: string;
      newContent: string;
      startLine?: number;
      endLine?: number;
    };
    viewedFile?: {
      path: string;
      startLine?: number;
      endLine?: number;
      content: string;
    };
  };
}

export interface TokenMetrics {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  totalTokens: number;
}

export interface SessionTokenStats {
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCacheReadTokens: number;
  totalTokens: number;
  cacheHitRatePercent: number;
  estimatedCostUsd: number;
}

export interface TimelineStep {
  stepIndex: number;
  type: string;
  source: string;
  status: string;
  createdAt: string;
  userPrompt?: {
    raw: string;
    requestText: string;
    credentialWarnings: CredentialMatch[];
  };
  environmentSnapshot?: EnvironmentSnapshot;
  thinking?: string;
  toolCalls?: ToolCallItem[];
  assistantResponse?: string;
  tokenMetrics?: TokenMetrics;
  subagent?: SubagentNode;
  rawPayload?: any;
}

export interface ParsedConversationSession {
  id: string;
  createdAt: string;
  updatedAt: string;
  durationMs: number;
  durationFormatted: string;
  model: string;
  environmentSnapshot?: EnvironmentSnapshot;
  toolStats: Record<string, number>;
  tokenStats?: SessionTokenStats;
  totalSteps: number;
  parentSessionId?: string;
  subagents?: SubagentNode[];
  steps: TimelineStep[];
}

export interface FileTreeNode {
  name: string;
  relativePath: string;
  type: 'file' | 'directory';
  size?: number;
  mtime?: string;
  extension?: string;
  children?: FileTreeNode[];
}

export interface ArtifactOverview {
  tree: FileTreeNode;
  hasPlan: boolean;
  hasWalkthrough: boolean;
  planContent?: string;
  walkthroughContent?: string;
  scratchFiles: Array<{ name: string; relativePath: string; size: number }>;
  uploadedMedia: Array<{ name: string; relativePath: string; size: number; url: string }>;
  taskLogs: Array<{ name: string; relativePath: string; size: number }>;
}

export interface ColumnInfo {
  cid: number;
  name: string;
  type: string;
  notnull: number;
  dflt_value: any;
  pk: number;
}

export interface TableSummary {
  name: string;
  rowCount: number;
  columns: ColumnInfo[];
}

export interface FormattedBlob {
  __isBlob: true;
  size: number;
  hex: string;
  textPreview: string;
  summary?: string;
  kind?: 'json' | 'protobuf' | 'text' | 'binary';
  parsedJson?: any;
  extractedStrings?: string[];
}

export interface SqlQueryResult {
  success: boolean;
  columns: string[];
  rows: any[];
  rowCount: number;
  durationMs: number;
  error?: string;
}

export interface DatabaseInfo {
  exists: boolean;
  tables: TableSummary[];
  dbPath: string;
  isGlobal?: boolean;
  hasBoth?: boolean;
}

export interface AppStatus {
  status: string;
  dataDir: string;
  defaultDataDir: string;
  platform: string;
  nodeVersion: string;
}

export interface DirectoryItem {
  name: string;
  path: string;
  hasAntigravityData: boolean;
}

export interface DirectoryBrowseResult {
  currentPath: string;
  parentPath: string | null;
  hasAntigravityData: boolean;
  homeDir: string;
  defaultDataDir: string;
  drives: string[];
  directories: DirectoryItem[];
}

export * from './permissions.js';

declare global {
  interface Window {
    electronAPI?: {
      platform: string;
      isElectron: boolean;
      updateTitleBarOverlay?: (isDark: boolean) => void;
      selectDirectory?: (defaultPath?: string) => Promise<string | null>;
    };
  }
}
