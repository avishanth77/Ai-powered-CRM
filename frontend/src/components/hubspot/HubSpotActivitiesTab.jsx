import React, { useState, useMemo } from 'react';
import {
  Activity,
  Phone,
  PhoneCall,
  Mail,
  Calendar,
  MessageSquare,
  CheckSquare,
  Clock,
  Send,
  Plus,
  CheckCircle,
  AlertCircle,
  User,
  Filter,
} from 'lucide-react';
import { formatDateTime, formatRelativeTime } from '../../utils/formatters';

export const HubSpotActivitiesTab = ({
  lead,
  notes = [],
  followups = [],
  timeline = [],
  onLogCall,
  onLogEmail,
  onLogMeeting,
  onAddNote,
  onCompleteFollowup,
}) => {
  const [filterType, setFilterType] = useState('ALL'); // ALL | CALLS | EMAILS | MEETINGS | NOTES | TASKS | FOLLOWUPS

  // Merge and sort all activities chronologically
  const unifiedActivities = useMemo(() => {
    const list = [];

    // 1. Communication Notes (Calls, Emails, Meetings, Notes)
    notes.forEach((n) => {
      let type = 'NOTE';
      if (n.note_type === 'CALL') type = 'CALL';
      else if (n.note_type === 'EMAIL') type = 'EMAIL';
      else if (n.note_type === 'MEETING') type = 'MEETING';

      list.push({
        id: `note-${n.id}`,
        type,
        title: n.note_type === 'CALL'
          ? 'Phone Call Logged'
          : n.note_type === 'EMAIL'
          ? 'Email Logged'
          : n.note_type === 'MEETING'
          ? 'Meeting Logged'
          : 'Communication Note',
        description: n.note_text,
        author: n.user?.full_name || n.user?.email || 'Team Member',
        timestamp: n.created_at,
        raw: n,
      });
    });

    // 2. Follow-ups
    followups.forEach((f) => {
      list.push({
        id: `followup-${f.id}`,
        type: 'FOLLOWUP',
        title: `Follow-up (${f.purpose})`,
        description: f.notes || f.outcome || 'Follow-up touchpoint scheduled',
        status: f.status,
        author: f.assigned_to_details?.full_name || f.assigned_to_details?.email || 'Assigned Rep',
        timestamp: f.completed_at || f.follow_up_at || f.created_at,
        raw: f,
      });
    });

    // 3. Activity Logs (Reassignments, Stage Moves, Creations)
    timeline.forEach((a) => {
      let actTitle = a.action?.replace(/_/g, ' ') || 'CRM Activity';
      list.push({
        id: `act-${a.id}`,
        type: 'SYSTEM',
        title: actTitle,
        description: a.notes || '',
        author: a.performed_by_name || a.performed_by?.email || 'System',
        timestamp: a.created_at,
        raw: a,
      });
    });

    // Sort descending by timestamp
    return list.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }, [notes, followups, timeline]);

  // Filtered list
  const filteredList = useMemo(() => {
    if (filterType === 'ALL') return unifiedActivities;
    if (filterType === 'CALLS') return unifiedActivities.filter((a) => a.type === 'CALL');
    if (filterType === 'EMAILS') return unifiedActivities.filter((a) => a.type === 'EMAIL');
    if (filterType === 'MEETINGS') return unifiedActivities.filter((a) => a.type === 'MEETING');
    if (filterType === 'NOTES') return unifiedActivities.filter((a) => a.type === 'NOTE');
    if (filterType === 'FOLLOWUPS') return unifiedActivities.filter((a) => a.type === 'FOLLOWUP');
    return unifiedActivities;
  }, [unifiedActivities, filterType]);

  const getActivityIcon = (type) => {
    switch (type) {
      case 'CALL':
        return <div className="hs-timeline-icon call"><PhoneCall size={16} /></div>;
      case 'EMAIL':
        return <div className="hs-timeline-icon email"><Mail size={16} /></div>;
      case 'MEETING':
        return <div className="hs-timeline-icon meeting"><Calendar size={16} /></div>;
      case 'NOTE':
        return <div className="hs-timeline-icon note"><MessageSquare size={16} /></div>;
      case 'FOLLOWUP':
        return <div className="hs-timeline-icon task"><Clock size={16} /></div>;
      default:
        return <div className="hs-timeline-icon system"><Activity size={16} /></div>;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Quick Action Drawer */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.75rem',
          background: 'var(--bg-surface, #1e222d)',
          border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))',
          borderRadius: 'var(--radius-md, 8px)',
          padding: '0.875rem 1.25rem',
        }}
      >
        <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-main)' }}>
          Quick Activity Logging
        </span>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-secondary btn-sm" onClick={onLogCall}>
            <PhoneCall size={14} color="#818cf8" />
            <span>Log Call</span>
          </button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={onLogEmail}>
            <Mail size={14} color="#38bdf8" />
            <span>Log Email</span>
          </button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={onLogMeeting}>
            <Calendar size={14} color="#c084fc" />
            <span>Log Meeting</span>
          </button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={onAddNote}>
            <MessageSquare size={14} color="#facc15" />
            <span>Add Note</span>
          </button>
        </div>
      </div>

      {/* Filter Chips */}
      <div className="hs-filter-bar">
        <button
          type="button"
          className={`hs-filter-chip ${filterType === 'ALL' ? 'active' : ''}`}
          onClick={() => setFilterType('ALL')}
        >
          All Activities ({unifiedActivities.length})
        </button>
        <button
          type="button"
          className={`hs-filter-chip ${filterType === 'CALLS' ? 'active' : ''}`}
          onClick={() => setFilterType('CALLS')}
        >
          Calls ({unifiedActivities.filter((a) => a.type === 'CALL').length})
        </button>
        <button
          type="button"
          className={`hs-filter-chip ${filterType === 'EMAILS' ? 'active' : ''}`}
          onClick={() => setFilterType('EMAILS')}
        >
          Emails ({unifiedActivities.filter((a) => a.type === 'EMAIL').length})
        </button>
        <button
          type="button"
          className={`hs-filter-chip ${filterType === 'MEETINGS' ? 'active' : ''}`}
          onClick={() => setFilterType('MEETINGS')}
        >
          Meetings ({unifiedActivities.filter((a) => a.type === 'MEETING').length})
        </button>
        <button
          type="button"
          className={`hs-filter-chip ${filterType === 'NOTES' ? 'active' : ''}`}
          onClick={() => setFilterType('NOTES')}
        >
          Notes ({unifiedActivities.filter((a) => a.type === 'NOTE').length})
        </button>
        <button
          type="button"
          className={`hs-filter-chip ${filterType === 'FOLLOWUPS' ? 'active' : ''}`}
          onClick={() => setFilterType('FOLLOWUPS')}
        >
          Follow-ups ({unifiedActivities.filter((a) => a.type === 'FOLLOWUP').length})
        </button>
      </div>

      {/* Timeline Feed */}
      {filteredList.length === 0 ? (
        <div
          style={{
            padding: '3rem 1rem',
            textAlign: 'center',
            background: 'var(--bg-surface, #1e222d)',
            borderRadius: 'var(--radius-md, 8px)',
            border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))',
          }}
        >
          <Activity size={32} className="text-dim" style={{ margin: '0 auto 0.75rem auto', opacity: 0.5 }} />
          <h4 style={{ margin: '0 0 0.25rem 0', color: 'var(--text-main)' }}>No activities found</h4>
          <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-dim)' }}>
            Log a call, email, meeting, or note to begin building this lead's engagement history.
          </p>
        </div>
      ) : (
        <div className="hs-timeline-feed">
          {filteredList.map((item) => (
            <div key={item.id} className="hs-timeline-item">
              {getActivityIcon(item.type)}
              <div className="hs-timeline-content">
                <div className="hs-timeline-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <h4 className="hs-timeline-title">{item.title}</h4>
                    {item.status && (
                      <span
                        className="badge"
                        style={{
                          fontSize: '0.68rem',
                          background: item.status === 'COMPLETED' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(56, 189, 248, 0.15)',
                          color: item.status === 'COMPLETED' ? 'var(--success)' : '#38bdf8',
                        }}
                      >
                        {item.status}
                      </span>
                    )}
                  </div>
                  <span className="hs-timeline-meta" title={formatDateTime(item.timestamp)}>
                    {formatRelativeTime(item.timestamp)} • by <strong>{item.author}</strong>
                  </span>
                </div>
                {item.description && (
                  <p className="hs-timeline-text">{item.description}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default HubSpotActivitiesTab;

