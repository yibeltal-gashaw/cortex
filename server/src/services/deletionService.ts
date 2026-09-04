import fs from 'node:fs';
import path from 'node:path';
import { getDataDir } from '../config.js';
import { invalidateCache } from './conversationScanner.js';

export interface DeletionResult {
  success: boolean;
  message: string;
  deletedItems: string[];
}

export function deleteConversation(conversationId: string): DeletionResult {
  const dataDir = getDataDir();
  const deletedItems: string[] = [];

  // Validate conversation ID UUID format to prevent accidental dangerous deletions
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(conversationId)) {
    return {
      success: false,
      message: 'Invalid conversation UUID format.',
      deletedItems: []
    };
  }

  // 1. Delete brain directory recursively
  const brainDir = path.join(dataDir, 'brain', conversationId);
  if (fs.existsSync(brainDir)) {
    try {
      fs.rmSync(brainDir, { recursive: true, force: true });
      deletedItems.push(`Directory: brain/${conversationId}`);
    } catch (err: any) {
      console.error(`Failed to delete brain directory ${brainDir}:`, err);
      return {
        success: false,
        message: `Failed to delete brain directory: ${err.message}`,
        deletedItems
      };
    }
  }

  // 2. Delete conversations DB and any journal/wal/shm files
  const dbBase = path.join(dataDir, 'conversations', conversationId);
  const extensions = ['.db', '.db-wal', '.db-shm', '.db-journal'];

  for (const ext of extensions) {
    const filePath = dbBase + ext;
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
        deletedItems.push(`Database file: conversations/${conversationId}${ext}`);
      } catch (err: any) {
        console.warn(`Could not delete ${filePath}:`, err.message);
      }
    }
  }

  // Invalidate cache
  invalidateCache(conversationId);

  return {
    success: true,
    message: `Successfully deleted conversation ${conversationId}`,
    deletedItems
  };
}
