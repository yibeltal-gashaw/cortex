import React, { useState } from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';
import { deleteConversation } from '../api/index.js';

interface DeleteModalProps {
  conversationId: string;
  isOpen: boolean;
  onClose: () => void;
  onDeleted: (id: string) => void;
}

export const DeleteModal: React.FC<DeleteModalProps> = ({
  conversationId,
  isOpen,
  onClose,
  onDeleted
}) => {
  const [confirmText, setConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleDelete = async () => {
    if (confirmText !== 'DELETE') return;
    setIsDeleting(true);
    setError(null);
    try {
      await deleteConversation(conversationId);
      onDeleted(conversationId);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to wipe conversation session');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--cortex-memory-wipe)' }}>
            <AlertTriangle size={18} />
            <span style={{ fontWeight: 700 }}>Memory Wipe: Permanent Deletion</span>
          </div>
          <button className="copy-btn" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="modal-body">
          <p style={{ fontSize: '13px', color: 'var(--cortex-deep-thought)', lineHeight: 1.6 }}>
            You are about to execute a permanent <strong>Memory Wipe</strong> on session:
          </p>
          <div className="mono" style={{ background: 'var(--cortex-memory-wipe-bg)', padding: '8px 12px', borderRadius: '6px', fontSize: '12px', color: 'var(--cortex-memory-wipe)', border: '1px solid var(--cortex-memory-wipe-border)', fontWeight: 600 }}>
            {conversationId}
          </div>

          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            This will permanently wipe from the file system and IDE cache:
            <ul style={{ paddingLeft: '20px', marginTop: '6px' }}>
              <li><code>brain/{conversationId}/</code> (logs, transcripts, plans, tasks, uploaded media)</li>
              <li><code>conversations/{conversationId}.db</code> (SQLite cache and metadata)</li>
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
            <span>{isDeleting ? 'Wiping State...' : 'Execute Memory Wipe'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
