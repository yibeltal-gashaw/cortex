import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { getDataDir } from '../config.js';

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
  kind: 'json' | 'protobuf' | 'text' | 'binary';
  summary: string;
  textPreview: string;
  parsedJson?: any;
  extractedStrings?: string[];
}

function isMostlyPrintable(str: string): boolean {
  if (!str || str.length === 0) return false;
  let printable = 0;
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    if ((code >= 32 && code <= 126) || code === 10 || code === 13 || code === 9) {
      printable++;
    }
  }
  return (printable / str.length) >= 0.85;
}

function decodeProto(buffer: Buffer, maxDepth = 4): Record<string, any> | null {
  if (maxDepth <= 0 || !buffer || buffer.length === 0) return null;
  let offset = 0;
  const result: Record<string, any> = {};

  while (offset < buffer.length) {
    let tag = 0;
    let shift = 0;
    while (offset < buffer.length) {
      const b = buffer[offset++];
      tag |= (b & 0x7f) << shift;
      if (!(b & 0x80)) break;
      shift += 7;
    }

    const fieldNumber = tag >>> 3;
    const wireType = tag & 0x07;
    if (fieldNumber === 0) break;

    if (wireType === 0) { // Varint
      let val = 0n;
      let s = 0n;
      while (offset < buffer.length) {
        const b = BigInt(buffer[offset++]);
        val |= (b & 0x7fn) << s;
        if (!(b & 0x80n)) break;
        s += 7n;
      }
      const numVal = (val <= BigInt(Number.MAX_SAFE_INTEGER)) ? Number(val) : val.toString();
      addProtoField(result, fieldNumber, numVal);
    } else if (wireType === 2) { // Length-delimited
      let len = 0;
      let s = 0;
      while (offset < buffer.length) {
        const b = buffer[offset++];
        len |= (b & 0x7f) << s;
        if (!(b & 0x80)) break;
        s += 7;
      }
      if (offset + len > buffer.length) break;
      const subBuf = buffer.subarray(offset, offset + len);
      offset += len;

      const str = Buffer.from(subBuf).toString('utf8');
      const isPrintable = isMostlyPrintable(str);

      let val: any = null;
      if (isPrintable && str.trim().length > 0) {
        const trimmed = str.trim();
        if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
          try {
            val = JSON.parse(trimmed);
          } catch {
            val = str;
          }
        } else {
          val = str;
        }
      } else {
        try {
          const subProto = decodeProto(Buffer.from(subBuf), maxDepth - 1);
          if (subProto && Object.keys(subProto).length > 0) {
            val = subProto;
          }
        } catch {}
        if (!val) {
          val = Buffer.from(subBuf).slice(0, 32).toString('hex');
        }
      }
      addProtoField(result, fieldNumber, val);
    } else if (wireType === 5) { // 32-bit
      offset += 4;
    } else if (wireType === 1) { // 64-bit
      offset += 8;
    } else {
      break;
    }
  }

  return Object.keys(result).length > 0 ? result : null;
}

function addProtoField(obj: Record<string, any>, fieldNumber: number, val: any) {
  const key = String(fieldNumber);
  if (key in obj) {
    if (Array.isArray(obj[key])) {
      obj[key].push(val);
    } else {
      obj[key] = [obj[key], val];
    }
  } else {
    obj[key] = val;
  }
}

function formatValue(val: any, colName?: string, row?: Record<string, any>, tableName?: string): any {
  if (val === null || val === undefined) return null;
  if (Buffer.isBuffer(val) || val instanceof Uint8Array) {
    const buf = Buffer.from(val);
    const size = buf.length;
    const hex = buf.slice(0, 64).toString('hex').match(/.{1,2}/g)?.join(' ') || '';

    // 1. Direct UTF-8 JSON check
    const rawStr = buf.toString('utf8');
    const trimmed = rawStr.trim();
    if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
      try {
        const parsed = JSON.parse(trimmed);
        return {
          __isBlob: true,
          size,
          hex: size > 64 ? `${hex}...` : hex,
          kind: 'json',
          summary: JSON.stringify(parsed).slice(0, 80),
          textPreview: JSON.stringify(parsed, null, 2),
          parsedJson: parsed
        };
      } catch {}
    }

    // 2. Extract embedded printable strings
    const strings: string[] = [];
    let s = '';
    for (let i = 0; i < buf.length; i++) {
      const c = buf[i];
      if (c >= 32 && c <= 126) {
        s += String.fromCharCode(c);
      } else if (c === 10 || c === 13 || c === 9) {
        s += (c === 9 ? ' ' : ' ');
      } else {
        if (s.trim().length >= 3) strings.push(s.trim());
        s = '';
      }
    }
    if (s.trim().length >= 3) strings.push(s.trim());

    // 3. Find embedded JSON inside strings
    let embeddedJson: any = null;
    for (const raw of strings) {
      const str = raw.replace(/^[^{[]+/, '').replace(/[^}\]]+$/, '').trim();
      if ((str.startsWith('{') && str.endsWith('}')) || (str.startsWith('[') && str.endsWith(']'))) {
        try {
          embeddedJson = JSON.parse(str);
          break;
        } catch {}
      }
    }

    // 4. Try Protobuf decoding
    let decodedProto: Record<string, any> | null = null;
    try {
      decodedProto = decodeProto(buf);
    } catch {}

    // Filter out UUIDs, raw session IDs, and hash garbage for summaries
    const isIdOrHash = (s: string) => /^[bL$"\s]*[0-9a-fA-F-]{32,40}/.test(s) || /^[0-9a-fA-F]{16,64}$/.test(s.trim());
    const meaningfulStrings = strings.filter(s => !isIdOrHash(s));

    // 5. Generate human-readable summary
    let summary = '';
    const knownTools = ['view_file', 'replace_file_content', 'run_command', 'write_to_file', 'multi_replace_file_content', 'search_web', 'list_dir', 'grep_search', 'read_url_content', 'ask_question', 'generate_image', 'schedule', 'manage_task'];
    const toolName = strings.find(str => knownTools.includes(str));
    const filePath = strings.find(str => (str.includes(':\\') || str.includes('file://') || str.match(/\.(tsx?|jsx?|md|json|html|css|py|rs|go)\b/)) && !str.includes('sessionID'));
    const modelName = strings.find(str => str.includes('Gemini') || str.includes('Claude') || str.includes('gemini-') || str.includes('claude-'));

    // If context is known from steps table
    const stepType = row?.step_type;
    if (tableName === 'steps' && colName === 'step_payload') {
      if (stepType === 14) {
        // User prompt step
        const promptCandidate = meaningfulStrings.find(s => s.length > 15 && !knownTools.includes(s) && !s.includes('file:///'));
        if (promptCandidate) {
          const cleanPrompt = promptCandidate.replace(/^@\[.*?\]\s*/, '').trim();
          summary = `User Prompt: "${cleanPrompt.slice(0, 80)}"`;
        } else {
          summary = 'User Input / Prompt';
        }
      } else if (stepType === 8) {
        // Tool call
        if (embeddedJson?.toolAction) {
          summary = embeddedJson.toolAction;
        } else if (embeddedJson?.toolSummary) {
          summary = embeddedJson.toolSummary;
        } else if (embeddedJson?.CommandLine) {
          summary = `Run: ${embeddedJson.CommandLine.slice(0, 60)}`;
        } else if (toolName && filePath) {
          const base = filePath.replace(/\\/g, '/').split('/').pop()?.replace(/["\}:].*$/, '') || '';
          summary = `${toolName} (${base})`;
        } else if (toolName) {
          summary = `Tool: ${toolName}`;
        }
      } else if (stepType === 15) {
        // Assistant thought / response (must have multiple words)
        const assistantText = meaningfulStrings.find(s => s.length > 15 && (s.match(/\s+/g) || []).length >= 2 && !s.startsWith('{') && !s.includes('sessionID'));
        if (assistantText) {
          const clean = assistantText.replace(/\s+/g, ' ').replace(/[2\(]*bot-[0-9a-f-]+.*$/, '').trim();
          summary = `Assistant: "${clean.slice(0, 80)}"`;
        } else {
          summary = 'Assistant Response';
        }
      } else if (stepType === 9) {
        summary = toolName ? `Result: ${toolName}` : 'Tool Execution Result';
      } else if (stepType === 98) {
        summary = 'Turn Start Header';
      } else if (stepType === 99) {
        summary = 'Turn End Boundary';
      } else if (stepType === 23) {
        summary = 'Session Heartbeat / Liveness';
      }
    } else if (tableName === 'gen_metadata' || colName === 'metadata') {
      if (modelName) {
        summary = `Model: ${modelName}`;
      } else if (embeddedJson?.toolAction) {
        summary = embeddedJson.toolAction;
      } else if (toolName && filePath) {
        const base = filePath.replace(/\\/g, '/').split('/').pop()?.replace(/["\}:].*$/, '') || '';
        summary = `${toolName} (${base})`;
      } else if (strings.some(s => s.includes('sessionID'))) {
        summary = 'Session Metadata';
      }
    }

    // Fallback if no specific summary generated yet
    if (!summary) {
      if (embeddedJson) {
        if (embeddedJson.toolAction) {
          summary = embeddedJson.toolAction;
        } else if (embeddedJson.toolSummary) {
          summary = embeddedJson.toolSummary;
        } else if (embeddedJson.AbsolutePath) {
          const base = embeddedJson.AbsolutePath.replace(/\\/g, '/').split('/').pop();
          summary = `${toolName || 'File'}: ${base}`;
        } else if (embeddedJson.TargetFile) {
          const base = embeddedJson.TargetFile.replace(/\\/g, '/').split('/').pop();
          summary = `Edit: ${base}`;
        } else if (embeddedJson.CommandLine) {
          summary = `Cmd: ${embeddedJson.CommandLine.slice(0, 60)}`;
        } else if (embeddedJson.Query) {
          summary = `Search: "${embeddedJson.Query}"`;
        } else if (embeddedJson.prompt || embeddedJson.Prompt) {
          const p = embeddedJson.prompt || embeddedJson.Prompt;
          summary = `Prompt: "${p.slice(0, 65)}"`;
        } else {
          summary = JSON.stringify(embeddedJson).slice(0, 70);
        }
      } else if (toolName) {
        if (filePath) {
          const base = filePath.replace(/\\/g, '/').split('/').pop()?.replace(/["\}:].*$/, '') || '';
          summary = `${toolName} (${base})`;
        } else {
          summary = `Tool: ${toolName}`;
        }
      } else if (modelName) {
        summary = `Model: ${modelName}`;
      } else if (filePath) {
        const base = filePath.replace(/\\/g, '/').split('/').pop()?.replace(/["\}:].*$/, '') || '';
        summary = `File: ${base}`;
      } else {
        const textCandidate = meaningfulStrings.find(str => str.length > 8 && !str.includes('sessionID'));
        if (textCandidate) {
          summary = textCandidate.length > 70 ? `${textCandidate.slice(0, 70)}...` : textCandidate;
        } else if (strings.some(s => s.includes('sessionID'))) {
          summary = 'Session Metadata';
        } else if (strings.length > 0) {
          summary = strings.slice(0, 2).join(' · ').slice(0, 70);
        } else {
          summary = `Binary BLOB (${size} B)`;
        }
      }
    }

    if (summary.includes('sessionID') || /^B!\s*/.test(summary)) {
      summary = 'Session Metadata';
    }

    // Clean up summary string (remove control characters)
    summary = summary.replace(/[\x00-\x1F\x7F]/g, ' ').replace(/\s+/g, ' ').trim();

    return {
      __isBlob: true,
      size,
      hex: size > 64 ? `${hex}...` : hex,
      kind: embeddedJson ? 'json' : (decodedProto ? 'protobuf' : (strings.length > 0 ? 'text' : 'binary')),
      summary,
      textPreview: strings.join('\n') || (size > 64 ? `${hex}...` : hex),
      parsedJson: embeddedJson || decodedProto || null,
      extractedStrings: strings.slice(0, 30)
    };
  }
  return val;
}

export function inspectDatabase(conversationId: string): {
  exists: boolean;
  tables: TableSummary[];
  dbPath: string;
} {
  const dataDir = getDataDir();
  const dbPath = path.join(dataDir, 'conversations', `${conversationId}.db`);

  if (!fs.existsSync(dbPath)) {
    return { exists: false, tables: [], dbPath };
  }

  let db: DatabaseSync | null = null;
  try {
    db = new DatabaseSync(dbPath, { readOnly: true });
    const tableRows = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all() as Array<{ name: string }>;

    const tables: TableSummary[] = [];
    for (const t of tableRows) {
      const tableName = t.name;
      const countRes = db.prepare(`SELECT COUNT(*) as c FROM "${tableName}"`).get() as { c: number };
      const cols = db.prepare(`PRAGMA table_info("${tableName}")`).all() as unknown as ColumnInfo[];

      tables.push({
        name: tableName,
        rowCount: countRes?.c || 0,
        columns: cols
      });
    }

    return {
      exists: true,
      tables,
      dbPath
    };
  } catch (err: any) {
    console.error(`Failed to inspect database for ${conversationId}:`, err);
    return {
      exists: true,
      tables: [],
      dbPath
    };
  } finally {
    if (db) {
      try {
        db.close();
      } catch {}
    }
  }
}

export function queryTableRows(
  conversationId: string,
  tableName: string,
  options?: { limit?: number; offset?: number; search?: string }
): {
  rows: any[];
  total: number;
  columns: ColumnInfo[];
} {
  const dataDir = getDataDir();
  const dbPath = path.join(dataDir, 'conversations', `${conversationId}.db`);

  if (!fs.existsSync(dbPath)) {
    return { rows: [], total: 0, columns: [] };
  }

  let db: DatabaseSync | null = null;
  try {
    db = new DatabaseSync(dbPath, { readOnly: true });
    // Sanitize table name to prevent injection
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as Array<{ name: string }>;
    const validTable = tables.find(t => t.name.toLowerCase() === tableName.toLowerCase());
    if (!validTable) {
      return { rows: [], total: 0, columns: [] };
    }
    const safeName = validTable.name;

    const columns = db.prepare(`PRAGMA table_info("${safeName}")`).all() as unknown as ColumnInfo[];
    const countRes = db.prepare(`SELECT COUNT(*) as c FROM "${safeName}"`).get() as { c: number };
    const total = countRes?.c || 0;

    const limit = Math.min(options?.limit || 50, 200);
    const offset = Math.max(options?.offset || 0, 0);

    const querySql = `SELECT * FROM "${safeName}" LIMIT ${limit} OFFSET ${offset}`;
    const rawRows = db.prepare(querySql).all() as any[];

    const formattedRows = rawRows.map(row => {
      const res: Record<string, any> = {};
      for (const col of Object.keys(row)) {
        res[col] = formatValue(row[col], col, row, safeName);
      }
      return res;
    });

    return {
      rows: formattedRows,
      total,
      columns
    };
  } catch (err) {
    console.error(`Error querying table ${tableName} for ${conversationId}:`, err);
    return { rows: [], total: 0, columns: [] };
  } finally {
    if (db) {
      try {
        db.close();
      } catch {}
    }
  }
}
