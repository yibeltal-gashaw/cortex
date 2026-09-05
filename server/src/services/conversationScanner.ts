import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { getDataDir } from '../config.js';

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
  artifacts: {
    hasPlan: boolean;
    hasWalkthrough: boolean;
    scratchCount: number;
    uploadCount: number;
    taskCount: number;
    hasDb: boolean;
  };
}

interface CacheEntry {
  mtimeMs: number;
  fileSizeBytes: number;
  summary: ConversationSummary;
}

const summaryCache = new Map<string, CacheEntry>();

function extractWorkspaceFromText(text: string): { name: string; fullPath: string } {
  // Try to match Active Document
  const docMatch = text.match(/Active Document:\s*([^\r\n]+)/i);
  if (docMatch) {
    const rawPath = docMatch[1].replace(/\s*\([^)]+\)$/, '').trim();
    const parts = rawPath.replace(/\\/g, '/').split('/');
    // e.g. d:/project/ABa Projects/automated-report-system/dashboard/...
    // Let's find project folder
    const projIdx = parts.findIndex(p => p.toLowerCase() === 'project' || p.toLowerCase() === 'projects');
    if (projIdx !== -1 && projIdx + 1 < parts.length) {
      const projName = parts[projIdx + 1];
      const fullPath = parts.slice(0, projIdx + 2).join('/');
      return { name: projName, fullPath };
    } else if (parts.length >= 3) {
      return { name: parts[parts.length - 2], fullPath: parts.slice(0, -1).join('/') };
    }
  }

  // Try to match (in <path>) from terminal commands
  const termMatch = text.match(/\(in\s+([^\r\n,]+)/i);
  if (termMatch) {
    const rawPath = termMatch[1].trim();
    const parts = rawPath.replace(/\\/g, '/').split('/');
    return { name: parts[parts.length - 1], fullPath: rawPath };
  }

  // Try to match file:/// URI
  const uriMatch = text.match(/file:\/\/\/([^\r\n"'\s]+)/i);
  if (uriMatch) {
    const rawPath = decodeURIComponent(uriMatch[1]);
    const parts = rawPath.replace(/\\/g, '/').split('/');
    const projIdx = parts.findIndex(p => p.toLowerCase() === 'project' || p.toLowerCase() === 'projects');
    if (projIdx !== -1 && projIdx + 1 < parts.length) {
      return { name: parts[projIdx + 1], fullPath: parts.slice(0, projIdx + 2).join('/') };
    }
  }

  return { name: 'Default Workspace', fullPath: '' };
}

export function detectRealModel(conversationId: string, dataDir: string): string {
  const dbPath = path.join(dataDir, 'conversations', `${conversationId}.db`);
  if (!fs.existsSync(dbPath)) return '';
  let db: any = null;
  try {
    db = new DatabaseSync(dbPath, { readOnly: true });
    const tableExists = db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='gen_metadata'").get();
    if (!tableExists) return '';

    const rows = db.prepare('SELECT data FROM gen_metadata ORDER BY idx DESC LIMIT 5').all() as Array<{ data: any }>;
    for (const row of rows) {
      if (!row.data) continue;
      const str = Buffer.from(row.data).toString('utf8');
      const friendlyMatch = str.match(/(?:Gemini|Claude|GPT)[\s0-9.a-zA-Z]+(?:\s*\([a-zA-Z]+\))?/);
      if (friendlyMatch) {
        return friendlyMatch[0].trim();
      }
      const idMatch = str.match(/(?:gemini|claude|gpt)-[a-zA-Z0-9_.-]+/i);
      if (idMatch) {
        return idMatch[0].trim();
      }
    }
  } catch {
    return '';
  } finally {
    if (db) {
      try { db.close(); } catch {}
    }
  }
  return '';
}

function extractModelFromText(text: string): string {
  const modelMatch = text.match(/setting `Model Selection` from .*? to ([^\r\n]+?)(?:\.\s*No need|\.\s*$|$)/i);
  if (modelMatch) {
    return modelMatch[1].trim();
  }
  const explicitMatch = text.match(/(?:Gemini|Claude|GPT)[\s0-9.a-zA-Z]+(?:\s*\([a-zA-Z]+\))?/);
  if (explicitMatch) return explicitMatch[0].trim();
  const idMatch = text.match(/(?:gemini|claude|gpt)-[a-zA-Z0-9_.-]+/i);
  if (idMatch) return idMatch[0].trim();
  return '';
}

function parsePromptAndTitle(content: string): { title: string; prompt: string } {
  let prompt = '';
  const reqMatch = content.match(/<USER_REQUEST>([\s\S]*?)<\/USER_REQUEST>/i);
  if (reqMatch) {
    prompt = reqMatch[1].trim();
  } else {
    prompt = content.slice(0, 300).trim();
  }

  // Clean prompt for preview
  const cleanPrompt = prompt.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const title = cleanPrompt.length > 60 ? cleanPrompt.slice(0, 60) + '...' : cleanPrompt || 'Untitled Session';
  return { title, prompt: cleanPrompt };
}

export function scanSingleConversation(conversationId: string, dataDir: string): ConversationSummary | null {
  const brainDir = path.join(dataDir, 'brain', conversationId);
  if (!fs.existsSync(brainDir)) return null;

  const logPath = path.join(brainDir, '.system_generated', 'logs', 'transcript.jsonl');
  let mtimeMs = 0;
  let fileSizeBytes = 0;

  if (fs.existsSync(logPath)) {
    const stat = fs.statSync(logPath);
    mtimeMs = stat.mtimeMs;
    fileSizeBytes = stat.size;
  } else {
    const dirStat = fs.statSync(brainDir);
    mtimeMs = dirStat.mtimeMs;
  }

  // Check cache
  const cached = summaryCache.get(conversationId);
  if (cached && cached.mtimeMs === mtimeMs && cached.fileSizeBytes === fileSizeBytes) {
    return cached.summary;
  }

  // Parse header info
  let promptPreview = 'New Conversation';
  let title = 'Conversation ' + conversationId.slice(0, 8);
  let workspace = 'Unknown Project';
  let workspacePath = '';
  let model = detectRealModel(conversationId, dataDir);
  let createdAt = new Date(mtimeMs).toISOString();
  let updatedAt = new Date(mtimeMs).toISOString();
  let stepCount = 0;

  if (fs.existsSync(logPath)) {
    try {
      // Read first 64KB to get first user input
      const fd = fs.openSync(logPath, 'r');
      const headBuffer = Buffer.alloc(Math.min(fileSizeBytes, 65536));
      const bytesRead = fs.readSync(fd, headBuffer, 0, headBuffer.length, 0);
      fs.closeSync(fd);

      const headContent = headBuffer.toString('utf8', 0, bytesRead);
      const firstLine = headContent.split('\n')[0];
      if (firstLine) {
        try {
          const firstStep = JSON.parse(firstLine);
          if (firstStep.created_at) createdAt = firstStep.created_at;
          if (firstStep.content) {
            const parsed = parsePromptAndTitle(firstStep.content);
            title = parsed.title;
            promptPreview = parsed.prompt;
            const ws = extractWorkspaceFromText(firstStep.content);
            workspace = ws.name;
            workspacePath = ws.fullPath;
            if (!model) {
              model = extractModelFromText(firstStep.content);
            }
          }
        } catch {
          // fallback
        }
      }

      // Count lines / steps fast
      const fileContent = fs.readFileSync(logPath, 'utf8');
      const lines = fileContent.split('\n').filter(Boolean);
      stepCount = lines.length;

      // Get last line timestamp
      if (lines.length > 1) {
        try {
          const lastStep = JSON.parse(lines[lines.length - 1]);
          if (lastStep.created_at) updatedAt = lastStep.created_at;
        } catch {}
      }
    } catch (err) {
      console.error(`Error reading transcript for ${conversationId}:`, err);
    }
  }

  // Check artifacts
  const hasPlan = fs.existsSync(path.join(brainDir, 'implementation_plan.md'));
  const hasWalkthrough = fs.existsSync(path.join(brainDir, 'walkthrough.md'));

  const scratchDir = path.join(brainDir, 'scratch');
  const scratchCount = fs.existsSync(scratchDir) ? fs.readdirSync(scratchDir).length : 0;

  const userUploadsDir = path.join(brainDir, '.user_uploaded');
  const uploadCount = fs.existsSync(userUploadsDir) ? fs.readdirSync(userUploadsDir).length : 0;

  const tasksDir = path.join(brainDir, '.system_generated', 'tasks');
  const taskCount = fs.existsSync(tasksDir) ? fs.readdirSync(tasksDir).filter(f => f.endsWith('.log')).length : 0;

  const dbPath = path.join(dataDir, 'conversations', `${conversationId}.db`);
  const hasDb = fs.existsSync(dbPath);

  const summary: ConversationSummary = {
    id: conversationId,
    title,
    promptPreview,
    workspace,
    workspacePath,
    model,
    createdAt,
    updatedAt,
    stepCount,
    fileSizeBytes,
    artifacts: {
      hasPlan,
      hasWalkthrough,
      scratchCount,
      uploadCount,
      taskCount,
      hasDb
    }
  };

  summaryCache.set(conversationId, { mtimeMs, fileSizeBytes, summary });
  return summary;
}

export function scanAllConversations(options?: {
  searchQuery?: string;
  workspace?: string;
  limit?: number;
  offset?: number;
}): { conversations: ConversationSummary[]; total: number; workspaces: { name: string; count: number }[] } {
  const dataDir = getDataDir();
  const brainDir = path.join(dataDir, 'brain');

  if (!fs.existsSync(brainDir)) {
    return { conversations: [], total: 0, workspaces: [] };
  }

  const entries = fs.readdirSync(brainDir, { withFileTypes: true });
  // Filter for valid UUID directories
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const conversationDirs = entries
    .filter(e => e.isDirectory() && uuidRegex.test(e.name))
    .map(e => e.name);

  const summaries: ConversationSummary[] = [];
  const workspaceMap = new Map<string, number>();

  for (const id of conversationDirs) {
    const summary = scanSingleConversation(id, dataDir);
    if (summary) {
      summaries.push(summary);
      const ws = summary.workspace || 'Unknown Project';
      workspaceMap.set(ws, (workspaceMap.get(ws) || 0) + 1);
    }
  }

  // Sort by updatedAt descending
  summaries.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  // Filter by workspace if specified
  let filtered = summaries;
  if (options?.workspace && options.workspace !== 'all') {
    filtered = filtered.filter(c => c.workspace.toLowerCase() === options.workspace!.toLowerCase());
  }

  // Filter by search query if specified
  if (options?.searchQuery && options.searchQuery.trim()) {
    const q = options.searchQuery.toLowerCase().trim();
    filtered = filtered.filter(c => 
      c.id.toLowerCase().includes(q) ||
      c.promptPreview.toLowerCase().includes(q) ||
      c.title.toLowerCase().includes(q) ||
      c.workspace.toLowerCase().includes(q) ||
      c.model.toLowerCase().includes(q)
    );
  }

  const total = filtered.length;
  const limit = options?.limit || 50;
  const offset = options?.offset || 0;
  const paginated = filtered.slice(offset, offset + limit);

  const workspaces = Array.from(workspaceMap.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  return {
    conversations: paginated,
    total,
    workspaces
  };
}

export function invalidateCache(conversationId?: string): void {
  if (conversationId) {
    summaryCache.delete(conversationId);
  } else {
    summaryCache.clear();
  }
}
