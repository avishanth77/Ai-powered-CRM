import React from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { useDialogA11y } from '../hooks/useDialogA11y';

export const ConfirmModal = ({
  isOpen,
  title = 'Confirm Action',
  message = 'Are you sure you want to proceed?',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  isDestructive = false,
  loading = false,
  onConfirm,
  onCancel,
}) => {
  const dialogRef = useDialogA11y(isOpen, onCancel);

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onCancel} role="dialog" aria-modal="true" aria-label={title}>
      <div className="modal-container" ref={dialogRef} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-row">
            {isDestructive && (
              <div className="modal-warning-icon">
                <AlertTriangle size={20} />
              </div>
            )}
            <h3>{title}</h3>
          </div>
          <button className="modal-close-btn" onClick={onCancel} aria-label="Close modal">
            <X size={18} />
          </button>
        </div>
        <div className="modal-body">
          <p>{message}</p>
        </div>
        <div className="modal-footer">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onCancel}
            disabled={loading}
          >
            {cancelText}
          </button>
          <button
            type="button"
            className={`btn ${isDestructive ? 'btn-danger' : 'btn-primary'}`}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? 'Processing...' : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};
