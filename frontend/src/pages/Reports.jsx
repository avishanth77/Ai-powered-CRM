import React, { useState, useEffect } from 'react';
import { reportApi } from '../api/reportApi';
import { leadApi } from '../api/leadApi';
import { userApi } from '../api/userApi';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { formatCurrency, formatDate } from '../utils/formatters';
import { extractErrorMessage, extractBlobErrorMessage } from '../utils/validation';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { StatusBadge } from '../components/StatusBadge';
import { PriorityBadge } from '../components/PriorityBadge';
import { LEAD_STATUS, LEAD_PRIORITY } from '../utils/constants';

import {
  BarChart3,
  Download,
  Filter,
  FilterX,
  Users,
  Eye,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Search,
  X,
  FileSpreadsheet,
} from 'lucide-react';

export const Reports = () => {
  const { canExportReports, isManagerOrAdmin } = useAuth();
  const { showToast } = useToast();

  const [summary, setSummary] = useState(null);
  const [sources, setSources] = useState([]);
  const [usersList, setUsersList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  // Filters for CSV Export & Live Preview
  const [filters, setFilters] = useState({
    status: '',
    source: '',
    priority: '',
    assigned_to: '',
    from_date: '',
    to_date: '',
    keyword: '',
  });

  // Preview States
  const [previewData, setPreviewData] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewLimit, setPreviewLimit] = useState(10);
  const [previewExpanded, setPreviewExpanded] = useState(true);

  useEffect(() => {
    const loadReportData = async () => {
      setLoading(true);
      try {
        const [sumRes, srcRes] = await Promise.all([
          reportApi.getSummary(),
          leadApi.getSources(),
        ]);
        setSummary(sumRes.data);
        setSources(srcRes.results || srcRes);

        if (isManagerOrAdmin) {
          const uRes = await userApi.getUsers();
          setUsersList(uRes.results || uRes);
        }
      } catch (err) {
        showToast(extractErrorMessage(err, 'Failed to generate reports'), 'error');
      } finally {
        setLoading(false);
      }
    };

    loadReportData();
  }, [isManagerOrAdmin, showToast]);

  const isDateRangeInvalid =
    Boolean(filters.from_date) && Boolean(filters.to_date) && filters.from_date > filters.to_date;

  // Real-time debounced preview loading when filters change
  useEffect(() => {
    if (!canExportReports) return;
    if (isDateRangeInvalid) {
      setPreviewData(null);
      return;
    }

    const timer = setTimeout(async () => {
      setPreviewLoading(true);
      try {
        const cleanedParams = {};
        Object.entries(filters).forEach(([key, val]) => {
          if (val) cleanedParams[key] = val;
        });
        cleanedParams.limit = previewLimit;

        const res = await reportApi.getPreview(cleanedParams);
        if (res?.data) {
          setPreviewData(res.data);
        }
      } catch (err) {
        console.error('Failed to load export preview:', err);
      } finally {
        setPreviewLoading(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [filters, previewLimit, canExportReports, isDateRangeInvalid]);

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  const handleClearSingleFilter = (key) => {
    setFilters((prev) => ({ ...prev, [key]: '' }));
  };

  const handleResetFilters = () => {
    setFilters({
      status: '',
      source: '',
      priority: '',
      assigned_to: '',
      from_date: '',
      to_date: '',
      keyword: '',
    });
  };

  const handleExportCsv = async () => {
    if (isDateRangeInvalid) {
      showToast('The "From Date" must be earlier than the "To Date".', 'warning');
      return;
    }
    setExporting(true);
    try {
      await reportApi.downloadExportCsv(filters);
      showToast('CSV report generated and downloaded successfully!', 'success');
    } catch (err) {
      const msg = await extractBlobErrorMessage(err, 'Failed to export CSV report');
      showToast(msg, 'error');
    } finally {
      setExporting(false);
    }
  };

  // Compile active criteria chips
  const activeFilters = [];
  if (filters.status) {
    const stageObj = summary?.charts?.by_status?.find(
      (s) =>
        s.stage_slug?.toLowerCase() === filters.status.toLowerCase() ||
        s.status?.toLowerCase() === filters.status.toLowerCase()
    );
    activeFilters.push({
      key: 'status',
      label: 'Stage',
      value: stageObj?.label || filters.status.replace(/_/g, ' '),
    });
  }
  if (filters.source) {
    const srcObj = sources.find((s) => String(s.id) === String(filters.source));
    activeFilters.push({
      key: 'source',
      label: 'Source',
      value: srcObj?.name || 'Selected Source',
    });
  }
  if (filters.priority) {
    activeFilters.push({
      key: 'priority',
      label: 'Priority',
      value: filters.priority,
    });
  }
  if (filters.assigned_to) {
    const userObj = usersList.find((u) => String(u.id) === String(filters.assigned_to));
    activeFilters.push({
      key: 'assigned_to',
      label: 'Assigned',
      value: userObj?.full_name || userObj?.email || 'User',
    });
  }
  if (filters.keyword) {
    activeFilters.push({
      key: 'keyword',
      label: 'Keyword',
      value: `"${filters.keyword}"`,
    });
  }
  if (filters.from_date) {
    activeFilters.push({
      key: 'from_date',
      label: 'From',
      value: filters.from_date,
    });
  }
  if (filters.to_date) {
    activeFilters.push({
      key: 'to_date',
      label: 'To',
      value: filters.to_date,
    });
  }

  if (loading) {
    return <LoadingSpinner text="Compiling analytical reports and team metrics..." />;
  }

  const { kpis, user_performance } = summary || {};

  return (
    <div className="reports-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <BarChart3 size={26} />
            <span>Sales Reports & Performance Analytics</span>
          </h1>
          <p className="page-subtitle">
            Comprehensive business reports on user performance, conversion ratios, and pipeline velocity
          </p>
        </div>

        {canExportReports && (
          <div className="page-actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleExportCsv}
              disabled={exporting || isDateRangeInvalid}
            >
              <Download size={16} />
              <span>{exporting ? 'Generating CSV...' : 'Export Filtered CSV'}</span>
            </button>
          </div>
        )}
      </div>

      {/* CSV Export & Filter Controls with Live Preview */}
      {canExportReports && (
        <div className="card mb-4" style={{ marginBottom: '2rem' }}>
          <div className="filter-controls-header">
            <div className="filter-controls-title">
              <Filter size={20} color="var(--primary-light)" />
              <div>
                <h3 style={{ fontSize: '1.05rem', margin: 0 }}>Report Filters & Export Criteria</h3>
                <p className="text-dim font-xs" style={{ margin: '2px 0 0 0' }}>
                  Filter matching leads in real-time and preview the export dataset before generating your report
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {activeFilters.length > 0 && (
                <button
                  type="button"
                  className="clear-all-filters-btn"
                  onClick={handleResetFilters}
                  title="Reset all filter criteria"
                >
                  <RotateCcw size={13} />
                  <span>Reset Filters</span>
                </button>
              )}

              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setPreviewExpanded(!previewExpanded)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                aria-label={previewExpanded ? 'Collapse preview' : 'Expand preview'}
              >
                <Eye size={15} />
                <span>{previewExpanded ? 'Hide Preview' : 'Show Preview'}</span>
                {previewExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
              </button>
            </div>
          </div>

          {/* Filter Inputs Grid */}
          <div className="form-grid-2" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
            <div className="form-group">
              <label className="form-label" htmlFor="report-keyword">Search / Keyword</label>
              <div style={{ position: 'relative' }}>
                <input
                  id="report-keyword"
                  type="text"
                  name="keyword"
                  className="filter-select"
                  placeholder="Name, company, email..."
                  value={filters.keyword}
                  onChange={handleFilterChange}
                  style={{ width: '100%', paddingLeft: '2rem' }}
                />
                <Search
                  size={14}
                  style={{
                    position: 'absolute',
                    left: '0.65rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--text-dim)',
                    pointerEvents: 'none',
                  }}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="report-status">Stage / Status</label>
              <select
                id="report-status"
                name="status"
                className="filter-select"
                value={filters.status}
                onChange={handleFilterChange}
              >
                <option value="">All Statuses</option>
                {summary?.charts?.by_status?.length > 0
                  ? summary.charts.by_status.map((st) => (
                      <option key={st.stage_id || st.status} value={st.stage_slug || st.status}>
                        {st.label}
                      </option>
                    ))
                  : Object.entries(LEAD_STATUS).map(([k, v]) => (
                      <option key={k} value={v}>
                        {v.replace(/_/g, ' ')}
                      </option>
                    ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="report-source">Lead Source</label>
              <select
                id="report-source"
                name="source"
                className="filter-select"
                value={filters.source}
                onChange={handleFilterChange}
              >
                <option value="">All Sources</option>
                {sources.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="report-priority">Priority</label>
              <select
                id="report-priority"
                name="priority"
                className="filter-select"
                value={filters.priority}
                onChange={handleFilterChange}
              >
                <option value="">All Priorities</option>
                {Object.entries(LEAD_PRIORITY).map(([k, v]) => (
                  <option key={k} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="report-assignee">Assigned User</label>
              <select
                id="report-assignee"
                name="assigned_to"
                className="filter-select"
                value={filters.assigned_to}
                onChange={handleFilterChange}
              >
                <option value="">All Users</option>
                {usersList.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.full_name || u.email}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="report-from">From Date</label>
              <input
                id="report-from"
                type="date"
                name="from_date"
                className="filter-select"
                value={filters.from_date}
                onChange={handleFilterChange}
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="report-to">To Date</label>
              <input
                id="report-to"
                type="date"
                name="to_date"
                className="filter-select"
                value={filters.to_date}
                onChange={handleFilterChange}
              />
              {isDateRangeInvalid && (
                <span className="form-error-msg" role="alert">
                  The "To Date" must be later than the "From Date".
                </span>
              )}
            </div>
          </div>

          {/* Active Criteria Filter Chips Bar */}
          {activeFilters.length > 0 && (
            <div className="active-filters-bar">
              <span className="active-filters-label">Active Criteria:</span>
              {activeFilters.map((af) => (
                <span key={af.key} className="filter-chip">
                  <strong style={{ color: 'var(--text-muted)' }}>{af.label}:</strong>
                  <span>{af.value}</span>
                  <button
                    type="button"
                    className="filter-chip-remove"
                    onClick={() => handleClearSingleFilter(af.key)}
                    aria-label={`Remove filter ${af.label}`}
                  >
                    <X size={11} />
                  </button>
                </span>
              ))}
              <button
                type="button"
                className="clear-all-filters-btn"
                onClick={handleResetFilters}
              >
                Clear all ({activeFilters.length})
              </button>
            </div>
          )}

          {/* Live Preview Section */}
          {previewExpanded && (
            <div className="report-preview-section">
              <div className="report-preview-banner">
                <div className="report-preview-title-group">
                  <h4 className="report-preview-title">
                    <FileSpreadsheet size={18} color="var(--primary-light)" />
                    <span>Export Criteria Live Preview</span>
                  </h4>
                  <span className="live-sync-indicator">
                    <span className="live-sync-dot" />
                    {previewLoading ? 'Updating...' : 'Live Preview Synced'}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <div className="preview-limit-control">
                    <span>Rows:</span>
                    {[5, 10, 25].map((lim) => (
                      <button
                        key={lim}
                        type="button"
                        className={`preview-limit-btn ${previewLimit === lim ? 'active' : ''}`}
                        onClick={() => setPreviewLimit(lim)}
                      >
                        {lim}
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    className="btn btn-secondary btn-xs"
                    onClick={handleExportCsv}
                    disabled={
                      exporting ||
                      isDateRangeInvalid ||
                      (previewData && previewData.total_count === 0)
                    }
                  >
                    <Download size={13} />
                    <span>
                      {exporting
                        ? 'Exporting...'
                        : `Export CSV (${previewData?.total_count ?? 0})`}
                    </span>
                  </button>
                </div>
              </div>

              {/* Preview KPI Metrics Strip */}
              {previewData && (
                <div className="report-preview-metrics-strip">
                  <div className="preview-metric-item">
                    <span className="preview-metric-label">Matching Leads</span>
                    <span className="preview-metric-value" style={{ color: 'var(--primary-light)' }}>
                      {previewData.total_count}
                    </span>
                  </div>

                  <div className="preview-metric-divider" />

                  <div className="preview-metric-item">
                    <span className="preview-metric-label">Pipeline Value</span>
                    <span className="preview-metric-value" style={{ color: 'var(--warning)' }}>
                      {formatCurrency(previewData.total_expected_value)}
                    </span>
                  </div>

                  <div className="preview-metric-divider" />

                  <div className="preview-metric-item">
                    <span className="preview-metric-label">Average Deal Size</span>
                    <span className="preview-metric-value" style={{ color: 'var(--success)' }}>
                      {formatCurrency(previewData.avg_expected_value)}
                    </span>
                  </div>

                  <div className="preview-metric-divider" />

                  <div className="preview-metric-item" style={{ flex: 1, minWidth: 160 }}>
                    <span className="preview-metric-label">Export Scope</span>
                    <span className="text-dim font-xs" style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '3px' }}>
                      {previewData.total_count === 0
                        ? 'No leads matching current filters'
                        : `All ${previewData.total_count} records will be packaged into CSV`}
                    </span>
                  </div>
                </div>
              )}

              {/* Preview Table or States */}
              {isDateRangeInvalid ? (
                <div className="preview-empty-state">
                  <div className="preview-empty-title" style={{ color: 'var(--danger)' }}>
                    Invalid Date Range
                  </div>
                  <div className="preview-empty-desc">
                    The "From Date" cannot be later than the "To Date". Please adjust your date range to preview and export records.
                  </div>
                </div>
              ) : previewLoading && !previewData ? (
                <div style={{ padding: '2rem', textAlign: 'center' }}>
                  <LoadingSpinner text="Fetching matching criteria records..." />
                </div>
              ) : previewData?.records && previewData.records.length > 0 ? (
                <>
                  <div
                    className="table-responsive embedded"
                    style={{
                      opacity: previewLoading ? 0.6 : 1,
                      transition: 'opacity var(--transition-fast)',
                    }}
                  >
                    <table className="crm-table">
                      <thead>
                        <tr>
                          <th>Lead & Company</th>
                          <th>Contact Info</th>
                          <th>Stage</th>
                          <th>Priority</th>
                          <th>Source</th>
                          <th>Assigned Rep</th>
                          <th>Expected Value</th>
                          <th>Created Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {previewData.records.map((record) => (
                          <tr key={record.id}>
                            <td className="table-truncate-cell">
                              <div>
                                <span className="preview-lead-link">{record.name}</span>
                                <span className="text-dim font-xs">
                                  {record.company_name || 'Individual / No Company'}
                                </span>
                              </div>
                            </td>
                            <td className="table-truncate-cell">
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '0.8125rem' }}>
                                {record.phone && (
                                  <span className="text-main font-xs">{record.phone}</span>
                                )}
                                {record.email && (
                                  <span className="text-dim font-xs">{record.email}</span>
                                )}
                              </div>
                            </td>
                            <td>
                              <StatusBadge
                                status={{ name: record.stage_name, color: record.stage_color }}
                              />
                            </td>
                            <td>
                              <PriorityBadge priority={record.priority} />
                            </td>
                            <td>
                              <span className="badge badge-neutral">{record.source}</span>
                            </td>
                            <td>
                              <span className="text-main font-semibold font-sm">
                                {record.assigned_to}
                              </span>
                            </td>
                            <td>
                              <span style={{ fontFamily: 'Outfit', fontWeight: 600, color: 'var(--warning)' }}>
                                {formatCurrency(record.expected_value)}
                              </span>
                            </td>
                            <td>
                              <span className="text-dim font-sm">
                                {formatDate(record.created_at)}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="preview-table-footer">
                    <span>
                      Previewing top <strong>{previewData.records.length}</strong> of{' '}
                      <strong>{previewData.total_count}</strong> records matching the export criteria.
                      {previewData.total_count > previewData.records.length &&
                        ' (Full CSV file will contain all records)'}
                    </span>
                    <button
                      type="button"
                      className="btn btn-primary btn-xs"
                      onClick={handleExportCsv}
                      disabled={exporting}
                    >
                      <Download size={13} />
                      <span>Export All {previewData.total_count} Leads to CSV</span>
                    </button>
                  </div>
                </>
              ) : (
                <div className="preview-empty-state">
                  <div className="preview-empty-icon">
                    <FilterX size={22} />
                  </div>
                  <div className="preview-empty-title">No matching records found</div>
                  <div className="preview-empty-desc">
                    None of your CRM leads match the selected report filters and criteria. Try clearing or broadening some filters to preview data.
                  </div>
                  {activeFilters.length > 0 && (
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={handleResetFilters}
                    >
                      <RotateCcw size={14} />
                      <span>Clear All Criteria</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* User-Wise Performance Report Table (Manager & Admin) */}
      {isManagerOrAdmin && user_performance && user_performance.length > 0 && (
        <div className="card mb-4" style={{ marginBottom: '2rem' }}>
          <div className="chart-card-header">
            <h3 className="chart-title"><Users size={18} /> Representative Performance Report</h3>
          </div>
          <div className="table-responsive embedded">
            <table className="crm-table">
              <thead>
                <tr>
                  <th>Representative</th>
                  <th>Role</th>
                  <th>Assigned Leads</th>
                  <th>Won / Customers</th>
                  <th>Expected Sales Value</th>
                  <th>Pending Follow-ups</th>
                </tr>
              </thead>
              <tbody>
                {user_performance.map((up) => (
                  <tr key={up.user_id}>
                    <td>
                      <span className="text-main font-semibold">{up.name}</span>
                    </td>
                    <td>
                      <span className="badge badge-primary">
                        {up.role}
                      </span>
                    </td>
                    <td>
                      <span className="font-semibold">{up.total_leads}</span>
                    </td>
                    <td>
                      <span className="font-semibold text-success" style={{ color: 'var(--success)' }}>
                        {up.won_leads}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontFamily: 'Outfit', fontWeight: 600, color: 'var(--warning)' }}>
                        {formatCurrency(up.expected_value)}
                      </span>
                    </td>
                    <td>
                      <span>{up.pending_followups}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="dashboard-stats-grid cols-4">
        <div className="kpi-card">
          <span className="kpi-label">Expected Revenue</span>
          <div className="kpi-value" style={{ color: 'var(--warning)' }}>
            {formatCurrency(kpis?.expected_sales_value)}
          </div>
          <div className="kpi-meta text-muted">Aggregated Active Pipeline</div>
        </div>

        <div className="kpi-card kpi-card-success">
          <span className="kpi-label">Conversion Rate</span>
          <div className="kpi-value" style={{ color: 'var(--success)' }}>
            {kpis?.conversion_rate}%
          </div>
          <div className="kpi-meta text-muted">Won Deals / Total Closed</div>
        </div>

        <div className="kpi-card">
          <span className="kpi-label">Follow-up Completion</span>
          <div className="kpi-value" style={{ color: 'var(--primary-light)' }}>
            {kpis?.followup_completion_rate}%
          </div>
          <div className="kpi-meta text-muted">Completed vs Scheduled</div>
        </div>

        <div className="kpi-card kpi-card-info">
          <span className="kpi-label">Qualified Prospect Ratio</span>
          <div className="kpi-value" style={{ color: 'var(--info)' }}>
            {kpis?.total_leads ? Math.round((kpis.qualified_leads / kpis.total_leads) * 100) : 0}%
          </div>
          <div className="kpi-meta text-muted">Qualified / Total Leads</div>
        </div>
      </div>
    </div>
  );
};
