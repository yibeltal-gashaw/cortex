import React, { useState } from 'react';
import {
  Eye,
  Code,
  Monitor,
  Tablet,
  Smartphone,
  RotateCw,
  ExternalLink,
  Download,
  Copy,
  Check,
  Sparkles
} from 'lucide-react';

interface GenerativeUiViewerProps {
  htmlContent: string;
  fileName: string;
}

export const GenerativeUiViewer: React.FC<GenerativeUiViewerProps> = ({
  htmlContent,
  fileName
}) => {
  const [mode, setMode] = useState<'preview' | 'source'>('preview');
  const [viewportWidth, setViewportWidth] = useState<'100%' | '1200px' | '768px' | '375px'>('100%');
  const [refreshKey, setRefreshKey] = useState<number>(0);
  const [copied, setCopied] = useState<boolean>(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(htmlContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName.split(/[\\/]/).pop() || 'artifact.html';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePopout = () => {
    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: 'var(--bg-main)',
        borderRadius: '8px',
        overflow: 'hidden',
        border: '1px solid var(--cortex-grey-matter-border)'
      }}
    >
      {/* Top Controls Toolbar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 16px',
          background: 'var(--bg-card)',
          borderBottom: '1px solid var(--cortex-grey-matter-border)',
          gap: '12px',
          flexWrap: 'wrap'
        }}
      >
        {/* Left: View Mode Toggle & File Info */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div className="db-mode-selector">
            <button
              className={`db-mode-btn ${mode === 'preview' ? 'active' : ''}`}
              onClick={() => setMode('preview')}
            >
              <Eye size={13} />
              <span>Interactive Widget</span>
            </button>
            <button
              className={`db-mode-btn ${mode === 'source' ? 'active' : ''}`}
              onClick={() => setMode('source')}
            >
              <Code size={13} />
              <span>HTML Source</span>
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span
              className="mini-badge mono"
              style={{
                background: 'rgba(139, 92, 246, 0.15)',
                color: '#c084fc',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '11px',
                padding: '3px 8px'
              }}
            >
              <Sparkles size={11} />
              <span>Generative UI Artifact</span>
            </span>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              {(new Blob([htmlContent]).size / 1024).toFixed(1)} KB
            </span>
          </div>
        </div>

        {/* Right: Viewport Presets & Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {mode === 'preview' && (
            <>
              {/* Viewport Width Switchers */}
              <div className="db-mode-selector">
                <button
                  className={`db-mode-btn ${viewportWidth === '100%' ? 'active' : ''}`}
                  onClick={() => setViewportWidth('100%')}
                  title="Responsive (100% width)"
                >
                  <Monitor size={12} />
                  <span>Full</span>
                </button>
                <button
                  className={`db-mode-btn ${viewportWidth === '768px' ? 'active' : ''}`}
                  onClick={() => setViewportWidth('768px')}
                  title="Tablet Width (768px)"
                >
                  <Tablet size={12} />
                  <span>768px</span>
                </button>
                <button
                  className={`db-mode-btn ${viewportWidth === '375px' ? 'active' : ''}`}
                  onClick={() => setViewportWidth('375px')}
                  title="Mobile Width (375px)"
                >
                  <Smartphone size={12} />
                  <span>375px</span>
                </button>
              </div>

              {/* Reload Button */}
              <button
                className="copy-btn"
                onClick={() => setRefreshKey(k => k + 1)}
                title="Reload Widget"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 8px', fontSize: '11px' }}
              >
                <RotateCw size={12} />
                <span>Reload</span>
              </button>

              {/* Popout */}
              <button
                className="copy-btn"
                onClick={handlePopout}
                title="Open in new window"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 8px', fontSize: '11px' }}
              >
                <ExternalLink size={12} />
                <span>Popout</span>
              </button>
            </>
          )}

          {mode === 'source' && (
            <button
              className="copy-btn"
              onClick={handleCopy}
              title="Copy HTML Source Code"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 8px', fontSize: '11px' }}
            >
              {copied ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
              <span>{copied ? 'Copied' : 'Copy Code'}</span>
            </button>
          )}

          {/* Download HTML */}
          <button
            className="copy-btn"
            onClick={handleDownload}
            title="Download HTML File"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 8px', fontSize: '11px' }}
          >
            <Download size={12} />
          </button>
        </div>
      </div>

      {/* Main Display Area */}
      <div style={{ flex: 1, overflow: 'auto', display: 'flex', justifyContent: 'center', background: '#0D1117' }}>
        {mode === 'preview' ? (
          <div
            style={{
              width: viewportWidth,
              height: '100%',
              transition: 'width 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
              background: '#ffffff',
              boxShadow: viewportWidth !== '100%' ? '0 0 24px rgba(0, 0, 0, 0.5)' : 'none'
            }}
          >
            <iframe
              key={refreshKey}
              srcDoc={htmlContent}
              title={fileName}
              sandbox="allow-scripts allow-forms allow-modals"
              style={{
                width: '100%',
                height: '100%',
                border: 'none',
                display: 'block'
              }}
            />
          </div>
        ) : (
          <div style={{ width: '100%', padding: '16px' }}>
            <pre
              className="mono"
              style={{
                background: '#090D14',
                color: '#E2E8F0',
                padding: '16px',
                borderRadius: '8px',
                fontSize: '12px',
                lineHeight: '1.6',
                overflowX: 'auto',
                whiteSpace: 'pre-wrap',
                border: '1px solid var(--cortex-grey-matter-border)'
              }}
            >
              {htmlContent}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};

