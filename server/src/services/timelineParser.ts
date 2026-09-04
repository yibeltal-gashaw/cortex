import fs from 'node:fs';
import path from 'node:path';
import { getDataDir } from '../config.js';
import { scanForCredentials, CredentialMatch } from './credentialScanner.js';

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
  totalSteps: number;
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
  p = p.replace(/^["']+|["']+$/g, '');
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

  let model = 'Gemini 3.7 Flash';
  let initialEnvironmentSnapshot: EnvironmentSnapshot | undefined;
  const toolStats: Record<string, number> = {};

  const timelineSteps: TimelineStep[] = [];

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

      for (const tc of toolCallsRaw) {
        const name = tc.name || tc.toolName || 'tool';
        toolStats[name] = (toolStats[name] || 0) + 1;

        const toolItem: ToolCallItem = {
          name,
          args: tc.args || {}
        };

        // Attempt to find subsequent result step in next positions
        for (let j = i + 1; j < Math.min(i + 5, rawSteps.length); j++) {
          const nextRaw = rawSteps[j];
          if (nextRaw.type === 'PLANNER_RESPONSE' || nextRaw.type === 'USER_INPUT') {
            break;
          }

          // Pair RUN_COMMAND
          if (name === 'run_command' && nextRaw.type === 'RUN_COMMAND') {
            toolItem.result = {
              type: 'RUN_COMMAND',
              status: nextRaw.status,
              exitCode: nextRaw.exit_code,
              content: nextRaw.content
            };
            break;
          }

          // Pair VIEW_FILE
          if (name === 'view_file' && nextRaw.type === 'VIEW_FILE') {
            toolItem.result = {
              type: 'VIEW_FILE',
              status: nextRaw.status,
              viewedFile: {
                path: cleanFilePath(toolItem.args.AbsolutePath || ''),
                startLine: toolItem.args.StartLine,
                endLine: toolItem.args.EndLine,
                content: cleanContentString(nextRaw.content || '')
              }
            };
            break;
          }

          // Pair CODE_ACTION (file edits)
          if ((name === 'replace_file_content' || name === 'write_to_file' || name === 'multi_replace_file_content') && (nextRaw.type === 'CODE_ACTION' || nextRaw.type === 'REPLACE_FILE_CONTENT')) {
            toolItem.result = {
              type: nextRaw.type,
              status: nextRaw.status,
              content: nextRaw.content,
              diff: {
                targetFile: cleanFilePath(toolItem.args.TargetFile || ''),
                oldContent: cleanContentString(toolItem.args.TargetContent || ''),
                newContent: cleanContentString(toolItem.args.ReplacementContent || toolItem.args.CodeContent || ''),
                startLine: toolItem.args.StartLine,
                endLine: toolItem.args.EndLine
              }
            };
            break;
          }

          // Pair READ_URL_CONTENT / SEARCH_WEB
          if ((name === 'read_url_content' || name === 'search_web') && (nextRaw.type === 'READ_URL_CONTENT' || nextRaw.type === 'SEARCH_WEB')) {
            toolItem.result = {
              type: nextRaw.type,
              status: nextRaw.status,
              content: nextRaw.content
            };
            break;
          }

          // Generic output step
          if (nextRaw.content && !toolItem.result) {
            toolItem.result = {
              type: nextRaw.type,
              status: nextRaw.status,
              content: cleanContentString(nextRaw.content)
            };
          }
        }

        // If replace_file_content didn't find next step, extract diff directly from args
        if (name === 'replace_file_content' && !toolItem.result?.diff) {
          toolItem.result = {
            type: 'CODE_ACTION',
            status: 'DONE',
            diff: {
              targetFile: cleanFilePath(toolItem.args.TargetFile || ''),
              oldContent: cleanContentString(toolItem.args.TargetContent || ''),
              newContent: cleanContentString(toolItem.args.ReplacementContent || ''),
              startLine: toolItem.args.StartLine,
              endLine: toolItem.args.EndLine
            }
          };
        } else if (name === 'write_to_file' && !toolItem.result?.diff) {
          toolItem.result = {
            type: 'CODE_ACTION',
            status: 'DONE',
            diff: {
              targetFile: cleanFilePath(toolItem.args.TargetFile || ''),
              oldContent: '',
              newContent: cleanContentString(toolItem.args.CodeContent || ''),
              startLine: 1,
              endLine: 1
            }
          };
        }

        toolCalls.push(toolItem);
      }

      timelineSteps.push({
        stepIndex: raw.step_index ?? i,
        type: 'PLANNER_RESPONSE',
        source: raw.source || 'MODEL',
        status: raw.status || 'DONE',
        createdAt: raw.created_at || new Date().toISOString(),
        thinking,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        assistantResponse: raw.content || '',
        rawPayload: raw
      });
    } else if (['RUN_COMMAND', 'VIEW_FILE', 'CODE_ACTION', 'READ_URL_CONTENT', 'SEARCH_WEB', 'LIST_DIRECTORY', 'CHECKPOINT', 'CONVERSATION_HISTORY'].includes(stepType)) {
      // Standalone or unlinked step (e.g., initial knowledge artifacts, checkpoints)
      // We keep non-paired steps so nothing is hidden
      const isAlreadyPaired = timelineSteps.some(step => 
        step.toolCalls?.some(tc => tc.result?.type === stepType && tc.result?.content === raw.content)
      );

      if (!isAlreadyPaired) {
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

  return {
    id: conversationId,
    createdAt,
    updatedAt,
    durationMs,
    durationFormatted: formatDuration(durationMs),
    model,
    environmentSnapshot: initialEnvironmentSnapshot,
    toolStats,
    totalSteps: rawSteps.length,
    steps: timelineSteps
  };
}
