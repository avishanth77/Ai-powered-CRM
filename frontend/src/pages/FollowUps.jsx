import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { followupApi } from '../api/followupApi';
import { leadApi } from '../api/leadApi';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { formatDateTime, formatDate } from '../utils/formatters';
import { extractErrorMessage } from '../utils/validation';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { EmptyState } from '../components/EmptyState';
import { StatusBadge } from '../components/StatusBadge';
import { SearchBar } from '../components/SearchBar';
import { FOLLOWUP_PURPOSES } from '../utils/constants';

import {
  Clock,
  AlertCircle,
  Calendar,
  CheckCircle2,
  CalendarPlus,
  Phone,
  MessageSquare,
  Users,
  Presentation,
  Mail,
  FileText,
  Filter,
  ArrowUpDown,
  X,
  Search,
} from 'lucide-react';

export const FollowUps = () => {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState('all'); // all | overdue | today | completed
  const [followups, setFollowups] = useState([]);
  const [loading, setLoading] = useState(true);

  // Search & Filtering State
  const [search, setSearch] = useState('');
  const [purposeFilter, setPurposeFilter] = useState('');
  const [sortOrder, setSortOrder] = useState('-follow_up_at'); // Default: latest scheduled first

  // Complete modal
  const [completeModalOpen, setCompleteModalOpen] = useState(false);
  const [selectedFollowup, setSelectedFollowup] = useState(null);
  const [outcome, setOutcome] = useState('');
  const [completing, setCompleting] = useState(false);

  // New follow-up modal
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [leadsList, setLeadsList] = useState([]);
  const [newFollowup, setNewFollowup] = useState({
    lead: '',
    purpose: 'Phone Call',
    follow_up_at: '',
  });
  const [scheduling, setScheduling] = useState(false);

  const fetchFollowups = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (search.trim()) params.search = search.trim();
      if (purposeFilter) params.purpose = purposeFilter;
      if (sortOrder) params.ordering = sortOrder;

      let res;
      if (activeTab === 'overdue') {
        res = await followupApi.getOverdue(params);
      } else if (activeTab === 'today') {
        res = await followupApi.getToday(params);
      } else if (activeTab === 'completed') {
        res = await followupApi.getFollowUps({ ...params, status: 'COMPLETED' });
      } else {
        res = await followupApi.getFollowUps(params);
      }

      setFollowups(res.results || res.data || (Array.isArray(res) ? res : []));
    } catch (err) {
      showToast(extractErrorMessage(err, 'Failed to fetch follow-ups'), 'error');
    } finally {
      setLoading(false);
    }
  }, [activeTab, search, purposeFilter, sortOrder, showToast]);

  useEffect(() => {
    fetchFollowups();
  }, [fetchFollowups]);

  // Load leads for scheduling modal
  useEffect(() => {
    leadApi
      .getLeads({ page_size: 100 })
      .then((res) => setLeadsList(res.results || res))
      .catch(() => {});
  }, []);

  const handleClearFilters = () => {
    setSearch('');
    setPurposeFilter('');
    setSortOrder('-follow_up_at');
  };

  const hasActiveFilters = Boolean(search || purposeFilter || sortOrder !== '-follow_up_at');

  const handleOpenComplete = (fu) => {
    setSelectedFollowup(fu);
    setOutcome(fu.outcome || '');
    setCompleteModalOpen(true);
  };

  const handleConfirmComplete = async (e) => {
    e.preventDefault();
    if (!outcome.trim() || outcome.trim().length < 3) {
      showToast('Please provide an outcome note (minimum 3 characters).', 'warning');
      return;
    }

    setCompleting(true);
    try {
      await followupApi.completeFollowUp(selectedFollowup.id, { outcome: outcome.trim() });
      showToast(
        selectedFollowup?.status === 'COMPLETED'
          ? 'Follow-up outcome updated!'
          : 'Follow-up marked as completed!',
        'success'
      );
      setCompleteModalOpen(false);
      setSelectedFollowup(null);
      setOutcome('');
      fetchFollowups();
    } catch (err) {
      showToast(extractErrorMessage(err, 'Failed to complete follow-up'), 'error');
    } finally {
      setCompleting(false);
    }
  };

  const handleReopenFollowup = async () => {
    if (!selectedFollowup) return;
    setCompleting(true);
    try {
      await followupApi.updateFollowUp(selectedFollowup.id, { status: 'PENDING' });
      showToast('Follow-up reopened as Pending!', 'success');
      setCompleteModalOpen(false);
      setSelectedFollowup(null);
      setOutcome('');
      fetchFollowups();
    } catch (err) {
      showToast(extractErrorMessage(err, 'Failed to reopen follow-up'), 'error');
    } finally {
      setCompleting(false);
    }
  };

  const handleScheduleSubmit = async (e) => {
    e.preventDefault();
    if (!newFollowup.lead || !newFollowup.follow_up_at) {
      showToast('Please select a lead and date/time.', 'warning');
      return;
    }

    setScheduling(true);
    try {
      await followupApi.createFollowUp({
        lead: parseInt(newFollowup.lead),
        purpose: newFollowup.purpose,
        follow_up_at: new Date(newFollowup.follow_up_at).toISOString(),
        assigned_to: user.id,
      });
      showToast('Follow-up scheduled successfully!', 'success');
      setScheduleModalOpen(false);
      setNewFollowup({ lead: '', purpose: 'Phone Call', follow_up_at: '' });
      fetchFollowups();
    } catch (err) {
      showToast(extractErrorMessage(err, 'Failed to schedule follow-up'), 'error');
    } finally {
      setScheduling(false);
    }
  };

  const getPurposeIcon = (purpose) => {
    switch (purpose) {
      case 'Phone Call':
        return <Phone size={14} color="#0284c7" />;
      case 'Product Demo':
        return <Presentation size={14} color="#8b5cf6" />;
      case 'Proposal Review':
        return <FileText size={14} color="#f59e0b" />;
      case 'Follow-up Meeting':
        return <Users size={14} color="#10b981" />;
      case 'Email Check-in':
        return <Mail size={14} color="#06b6d4" />;
      case 'Contract Negotiation':
        return <FileText size={14} color="#ec4899" />;
      default:
        return <Calendar size={14} color="var(--primary)" />;
    }
  };

  return (
    <div className="followups-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <Clock size={26} />
            <span>Follow-up Management</span>
          </h1>
          <p className="page-subtitle">
            Stay on top of scheduled phone calls, product demos, proposals, and client meetings
          </p>
        </div>
        <div className="page-actions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setScheduleModalOpen(true)}
          >
            <CalendarPlus size={18} />
            <span>Schedule Follow-up</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs-navigation">
        <button
          type="button"
          className={`tab-btn ${activeTab === 'all' ? 'tab-btn-active' : ''}`}
          onClick={() => setActiveTab('all')}
        >
          <Calendar size={16} />
          <span>All Follow-ups</span>
        </button>

        <button
          type="button"
          className={`tab-btn ${activeTab === 'overdue' ? 'tab-btn-active' : ''}`}
          onClick={() => setActiveTab('overdue')}
          style={{ color: activeTab === 'overdue' ? 'var(--danger)' : undefined }}
        >
          <AlertCircle size={16} color="var(--danger)" />
          <span>Overdue Tasks</span>
        </button>

        <button
          type="button"
          className={`tab-btn ${activeTab === 'today' ? 'tab-btn-active' : ''}`}
          onClick={() => setActiveTab('today')}
        >
          <Clock size={16} />
          <span>Scheduled Today</span>
        </button>

        <button
          type="button"
          className={`tab-btn ${activeTab === 'completed' ? 'tab-btn-active' : ''}`}
          onClick={() => setActiveTab('completed')}
        >
          <CheckCircle2 size={16} color="var(--success)" />
          <span>Completed</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="filter-toolbar">
        <SearchBar
          value={search}
          onChange={(val) => setSearch(val)}
          placeholder="Search by contact, company, purpose, rep, or outcome..."
        />

        <div className="filter-group">
          {/* Purpose Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
            <Filter size={14} className="text-dim" />
            <select
              className="filter-select"
              value={purposeFilter}
              onChange={(e) => setPurposeFilter(e.target.value)}
              aria-label="Filter by Purpose"
            >
              <option value="">All Purposes</option>
              {FOLLOWUP_PURPOSES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          {/* Sort Order */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
            <ArrowUpDown size={14} className="text-dim" />
            <select
              className="filter-select"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              aria-label="Sort Order"
            >
              <option value="-follow_up_at">Latest Scheduled First</option>
              <option value="follow_up_at">Oldest / Upcoming First</option>
              <option value="-created_at">Recently Created First</option>
              <option value="purpose">Purpose (A-Z)</option>
            </select>
          </div>

          {/* Clear Filters Button */}
          {hasActiveFilters && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleClearFilters}
              title="Reset search and filters"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
            >
              <X size={13} />
              <span>Clear</span>
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="table-responsive">
        {loading ? (
          <LoadingSpinner text="Retrieving follow-ups..." />
        ) : followups.length === 0 ? (
          <EmptyState
            title="No follow-ups found"
            message={
              hasActiveFilters
                ? 'No follow-up tasks matched your search or filters.'
                : activeTab === 'overdue'
                ? 'Great job! You have no overdue tasks.'
                : activeTab === 'today'
                ? 'No follow-up tasks scheduled for today.'
                : 'No follow-up tasks scheduled in this view.'
            }
            actionLabel={hasActiveFilters ? 'Clear Filters' : 'Schedule a Follow-up'}
            onAction={hasActiveFilters ? handleClearFilters : () => setScheduleModalOpen(true)}
          />
        ) : (
          <table className="crm-table">
            <thead>
              <tr>
                <th>Purpose</th>
                <th>Target Lead / Customer</th>
                <th>Scheduled Date & Time</th>
                <th>Assigned Rep</th>
                <th>Status</th>
                <th>Outcome / Notes</th>
                <th className="table-action-col">Action</th>
              </tr>
            </thead>
            <tbody>
              {followups.map((fu) => {
                const isOverdue =
                  fu.is_overdue ||
                  (fu.status === 'PENDING' && new Date(fu.follow_up_at) < new Date());
                return (
                  <tr key={fu.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        {getPurposeIcon(fu.purpose)}
                        <span className="text-main font-semibold">{fu.purpose}</span>
                      </div>
                    </td>
                    <td>
                      {fu.lead ? (
                        <div className="lead-name-cell">
                          <Link to={`/leads/${fu.lead}`} className="lead-primary-name">
                            {fu.lead_name || `Lead #${fu.lead}`}
                          </Link>
                          <span className="lead-company-name">
                            {fu.lead_company || 'Individual Lead'}
                          </span>
                        </div>
                      ) : fu.customer ? (
                        <div className="lead-name-cell">
                          <Link to={`/customers/${fu.customer}`} className="lead-primary-name">
                            {fu.customer_name || `Customer #${fu.customer}`}
                          </Link>
                          <span className="lead-company-name">
                            {fu.customer_company || 'Customer Account'}
                          </span>
                        </div>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span className="text-main font-sm">{formatDateTime(fu.follow_up_at)}</span>
                        {isOverdue && (
                          <span className="font-sm" style={{ color: 'var(--danger)', fontSize: '0.75rem', fontWeight: 600 }}>
                            Overdue
                          </span>
                        )}
                      </div>
                    </td>
                    <td>
                      <span className="text-dim font-sm">
                        {fu.assigned_to_details?.full_name ||
                          fu.assigned_to_details?.email ||
                          'Unassigned'}
                      </span>
                    </td>
                    <td>
                      <span
                        className="status-badge"
                        style={{
                          color: isOverdue ? 'var(--danger)' : fu.status === 'COMPLETED' ? 'var(--success)' : '#38bdf8',
                          backgroundColor: isOverdue ? 'rgba(239, 68, 68, 0.12)' : fu.status === 'COMPLETED' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(56, 189, 248, 0.12)',
                        }}
                      >
                        {isOverdue ? 'OVERDUE' : fu.status}
                      </span>
                    </td>
                    <td>
                      <span className="table-truncate-cell text-muted font-sm" title={fu.outcome || ''}>
                        {fu.outcome || '—'}
                      </span>
                    </td>
                    <td className="table-action-col">
                      {fu.status !== 'COMPLETED' ? (
                        <button
                          type="button"
                          className="btn btn-success btn-sm"
                          onClick={() => handleOpenComplete(fu)}
                          title="Complete task and log outcome"
                        >
                          <CheckCircle2 size={14} />
                          <span>Complete</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleOpenComplete(fu)}
                          title="View or update logged outcome"
                        >
                          <FileText size={14} color="var(--primary)" />
                          <span>Outcome</span>
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Complete / Outcome Modal */}
      {completeModalOpen && (
        <div className="modal-backdrop" onClick={() => setCompleteModalOpen(false)}>
          <div className="modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {selectedFollowup?.status === 'COMPLETED' ? (
                  <CheckCircle2 size={18} color="var(--success)" />
                ) : (
                  <Clock size={18} color="var(--primary)" />
                )}
                <h3 style={{ margin: 0 }}>
                  {selectedFollowup?.status === 'COMPLETED'
                    ? 'Follow-up Outcome & Details'
                    : 'Log Follow-up Outcome'}
                </h3>
              </div>
              <button className="modal-close-btn" onClick={() => setCompleteModalOpen(false)}>✕</button>
            </div>
            <form onSubmit={handleConfirmComplete}>
              <div className="modal-body form-layout">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <p className="text-muted font-sm" style={{ margin: 0 }}>
                    Target: <strong>{selectedFollowup?.lead_name || selectedFollowup?.customer_name || 'Contact'}</strong> ({selectedFollowup?.purpose})
                  </p>
                  <span
                    className="status-badge"
                    style={{
                      color: selectedFollowup?.status === 'COMPLETED' ? 'var(--success)' : '#38bdf8',
                      backgroundColor: selectedFollowup?.status === 'COMPLETED' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(56, 189, 248, 0.12)',
                    }}
                  >
                    {selectedFollowup?.status}
                  </span>
                </div>
                <div className="form-group">
                  <label className="form-label form-label-required" htmlFor="modal-outcome">
                    Result & Next Step Summary
                  </label>
                  <textarea
                    id="modal-outcome"
                    className="form-control"
                    placeholder="Describe discussion results, client feedback, or required next actions (min 3 chars)..."
                    value={outcome}
                    onChange={(e) => setOutcome(e.target.value)}
                    rows={4}
                    minLength={3}
                    required
                  />
                </div>
              </div>
              <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div>
                  {selectedFollowup?.status === 'COMPLETED' && (
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={handleReopenFollowup}
                      disabled={completing}
                      title="Change status back to Pending"
                    >
                      <Clock size={14} />
                      <span>Reopen as Pending</span>
                    </button>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setCompleteModalOpen(false)}>Cancel</button>
                  <button
                    type="submit"
                    className={selectedFollowup?.status === 'COMPLETED' ? 'btn btn-primary' : 'btn btn-success'}
                    disabled={completing || outcome.trim().length < 3}
                  >
                    {completing
                      ? 'Saving...'
                      : selectedFollowup?.status === 'COMPLETED'
                      ? 'Update Outcome'
                      : 'Mark Completed'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Schedule Modal */}
      {scheduleModalOpen && (
        <div className="modal-backdrop" onClick={() => setScheduleModalOpen(false)}>
          <div className="modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Schedule New Follow-up</h3>
              <button className="modal-close-btn" onClick={() => setScheduleModalOpen(false)}>✕</button>
            </div>
            <form onSubmit={handleScheduleSubmit}>
              <div className="modal-body form-layout">
                <div className="form-group">
                  <label className="form-label form-label-required" htmlFor="fu-lead-select">Target Lead</label>
                  <select
                    id="fu-lead-select"
                    className="form-control"
                    value={newFollowup.lead}
                    onChange={(e) => setNewFollowup({ ...newFollowup, lead: e.target.value })}
                    required
                  >
                    <option value="">Select a Lead</option>
                    {leadsList.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name} ({l.company_name || 'Individual'})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="fu-purpose-select">Purpose</label>
                  <select
                    id="fu-purpose-select"
                    className="form-control"
                    value={newFollowup.purpose}
                    onChange={(e) => setNewFollowup({ ...newFollowup, purpose: e.target.value })}
                  >
                    {FOLLOWUP_PURPOSES.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label form-label-required" htmlFor="fu-datetime">Scheduled Date & Time</label>
                  <input
                    id="fu-datetime"
                    type="datetime-local"
                    className="form-control"
                    value={newFollowup.follow_up_at}
                    onChange={(e) => setNewFollowup({ ...newFollowup, follow_up_at: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setScheduleModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={scheduling}>
                  {scheduling ? 'Scheduling...' : 'Schedule Follow-up'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
