import fs from 'node:fs';
import path from 'node:path';
import { getDataDir } from '../config.js';

export interface FileTreeNode {
  name: string;
  relativePath: string;
  type: 'file' | 'directory';
  size?: number;
  mtime?: string;
  extension?: string;
  children?: FileTreeNode[];
}

export interface ArtifactOverview {
  tree: FileTreeNode;
  hasPlan: boolean;
  hasWalkthrough: boolean;
  planContent?: string;
  walkthroughContent?: string;
  scratchFiles: Array<{ name: string; relativePath: string; size: number }>;
  uploadedMedia: Array<{ name: string; relativePath: string; size: number; url: string }>;
  taskLogs: Array<{ name: string; relativePath: string; size: number }>;
}

function buildFileTree(dirPath: string, rootPath: string): FileTreeNode {
  const name = path.basename(dirPath);
  const relativePath = path.relative(rootPath, dirPath).replace(/\\/g, '/');

  const stat = fs.statSync(dirPath);
  if (!stat.isDirectory()) {
    return {
      name,
      relativePath,
      type: 'file',
      size: stat.size,
      mtime: stat.mtime.toISOString(),
      extension: path.extname(name).toLowerCase()
    };
  }

  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const children: FileTreeNode[] = [];

  for (const entry of entries) {
    const fullChildPath = path.join(dirPath, entry.name);
    try {
      children.push(buildFileTree(fullChildPath, rootPath));
    } catch {
      // skip permission or unreadable
    }
  }

  // Sort directories first, then files alphabetically
  children.sort((a, b) => {
    if (a.type === b.type) return a.name.localeCompare(b.name);
    return a.type === 'directory' ? -1 : 1;
  });

  return {
    name,
    relativePath,
    type: 'directory',
    children
  };
}

export function getArtifactsOverview(conversationId: string): ArtifactOverview | null {
  const dataDir = getDataDir();
  const brainDir = path.join(dataDir, 'brain', conversationId);

  if (!fs.existsSync(brainDir)) {
    return null;
  }

  const tree = buildFileTree(brainDir, brainDir);

  const planPath = path.join(brainDir, 'implementation_plan.md');
  const hasPlan = fs.existsSync(planPath);
  let planContent: string | undefined;
  if (hasPlan) {
    try {
      planContent = fs.readFileSync(planPath, 'utf8');
    } catch {}
  }

  const walkthroughPath = path.join(brainDir, 'walkthrough.md');
  const hasWalkthrough = fs.existsSync(walkthroughPath);
  let walkthroughContent: string | undefined;
  if (hasWalkthrough) {
    try {
      walkthroughContent = fs.readFileSync(walkthroughPath, 'utf8');
    } catch {}
  }

  const scratchDir = path.join(brainDir, 'scratch');
  const scratchFiles: Array<{ name: string; relativePath: string; size: number }> = [];
  if (fs.existsSync(scratchDir)) {
    try {
      for (const f of fs.readdirSync(scratchDir)) {
        const fp = path.join(scratchDir, f);
        const s = fs.statSync(fp);
        if (s.isFile()) {
          scratchFiles.push({
            name: f,
            relativePath: `scratch/${f}`,
            size: s.size
          });
        }
      }
    } catch {}
  }

  const userUploadsDir = path.join(brainDir, '.user_uploaded');
  const uploadedMedia: Array<{ name: string; relativePath: string; size: number; url: string }> = [];
  if (fs.existsSync(userUploadsDir)) {
    try {
      for (const f of fs.readdirSync(userUploadsDir)) {
        const fp = path.join(userUploadsDir, f);
        const s = fs.statSync(fp);
        if (s.isFile()) {
          uploadedMedia.push({
            name: f,
            relativePath: `.user_uploaded/${f}`,
            size: s.size,
            url: `/api/conversations/${conversationId}/media/${encodeURIComponent(f)}`
          });
        }
      }
    } catch {}
  }

  const tasksDir = path.join(brainDir, '.system_generated', 'tasks');
  const taskLogs: Array<{ name: string; relativePath: string; size: number }> = [];
  if (fs.existsSync(tasksDir)) {
    try {
      for (const f of fs.readdirSync(tasksDir)) {
        if (f.endsWith('.log')) {
          const fp = path.join(tasksDir, f);
          const s = fs.statSync(fp);
          taskLogs.push({
            name: f,
            relativePath: `.system_generated/tasks/${f}`,
            size: s.size
          });
        }
      }
    } catch {}
  }

  return {
    tree,
    hasPlan,
    hasWalkthrough,
    planContent,
    walkthroughContent,
    scratchFiles,
    uploadedMedia,
    taskLogs
  };
}

export const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg', '.bmp', '.ico', '.avif']);
export const VIDEO_EXTENSIONS = new Set(['.mp4', '.webm', '.ogg', '.mov']);

export function isImageExtension(ext: string): boolean {
  return IMAGE_EXTENSIONS.has(ext.toLowerCase());
}

export function isVideoExtension(ext: string): boolean {
  return VIDEO_EXTENSIONS.has(ext.toLowerCase());
}

export function getArtifactFilePath(conversationId: string, relativePath: string): string | null {
  const dataDir = getDataDir();
  const brainDir = path.join(dataDir, 'brain', conversationId);

  let cleanRel = relativePath;
  try {
    cleanRel = decodeURIComponent(relativePath);
  } catch {}

  // Strip file:/// prefix if present
  cleanRel = cleanRel.replace(/^file:\/\/\/?/i, '');

  // If cleanRel is an absolute path or contains brain\<id>\...
  if (cleanRel.includes(`brain\\${conversationId}\\`)) {
    cleanRel = cleanRel.split(`brain\\${conversationId}\\`)[1];
  } else if (cleanRel.includes(`brain/${conversationId}/`)) {
    cleanRel = cleanRel.split(`brain/${conversationId}/`)[1];
  } else if (path.isAbsolute(cleanRel)) {
    const rel = path.relative(brainDir, cleanRel);
    if (!rel.startsWith('..')) {
      cleanRel = rel;
    }
  }

  // Prevent directory traversal
  const normalizedRel = path.normalize(cleanRel).replace(/^(\.\.[\/\\])+/, '');
  const fullPath = path.join(brainDir, normalizedRel);

  if (!fullPath.startsWith(brainDir) || !fs.existsSync(fullPath)) {
    return null;
  }

  const stat = fs.statSync(fullPath);
  if (!stat.isFile()) return null;

  return fullPath;
}

export function readArtifactFile(conversationId: string, relativePath: string): {
  content: string;
  extension: string;
  size: number;
  isImage: boolean;
  isVideo: boolean;
  rawUrl: string;
} | null {
  const fullPath = getArtifactFilePath(conversationId, relativePath);
  if (!fullPath) return null;

  const stat = fs.statSync(fullPath);
  const ext = path.extname(fullPath).toLowerCase();
  const isImage = isImageExtension(ext);
  const isVideo = isVideoExtension(ext);
  const rawUrl = `/api/conversations/${conversationId}/artifacts/raw?path=${encodeURIComponent(relativePath)}`;

  if (isImage || isVideo) {
    return {
      content: '',
      extension: ext,
      size: stat.size,
      isImage,
      isVideo,
      rawUrl
    };
  }

  // Text, code, or markdown files
  try {
    const content = fs.readFileSync(fullPath, 'utf8');
    return {
      content,
      extension: ext,
      size: stat.size,
      isImage: false,
      isVideo: false,
      rawUrl
    };
  } catch {
    return null;
  }
}

export function getMediaFilePath(conversationId: string, filename: string): string | null {
  const dataDir = getDataDir();
  const mediaPath = path.join(dataDir, 'brain', conversationId, '.user_uploaded', filename);
  if (fs.existsSync(mediaPath)) {
    return mediaPath;
  }
  // Fallback to searching any artifact path
  return getArtifactFilePath(conversationId, filename);
}
