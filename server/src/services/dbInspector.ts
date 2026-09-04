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
  textPreview: string;
}

function formatValue(val: any): any {
  if (val === null || val === undefined) return null;
  if (Buffer.isBuffer(val) || val instanceof Uint8Array) {
    const buf = Buffer.from(val);
    const size = buf.length;
    // Extract readable text (replace non-printable chars)
    let textPreview = '';
    for (let i = 0; i < Math.min(size, 256); i++) {
      const code = buf[i];
      if (code >= 32 && code <= 126) {
        textPreview += String.fromCharCode(code);
      } else if (code === 10 || code === 13) {
        textPreview += ' ';
      } else {
        textPreview += '.';
      }
    }
    textPreview = textPreview.trim();

    const hex = buf.slice(0, 64).toString('hex').match(/.{1,2}/g)?.join(' ') || '';
    const formatted: FormattedBlob = {
      __isBlob: true,
      size,
      hex: size > 64 ? `${hex}...` : hex,
      textPreview: size > 256 ? `${textPreview}...` : textPreview
    };
    return formatted;
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
        res[col] = formatValue(row[col]);
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
