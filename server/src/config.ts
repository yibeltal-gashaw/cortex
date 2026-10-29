import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';

export interface AppConfig {
  port: number;
  dataDir: string;
  defaultDataDir: string;
}

export function getDefaultDataDir(): string {
  if (process.env.ANTIGRAVITY_DATA_DIR && fs.existsSync(process.env.ANTIGRAVITY_DATA_DIR)) {
    return path.resolve(process.env.ANTIGRAVITY_DATA_DIR);
  }

  const userHome = os.homedir();
  // Check modern Antigravity path (~/.gemini/antigravity)
  const modernPath = path.join(userHome, '.gemini', 'antigravity');
  if (fs.existsSync(modernPath)) {
    return modernPath;
  }

  // Check legacy Antigravity IDE path (~/.gemini/antigravity-ide)
  const legacyPath = path.join(userHome, '.gemini', 'antigravity-ide');
  if (fs.existsSync(legacyPath)) {
    return legacyPath;
  }

  return modernPath;
}

let currentDataDir: string = getDefaultDataDir();

export function getDataDir(): string {
  return currentDataDir;
}

export function setDataDir(newPath: string): { success: boolean; message: string; dataDir: string } {
  const resolved = path.resolve(newPath);
  if (!fs.existsSync(resolved)) {
    return { success: false, message: `Directory does not exist: ${resolved}`, dataDir: currentDataDir };
  }

  const hasBrain = fs.existsSync(path.join(resolved, 'brain'));
  const hasConversations = fs.existsSync(path.join(resolved, 'conversations'));
  const hasUnifiedDb = fs.existsSync(path.join(resolved, 'conversation_summaries.db'));

  if (!hasBrain && !hasConversations && !hasUnifiedDb) {
    return {
      success: false,
      message: `Directory does not appear to be an Antigravity directory (missing 'brain' or 'conversations' folder): ${resolved}`,
      dataDir: currentDataDir
    };
  }

  currentDataDir = resolved;
  return {
    success: true,
    message: `Active Antigravity data directory set to: ${resolved}`,
    dataDir: currentDataDir
  };
}

export const config: AppConfig = {
  port: parseInt(process.env.PORT || '3050', 10),
  get dataDir() {
    return currentDataDir;
  },
  defaultDataDir: getDefaultDataDir()
};
