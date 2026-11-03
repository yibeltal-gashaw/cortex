import React, { useState, useEffect } from 'react';
import {
  FileText,
  CheckCircle2,
  Folder,
  FolderOpen,
  ChevronRight,
  ChevronDown,
  FileCode,
  Image as ImageIcon,
  Terminal,
  Copy,
  Check,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Maximize2,
  Download,
  Layers,
  X,
  PanelLeftClose,
  PanelLeftOpen
} from 'lucide-react';
import { marked } from 'marked';
import { sanitizeHtml } from '../utils/sanitizeHtml.js';
import { ArtifactOverview, FileTreeNode } from '../types/index.js';
import { fetchArtifactFile } from '../api/index.js';
import { JsonViewerPanel } from './JsonViewerPanel.js';
import { TaskTerminalViewer } from './TaskTerminalViewer.js';
import { GenerativeUiViewer } from './GenerativeUiViewer.js';

interface ArtifactsTabProps {
  conversationId: string;
  artifacts: ArtifactOverview;
  isRightPanelOpen?: boolean;
}

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg', '.bmp', '.ico', '.avif']);
const VIDEO_EXTENSIONS = new Set(['.mp4', '.webm', '.ogg', '.mov']);

function getExtension(filename: string): string {
  const parts = filename.split('.');
  return parts.length > 1 ? '.' + parts[parts.length - 1].toLowerCase() : '';
}

function isImageFile(filename: string): boolean {
  return IMAGE_EXTENSIONS.has(getExtension(filename));
}

function isVideoFile(filename: string): boolean {
  return VIDEO_EXTENSIONS.has(getExtension(filename));
}

function isJsonFile(filename: string): boolean {
  return filename.toLowerCase().endsWith('.json');
}

function isJsonlFile(filename: string): boolean {
  return filename.toLowerCase().endsWith('.jsonl');
}

function preprocessMarkdownImages(md: string, convId: string): string {
  return md.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (match, alt, src) => {
    let target = src.trim();
    if (target.startsWith('http://') || target.startsWith('https://') || target.startsWith('data:')) {
      return match;
    }
    if ((target.startsWith('"') && target.endsWith('"')) || (target.startsWith("'") && target.endsWith("'"))) {
      target = target.slice(1, -1);
    }
    target = target.replace(/^file:\/\/\/?/i, '');
    if (target.includes(`brain/${convId}/`)) {
      target = target.split(`brain/${convId}/`)[1];
    } else if (target.includes(`brain\\${convId}\\`)) {
      target = target.split(`brain\\${convId}\\`)[1];
    } else {
      const parts = target.replace(/\\/g, '/').split('/');
      const idx = parts.findIndex((p: string) => p === convId);
      if (idx !== -1 && idx < parts.length - 1) {
        target = parts.slice(idx + 1).join('/');
      }
    }
    const encoded = encodeURIComponent(target.replace(/\\/g, '/'));
    return `![${alt}](/api/conversations/${convId}/artifacts/raw?path=${encoded})`;
  });
}

export const ArtifactsTab: React.FC<ArtifactsTabProps> = ({
  conversationId,
  artifacts
}) => {
  const [isExplorerCollapsed, setIsExplorerCollapsed] = useState<boolean>(false);
  const [selectedPath, setSelectedPath] = useState<string>('implementation_plan.md');
  const [fileContent, setFileContent] = useState<string>(artifacts.planContent || '');
  const [loading, setLoading] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [activeMediaModal, setActiveMediaModal] = useState<string | null>(null);

  // Media inspection state
  const [mediaMeta, setMediaMeta] = useState<{
    isImage: boolean;
    isVideo: boolean;
    rawUrl: string;
    size?: number;
    dimensions?: { width: number; height: number };
  } | null>(null);
  const [zoom, setZoom] = useState<number>(100);

  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(() => {
    return new Set(['', artifacts?.tree?.relativePath || '']);
  });

  useEffect(() => {
    setExpandedFolders(new Set(['', artifacts?.tree?.relativePath || '']));
    if (artifacts.hasPlan) {
      setSelectedPath('implementation_plan.md');
      setFileContent(artifacts.planContent || '');
      setMediaMeta(null);
    } else if (artifacts.hasWalkthrough) {
      setSelectedPath('walkthrough.md');
      setFileContent(artifacts.walkthroughContent || '');
      setMediaMeta(null);
    } else if (artifacts.scratchFiles.length > 0) {
      loadFile(artifacts.scratchFiles[0].relativePath);
    } else if (artifacts.taskLogs.length > 0) {
      loadFile(artifacts.taskLogs[0].relativePath);
    }
  }, [conversationId, artifacts]);

  const toggleFolder = (folderPath: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(folderPath)) {
        next.delete(folderPath);
      } else {
        next.add(folderPath);
      }
      return next;
    });
  };

  const loadFile = async (relPath: string) => {
    setSelectedPath(relPath);
    setLoading(true);
    setZoom(100);

    // Automatically expand parent folders of this file
    const parts = relPath.split('/');
    if (parts.length > 1) {
      setExpandedFolders(prev => {
        const next = new Set(prev);
        let curr = '';
        for (let i = 0; i < parts.length - 1; i++) {
          curr = curr ? `${curr}/${parts[i]}` : parts[i];
          next.add(curr);
        }
        return next;
      });
    }

    const isImg = isImageFile(relPath);
    const isVid = isVideoFile(relPath);

    if (isImg || isVid) {
      const rawUrl = `/api/conversations/${conversationId}/artifacts/raw?path=${encodeURIComponent(relPath)}`;
      setMediaMeta({
        isImage: isImg,
        isVideo: isVid,
        rawUrl,
        dimensions: undefined
      });
      setFileContent('');

      try {
        const res = await fetchArtifactFile(conversationId, relPath);
        if (res.size) {
          setMediaMeta(prev => prev ? { ...prev, size: res.size } : null);
        }
      } catch {}
      setLoading(false);
      return;
    }

    setMediaMeta(null);

    try {
      if (relPath === 'implementation_plan.md' && artifacts.planContent) {
        setFileContent(artifacts.planContent);
      } else if (relPath === 'walkthrough.md' && artifacts.walkthroughContent) {
        setFileContent(artifacts.walkthroughContent);
      } else {
        const res = await fetchArtifactFile(conversationId, relPath);
        if (res.isImage || res.isVideo) {
          setMediaMeta({
            isImage: !!res.isImage,
            isVideo: !!res.isVideo,
            rawUrl: res.rawUrl || `/api/conversations/${conversationId}/artifacts/raw?path=${encodeURIComponent(relPath)}`,
            size: res.size
          });
          setFileContent('');
        } else {
          setFileContent(res.content);
        }
      }
    } catch (err: any) {
      setFileContent(`Error loading file: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const copyCurrent = () => {
    navigator.clipboard.writeText(fileContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isMarkdown = selectedPath.endsWith('.md');
  const isImageGallery = selectedPath === '.user_uploaded';

  // Recursive tree renderer with collapsible folder support
  const renderTreeNode = (node: FileTreeNode, depth = 0) => {
    const isDir = node.type === 'directory';
    const isExpanded = expandedFolders.has(node.relativePath);
    const hasChildren = isDir && Boolean(node.children && node.children.length > 0);
    const isSelected = selectedPath === node.relativePath;
    const isScratch = node.relativePath.startsWith('scratch');
    const isTask = node.relativePath.includes('tasks');
    const isUserUpload = node.relativePath.startsWith('.user_uploaded');
    const isImg = isImageFile(node.name);
    const isJson = isJsonFile(node.name);
    const isJsonl = isJsonlFile(node.name);

    // Accent color determination based on Cortex spec
    let iconColor = 'var(--cortex-cognitive-teal)';
    if (isScratch || isUserUpload) {
      iconColor = 'var(--cortex-insight-amber)';
    } else if (isTask || isJson || isJsonl) {
      iconColor = 'var(--cortex-synapse-purple)';
    } else if (node.name.endsWith('.md')) {
      iconColor = 'var(--cortex-execution-green)';
    } else if (isImg) {
      iconColor = 'var(--cortex-insight-amber)';
    }

    return (
      <div key={node.relativePath} style={{ paddingLeft: `${depth * 14}px`, minWidth: 'max-content' }}>
        <div
          className={`tree-node-item ${isSelected ? 'selected' : ''}`}
          onClick={() => {
            if (isDir) {
              toggleFolder(node.relativePath);
              if (node.name === '.user_uploaded') {
                setSelectedPath('.user_uploaded');
                setMediaMeta(null);
              }
            } else {
              loadFile(node.relativePath);
            }
          }}
          title={isDir ? (isExpanded ? 'Click to collapse folder' : 'Click to expand folder') : node.relativePath}
        >
          {isDir ? (
            <>
              {hasChildren ? (
                isExpanded ? (
                  <ChevronDown size={12} color="var(--cortex-grey-matter)" style={{ flexShrink: 0, marginRight: 2 }} />
                ) : (
                  <ChevronRight size={12} color="var(--cortex-grey-matter)" style={{ flexShrink: 0, marginRight: 2 }} />
                )
              ) : (
                <span style={{ width: 14, flexShrink: 0 }} />
              )}
              {isExpanded ? (
                <FolderOpen size={14} color={iconColor} style={{ flexShrink: 0 }} />
              ) : (
                <Folder size={14} color={iconColor} style={{ flexShrink: 0 }} />
              )}
            </>
          ) : (
            <>
              <span style={{ width: 14, flexShrink: 0 }} />
              {isImg ? (
                <ImageIcon size={14} color="var(--cortex-insight-amber)" style={{ flexShrink: 0 }} />
              ) : isJson || isJsonl ? (
                <FileCode size={14} color="var(--cortex-synapse-purple)" style={{ flexShrink: 0 }} />
              ) : node.name.endsWith('.md') ? (
                <FileText size={14} color="var(--cortex-execution-green)" style={{ flexShrink: 0 }} />
              ) : node.name.endsWith('.log') ? (
                <Terminal size={14} color="var(--cortex-synapse-purple)" style={{ flexShrink: 0 }} />
              ) : (
                <FileCode size={14} color={iconColor} style={{ flexShrink: 0 }} />
              )}
            </>
          )}
          <span className="mono" style={{ color: isScratch ? '#B45309' : 'inherit', whiteSpace: 'nowrap', flexShrink: 0 }}>
            {node.name}
          </span>
          {node.size !== undefined && (
            <span style={{ fontSize: '10px', color: 'var(--cortex-grey-matter)', marginLeft: '6px', whiteSpace: 'nowrap', flexShrink: 0 }}>
              {(node.size / 1024).toFixed(1)}k
            </span>
          )}
        </div>

        {isDir && isExpanded && node.children && node.children.map(child => renderTreeNode(child, depth + 1))}
      </div>
    );
  };

  return (
    <div className="artifacts-view">
      {/* 1. Left Explorer Panel (Collapsible) */}
      {!isExplorerCollapsed && (
        <div className="artifacts-tree-panel">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px 10px 12px', borderBottom: '1px solid var(--cortex-grey-matter-border)' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--cortex-grey-matter)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Artifacts Explorer
            </span>
            <button
              className="hud-action-icon-btn"
              style={{ width: '24px', height: '24px', padding: 0 }}
              onClick={() => setIsExplorerCollapsed(true)}
              title="Collapse Explorer"
              aria-label="Collapse Artifacts Explorer"
            >
              <PanelLeftClose size={14} />
            </button>
          </div>

          <div style={{ padding: '8px 10px 12px 10px', borderBottom: '1px solid var(--cortex-grey-matter-border)', marginBottom: '8px' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--cortex-grey-matter)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Artifact Shortcuts
            </span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '6px' }}>
              {artifacts.hasPlan && (
                <button
                  className={`tree-node-item ${selectedPath === 'implementation_plan.md' ? 'selected' : ''}`}
                  onClick={() => loadFile('implementation_plan.md')}
                >
                  <FileText size={14} color="var(--cortex-execution-green)" />
                  <span style={{ color: 'var(--cortex-deep-thought)', fontWeight: 600 }}>implementation_plan.md</span>
                </button>
              )}
              {artifacts.hasWalkthrough && (
                <button
                  className={`tree-node-item ${selectedPath === 'walkthrough.md' ? 'selected' : ''}`}
                  onClick={() => loadFile('walkthrough.md')}
                >
                  <CheckCircle2 size={14} color="var(--cortex-execution-green)" />
                  <span style={{ color: 'var(--cortex-deep-thought)', fontWeight: 600 }}>walkthrough.md</span>
                </button>
              )}
              {artifacts.uploadedMedia.length > 0 && (
                <button
                  className={`tree-node-item ${selectedPath === '.user_uploaded' ? 'selected' : ''}`}
                  onClick={() => {
                    setSelectedPath('.user_uploaded');
                    setMediaMeta(null);
                  }}
                >
                  <ImageIcon size={14} color="var(--cortex-insight-amber)" />
                  <span style={{ color: '#B45309', fontWeight: 600 }}>
                    Uploaded Assets ({artifacts.uploadedMedia.length})
                  </span>
                </button>
              )}

              {artifacts.taskLogs.length > 0 && (
                <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid var(--border-subtle)' }}>
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                    Background Processes ({artifacts.taskLogs.length})
                  </span>
                  {artifacts.taskLogs.map(tl => (
                    <button
                      key={tl.name}
                      className={`tree-node-item ${selectedPath === tl.relativePath ? 'selected' : ''}`}
                      onClick={() => loadFile(tl.relativePath)}
                      style={{ padding: '4px 6px' }}
                    >
                      <Terminal size={13} color="var(--cortex-synapse-purple)" />
                      <span className="mono truncate" style={{ color: 'var(--cortex-deep-thought)', fontSize: '11px' }}>
                        {tl.name}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div style={{ padding: '6px 10px' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--cortex-grey-matter)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Cortex Workspace Tree
            </span>
            <div className="artifacts-tree-scroll" style={{ marginTop: '8px', overflowX: 'auto', paddingBottom: '6px' }}>
              <div style={{ minWidth: 'max-content' }}>
                {renderTreeNode(artifacts.tree)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. Right Content Panel */}
      <div className="artifacts-content-panel">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '16px', borderBottom: '1px solid var(--cortex-grey-matter-border)', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {isExplorerCollapsed && (
              <button
                className="metric-pill"
                onClick={() => setIsExplorerCollapsed(false)}
                title="Expand Artifacts Explorer"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '11.5px', padding: '4px 8px' }}
              >
                <PanelLeftOpen size={13} />
                <span>Show Explorer</span>
              </button>
            )}
            {mediaMeta?.isImage ? (
              <ImageIcon size={18} color="var(--cortex-insight-amber)" />
            ) : isJsonFile(selectedPath) || isJsonlFile(selectedPath) ? (
              <FileCode size={18} color="var(--cortex-synapse-purple)" />
            ) : (
              <FileCode size={18} color="var(--cortex-cognitive-teal)" />
            )}
            <span className="mono" style={{ fontSize: '14px', fontWeight: 700, color: 'var(--cortex-deep-thought)' }}>
              {selectedPath}
            </span>
          </div>

          {!isImageGallery && !mediaMeta && !isJsonFile(selectedPath) && !isJsonlFile(selectedPath) && (
            <button className="metric-pill" onClick={copyCurrent} title="Copy file content">
              {copied ? <Check size={14} color="var(--cortex-execution-green)" /> : <Copy size={14} />}
              <span>{copied ? 'Copied' : 'Copy Content'}</span>
            </button>
          )}
        </div>

        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--cortex-grey-matter)' }}>
            Loading artifact content...
          </div>
        ) : isImageGallery ? (
          <div>
            <h3 style={{ fontSize: '15px', marginBottom: '14px', color: 'var(--cortex-deep-thought)', fontWeight: 700 }}>
              User Uploaded Media & Screenshots (Insight Amber)
            </h3>
            <div className="media-gallery">
              {artifacts.uploadedMedia.map((m) => (
                <div
                  key={m.name}
                  className="media-card"
                  onClick={() => setActiveMediaModal(m.url)}
                >
                  <div className="media-img-wrapper">
                    <img src={m.url} alt={m.name} />
                  </div>
                  <div style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span className="mono truncate" style={{ fontSize: '11px', color: 'var(--cortex-deep-thought)', fontWeight: 500 }} title={m.name}>
                      {m.name}
                    </span>
                    <span style={{ fontSize: '10px', color: 'var(--cortex-grey-matter)' }}>
                      {(m.size / 1024).toFixed(1)} KB
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : mediaMeta?.isImage ? (
          /* Human-Recognizable Artifact Image Inspector */
          <div className="artifact-image-viewer">
            <div className="artifact-image-toolbar">
              <div className="artifact-image-meta">
                <span className="artifact-image-badge">
                  {selectedPath.split('.').pop()?.toUpperCase()}
                </span>
                {mediaMeta.size !== undefined && (
                  <span className="metric-pill">
                    <Layers size={13} className="icon" />
                    <span>{(mediaMeta.size / 1024).toFixed(1)} KB</span>
                  </span>
                )}
                {mediaMeta.dimensions && (
                  <span className="metric-pill">
                    <Maximize2 size={13} className="icon" />
                    <span>{mediaMeta.dimensions.width} × {mediaMeta.dimensions.height} px</span>
                  </span>
                )}
                <span className="metric-pill" style={{ color: 'var(--cortex-execution-green)' }}>
                  <Check size={13} />
                  <span>Rendered Image</span>
                </span>
              </div>

              <div className="artifact-image-controls">
                <button
                  className="artifact-control-btn"
                  onClick={() => setZoom(z => Math.max(25, z - 25))}
                  title="Zoom Out"
                >
                  <ZoomOut size={14} />
                </button>
                <button
                  className="artifact-control-btn"
                  onClick={() => setZoom(100)}
                  title="Reset to 100%"
                >
                  <RotateCcw size={13} />
                  <span>{zoom}%</span>
                </button>
                <button
                  className="artifact-control-btn"
                  onClick={() => setZoom(z => Math.min(300, z + 25))}
                  title="Zoom In"
                >
                  <ZoomIn size={14} />
                </button>
                <button
                  className="artifact-control-btn"
                  onClick={() => setActiveMediaModal(mediaMeta.rawUrl)}
                  title="Expand to Fullscreen Lightbox"
                >
                  <Maximize2 size={14} />
                  <span>Expand</span>
                </button>
                <a
                  className="artifact-control-btn"
                  href={mediaMeta.rawUrl}
                  download={selectedPath.split('/').pop()}
                  title="Download Image"
                  style={{ textDecoration: 'none' }}
                >
                  <Download size={14} />
                  <span>Download</span>
                </a>
              </div>
            </div>

            <div className="artifact-image-canvas">
              <img
                src={mediaMeta.rawUrl}
                alt={selectedPath}
                style={{ transform: `scale(${zoom / 100})` }}
                onLoad={(e) => {
                  const img = e.currentTarget;
                  setMediaMeta(prev => prev ? { ...prev, dimensions: { width: img.naturalWidth, height: img.naturalHeight } } : null);
                }}
                onClick={() => setActiveMediaModal(mediaMeta.rawUrl)}
                title="Click to view fullscreen lightbox"
              />
            </div>
          </div>
        ) : mediaMeta?.isVideo ? (
          /* Video Player */
          <div className="artifact-image-viewer">
            <div className="artifact-image-toolbar">
              <div className="artifact-image-meta">
                <span className="artifact-image-badge">{selectedPath.split('.').pop()?.toUpperCase()} VIDEO</span>
                {mediaMeta.size !== undefined && (
                  <span className="metric-pill">
                    <span>{(mediaMeta.size / 1024).toFixed(1)} KB</span>
                  </span>
                )}
              </div>
              <div className="artifact-image-controls">
                <a
                  className="artifact-control-btn"
                  href={mediaMeta.rawUrl}
                  download={selectedPath.split('/').pop()}
                  style={{ textDecoration: 'none' }}
                >
                  <Download size={14} />
                  <span>Download</span>
                </a>
              </div>
            </div>
            <div className="artifact-video-canvas">
              <video controls autoPlay loop src={mediaMeta.rawUrl} />
            </div>
          </div>
        ) : (selectedPath.toLowerCase().endsWith('.html') || selectedPath.toLowerCase().endsWith('.htm')) ? (
          <GenerativeUiViewer
            htmlContent={fileContent}
            fileName={selectedPath}
          />
        ) : (selectedPath.includes('.system_generated/tasks/') || (selectedPath.startsWith('task-') && selectedPath.endsWith('.log')) || selectedPath.endsWith('.log')) ? (
          <TaskTerminalViewer
            conversationId={conversationId}
            taskPath={selectedPath}
            initialContent={fileContent}
          />
        ) : isMarkdown ? (
          <div
            className="markdown-body"
            dangerouslySetInnerHTML={{
              __html: sanitizeHtml(marked.parse(preprocessMarkdownImages(fileContent, conversationId), { breaks: true, gfm: true }) as string)
            }}
          />
        ) : isJsonFile(selectedPath) || isJsonlFile(selectedPath) ? (
          <JsonViewerPanel
            content={fileContent}
            filePath={selectedPath}
            isJsonl={isJsonlFile(selectedPath)}
          />
        ) : (
          <pre className="mono" style={{ background: 'var(--bg-code)', padding: '16px', borderRadius: '10px', fontSize: '12px', overflowX: 'auto', border: '1px solid var(--cortex-grey-matter-border)', whiteSpace: 'pre-wrap', color: 'var(--cortex-deep-thought)' }}>
            {fileContent}
          </pre>
        )}
      </div>

      {activeMediaModal && (
        <div className="lightbox-modal" onClick={() => setActiveMediaModal(null)}>
          <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
            <button className="lightbox-close-btn" onClick={() => setActiveMediaModal(null)}>
              <X size={18} />
            </button>
            <img src={activeMediaModal} alt="Preview" />
          </div>
        </div>
      )}
    </div>
  );
};
