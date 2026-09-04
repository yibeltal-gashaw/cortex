import {
  AppStatus,
  ConversationSummary,
  ParsedConversationSession,
  ArtifactOverview,
  DatabaseInfo
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

export async function fetchConversations(options?: {
  searchQuery?: string;
  workspace?: string;
  limit?: number;
  offset?: number;
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
