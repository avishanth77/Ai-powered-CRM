import React, { useState, useEffect } from 'react';
import { reportApi } from '../api/reportApi';
import { leadApi } from '../api/leadApi';
import { userApi } from '../api/userApi';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { formatCurrency } from '../utils/formatters';
import { extractErrorMessage } from '../utils/validation';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { LEAD_STATUS, LEAD_PRIORITY } from '../utils/constants';

import {
  BarChart3,
  Download,
  Filter,
  Users,
  TrendingUp,
  IndianRupee,
  Briefcase,
  CheckCircle,
} from 'lucide-react';

export const Reports = () => {
  const { user, canExportReports, isManagerOrAdmin } = useAuth();
  const { showToast } = useToast();

  const [summary, setSummary] = useState(null);
  const [sources, setSources] = useState([]);
  const [usersList, setUsersList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  // Filters for CSV Export
  const [filters, setFilters] = useState({
    status: '',
    source: '',
    priority: '',
    assigned_to: '',
    from_date: '',
    to_date: '',
  });

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

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  const handleExportCsv = async () => {
    setExporting(true);
    try {
      await reportApi.downloadExportCsv(filters);
      showToast('CSV report generated and downloaded successfully!', 'success');
    } catch (err) {
      showToast(extractErrorMessage(err, 'Failed to export CSV report'), 'error');
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return <LoadingSpinner text="Compiling analytical reports and team metrics..." />;
  }

  const { kpis, charts, user_performance } = summary || {};

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
              disabled={exporting}
            >
              <Download size={16} />
              <span>{exporting ? 'Generating CSV...' : 'Export Filtered CSV'}</span>
            </button>
          </div>
        )}
      </div>

      {/* CSV Export & Filter Controls */}
      {canExportReports && (
        <div className="card mb-4" style={{ marginBottom: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <Filter size={18} color="var(--primary-light)" />
            <h3 style={{ fontSize: '1rem' }}>Report Filters & Export Criteria</h3>
          </div>

          <div className="form-grid-2" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
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
                {Object.entries(LEAD_STATUS).map(([k, v]) => (
                  <option key={k} value={v}>
                    {v.replace('_', ' ')}
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
            </div>
          </div>
        </div>
      )}

      {/* User-Wise Performance Report Table (Manager & Admin) */}
      {isManagerOrAdmin && user_performance && user_performance.length > 0 && (
        <div className="card mb-4" style={{ marginBottom: '2rem' }}>
          <div className="chart-card-header">
            <h3 className="chart-title"><Users size={18} /> Representative Performance Report</h3>
          </div>
          <div className="table-responsive">
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
                      <span className="status-badge" style={{ color: '#38bdf8', backgroundColor: 'rgba(56, 189, 248, 0.12)' }}>
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
                      <span style={{ fontFamily: 'Outfit', fontWeight: 600, color: '#fbbf24' }}>
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
      <div className="dashboard-stats-grid">
        <div className="kpi-card">
          <span className="kpi-label">Expected Revenue</span>
          <div className="kpi-value" style={{ color: '#fbbf24' }}>
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
