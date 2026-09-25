import React, { useState, useEffect, useRef } from 'react';
import { AlertCircle, X } from 'lucide-react';
import { useDialogA11y } from '../hooks/useDialogA11y';

const COMMON_REASONS = [
  'Competitor Chosen',
  'Budget Constraints',
  'Feature / Product Mismatch',
  'Lost Contact / Unresponsive',
  'Project Cancelled / Delayed',
  'Timing Not Right',
];

export const LostReasonModal = ({
  isOpen,
  leadName = '',
  loading = false,
  onConfirm,
  onCancel,
}) => {
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const textareaRef = useRef(null);
  const dialogRef = useDialogA11y(isOpen, () => {
    if (!loading) onCancel();
  });

  useEffect(() => {
    if (isOpen) {
      setReason('');
      setError('');
      const timer = setTimeout(() => {
        textareaRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    if (e) e.preventDefault();
    if (!reason.trim()) {
      setError('Please provide a reason why this lead is lost.');
      textareaRef.current?.focus();
      return;
    }
    setError('');
    onConfirm(reason.trim());
  };

  const handleSelectQuickReason = (quickReason) => {
    setReason(quickReason);
    setError('');
    textareaRef.current?.focus();
  };

  return (
    <div
      className="modal-backdrop"
      onClick={!loading ? onCancel : undefined}
      role="dialog"
      aria-modal="true"
      aria-labelledby="lost-modal-title"
    >
      <div className="modal-container" ref={dialogRef} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-row">
            <div className="modal-warning-icon" style={{ color: 'var(--danger)' }}>
              <AlertCircle size={22} />
            </div>
            <h3 id="lost-modal-title">Mark Lead as Lost</h3>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onCancel}
            disabled={loading}
            aria-label="Close modal"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body form-layout">
            {leadName && (
              <div
                style={{
                  backgroundColor: 'var(--bg-surface-elevated)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  padding: '0.75rem 1rem',
                  fontSize: '0.875rem',
                  color: 'var(--text-muted)',
                }}
              >
                Moving deal <strong style={{ color: 'var(--text-main)' }}>{leadName}</strong> to the Lost stage.
              </div>
            )}

            <div className="form-group">
              <label className="form-label form-label-required" htmlFor="lost-reason-textarea">
                Reason for Lost Deal
              </label>

              {/* Quick reason chips */}
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '0.375rem',
                  marginBottom: '0.625rem',
                }}
              >
                {COMMON_REASONS.map((qr) => {
                  const isSelected = reason === qr;
  const handleTextareaKeyDown = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
                    <button
                      key={qr}
                      type="button"
                      onClick={() => handleSelectQuickReason(qr)}
                      disabled={loading}
                      style={{
                        fontSize: '0.75rem',
                        padding: '0.25rem 0.625rem',
                        borderRadius: 'var(--radius-full)',
                        border: '1px solid',
                        borderColor: isSelected ? 'var(--danger)' : 'var(--border-subtle)',
                        backgroundColor: isSelected ? 'var(--danger-bg)' : 'var(--bg-surface-elevated)',
                        color: isSelected ? 'var(--danger)' : 'var(--text-muted)',
                        fontWeight: isSelected ? 600 : 400,
                        cursor: 'pointer',
                        transition: 'all var(--transition-fast)',
                      }}
                    >
                      {qr}
                    </button>
                  );
                })}
              </div>

              <textarea
                ref={textareaRef}
                id="lost-reason-textarea"
                className="form-control"
                rows={3}
                placeholder="Enter detailed reason why the deal was lost (or select a quick reason above)..."
                value={reason}
                onChange={(e) => {
                  setReason(e.target.value);
                  if (error) setError('');
                }}
                onKeyDown={handleTextareaKeyDown}
                disabled={loading}
                style={{ minHeight: '85px', resize: 'vertical' }}
              />
              {error ? (
                <span className="form-error-msg">{error}</span>
              ) : (
                <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '0.25rem' }}>
                  Press Ctrl+Enter to submit
                </span>
              )}
            </div>
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onCancel}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-danger"
              disabled={loading}
            >
              {loading ? 'Updating...' : 'Confirm & Mark Lost'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
