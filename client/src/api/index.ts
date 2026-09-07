import {
  AppStatus,
  ConversationSummary,
  ParsedConversationSession,
  ArtifactOverview,
  DatabaseInfo,
  DirectoryBrowseResult
} from '../types/index.js';

const API_BASE = '/api';

export async function fetchStatus(): Promise<AppStatus> {
  const res = await fetch(`${API_BASE}/status`);
  if (!res.ok) throw new Error(`Failed to fetch status: ${res.statusText}`);
  return res.json();
}

export async function updateDataDir(path: string): Promise<{ success: boolean; message: string; dataDir: string }> {
  const res = await fetch(`${API_BASE}/settings/datadir`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to update data directory');
  return data;
}

export async function refreshCache(): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`${API_BASE}/refresh`, { method: 'POST' });
  if (!res.ok) throw new Error(`Failed to refresh cache: ${res.statusText}`);
  return res.json();
}

export async function fetchConversations(options?: {
  searchQuery?: string;
  workspace?: string;
  limit?: number;
  offset?: number;
  forceRefresh?: boolean;
}): Promise<{
  conversations: ConversationSummary[];
  total: number;
  workspaces: { name: string; count: number }[];
}> {
  const params = new URLSearchParams();
  if (options?.searchQuery) params.set('q', options.searchQuery);
  if (options?.workspace && options.workspace !== 'all') params.set('workspace', options.workspace);
  if (options?.limit) params.set('limit', options.limit.toString());
  if (options?.offset) params.set('offset', options.offset.toString());
  if (options?.forceRefresh) params.set('refresh', 'true');

  const res = await fetch(`${API_BASE}/conversations?${params.toString()}`);
  if (!res.ok) throw new Error(`Failed to fetch conversations: ${res.statusText}`);
  return res.json();
}

export async function fetchConversation(id: string): Promise<ParsedConversationSession> {
  const res = await fetch(`${API_BASE}/conversations/${id}`);
  if (!res.ok) throw new Error(`Failed to fetch conversation ${id}: ${res.statusText}`);
  return res.json();
}

export async function fetchArtifacts(id: string): Promise<ArtifactOverview> {
  const res = await fetch(`${API_BASE}/conversations/${id}/artifacts`);
  if (!res.ok) throw new Error(`Failed to fetch artifacts for ${id}: ${res.statusText}`);
  return res.json();
}

export interface ArtifactFileResponse {
  content: string;
  extension: string;
  size: number;
  isImage?: boolean;
  isVideo?: boolean;
  rawUrl?: string;
}

export async function fetchArtifactFile(id: string, filePath: string): Promise<ArtifactFileResponse> {
  const params = new URLSearchParams({ path: filePath });
  const res = await fetch(`${API_BASE}/conversations/${id}/artifacts/file?${params.toString()}`);
  if (!res.ok) throw new Error(`Failed to read file ${filePath}: ${res.statusText}`);
  return res.json();
}

export async function fetchDatabaseInfo(id: string): Promise<DatabaseInfo> {
  const res = await fetch(`${API_BASE}/conversations/${id}/db`);
  if (!res.ok) throw new Error(`Failed to fetch database info: ${res.statusText}`);
  return res.json();
}

export async function fetchTableRows(
  id: string,
  tableName: string,
  options?: { limit?: number; offset?: number; search?: string }
): Promise<{ rows: any[]; total: number; columns: any[] }> {
  const params = new URLSearchParams();
  if (options?.limit) params.set('limit', options.limit.toString());
  if (options?.offset) params.set('offset', options.offset.toString());
  if (options?.search) params.set('search', options.search);

  const res = await fetch(`${API_BASE}/conversations/${id}/db/table/${encodeURIComponent(tableName)}?${params.toString()}`);
  if (!res.ok) throw new Error(`Failed to fetch rows for table ${tableName}: ${res.statusText}`);
  return res.json();
}

export async function deleteConversation(id: string): Promise<{ success: boolean; message: string; deletedItems: string[] }> {
  const res = await fetch(`${API_BASE}/conversations/${id}`, {
    method: 'DELETE'
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to delete conversation');
  return data;
}

export async function deleteConversations(ids: string[]): Promise<{
  success: boolean;
  totalDeleted: number;
  failedIds: string[];
  deletedItems: string[];
}> {
  try {
    const res = await fetch(`${API_BASE}/conversations/batch-delete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ ids })
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('Batch delete endpoint failed, falling back to sequential delete:', err);
  }

  let totalDeleted = 0;
  const failedIds: string[] = [];
  const deletedItems: string[] = [];

  for (const id of ids) {
    try {
      const res = await deleteConversation(id);
      if (res.success) {
        totalDeleted++;
        deletedItems.push(...res.deletedItems);
      } else {
        failedIds.push(id);
      }
    } catch {
      failedIds.push(id);
    }
  }

  return {
    success: failedIds.length === 0,
    totalDeleted,
    failedIds,
    deletedItems
  };
}

export async function browseDirectory(path?: string): Promise<DirectoryBrowseResult> {
  const params = new URLSearchParams();
  if (path) params.set('path', path);
  const res = await fetch(`${API_BASE}/browse-directory?${params.toString()}`);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Failed to browse directory: ${res.statusText}`);
  }
  return res.json();
}

export async function selectDirectoryNative(defaultPath?: string): Promise<string | null> {
  const res = await fetch(`${API_BASE}/select-directory-native`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ defaultPath })
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to open native directory selector');
  }
  const data = await res.json();
  return data.path || null;
}
