import React, { useState } from 'react';
import {
  MessageSquare,
  Lock,
  EyeOff,
  Send,
  Plus,
  Shield,
  MessageSquarePlus,
  Users,
} from 'lucide-react';
import { InternalCommentsSection } from '../InternalCommentsSection';
import { formatDateTime, formatRelativeTime } from '../../utils/formatters';

export const HubSpotNotesCollabTab = ({
  lead,
  notes = [],
  onAddNote,
}) => {
  const [subTab, setSubTab] = useState('internal'); // internal | external

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Sub-navigation */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            type="button"
            className={`btn btn-sm ${subTab === 'internal' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setSubTab('internal')}
          >
            <Lock size={13} />
            <span>Internal Team Chat (@mentions)</span>
          </button>
          <button
            type="button"
            className={`btn btn-sm ${subTab === 'external' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setSubTab('external')}
          >
            <MessageSquarePlus size={13} />
            <span>Communication Notes ({notes.length})</span>
          </button>
        </div>

        {subTab === 'internal' ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem', color: '#10b981', background: 'rgba(16, 185, 129, 0.1)', padding: '0.3rem 0.6rem', borderRadius: '4px', border: '1px solid rgba(16, 185, 129, 0.25)' }}>
            <EyeOff size={13} />
            <span>Strictly Internal — Never visible to customer</span>
          </div>
        ) : (
          <button type="button" className="btn btn-secondary btn-sm" onClick={onAddNote}>
            <Plus size={13} />
            <span>+ Add Note</span>
          </button>
        )}
      </div>

      {/* Internal Team Discussion */}
      {subTab === 'internal' && (
        <div className="hs-card" style={{ padding: '1rem' }}>
          <InternalCommentsSection leadId={lead?.id} />
        </div>
      )}

      {/* Customer Communication Notes */}
      {subTab === 'external' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {notes.length === 0 ? (
            <div
              style={{
                padding: '3rem 1rem',
                textAlign: 'center',
                background: 'var(--bg-surface, #1e222d)',
                borderRadius: 'var(--radius-md, 8px)',
                border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))',
              }}
            >
              <MessageSquare size={32} className="text-dim" style={{ margin: '0 auto 0.75rem auto', opacity: 0.5 }} />
              <h4 style={{ margin: '0 0 0.25rem 0', color: 'var(--text-main)' }}>No communication notes yet</h4>
              <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-dim)' }}>
                Add interaction notes to document discussions, client objections, or requirements.
              </p>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={onAddNote}
                style={{ marginTop: '1rem' }}
              >
                <Plus size={14} />
                <span>Add First Note</span>
              </button>
            </div>
          ) : (
            notes.map((n) => (
              <div key={n.id} className="hs-card" style={{ margin: 0 }}>
                <div className="hs-card-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span className="badge badge-primary" style={{ fontSize: '0.7rem' }}>
                      {n.note_type}
                    </span>
                    <span style={{ fontSize: '0.8125rem', color: 'var(--text-dim)' }}>
                      by <strong>{n.user?.full_name || n.user?.email || 'Team Member'}</strong>
                    </span>
                  </div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                    {formatRelativeTime(n.created_at)}
                  </span>
                </div>
                <div className="hs-card-body" style={{ padding: '1rem 1.25rem' }}>
                  <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-main)', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                    {n.note_text}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default HubSpotNotesCollabTab;

