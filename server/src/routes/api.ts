import { Router } from 'express';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { getDataDir, setDataDir, getDefaultDataDir } from '../config.js';
import { scanAllConversations, invalidateCache } from '../services/conversationScanner.js';
import { parseConversationTimeline } from '../services/timelineParser.js';
import { getArtifactsOverview, readArtifactFile, getMediaFilePath, getArtifactFilePath } from '../services/artifactService.js';
import { inspectDatabase, queryTableRows } from '../services/dbInspector.js';
import { deleteConversation } from '../services/deletionService.js';

export const apiRouter = Router();

// Status & Configuration
apiRouter.get('/status', (req, res) => {
  res.json({
    status: 'ok',
    dataDir: getDataDir(),
    defaultDataDir: getDefaultDataDir(),
    platform: os.platform(),
    nodeVersion: process.version
  });
});

// Force Refresh / Cache Invalidation
apiRouter.post('/refresh', (req, res) => {
  try {
    invalidateCache();
    res.json({ success: true, message: 'Conversation cache invalidated successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.get('/refresh', (req, res) => {
  try {
    invalidateCache();
    res.json({ success: true, message: 'Conversation cache invalidated successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/settings/datadir', (req, res) => {
  const { path: newPath } = req.body;
  if (!newPath || typeof newPath !== 'string') {
    res.status(400).json({ error: 'Missing path string in request body' });
    return;
  }

  const result = setDataDir(newPath);
  if (!result.success) {
    res.status(400).json(result);
    return;
  }

  res.json(result);
});

// List Conversations
apiRouter.get('/conversations', (req, res) => {
  const searchQuery = req.query.q as string | undefined;
  const workspace = req.query.workspace as string | undefined;
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 100;
  const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : 0;
  const forceRefresh = req.query.refresh === 'true' || req.query.refresh === '1';

  try {
    if (forceRefresh) {
      invalidateCache();
    }
    const data = scanAllConversations({
      searchQuery,
      workspace,
      limit,
      offset
    });
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Single Conversation Timeline
apiRouter.get('/conversations/:id', (req, res) => {
  const { id } = req.params;
  try {
    const session = parseConversationTimeline(id);
    if (!session) {
      res.status(404).json({ error: `Conversation ${id} not found or has no transcript` });
      return;
    }
    res.json(session);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Artifacts Overview
apiRouter.get('/conversations/:id/artifacts', (req, res) => {
  const { id } = req.params;
  try {
    const overview = getArtifactsOverview(id);
    if (!overview) {
      res.status(404).json({ error: `Artifacts for conversation ${id} not found` });
      return;
    }
    res.json(overview);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Read Artifact File Content (Text/Metadata)
apiRouter.get('/conversations/:id/artifacts/file', (req, res) => {
  const { id } = req.params;
  const filePath = req.query.path as string;

  if (!filePath) {
    res.status(400).json({ error: 'Missing path query parameter' });
    return;
  }

  try {
    const fileData = readArtifactFile(id, filePath);
    if (!fileData) {
      res.status(404).json({ error: `File not found: ${filePath}` });
      return;
    }
    res.json(fileData);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Serve Raw Artifact File (Images, Videos, Media, Downloads)
apiRouter.get('/conversations/:id/artifacts/raw', (req, res) => {
  const { id } = req.params;
  const filePath = req.query.path as string;

  if (!filePath) {
    res.status(400).send('Missing path query parameter');
    return;
  }

  try {
    const fullPath = getArtifactFilePath(id, filePath);
    if (!fullPath) {
      res.status(404).send('Artifact file not found');
      return;
    }

    // Set cache control for static media artifacts
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.sendFile(fullPath);
  } catch (err: any) {
    res.status(500).send(err.message);
  }
});

// Serve User Uploaded Media
apiRouter.get('/conversations/:id/media/:filename', (req, res) => {
  const { id, filename } = req.params;
  const mediaPath = getMediaFilePath(id, filename);
  if (!mediaPath) {
    res.status(404).send('Media file not found');
    return;
  }
  res.sendFile(mediaPath);
});

// SQLite DB Inspector: Tables & Schema
apiRouter.get('/conversations/:id/db', (req, res) => {
  const { id } = req.params;
  try {
    const dbInfo = inspectDatabase(id);
    res.json(dbInfo);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// SQLite DB Inspector: Query Table Rows
apiRouter.get('/conversations/:id/db/table/:tableName', (req, res) => {
  const { id, tableName } = req.params;
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
  const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : 0;
  const search = req.query.search as string | undefined;

  try {
    const data = queryTableRows(id, tableName, { limit, offset, search });
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Permanent Deletion
apiRouter.delete('/conversations/:id', (req, res) => {
  const { id } = req.params;
  try {
    const result = deleteConversation(id);
    if (!result.success) {
      res.status(400).json(result);
      return;
    }
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Directory Browsing: inspect folders on disk
apiRouter.get('/browse-directory', (req, res) => {
  try {
    const requestedPath = req.query.path as string | undefined;
    const defaultData = getDefaultDataDir();
    const currentData = getDataDir();
    const homeDir = os.homedir();

    let targetDir = requestedPath ? path.resolve(requestedPath) : (currentData || defaultData || homeDir);

    // If targetDir doesn't exist, fallback to homeDir
    if (!fs.existsSync(targetDir)) {
      targetDir = homeDir;
    }

    // If targetDir is a file instead of directory, get its parent
    try {
      const stat = fs.statSync(targetDir);
      if (!stat.isDirectory()) {
        targetDir = path.dirname(targetDir);
      }
    } catch {
      targetDir = homeDir;
    }

    const parentDir = path.dirname(targetDir) !== targetDir ? path.dirname(targetDir) : null;

    // Detect drives on Windows
    const drives: string[] = [];
    if (os.platform() === 'win32') {
      const letters = 'CDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
      for (const letter of letters) {
        const driveRoot = `${letter}:\\`;
        try {
          if (fs.existsSync(driveRoot)) {
            drives.push(driveRoot);
          }
        } catch {}
      }
    }

    // Read entries
    let entries: fs.Dirent[] = [];
    try {
      entries = fs.readdirSync(targetDir, { withFileTypes: true });
    } catch {
      entries = [];
    }

    const directories: Array<{ name: string; path: string; hasAntigravityData: boolean }> = [];

    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (entry.name.startsWith('$') || entry.name === 'System Volume Information' || entry.name === 'node_modules') {
          continue;
        }
        const fullSubPath = path.join(targetDir, entry.name);
        let hasAntigravityData = false;
        try {
          hasAntigravityData =
            fs.existsSync(path.join(fullSubPath, 'brain')) ||
            fs.existsSync(path.join(fullSubPath, 'conversations'));
        } catch {}
        directories.push({
          name: entry.name,
          path: fullSubPath,
          hasAntigravityData
        });
      }
    }

    // Check if current targetDir itself has brain or conversations
    let targetHasAntigravityData = false;
    try {
      targetHasAntigravityData =
        fs.existsSync(path.join(targetDir, 'brain')) ||
        fs.existsSync(path.join(targetDir, 'conversations'));
    } catch {}

    res.json({
      currentPath: targetDir,
      parentPath: parentDir,
      hasAntigravityData: targetHasAntigravityData,
      homeDir,
      defaultDataDir: defaultData,
      drives,
      directories: directories.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Native OS Directory Picker via PowerShell on Windows
apiRouter.post('/select-directory-native', (req, res) => {
  if (os.platform() === 'win32') {
    const defaultPath = req.body?.defaultPath || getDataDir() || getDefaultDataDir() || os.homedir();
    const sanitized = (defaultPath || '').replace(/'/g, "''");
    const script = `
Add-Type -AssemblyName System.Windows.Forms
$f = New-Object System.Windows.Forms.FolderBrowserDialog
$f.Description = 'Select Antigravity IDE Data Directory'
$f.ShowNewFolderButton = $true
if ('${sanitized}' -ne '') { $f.SelectedPath = '${sanitized}' }
if ($f.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {
  Write-Output $f.SelectedPath
}
`.trim();

    execFile('powershell', ['-NoProfile', '-NonInteractive', '-Command', script], (error, stdout) => {
      if (error) {
        res.status(500).json({ error: error.message });
        return;
      }
      const selected = stdout.trim();
      res.json({ path: selected || null });
    });
  } else {
    res.status(501).json({ error: 'Native picker only supported on Windows' });
  }
});
