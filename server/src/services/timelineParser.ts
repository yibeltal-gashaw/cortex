import fs from 'node:fs';
import path from 'node:path';
import { getDataDir } from '../config.js';
import { scanForCredentials, CredentialMatch } from './credentialScanner.js';
import { detectRealModel } from './conversationScanner.js';

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

export interface SubagentNode {
  id?: string;
  conversationId?: string;
  typeName: string;
  role: string;
  prompt: string;
  stepIndex: number;
  status?: string;
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

export interface ParsedConversationSession {
  id: string;
  createdAt: string;
  updatedAt: string;
  durationMs: number;
  durationFormatted: string;
  model: string;
  environmentSnapshot?: EnvironmentSnapshot;
  toolStats: Record<string, number>;
  tokenStats: SessionTokenStats;
  totalSteps: number;
  parentSessionId?: string;
  subagents?: SubagentNode[];
  steps: TimelineStep[];
}

function parseEnvironmentSnapshot(text: string): EnvironmentSnapshot | undefined {
  const metaMatch = text.match(/<ADDITIONAL_METADATA>([\s\S]*?)<\/ADDITIONAL_METADATA>/i);
  if (!metaMatch) return undefined;
  const meta = metaMatch[1];

  const snapshot: EnvironmentSnapshot = {
    openDocuments: [],
    terminalProcesses: []
  };

  const timeMatch = meta.match(/The current local time is:\s*([^\r\n.]+)/i);
  if (timeMatch) snapshot.localTime = timeMatch[1].trim();

  const docMatch = meta.match(/Active Document:\s*([^\r\n]+)/i);
  if (docMatch) {
    const raw = docMatch[1].trim();
    const langMatch = raw.match(/\((LANGUAGE_[A-Z0-9_]+)\)/i);
    const cleanPath = raw.replace(/\s*\([^)]+\)$/, '').trim();
    snapshot.activeDocument = {
      path: cleanPath,
      language: langMatch ? langMatch[1] : undefined
    };
  }

  const cursorMatch = meta.match(/Cursor is on line:\s*(\d+)/i);
  if (cursorMatch) snapshot.cursorLine = parseInt(cursorMatch[1], 10);

  // Parse open documents
  const docsSection = meta.match(/Other open documents:([\s\S]*?)(?:No browser pages|Running terminal|Browser pages|$)/i);
  if (docsSection) {
    const lines = docsSection[1].split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('-')) {
        const docPath = trimmed.replace(/^-\s*/, '').replace(/\s*\([^)]+\)$/, '').trim();
        if (docPath && !snapshot.openDocuments.includes(docPath)) {
          snapshot.openDocuments.push(docPath);
        }
      }
    }
  }

  // Parse running terminal commands
  const termSection = meta.match(/Running terminal commands:([\s\S]*?)(?:<\/ADDITIONAL_METADATA>|$)/i);
  if (termSection) {
    const lines = termSection[1].split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('-')) {
        const cmdText = trimmed.replace(/^-\s*/, '').trim();
        const inMatch = cmdText.match(/^(.*?)\s*\(in\s+([^,]+)(?:,\s*running for\s+([^)]+))?\)/i);
        if (inMatch) {
          snapshot.terminalProcesses.push({
            command: inMatch[1].trim(),
            cwd: inMatch[2].trim(),
            duration: inMatch[3]?.trim()
          });
        } else {
          snapshot.terminalProcesses.push({ command: cmdText });
        }
      }
    }
  }

  return snapshot;
}

function cleanUserRequest(text: string): string {
  const reqMatch = text.match(/<USER_REQUEST>([\s\S]*?)<\/USER_REQUEST>/i);
  if (reqMatch) return reqMatch[1].trim();
  return text.trim();
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes < 60) return `${minutes}m ${remainingSeconds}s`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
}

function cleanFilePath(filePath: string): string {
  if (!filePath) return '';
  let p = String(filePath).trim();
  while ((p.startsWith('"') && p.endsWith('"')) || (p.startsWith("'") && p.endsWith("'"))) {
    p = p.slice(1, -1).trim();
  }
  p = p.replace(/\\/g, '/');
  p = p.replace(/\/+/g, '/');
  return p;
}

function cleanContentString(content: string): string {
  if (!content) return '';
  let str = String(content).trim();
  if (str.startsWith('"') && (str.endsWith('"') || str.includes('\\n') || str.includes('<truncated'))) {
    if (str.startsWith('"')) str = str.slice(1);
    if (str.endsWith('"')) str = str.slice(0, -1);
  }
  str = str
    .replace(/\\r\\n/g, '\n')
    .replace(/\\n/g, '\n')
    .replace(/\\t/g, '  ')
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, '\\');
  return str.replace(/\r\n/g, '\n');
}

export function isEditTool(name: string): boolean {
  return [
    'replace_file_content',
    'edit_file',
    'write_to_file',
    'write_file',
    'multi_replace_file_content'
  ].includes(name);
}

export function isViewTool(name: string): boolean {
  return ['view_file', 'read_file'].includes(name);
}

export function isCommandTool(name: string): boolean {
  return name === 'run_command';
}

export function isWebTool(name: string): boolean {
  return ['read_url_content', 'search_web'].includes(name);
}

function parseCommandExitCode(rawStep: any): number {
  if (typeof rawStep.exit_code === 'number') {
    return rawStep.exit_code;
  }
  if (rawStep.content) {
    const match = String(rawStep.content).match(/Command exited with code\s+(-?\d+)/i);
    if (match) {
      return parseInt(match[1], 10);
    }
  }
  return rawStep.status === 'ERROR' ? 1 : 0;
}

function extractEditFileDiff(
  toolName: string,
  args: Record<string, any>,
  resultContent?: string
): { targetFile: string; oldContent: string; newContent: string; startLine?: number; endLine?: number } {
  const isWrite = toolName === 'write_to_file' || toolName === 'write_file';
  const targetFile = cleanFilePath(
    args.Path || args.TargetFile || args.path || args.target_file || args.targetFile || ''
  );

  const oldContent = isWrite
    ? ''
    : (args.Target ?? args.TargetContent ?? args.target ?? args.target_content ?? args.targetContent ?? '');

  const newContent = isWrite
    ? (args.Content ?? args.CodeContent ?? args.content ?? args.code_content ?? args.codeContent ?? '')
    : (args.Replacement ?? args.ReplacementContent ?? args.replacement ?? args.replacement_content ?? args.replacementContent ?? args.Content ?? args.CodeContent ?? '');

  const startLine = args.StartLine ? parseInt(String(args.StartLine), 10) : (isWrite ? 1 : undefined);
  const endLine = args.EndLine ? parseInt(String(args.EndLine), 10) : (isWrite ? 1 : undefined);

  return {
    targetFile,
    oldContent: cleanContentString(oldContent),
    newContent: cleanContentString(newContent),
    startLine,
    endLine
  };
}

function extractViewedFileInfo(
  args: Record<string, any>,
  content: string
): { path: string; startLine?: number; endLine?: number; content: string } {
  const filePath = cleanFilePath(
    args.Path || args.AbsolutePath || args.path || args.absolutePath || args.filePath || ''
  );
  const startLine = args.StartLine ? parseInt(String(args.StartLine), 10) : undefined;
  const endLine = args.EndLine ? parseInt(String(args.EndLine), 10) : undefined;

  return {
    path: filePath,
    startLine,
    endLine,
    content: cleanContentString(content)
  };
}

function calculateEstimatedCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
  cacheReadTokens: number
): number {
  const m = (model || '').toLowerCase();
  let inputRatePerM = 0.15;
  let cacheRatePerM = 0.0375;
  let outputRatePerM = 0.60;

  if (m.includes('flash')) {
    inputRatePerM = 0.075;
    cacheRatePerM = 0.01875;
    outputRatePerM = 0.30;
  } else if (m.includes('argon') || m.includes('pro')) {
    inputRatePerM = 1.25;
    cacheRatePerM = 0.3125;
    outputRatePerM = 5.00;
  } else if (m.includes('opus')) {
    inputRatePerM = 15.00;
    cacheRatePerM = 1.50;
    outputRatePerM = 75.00;
  } else if (m.includes('sonnet') || m.includes('claude')) {
    inputRatePerM = 3.00;
    cacheRatePerM = 0.30;
    outputRatePerM = 15.00;
  }

  const cost =
    (inputTokens * inputRatePerM +
      cacheReadTokens * cacheRatePerM +
      outputTokens * outputRatePerM) /
    1_000_000;

  return Math.round(cost * 10000) / 10000;
}

export function parseConversationTimeline(conversationId: string): ParsedConversationSession | null {
  const dataDir = getDataDir();
  const logPath = path.join(dataDir, 'brain', conversationId, '.system_generated', 'logs', 'transcript.jsonl');
  
  if (!fs.existsSync(logPath)) {
    return null;
  }

  const rawFile = fs.readFileSync(logPath, 'utf8');
  const lines = rawFile.split('\n').filter(Boolean);

  const rawSteps: any[] = [];
  for (let i = 0; i < lines.length; i++) {
    try {
      rawSteps.push(JSON.parse(lines[i]));
    } catch (e) {
      console.warn(`Failed to parse line ${i} of transcript for ${conversationId}`);
    }
  }

  let model = detectRealModel(conversationId, dataDir);
  let initialEnvironmentSnapshot: EnvironmentSnapshot | undefined;
  let parentSessionId: string | undefined;
  const subagents: SubagentNode[] = [];
  const toolStats: Record<string, number> = {};
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalCacheReadTokens = 0;

  const timelineSteps: TimelineStep[] = [];
  const pairedStepIndices = new Set<number>();

  // Group and link steps
  for (let i = 0; i < rawSteps.length; i++) {
    const raw = rawSteps[i];
    const stepType = raw.type;

    if (stepType === 'USER_INPUT') {
      const content = raw.content || '';
      const requestText = cleanUserRequest(content);
      const snapshot = parseEnvironmentSnapshot(content);
      if (!initialEnvironmentSnapshot && snapshot) {
        initialEnvironmentSnapshot = snapshot;
      }

      const modelChangeMatch = content.match(/setting `Model Selection` from .*? to ([^\r\n]+?)(?:\.\s*No need|\.\s*$|$)/i);
      if (modelChangeMatch) {
        model = modelChangeMatch[1].trim();
      }

      const credentialWarnings = scanForCredentials(content);

      if (!parentSessionId) {
        const parentMatch = content.match(/Parent conversation ID:\s*([0-9a-fA-F-]+)/i) ||
                            content.match(/parent_session_id["']?\s*:\s*["']?([0-9a-fA-F-]+)/i) ||
                            content.match(/parent_conversation_id["']?\s*:\s*["']?([0-9a-fA-F-]+)/i);
        if (parentMatch) {
          parentSessionId = parentMatch[1];
        }
      }

      timelineSteps.push({
        stepIndex: raw.step_index ?? i,
        type: 'USER_INPUT',
        source: raw.source || 'USER_EXPLICIT',
        status: raw.status || 'DONE',
        createdAt: raw.created_at || new Date().toISOString(),
        userPrompt: {
          raw: content,
          requestText,
          credentialWarnings
        },
        environmentSnapshot: snapshot,
        rawPayload: raw
      });
    } else if (stepType === 'PLANNER_RESPONSE') {
      const thinking = raw.thinking;
      const toolCallsRaw = raw.tool_calls || [];
      const toolCalls: ToolCallItem[] = [];

      for (let tcIdx = 0; tcIdx < toolCallsRaw.length; tcIdx++) {
        const tc = toolCallsRaw[tcIdx];
        const name = tc.name || tc.toolName || 'tool';
        toolStats[name] = (toolStats[name] || 0) + 1;

        const toolItem: ToolCallItem = {
          name,
          args: tc.args || {}
        };

        // Attempt to find subsequent result step in next positions
        for (let j = i + 1; j < Math.min(i + 10, rawSteps.length); j++) {
          if (pairedStepIndices.has(j)) {
            continue;
          }

          const nextRaw = rawSteps[j];
          if (nextRaw.type === 'PLANNER_RESPONSE' || nextRaw.type === 'USER_INPUT') {
            break;
          }

          // Pair RUN_COMMAND (handles RUN_COMMAND or GENERIC)
          if (isCommandTool(name) && (nextRaw.type === 'RUN_COMMAND' || nextRaw.type === 'GENERIC')) {
            const exitCode = parseCommandExitCode(nextRaw);
            toolItem.result = {
              type: 'RUN_COMMAND',
              status: nextRaw.status || (exitCode === 0 ? 'DONE' : 'ERROR'),
              exitCode,
              content: nextRaw.content
            };
            pairedStepIndices.add(j);
            break;
          }

          // Pair VIEW_FILE / READ_FILE (handles VIEW_FILE or GENERIC)
          if (isViewTool(name) && (nextRaw.type === 'VIEW_FILE' || nextRaw.type === 'GENERIC')) {
            toolItem.result = {
              type: 'VIEW_FILE',
              status: nextRaw.status || 'DONE',
              viewedFile: extractViewedFileInfo(toolItem.args, nextRaw.content || '')
            };
            pairedStepIndices.add(j);
            break;
          }

          // Pair CODE_ACTION (file edits/writes, handles CODE_ACTION, REPLACE_FILE_CONTENT, or GENERIC)
          if (isEditTool(name) && (nextRaw.type === 'CODE_ACTION' || nextRaw.type === 'REPLACE_FILE_CONTENT' || nextRaw.type === 'GENERIC')) {
            toolItem.result = {
              type: 'CODE_ACTION',
              status: nextRaw.status || 'DONE',
              content: nextRaw.content,
              diff: extractEditFileDiff(name, toolItem.args, nextRaw.content)
            };
            pairedStepIndices.add(j);
            break;
          }

          // Pair READ_URL_CONTENT / SEARCH_WEB (handles SEARCH_WEB, READ_URL_CONTENT, or GENERIC)
          if (isWebTool(name) && (nextRaw.type === 'READ_URL_CONTENT' || nextRaw.type === 'SEARCH_WEB' || nextRaw.type === 'GENERIC')) {
            toolItem.result = {
              type: name === 'search_web' ? 'SEARCH_WEB' : 'READ_URL_CONTENT',
              status: nextRaw.status || 'DONE',
              content: nextRaw.content
            };
            pairedStepIndices.add(j);
            break;
          }

          // Generic output step for any other tool
          if (nextRaw.content && !toolItem.result) {
            toolItem.result = {
              type: nextRaw.type,
              status: nextRaw.status || 'DONE',
              content: cleanContentString(nextRaw.content)
            };
            pairedStepIndices.add(j);
            break;
          }
        }

        // If edit or write didn't get diff from next step, extract diff directly from args
        if (isEditTool(name) && !toolItem.result?.diff) {
          toolItem.result = {
            type: 'CODE_ACTION',
            status: toolItem.result?.status || 'DONE',
            diff: extractEditFileDiff(name, toolItem.args, toolItem.result?.content)
          };
        } else if (isViewTool(name) && !toolItem.result?.viewedFile) {
          toolItem.result = {
            type: 'VIEW_FILE',
            status: toolItem.result?.status || 'DONE',
            viewedFile: extractViewedFileInfo(toolItem.args, toolItem.result?.content || '')
          };
        }

        if (name === 'invoke_subagent') {
          const typeName = toolItem.args.TypeName || toolItem.args.typeName || 'subagent';
          const role = toolItem.args.Role || toolItem.args.role || 'Assistant';
          const prompt = toolItem.args.Prompt || toolItem.args.prompt || '';
          let subagentConvId: string | undefined;

          if (toolItem.result?.content) {
            const m = toolItem.result.content.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
            if (m) subagentConvId = m[1];
          }

          const subNode: SubagentNode = {
            conversationId: subagentConvId,
            typeName,
            role,
            prompt: prompt.slice(0, 300),
            stepIndex: raw.step_index ?? i,
            status: toolItem.result?.status || 'DONE'
          };
          subagents.push(subNode);
        }

        toolCalls.push(toolItem);
      }

      const inTok = typeof raw.input_tokens === 'number' ? raw.input_tokens : (typeof raw.inputTokens === 'number' ? raw.inputTokens : 0);
      const cacheTok = typeof raw.cache_read_tokens === 'number' ? raw.cache_read_tokens : (typeof raw.cacheReadTokens === 'number' ? raw.cacheReadTokens : 0);
      const outTok = typeof raw.output_tokens === 'number' ? raw.output_tokens : (typeof raw.outputTokens === 'number' ? raw.outputTokens : Math.round(((thinking?.length || 0) + (raw.content?.length || 0)) / 3.8));

      let stepTokens: TokenMetrics | undefined;
      if (inTok > 0 || outTok > 0 || cacheTok > 0) {
        stepTokens = {
          inputTokens: inTok,
          outputTokens: outTok,
          cacheReadTokens: cacheTok,
          totalTokens: inTok + outTok
        };
        totalInputTokens += inTok;
        totalOutputTokens += outTok;
        totalCacheReadTokens += cacheTok;
      }

      const matchedSubagent = subagents.find(s => s.stepIndex === (raw.step_index ?? i));

      timelineSteps.push({
        stepIndex: raw.step_index ?? i,
        type: 'PLANNER_RESPONSE',
        source: raw.source || 'MODEL',
        status: raw.status || 'DONE',
        createdAt: raw.created_at || new Date().toISOString(),
        thinking,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        assistantResponse: raw.content || '',
        tokenMetrics: stepTokens,
        subagent: matchedSubagent,
        rawPayload: raw
      });
    } else if (['RUN_COMMAND', 'VIEW_FILE', 'CODE_ACTION', 'READ_URL_CONTENT', 'SEARCH_WEB', 'LIST_DIRECTORY', 'CHECKPOINT', 'CONVERSATION_HISTORY', 'GENERIC'].includes(stepType)) {
      // Standalone or unlinked step (e.g., initial knowledge artifacts, checkpoints)
      // We keep non-paired steps so nothing is hidden
      if (!pairedStepIndices.has(i)) {
        timelineSteps.push({
          stepIndex: raw.step_index ?? i,
          type: stepType,
          source: raw.source || 'SYSTEM',
          status: raw.status || 'DONE',
          createdAt: raw.created_at || new Date().toISOString(),
          assistantResponse: raw.content || '',
          rawPayload: raw
        });
      }
    }
  }

  const createdAt = rawSteps[0]?.created_at || new Date().toISOString();
  const updatedAt = rawSteps[rawSteps.length - 1]?.created_at || createdAt;
  const durationMs = Math.max(0, new Date(updatedAt).getTime() - new Date(createdAt).getTime());

  const totalPromptTokens = totalInputTokens + totalCacheReadTokens;
  const cacheHitRatePercent = totalPromptTokens > 0
    ? Math.min(100, Math.round((totalCacheReadTokens / totalPromptTokens) * 100))
    : 0;

  const estimatedCostUsd = calculateEstimatedCost(model, totalInputTokens, totalOutputTokens, totalCacheReadTokens);

  const tokenStats: SessionTokenStats = {
    totalInputTokens,
    totalOutputTokens,
    totalCacheReadTokens,
    totalTokens: totalPromptTokens + totalOutputTokens,
    cacheHitRatePercent,
    estimatedCostUsd
  };

  return {
    id: conversationId,
    createdAt,
    updatedAt,
    durationMs,
    durationFormatted: formatDuration(durationMs),
    model,
    environmentSnapshot: initialEnvironmentSnapshot,
    toolStats,
    tokenStats,
    totalSteps: rawSteps.length,
    parentSessionId,
    subagents: subagents.length > 0 ? subagents : undefined,
    steps: timelineSteps
  };
}
