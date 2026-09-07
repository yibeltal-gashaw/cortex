import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Trash2, X } from 'lucide-react';
import { deleteConversation, deleteConversations } from '../api/index.js';

interface DeleteModalProps {
  conversationId?: string;
  conversationIds?: string[];
  conversationTitles?: Record<string, string>;
  isOpen: boolean;
  onClose: () => void;
  onDeleted: (ids: any) => void;
}

export const DeleteModal: React.FC<DeleteModalProps> = ({
  conversationId,
  conversationIds,
  conversationTitles = {},
  isOpen,
  onClose,
  onDeleted
}) => {
  const [confirmText, setConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const targetIds: string[] = conversationIds && conversationIds.length > 0
    ? conversationIds
    : conversationId
      ? [conversationId]
      : [];
  const isMultiple = targetIds.length > 1;

  useEffect(() => {
    if (isOpen) {
      setConfirmText('');
      setError(null);
      setIsDeleting(false);
    }
  }, [isOpen]);

  if (!isOpen || targetIds.length === 0) return null;

  const handleDelete = async () => {
    if (confirmText !== 'DELETE') return;
    setIsDeleting(true);
    setError(null);
    try {
      if (isMultiple) {
        const res = await deleteConversations(targetIds);
        if (!res.success && res.totalDeleted === 0) {
          throw new Error('Failed to wipe selected sessions');
        }
        onDeleted(targetIds);
      } else {
        await deleteConversation(targetIds[0]);
        onDeleted(targetIds[0]);
      }
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to wipe conversation session');
    } finally {
      setIsDeleting(false);
    }
  };

  const modalContent = (
    <div className="modal-backdrop" style={{ zIndex: 99999 }} onClick={onClose}>
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--cortex-memory-wipe)' }}>
            <AlertTriangle size={18} />
            <span style={{ fontWeight: 700 }}>
              Memory Wipe: Permanent Deletion {isMultiple ? `(${targetIds.length} Sessions)` : ''}
            </span>
          </div>
          <button className="copy-btn" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="modal-body">
          <p style={{ fontSize: '13px', color: 'var(--cortex-deep-thought)', lineHeight: 1.6 }}>
            {isMultiple ? (
              <>
                You are about to execute a permanent <strong>Memory Wipe</strong> on <strong>{targetIds.length} sessions</strong>:
              </>
            ) : (
              <>
                You are about to execute a permanent <strong>Memory Wipe</strong> on session:
              </>
            )}
          </p>

          {isMultiple ? (
            <div className="batch-delete-preview-list">
              {targetIds.map(id => (
                <div key={id} className="batch-delete-preview-item">
                  <span className="batch-preview-title" title={conversationTitles[id] || id}>
                    {conversationTitles[id] || 'Untitled Session'}
                  </span>
                  <span className="batch-preview-id mono">{id.slice(0, 8)}...</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="mono" style={{ background: 'var(--cortex-memory-wipe-bg)', padding: '8px 12px', borderRadius: '6px', fontSize: '12px', color: 'var(--cortex-memory-wipe)', border: '1px solid var(--cortex-memory-wipe-border)', fontWeight: 600 }}>
              {targetIds[0]}
            </div>
          )}

          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.6, marginTop: '8px' }}>
            This will permanently wipe from the file system and IDE cache{isMultiple ? ` for all ${targetIds.length} sessions` : ''}:
            <ul style={{ paddingLeft: '20px', marginTop: '6px' }}>
              <li><code>brain/&lt;session_id&gt;/</code> (logs, transcripts, plans, tasks, uploaded media)</li>
              <li><code>conversations/&lt;session_id&gt;.db</code> (SQLite cache and metadata)</li>
            </ul>
          </div>

          {error && (
            <div className="credential-alert">
              <AlertTriangle size={14} color="var(--cortex-memory-wipe)" />
              <span>{error}</span>
            </div>
          )}

          <div style={{ marginTop: '8px' }}>
            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--cortex-deep-thought)', display: 'block', marginBottom: '6px' }}>
              Type <strong style={{ color: 'var(--cortex-memory-wipe)' }}>DELETE</strong> to confirm wipe:
            </label>
            <input
              type="text"
              className="search-input mono"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="DELETE"
              autoFocus
            />
          </div>
        </div>

        <div className="modal-footer">
          <button className="metric-pill" onClick={onClose} disabled={isDeleting}>
            Cancel
          </button>
          <button
            className="danger-btn"
            disabled={confirmText !== 'DELETE' || isDeleting}
            onClick={handleDelete}
            style={{
              opacity: confirmText !== 'DELETE' || isDeleting ? 0.4 : 1,
              cursor: confirmText === 'DELETE' ? 'pointer' : 'not-allowed',
              background: 'var(--cortex-memory-wipe)',
              color: '#FFFFFF'
            }}
          >
            <Trash2 size={13} />
            <span>
              {isDeleting
                ? 'Wiping State...'
                : isMultiple
                  ? `Execute Memory Wipe (${targetIds.length})`
                  : 'Execute Memory Wipe'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );

  if (typeof document !== 'undefined' && document.body) {
    return createPortal(modalContent, document.body);
  }
  return modalContent;
};
