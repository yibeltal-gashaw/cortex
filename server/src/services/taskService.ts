import fs from 'node:fs';
import path from 'node:path';
import { Request, Response } from 'express';
import { getDataDir } from '../config.js';

export interface BackgroundTaskSummary {
  taskId: string;
  name: string;
  relativePath: string;
  size: number;
  mtime: string;
  status: 'running' | 'completed' | 'failed';
  commandPreview: string;
  lineCount: number;
}

export function listTasks(conversationId: string): BackgroundTaskSummary[] {
  const dataDir = getDataDir();
  const tasksDir = path.join(dataDir, 'brain', conversationId, '.system_generated', 'tasks');

  if (!fs.existsSync(tasksDir)) {
    return [];
  }

  const result: BackgroundTaskSummary[] = [];

  try {
    const entries = fs.readdirSync(tasksDir);
    for (const file of entries) {
      if (!file.endsWith('.log')) continue;
      const fp = path.join(tasksDir, file);
      try {
        const stat = fs.statSync(fp);
        const content = fs.readFileSync(fp, 'utf8');
        const lines = content.split('\n');
        const trimmedLines = lines.map(l => l.trim()).filter(Boolean);
        const commandPreview = trimmedLines[0] || file;

        // Infer status: if modified in last 10s, likely running; check exit code
        const isRecent = Date.now() - stat.mtimeMs < 10000;
        let status: 'running' | 'completed' | 'failed' = isRecent ? 'running' : 'completed';

        if (content.includes('Command exited with code 0') || content.includes('Exit code: 0')) {
          status = 'completed';
        } else if (/Command exited with code [1-9]/i.test(content) || /error|fatal|exception/i.test(content.slice(-500))) {
          status = 'failed';
        }

        const taskId = file.replace(/^task-/, '').replace(/\.log$/, '');

        result.push({
          taskId,
          name: file,
          relativePath: `.system_generated/tasks/${file}`,
          size: stat.size,
          mtime: stat.mtime.toISOString(),
          status,
          commandPreview: commandPreview.slice(0, 100),
          lineCount: lines.length
        });
      } catch {}
    }
  } catch (err) {
    console.error(`Error reading tasks for ${conversationId}:`, err);
  }

  // Sort by mtime descending
  return result.sort((a, b) => new Date(b.mtime).getTime() - new Date(a.mtime).getTime());
}

export function getTaskFilePath(conversationId: string, taskId: string): string | null {
  const dataDir = getDataDir();
  const tasksDir = path.join(dataDir, 'brain', conversationId, '.system_generated', 'tasks');
  const possibleNames = [`task-${taskId}.log`, `${taskId}.log`, taskId];

  for (const name of possibleNames) {
    const fp = path.join(tasksDir, name);
    if (fs.existsSync(fp)) return fp;
  }
  return null;
}

export function streamTaskLog(req: Request, res: Response, conversationId: string, taskId: string) {
  const filePath = getTaskFilePath(conversationId, taskId);

  if (!filePath || !fs.existsSync(filePath)) {
    res.status(404).json({ error: `Task log not found for taskId ${taskId}` });
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  let isAlive = true;
  let lastSize = 0;
  let lastMtime = 0;

  // Send initial content
  try {
    const stat = fs.statSync(filePath);
    lastSize = stat.size;
    lastMtime = stat.mtimeMs;
    const content = fs.readFileSync(filePath, 'utf8');
    res.write(`event: initial\ndata: ${JSON.stringify({ content, size: lastSize })}\n\n`);
  } catch (err: any) {
    res.write(`event: error\ndata: ${JSON.stringify({ error: err.message })}\n\n`);
  }

  // Periodic heartbeat
  const heartbeatTimer = setInterval(() => {
    if (!isAlive) return;
    try {
      res.write(`event: ping\ndata: {}\n\n`);
    } catch {
      cleanup();
    }
  }, 10000);

  // Poll for file changes
  const pollTimer = setInterval(() => {
    if (!isAlive) return;
    try {
      if (!fs.existsSync(filePath)) return;
      const stat = fs.statSync(filePath);
      if (stat.size > lastSize) {
        // Read new chunk
        const fd = fs.openSync(filePath, 'r');
        const diffSize = stat.size - lastSize;
        const buffer = Buffer.alloc(diffSize);
        fs.readSync(fd, buffer, 0, diffSize, lastSize);
        fs.closeSync(fd);

        lastSize = stat.size;
        lastMtime = stat.mtimeMs;

        const chunk = buffer.toString('utf8');
        res.write(`event: chunk\ndata: ${JSON.stringify({ chunk, size: lastSize })}\n\n`);
      }
    } catch {
      // ignore transient file lock
    }
  }, 400);

  const cleanup = () => {
    if (!isAlive) return;
    isAlive = false;
    clearInterval(heartbeatTimer);
    clearInterval(pollTimer);
  };

  req.on('close', cleanup);
  req.on('end', cleanup);
}

