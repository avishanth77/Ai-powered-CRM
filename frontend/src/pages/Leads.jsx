import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { leadApi } from '../api/leadApi';
import { reportApi } from '../api/reportApi';
import { followupApi } from '../api/followupApi';
import { activityApi } from '../api/activityApi';
import { userApi } from '../api/userApi';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { formatCurrency, formatDate, formatDateTime, toLocalDateTimeInput } from '../utils/formatters';
import { extractErrorMessage } from '../utils/validation';
import { useDialogA11y } from '../hooks/useDialogA11y';
import { LEAD_STATUS, LEAD_PRIORITY, FOLLOWUP_PURPOSES, ICP_STATUS_CONFIG } from '../utils/constants';
import { IcpStatusBadge } from '../components/IcpStatusBadge';

import { StatusBadge } from '../components/StatusBadge';
import { PriorityBadge } from '../components/PriorityBadge';
import { SearchBar } from '../components/SearchBar';
import { Pagination } from '../components/Pagination';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { EmptyState } from '../components/EmptyState';
import { ConfirmModal } from '../components/ConfirmModal';

import {
  Eye,
  Edit,
  Trash2,
  Plus,
  Filter,
  Phone,
  Mail,
  Users,
  Sparkles,
  CheckCircle2,
  Flame,
  TrendingUp,
  ChevronRight,
  ArrowRight,
  Calendar,
  CalendarPlus,
  Clock,
  Download,
  UploadCloud,
  Kanban,
  Activity,
  UserPlus,
  FileSpreadsheet,
  Share2,
} from 'lucide-react';

export const Leads = () => {
  const { user, canDeleteLeads, canHandoverLeads } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  // Primary Leads State
  const [leads, setLeads] = useState([]);
  const [sources, setSources] = useState([]);
  const [stages, setStages] = useState([]);
  const [executives, setExecutives] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(20);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [icpStatusFilter, setIcpStatusFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [assignedToFilter, setAssignedToFilter] = useState('');

  // Bulk Handover State
  const [selectedLeads, setSelectedLeads] = useState([]);
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [bulkTarget, setBulkTarget] = useState('');
  const [bulkReason, setBulkReason] = useState('');
  const [bulkSubmitting, setBulkSubmitting] = useState(false);

  // Dashboard Enrichment State
  const [kpis, setKpis] = useState(null);
  const [followups, setFollowups] = useState([]);
  const [activities, setActivities] = useState([]);
  const [panelsLoading, setPanelsLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  // Guards against out-of-order list responses on rapid filter changes
  const leadsRequestId = useRef(0);
  const selectAllRef = useRef(null);

  // Modals
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [leadToDelete, setLeadToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const [importModalOpen, setImportModalOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);

  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [scheduling, setScheduling] = useState(false);

  // Dialog accessibility: Escape to close, focus trap, body scroll lock
  const scheduleDialogRef = useDialogA11y(scheduleModalOpen, () => setScheduleModalOpen(false));
  const importDialogRef = useDialogA11y(importModalOpen, () => setImportModalOpen(false));
  const bulkDialogRef = useDialogA11y(bulkModalOpen, () => setBulkModalOpen(false));

  const [newFollowup, setNewFollowup] = useState({
    lead: '',
    purpose: 'Phone Call',
    follow_up_at: '',
  });

  // Load Lead Sources, Dynamic Stages, and Executives
  useEffect(() => {
    leadApi
      .getSources()
      .then((res) => {
        if (res.results) setSources(res.results);
        else if (Array.isArray(res)) setSources(res);
      })
      .catch(() => {});

    leadApi
      .getStages()
      .then((res) => {
        setStages(res.results || (Array.isArray(res) ? res : []));
      })
      .catch(() => {});

    if (canHandoverLeads) {
      userApi
        .getUsers()
        .then((res) => {
          const list = res.results || (Array.isArray(res) ? res : []);
          setExecutives(list.filter((u) => u.is_active && u.role === 'EXECUTIVE'));
        })
        .catch(() => {});
    }
  }, [canHandoverLeads]);

  // Fetch KPI Summary Data
  const fetchKpis = useCallback(async () => {
    try {
      const res = await reportApi.getSummary();
      if (res?.data) {
        setKpis(res.data);
      }
    } catch {
      // Fallback will calculate from leads array
    }
  }, []);

  // Fetch Upcoming Follow-ups
  const fetchUpcomingFollowups = useCallback(async () => {
    try {
      const res = await followupApi.getFollowUps({ page_size: 4, ordering: 'follow_up_at', status: 'PENDING' });
      const items = res?.results || res?.data || (Array.isArray(res) ? res : []);
      setFollowups(items);
    } catch {
      // keep previously loaded items on refresh failure
    }
  }, []);

  // Fetch Recent Activity Logs
  const fetchRecentActivity = useCallback(async () => {
    try {
      const res = await activityApi.getActivities({ page_size: 6 });
      const items = res?.results || (Array.isArray(res) ? res : []);
      setActivities(items);
    } catch {
      // keep previously loaded items on refresh failure
    }
  }, []);

  useEffect(() => {
    fetchKpis();
    setPanelsLoading(true);
    Promise.allSettled([fetchUpcomingFollowups(), fetchRecentActivity()]).then(() =>
      setPanelsLoading(false)
    );
  }, [fetchKpis, fetchUpcomingFollowups, fetchRecentActivity]);

  // Partial selection state for the select-all checkbox
  const isPartialSelection = selectedLeads.length > 0 && selectedLeads.length < leads.length;
  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = isPartialSelection;
    }
  }, [isPartialSelection, leads.length]);

  const fetchLeads = useCallback(async () => {
    const requestId = ++leadsRequestId.current;
    setLoading(true);
    try {
      const params = {
        page: currentPage,
        keyword: search || undefined,
        status: statusFilter || undefined,
        priority: priorityFilter || undefined,
        icp_status: icpStatusFilter || undefined,
        source: sourceFilter || undefined,
        assigned_to: assignedToFilter || undefined,
      };

      const res = await leadApi.getLeads(params);
      if (requestId !== leadsRequestId.current) return; // stale response
      if (res.results) {
        setLeads(res.results);
        setTotalCount(res.count || res.results.length);
      } else if (Array.isArray(res)) {
        setLeads(res);
        setTotalCount(res.length);
      }
    } catch (err) {
      if (requestId !== leadsRequestId.current) return; // stale response
      showToast(extractErrorMessage(err, 'Failed to fetch leads'), 'error');
    } finally {
      if (requestId === leadsRequestId.current) setLoading(false);
    }
  }, [currentPage, search, statusFilter, priorityFilter, icpStatusFilter, sourceFilter, assignedToFilter, showToast]);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  const handleSearchChange = (val) => {
    setSearch(val);
    setCurrentPage(1);
  };

  const handleStatusChange = (e) => {
    setStatusFilter(e.target.value);
    setCurrentPage(1);
  };

  const handlePriorityChange = (e) => {
    setPriorityFilter(e.target.value);
    setCurrentPage(1);
  };

  const handleIcpStatusChange = (e) => {
    setIcpStatusFilter(e.target.value);
    setCurrentPage(1);
  };

  const handleSourceChange = (e) => {
    setSourceFilter(e.target.value);
    setCurrentPage(1);
  };

  const handleAssignedToChange = (e) => {
    setAssignedToFilter(e.target.value);
    setCurrentPage(1);
  };

  // Bulk Selection Handlers
  const handleToggleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedLeads(leads.map((l) => l.id));
    } else {
      setSelectedLeads([]);
    }
  };

  const handleToggleSelect = (leadId) => {
    setSelectedLeads((prev) =>
      prev.includes(leadId) ? prev.filter((id) => id !== leadId) : [...prev, leadId]
    );
  };

  const handleConfirmBulkHandover = async (e) => {
    e.preventDefault();
    if (!bulkTarget || selectedLeads.length === 0) return;
    if (!bulkReason.trim()) {
      showToast('Please provide a handover reason.', 'warning');
      return;
    }

    setBulkSubmitting(true);
    try {
      const res = await leadApi.bulkHandover({
        lead_ids: selectedLeads,
        new_assigned_to: parseInt(bulkTarget),
        reason: bulkReason.trim(),
      });
      showToast(res.message || `Successfully handed over ${selectedLeads.length} lead(s).`, 'success');
      setBulkModalOpen(false);
      setSelectedLeads([]);
      setBulkTarget('');
      setBulkReason('');
      fetchLeads();
      fetchKpis();
    } catch (err) {
      showToast(extractErrorMessage(err, 'Bulk handover failed'), 'error');
    } finally {
      setBulkSubmitting(false);
    }
  };

  // Pipeline stage click filter
  // Stage keys use the uppercase-with-underscores form ('NEW', 'DEMO_SCHEDULED'),
  // matching the report API and the <select> option values below.
  const normalizeStageKey = (value) => (value || '').toUpperCase().replace(/[- ]/g, '_');

  const handleStageClick = (stageKey) => {
    if (statusFilter === stageKey) {
      setStatusFilter(''); // Toggle off
    } else {
      setStatusFilter(stageKey);
    }
    setCurrentPage(1);
  };

  const handleOpenDelete = (lead) => {
    setLeadToDelete(lead);
    setDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!leadToDelete) return;
    setDeleting(true);
    try {
      await leadApi.deleteLead(leadToDelete.id);
      showToast(`Lead "${leadToDelete.name}" was successfully deleted.`, 'success');
      setDeleteModalOpen(false);
      setLeadToDelete(null);
      // Avoid landing on an empty page when deleting the last row
      if (leads.length <= 1 && currentPage > 1) {
        setCurrentPage(currentPage - 1);
      } else {
        fetchLeads();
      }
      fetchKpis();
    } catch (err) {
      showToast(extractErrorMessage(err, 'Failed to delete lead'), 'error');
    } finally {
      setDeleting(false);
    }
  };

  // Quick Export (mirrors the active table filters)
  const handleExportLeads = async () => {
    setExporting(true);
    try {
      await reportApi.downloadExportCsv({
        keyword: search || undefined,
        status: statusFilter || undefined,
        priority: priorityFilter || undefined,
        source: sourceFilter || undefined,
        assigned_to: assignedToFilter || undefined,
      });
      showToast('Leads CSV exported successfully!', 'success');
    } catch (err) {
      showToast(extractErrorMessage(err, 'Export failed'), 'error');
    } finally {
      setExporting(false);
    }
  };

  const handleOpenScheduleForLead = (lead) => {
    setNewFollowup({
      lead: lead.id.toString(),
      purpose: 'Phone Call',
      follow_up_at: '',
    });
    setScheduleModalOpen(true);
  };

  // Quick Schedule Follow-up
  const handleQuickScheduleSubmit = async (e) => {
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
        assigned_to: user?.id,
      });
      showToast('Follow-up scheduled successfully!', 'success');
      setScheduleModalOpen(false);
      setNewFollowup({ lead: '', purpose: 'Phone Call', follow_up_at: '' });
      fetchUpcomingFollowups();
      fetchKpis();
    } catch (err) {
      showToast(extractErrorMessage(err, 'Failed to schedule follow-up'), 'error');
    } finally {
      setScheduling(false);
    }
  };

  // Import Leads via CSV upload
  const MAX_IMPORT_SIZE = 10 * 1024 * 1024;

  const handleImportFile = (file) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.csv')) {
      showToast('Invalid file type. Please select a .csv file.', 'error');
      return;
    }
    if (file.size > MAX_IMPORT_SIZE) {
      showToast('File is too large. Maximum allowed size is 10MB.', 'error');
      return;
    }
    setImportResult(null);
    setSelectedFile(file);
  };

  const handleDownloadTemplate = () => {
    const headers = ['Name', 'Phone', 'Email', 'Company', 'Source', 'Priority', 'Expected Value', 'Address'];
    const rows = [
      ['Aarav Sharma', '+919876543210', 'aarav@example.com', 'Apex Traders', 'Website', 'HIGH', '75000', 'Mumbai'],
      ['Sara Khan', '+919123456780', 'sara@example.com', 'Bright Retail', 'Referral', 'MEDIUM', '25000', 'Delhi'],
    ];
    const escapeCell = (cell) => `"${String(cell).replace(/"/g, '""')}"`;
    const csv = [headers, ...rows].map((r) => r.map(escapeCell).join(',')).join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'crm_lite_leads_import_template.csv';
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
    showToast('Sample template downloaded!', 'info');
  };

  const handleImportSubmit = async (e) => {
    e.preventDefault();
    if (!selectedFile) {
      showToast('Please select a valid CSV file to import.', 'warning');
      return;
    }
    setImporting(true);
    setImportResult(null);
    try {
      const res = await leadApi.importLeads(selectedFile);
      const data = res.data || { imported: 0, skipped: 0, total: 0, errors: [] };
      setImportResult(data);
      showToast(
        res.message || `Imported ${data.imported || 0} lead(s).`,
        data.skipped ? 'warning' : 'success'
      );
      fetchLeads();
      fetchKpis();
      if (!data.skipped) {
        setImportModalOpen(false);
        setSelectedFile(null);
      }
    } catch (err) {
      showToast(extractErrorMessage(err, 'CSV import failed'), 'error');
    } finally {
      setImporting(false);
    }
  };

  // Dynamic KPI numbers with realistic defaults
  const kpiData = kpis?.kpis || {};
  const statusCharts = kpis?.charts?.by_status || [];
  const priorityCharts = kpis?.charts?.by_priority || [];

  const totalLeadsCount = kpiData.total_leads ?? totalCount ?? leads.length;
  // `lead.status` is serialized as the stage *name*; normalize via the stage slug.
  const leadStageKey = (l) => normalizeStageKey(l.stage_details?.slug || l.status);
  const newLeadsCount = kpiData.new_leads ?? leads.filter((l) => leadStageKey(l) === 'NEW').length;
  const qualifiedLeadsCount = kpiData.qualified_leads ?? leads.filter((l) => leadStageKey(l) === 'QUALIFIED').length;
  const highPriorityCount =
    priorityCharts.find((p) => p.priority === 'HIGH')?.count ??
    leads.filter((l) => l.priority === 'HIGH').length;
  const conversionRate = kpiData.conversion_rate ?? 0;

  // Pipeline stage counts
  const getStageCount = (stageKey) => {
    const found = statusCharts.find((s) => s.status === stageKey);
    if (found) return found.count;
    return leads.filter((l) => leadStageKey(l) === stageKey).length;
  };

  const pipelineStages = [
    { key: 'NEW', label: 'New', count: getStageCount('NEW'), sub: 'Inbound intake' },
    { key: 'CONTACTED', label: 'Contacted', count: getStageCount('CONTACTED'), sub: 'Initial call/chat' },
    { key: 'QUALIFIED', label: 'Qualified', count: getStageCount('QUALIFIED'), sub: 'Needs verified' },
    { key: 'NEGOTIATION', label: 'Proposal', count: getStageCount('NEGOTIATION'), sub: 'Pricing review' },
    { key: 'WON', label: 'Converted', count: getStageCount('WON'), sub: 'Customer created' },
  ];

  const getActivityIcon = (action) => {
    if (action.includes('CONVERT')) return <CheckCircle2 size={14} color="#10b981" />;
    if (action.includes('CREATE')) return <UserPlus size={14} color="#06b6d4" />;
    if (action.includes('STATUS')) return <TrendingUp size={14} color="#3b82f6" />;
    if (action.includes('FOLLOW_UP')) return <Clock size={14} color="#f59e0b" />;
    return <Activity size={14} color="var(--primary)" />;
  };

  return (
    <div className="leads-page">
      {/* 1. Page Header with Title & Quick Actions Toolbar */}
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <Users size={26} />
            <span>Lead Management</span>
          </h1>
          <p className="page-subtitle">
            Manage your prospecting database, track sales pipeline velocity, and stay ahead of follow-ups
          </p>
        </div>

        {/* 5. Quick Actions Toolbar */}
        <div className="quick-actions-toolbar">
          <Link to="/leads/create" className="btn btn-primary" title="Create a new prospective lead">
            <Plus size={17} />
            <span>Create New Lead</span>
          </Link>

          <button
            type="button"
            className="btn-quick-action"
            onClick={() => setScheduleModalOpen(true)}
            title="Schedule an interaction task"
          >
            <CalendarPlus size={15} />
            <span>Schedule Follow-up</span>
          </button>

          <button
            type="button"
            className="btn-quick-action"
            onClick={() => setImportModalOpen(true)}
            title="Import leads from CSV spreadsheet"
          >
            <UploadCloud size={15} />
            <span>Import Leads</span>
          </button>

          <Link to="/pipeline" className="btn-quick-action" title="View visual Kanban board">
            <Kanban size={15} />
            <span>View Pipeline</span>
          </Link>

          <button
            type="button"
            className="btn-quick-action"
            onClick={handleExportLeads}
            disabled={exporting}
            title="Download CSV export"
          >
            <Download size={15} />
            <span>{exporting ? 'Exporting...' : 'Export Leads'}</span>
          </button>
        </div>
      </div>

      {/* 1. LEAD SUMMARY CARDS STRIP */}
      <div className="leads-summary-grid">
        {/* Total Leads */}
        <div className="lead-summary-card summary-card-accent-emerald">
          <div className="summary-card-header">
            <span className="summary-card-label">Total Leads</span>
            <div className="summary-card-icon-wrap" style={{ color: '#10b981' }}>
              <Users size={16} />
            </div>
          </div>
          <div className="summary-card-value">{totalLeadsCount}</div>
          <div className="summary-card-sub">
            <span style={{ color: '#10b981', fontWeight: 600 }}>Active Database</span>
            <span>• All sources</span>
          </div>
        </div>

        {/* New Leads */}
        <div className="lead-summary-card summary-card-accent-cyan">
          <div className="summary-card-header">
            <span className="summary-card-label">New Prospects</span>
            <div className="summary-card-icon-wrap" style={{ color: '#06b6d4' }}>
              <Sparkles size={16} />
            </div>
          </div>
          <div className="summary-card-value">{newLeadsCount}</div>
          <div className="summary-card-sub">
            <span style={{ color: '#06b6d4', fontWeight: 600 }}>Fresh Leads</span>
            <span>• Awaiting outreach</span>
          </div>
        </div>

        {/* Qualified Leads */}
        <div className="lead-summary-card summary-card-accent-blue">
          <div className="summary-card-header">
            <span className="summary-card-label">Qualified</span>
            <div className="summary-card-icon-wrap" style={{ color: '#3b82f6' }}>
              <CheckCircle2 size={16} />
            </div>
          </div>
          <div className="summary-card-value">{qualifiedLeadsCount}</div>
          <div className="summary-card-sub">
            <span style={{ color: '#3b82f6', fontWeight: 600 }}>Sales Ready</span>
            <span>• Conversion-eligible</span>
          </div>
        </div>

        {/* High Priority Leads */}
        <div className="lead-summary-card summary-card-accent-amber">
          <div className="summary-card-header">
            <span className="summary-card-label">High Priority</span>
            <div className="summary-card-icon-wrap" style={{ color: '#f59e0b' }}>
              <Flame size={16} />
            </div>
          </div>
          <div className="summary-card-value">{highPriorityCount}</div>
          <div className="summary-card-sub">
            <span style={{ color: '#f59e0b', fontWeight: 600 }}>Urgent Focus</span>
            <span>• Immediate response</span>
          </div>
        </div>

        {/* Conversion Rate */}
        <div className="lead-summary-card summary-card-accent-purple">
          <div className="summary-card-header">
            <span className="summary-card-label">Conversion Rate</span>
            <div className="summary-card-icon-wrap" style={{ color: '#8b5cf6' }}>
              <TrendingUp size={16} />
            </div>
          </div>
          <div className="summary-card-value">{conversionRate}%</div>
          <div className="summary-card-sub">
            <span style={{ color: '#8b5cf6', fontWeight: 600 }}>Win Velocity</span>
            <span>• Lead-to-customer</span>
          </div>
        </div>
      </div>

      {/* 4. LEAD PIPELINE MINI OVERVIEW */}
      <div className="mini-pipeline-container">
        <div className="mini-pipeline-header">
          <div className="mini-pipeline-title">
            <Kanban size={15} color="var(--primary)" />
            <span>Sales Pipeline Velocity (Click to filter table)</span>
          </div>
          {statusFilter && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => {
                setStatusFilter('');
                setCurrentPage(1);
              }}
              style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
            >
              Clear Filter ({statusFilter.replace('_', ' ')}) ✕
            </button>
          )}
        </div>

        <div className="mini-pipeline-track">
          {pipelineStages.map((stg, idx) => (
            <React.Fragment key={stg.key}>
              <button
                type="button"
                className={`mini-pipeline-step ${statusFilter === stg.key ? 'active' : ''}`}
                onClick={() => handleStageClick(stg.key)}
                title={`Filter table to show only ${stg.label} leads`}
                aria-pressed={statusFilter === stg.key}
              >
                <div className="mini-step-info">
                  <span className="mini-step-name">{stg.label}</span>
                  <span className="mini-step-sub">{stg.sub}</span>
                </div>
                <span className="mini-step-count">{stg.count}</span>
              </button>
              {idx < pipelineStages.length - 1 && (
                <ChevronRight size={18} className="mini-pipeline-arrow" />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="filter-toolbar">
        <SearchBar
          value={search}
          onChange={handleSearchChange}
          placeholder="Search by name, phone, email, or company..."
        />

        <div className="filter-group">
          <div className="contact-item">
            <Filter size={15} className="text-dim" />
            <select
              className="filter-select"
              value={statusFilter}
              onChange={handleStatusChange}
              aria-label="Filter by Lead Stage"
            >
              <option value="">All Stages</option>
              {stages.length > 0 ? (
                stages.map((st) => (
                  <option key={st.id} value={normalizeStageKey(st.slug || st.name)}>
                    {st.name}
                  </option>
                ))
              ) : (
                Object.entries(LEAD_STATUS).map(([key, val]) => (
                  <option key={key} value={val}>
                    {val.replace('_', ' ')}
                  </option>
                ))
              )}
            </select>
          </div>

          <select
            className="filter-select"
            value={priorityFilter}
            onChange={handlePriorityChange}
            aria-label="Filter by Priority"
          >
            <option value="">All Priorities</option>
            {Object.entries(LEAD_PRIORITY).map(([key, val]) => (
              <option key={key} value={val}>
                {val}
              </option>
            ))}
          </select>

          <select
            className="filter-select"
            value={icpStatusFilter}
            onChange={handleIcpStatusChange}
            aria-label="Filter by ICP Status"
          >
            <option value="">All ICP Status</option>
            {Object.entries(ICP_STATUS_CONFIG).map(([key, cfg]) => (
              <option key={key} value={key}>
                {cfg.label}
              </option>
            ))}
          </select>

          <select
            className="filter-select"
            value={sourceFilter}
            onChange={handleSourceChange}
            aria-label="Filter by Source"
          >
            <option value="">All Sources</option>
            {sources.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>

          {canHandoverLeads && (
            <select
              className="filter-select"
              value={assignedToFilter}
              onChange={handleAssignedToChange}
              aria-label="Filter by Assigned Executive"
            >
              <option value="">All Executives</option>
              {executives.map((exec) => (
                <option key={exec.id} value={exec.id}>
                  {exec.full_name || exec.email}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Primary Leads Table */}
      {canHandoverLeads && selectedLeads.length > 0 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(99, 102, 241, 0.12)',
            border: '1px solid rgba(99, 102, 241, 0.35)',
            padding: '0.625rem 1rem',
            borderRadius: 'var(--radius-md)',
            marginBottom: '1rem',
          }}
        >
          <span style={{ fontWeight: 600, color: 'var(--primary)', fontSize: '0.875rem' }}>
            {selectedLeads.length} lead{selectedLeads.length > 1 ? 's' : ''} selected
          </span>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setSelectedLeads([])}
            >
              Deselect All
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => setBulkModalOpen(true)}
            >
              <Share2 size={14} />
              <span>Handover Selected ({selectedLeads.length})</span>
            </button>
          </div>
        </div>
      )}
      <div className="table-responsive">
        {loading ? (
          <LoadingSpinner text="Retrieving leads..." />
        ) : leads.length === 0 ? (
          <EmptyState
            title="No leads found"
            message="No leads match your current search and filter criteria."
            actionLabel="Create First Lead"
            onAction={() => navigate('/leads/create')}
          />
        ) : (
          <table className="crm-table">
            <thead>
              <tr>
                {canHandoverLeads && (
                  <th style={{ width: '38px', textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      ref={selectAllRef}
                      checked={leads.length > 0 && selectedLeads.length === leads.length}
                      onChange={handleToggleSelectAll}
                      aria-label="Select all leads"
                    />
                  </th>
                )}
                <th>Lead / Company</th>
                <th>Contact</th>
                <th>Status</th>
                <th>Priority</th>
                <th>ICP</th>
                <th>Assigned To</th>
                <th>Expected Value</th>
                <th>Created</th>
                <th className="table-action-col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => (
                <tr key={lead.id}>
                  {canHandoverLeads && (
                    <td style={{ textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={selectedLeads.includes(lead.id)}
                        onChange={() => handleToggleSelect(lead.id)}
                        aria-label={`Select lead ${lead.name}`}
                      />
                    </td>
                  )}
                  <td className="table-truncate-cell">
                    <div className="lead-name-cell">
                      <Link to={`/leads/${lead.id}`} className="lead-primary-name">
                        {lead.name}
                      </Link>
                      <span className="lead-company-name">
                        {lead.company_name ? lead.company_name : 'Individual / No Company'}
                      </span>
                    </div>
                  </td>
                  <td className="table-truncate-cell">
                    <div className="lead-contact-cell">
                      <span className="contact-item">
                        <Phone size={13} className="text-dim" /> {lead.phone}
                      </span>
                      {lead.email && (
                        <span className="contact-item">
                          <Mail size={13} className="text-dim" /> {lead.email}
                        </span>
                      )}
                    </div>
                  </td>
                  <td>
                    <StatusBadge status={lead.stage_details || lead.status} />
                  </td>
                  <td>
                    <PriorityBadge priority={lead.priority} />
                  </td>
                  <td>
                    <IcpStatusBadge status={lead.icp_status} size="sm" />
                  </td>
                  <td>
                    <span className="text-main font-semibold font-sm">
                      {lead.assigned_to_details?.full_name ||
                        lead.assigned_to_details?.email ||
                        'Unassigned'}
                    </span>
                  </td>
                  <td>
                    <span className="lead-value-cell">
                      {formatCurrency(lead.expected_value)}
                    </span>
                  </td>
                  <td>
                    <span className="text-dim font-sm">
                      {formatDate(lead.created_at)}
                    </span>
                  </td>
                  <td className="table-action-col">
                    <div className="action-buttons-group" style={{ justifyContent: 'flex-end' }}>
                      <button
                        type="button"
                        className="icon-action-btn"
                        title="Schedule Follow-up"
                        aria-label={`Schedule follow-up for ${lead.name}`}
                        onClick={() => handleOpenScheduleForLead(lead)}
                      >
                        <CalendarPlus size={15} />
                      </button>
                      <Link
                        to={`/leads/${lead.id}`}
                        className="icon-action-btn"
                        title="View Lead Details"
                        aria-label={`View details for ${lead.name}`}
                      >
                        <Eye size={15} />
                      </Link>
                      <Link
                        to={`/leads/${lead.id}/edit`}
                        className="icon-action-btn"
                        title="Edit Lead"
                        aria-label={`Edit ${lead.name}`}
                      >
                        <Edit size={15} />
                      </Link>
                      {canDeleteLeads && (
                        <button
                          type="button"
                          className="icon-action-btn icon-action-btn-danger"
                          title="Delete Lead (Admin Only)"
                          aria-label={`Delete ${lead.name}`}
                          onClick={() => handleOpenDelete(lead)}
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {!loading && (
          <Pagination
            currentPage={currentPage}
            totalCount={totalCount}
            pageSize={pageSize}
            onPageChange={(page) => setCurrentPage(page)}
          />
        )}
      </div>

      {/* 2 & 3. 2-COLUMN BOTTOM GRID (Upcoming Follow-ups + Recent Activity) */}
      <div className="leads-bottom-grid">
        {/* 2. Upcoming Follow-ups Panel */}
        <div className="leads-panel-card">
          <div className="leads-panel-header">
            <div className="leads-panel-title-group">
              <Clock size={17} color="var(--primary)" />
              <h3 className="leads-panel-title">Upcoming Follow-ups</h3>
            </div>
            <Link to="/follow-ups" className="leads-panel-link">
              <span>View All</span>
              <ArrowRight size={13} />
            </Link>
          </div>

          <div className="followup-compact-list">
            {panelsLoading ? (
              <LoadingSpinner size={22} text="Loading follow-ups..." />
            ) : followups.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '1.5rem 1rem', color: 'var(--text-dim)', fontSize: '0.8125rem' }}>
                No upcoming follow-ups scheduled
              </div>
            ) : (
              followups.slice(0, 4).map((fu) => (
                <div key={fu.id} className="followup-compact-item">
                  <div className="followup-compact-lead">
                    <Link to={`/leads/${fu.lead}`} className="followup-lead-name">
                      {fu.lead_name || 'Prospect Contact'}
                    </Link>
                    <span className="followup-lead-company">
                      {fu.lead_company || 'Corporate Prospect'}
                    </span>
                  </div>

                  <div className="followup-compact-meta">
                    <span className="followup-purpose-tag">{fu.purpose}</span>
                    <div className="followup-time-pill">
                      <Calendar size={12} color="var(--text-dim)" />
                      <span>{formatDateTime(fu.follow_up_at)}</span>
                    </div>
                    {fu.is_overdue && (
                      <span className="status-badge" style={{ color: 'var(--danger)', backgroundColor: 'rgba(239, 68, 68, 0.12)', fontSize: '0.6875rem' }}>
                        Overdue
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* 3. Recent Activity Panel */}
        <div className="leads-panel-card">
          <div className="leads-panel-header">
            <div className="leads-panel-title-group">
              <Activity size={17} color="var(--primary)" />
              <h3 className="leads-panel-title">Recent Activity</h3>
            </div>
            <span className="text-dim font-sm" style={{ fontSize: '0.75rem' }}>Live Audit Feed</span>
          </div>

          <div className="activity-compact-list">
            {panelsLoading ? (
              <LoadingSpinner size={22} text="Loading activity..." />
            ) : activities.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '1.5rem 1rem', color: 'var(--text-dim)', fontSize: '0.8125rem' }}>
                No recent activity recorded
              </div>
            ) : (
              activities.slice(0, 4).map((act) => (
                <div key={act.id} className="activity-compact-item">
                  <div className="activity-compact-icon">
                    {getActivityIcon(act.action)}
                  </div>
                  <div className="activity-compact-content">
                    <p className="activity-compact-text">{act.notes}</p>
                    <div className="activity-compact-meta">
                      <span>{formatDateTime(act.created_at)}</span>
                      {act.performer_name && (
                        <>
                          <span>•</span>
                          <span style={{ color: 'var(--primary-light)', fontWeight: 600 }}>
                            {act.performer_name}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Modal: Quick Schedule Follow-up */}
      {scheduleModalOpen && (
        <div className="modal-backdrop" onClick={() => setScheduleModalOpen(false)}>
          <div className="modal-container" ref={scheduleDialogRef} role="dialog" aria-modal="true" aria-label="Schedule follow-up" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title-row">
                <CalendarPlus size={18} color="var(--primary)" />
                <h3>Quick Schedule Follow-up</h3>
              </div>
              <button className="modal-close-btn" onClick={() => setScheduleModalOpen(false)} aria-label="Close dialog">✕</button>
            </div>
            <form onSubmit={handleQuickScheduleSubmit}>
              <div className="modal-body form-layout">
                <div className="form-group">
                  <label className="form-label form-label-required" htmlFor="quick-fu-lead">
                    Target Lead
                  </label>
                  <select
                    id="quick-fu-lead"
                    className="form-control"
                    value={newFollowup.lead}
                    onChange={(e) => setNewFollowup({ ...newFollowup, lead: e.target.value })}
                    required
                  >
                    <option value="">Select a Lead from Database</option>
                    {leads.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name} ({l.company_name || 'Individual'})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="quick-fu-purpose">Interaction Purpose</label>
                  <select
                    id="quick-fu-purpose"
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
                  <label className="form-label form-label-required" htmlFor="quick-fu-datetime">
                    Scheduled Date & Time
                  </label>
                  <input
                    id="quick-fu-datetime"
                    type="datetime-local"
                    className="form-control"
                    value={newFollowup.follow_up_at}
                    min={toLocalDateTimeInput(new Date())}
                    onChange={(e) => setNewFollowup({ ...newFollowup, follow_up_at: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setScheduleModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={scheduling}>
                  {scheduling ? 'Scheduling...' : 'Schedule Follow-up'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Import Leads CSV */}
      {importModalOpen && (
        <div className="modal-backdrop" onClick={() => setImportModalOpen(false)}>
          <div className="modal-container" ref={importDialogRef} role="dialog" aria-modal="true" aria-label="Import leads from CSV" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title-row">
                <UploadCloud size={18} color="var(--primary)" />
                <h3>Import Prospect Leads from CSV</h3>
              </div>
              <button className="modal-close-btn" onClick={() => setImportModalOpen(false)} aria-label="Close dialog">✕</button>
            </div>
            <form onSubmit={handleImportSubmit}>
              <div className="modal-body form-layout">
                <p className="text-muted font-sm">
                  Bulk upload prospective contacts, company details, phone numbers, and initial stages.
                </p>

                <label
                  htmlFor="csv-file-input"
                  className="import-drop-zone"
                  role="button"
                  tabIndex={0}
                  aria-label="Select a CSV file to import"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      document.getElementById('csv-file-input').click();
                    }
                  }}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (e.dataTransfer.files?.[0]) handleImportFile(e.dataTransfer.files[0]);
                  }}
                >
                  <FileSpreadsheet size={36} className="import-drop-icon" />
                  <div>
                    <strong className="text-main" style={{ display: 'block', fontSize: '0.9375rem' }}>
                      {selectedFile ? selectedFile.name : 'Click to browse or drop CSV spreadsheet'}
                    </strong>
                    <span className="text-dim font-sm">
                      {selectedFile
                        ? `${(selectedFile.size / 1024).toFixed(1)} KB • Ready for upload`
                        : 'Supported formats: .CSV (Max 10MB)'}
                    </span>
                  </div>
                  <input
                    id="csv-file-input"
                    type="file"
                    accept=".csv"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      handleImportFile(e.target.files?.[0]);
                      e.target.value = '';
                    }}
                  />
                </label>

                <div
                  className="import-template-download"
                  role="button"
                  tabIndex={0}
                  aria-label="Download sample CSV template"
                  onClick={handleDownloadTemplate}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleDownloadTemplate();
                    }
                  }}
                >
                  <Download size={14} />
                  <span>Download Sample Leads CSV Template</span>
                </div>

                {importResult && (
                  <div
                    role="status"
                    style={{
                      padding: '0.875rem 1rem',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: 'var(--bg-surface-elevated)',
                      border: '1px solid var(--border-subtle)',
                      fontSize: '0.875rem',
                      color: 'var(--text-main)',
                    }}
                  >
                    <strong>
                      Imported {importResult.imported} of {importResult.total} lead(s).
                      {importResult.skipped > 0 && ` ${importResult.skipped} row(s) skipped.`}
                    </strong>
                    {importResult.errors?.length > 0 && (
                      <ul style={{ margin: '0.5rem 0 0', paddingLeft: '1.25rem', color: 'var(--danger)', fontSize: '0.8125rem' }}>
                        {importResult.errors.map((rowErr, i) => (
                          <li key={`${rowErr.row}-${i}`}>
                            Row {rowErr.row}: {rowErr.message}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setImportModalOpen(false)}>
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={importing || !selectedFile}
                >
                  {importing ? 'Processing File...' : 'Upload & Import Leads'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Bulk Handover Leads */}
      {bulkModalOpen && (
        <div className="modal-backdrop" onClick={() => setBulkModalOpen(false)}>
          <div className="modal-container" ref={bulkDialogRef} role="dialog" aria-modal="true" aria-label="Bulk handover leads" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <div className="modal-title-row">
                <Share2 size={18} color="var(--primary)" />
                <h3>Bulk Handover Leads</h3>
              </div>
              <button className="modal-close-btn" onClick={() => setBulkModalOpen(false)} aria-label="Close dialog">✕</button>
            </div>
            <form onSubmit={handleConfirmBulkHandover}>
              <div className="modal-body form-layout">
                <p className="text-muted font-sm">
                  Transferring <strong>{selectedLeads.length}</strong> selected lead(s) to a new Sales Executive.
                </p>
                <div className="form-group">
                  <label className="form-label form-label-required" htmlFor="bulk-exec-target">Transfer To</label>
                  <select
                    id="bulk-exec-target"
                    className="form-control"
                    value={bulkTarget}
                    onChange={(e) => setBulkTarget(e.target.value)}
                    required
                  >
                    <option value="">Select Sales Executive</option>
                    {executives.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.full_name || u.email}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label form-label-required" htmlFor="bulk-handover-reason">Reason</label>
                  <textarea
                    id="bulk-handover-reason"
                    className="form-control"
                    rows={3}
                    placeholder="e.g. John is on leave, regional portfolio reallocation..."
                    value={bulkReason}
                    onChange={(e) => setBulkReason(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setBulkModalOpen(false)}>
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={bulkSubmitting || !bulkTarget || !bulkReason.trim()}
                >
                  <Share2 size={14} />
                  <span>{bulkSubmitting ? 'Transferring...' : 'Confirm Bulk Handover'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={deleteModalOpen}
        title="Delete Lead Record"
        message={`Are you sure you want to permanently delete lead "${leadToDelete?.name}"? All associated notes and follow-ups will also be removed.`}
        confirmText="Delete Lead"
        isDestructive={true}
        loading={deleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => {
          setDeleteModalOpen(false);
          setLeadToDelete(null);
        }}
      />
    </div>
  );
};
