import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { reportApi } from '../api/reportApi';
import { formatCurrency, formatRelativeTime } from '../utils/formatters';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { useAuth } from '../context/AuthContext';
import {
  Users,
  UserCheck,
  TrendingUp,
  AlertCircle,
  Clock,
  Briefcase,
  IndianRupee,
  Percent,
  CheckCircle,
  BarChart2,
  ArrowUpRight,
  Sparkles,
  Share2,
} from 'lucide-react';

export const Dashboard = () => {
  const { user, isExecutive } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await reportApi.getSummary();
      if (res.success && res.data) {
        setData(res.data);
      }
    } catch (err) {
      setError('Failed to fetch dashboard metrics. Please verify the backend connection.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <LoadingSpinner text="Computing real-time CRM KPIs..." />;
  }

  if (error || !data) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
        <AlertCircle size={40} color="var(--danger)" style={{ margin: '0 auto 1rem' }} />
        <h3>Unable to load dashboard</h3>
        <p className="text-muted" style={{ margin: '0.5rem 0 1.5rem' }}>{error || 'No dashboard data was returned.'}</p>
        <button className="btn btn-primary" onClick={loadDashboard}>
          Retry Connection
        </button>
      </div>
    );
  }

  const { kpis = {}, charts = {} } = data || {};
  const {
    by_status: byStatus = [],
    by_source: bySource = [],
    by_priority: byPriority = [],
    won_vs_lost: wonVsLost = {},
  } = charts;
  const statusMax = Math.max(...byStatus.map((s) => s.count), 1);
  const sourceMax = Math.max(...bySource.map((s) => s.count), 1);
  const priorityMax = Math.max(...byPriority.map((p) => p.count), 1);
  const execMax = Math.max(...(data.leads_by_executive || []).map((e) => e.count), 1);

  return (
    <div className="dashboard-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <span>Welcome back, {user?.first_name || user?.email}</span>
            <Sparkles size={22} color="var(--primary-light)" />
          </h1>
          <p className="page-subtitle">
            {isExecutive
              ? 'Your assigned leads, active follow-ups, and conversion metrics'
              : 'Real-time sales performance, team pipeline, and conversion analytics'}
          </p>
        </div>
        <div className="page-actions">
          <Link to="/leads/create" className="btn btn-primary">
            + New Lead
          </Link>
          <Link to="/pipeline" className="btn btn-secondary">
            Visual Pipeline
          </Link>
        </div>
      </div>

      {/* Overdue Alert Banner */}
      {kpis.overdue_followups > 0 && (
        <div className="overdue-banner">
          <div className="overdue-banner-text">
            <AlertCircle size={20} color="var(--danger)" />
            <span>
              Attention needed: You have{' '}
              <strong className="overdue-count-tag">{kpis.overdue_followups} overdue</strong>{' '}
              follow-up{kpis.overdue_followups > 1 ? 's' : ''} requiring immediate action.
            </span>
          </div>
          <Link to="/follow-ups" className="btn btn-danger btn-sm">
            Review Overdue <ArrowUpRight size={14} />
          </Link>
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="dashboard-stats-grid">
        <div className="kpi-card">
          <div className="kpi-card-header">
            <span className="kpi-label">Total Leads</span>
            <div className="kpi-icon-circle"><Users size={18} /></div>
          </div>
          <div className="kpi-value">{kpis.total_leads}</div>
          <div className="kpi-meta text-muted">
            <span>{kpis.new_leads} New</span> • <span>{kpis.contacted_leads} Contacted</span>
          </div>
        </div>

        <div className="kpi-card kpi-card-info">
          <div className="kpi-card-header">
            <span className="kpi-label">Qualified Leads</span>
            <div className="kpi-icon-circle" style={{ color: 'var(--info)' }}><UserCheck size={18} /></div>
          </div>
          <div className="kpi-value">{kpis.qualified_leads}</div>
          <div className="kpi-meta text-muted">
            Ready for customer conversion
          </div>
        </div>

        <div className="kpi-card kpi-card-success">
          <div className="kpi-card-header">
            <span className="kpi-label">Won / Customers</span>
            <div className="kpi-icon-circle" style={{ color: 'var(--success)' }}><Briefcase size={18} /></div>
          </div>
          <div className="kpi-value">{kpis.total_customers}</div>
          <div className="kpi-meta text-muted">
            <span>{kpis.won_leads} Deals Won</span>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-card-header">
            <span className="kpi-label">Expected Value</span>
            <div className="kpi-icon-circle" style={{ color: 'var(--warning)' }}><IndianRupee size={18} /></div>
          </div>
          <div className="kpi-value">{formatCurrency(kpis.expected_sales_value)}</div>
          <div className="kpi-meta text-muted">Active Pipeline Value</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-card-header">
            <span className="kpi-label">Conversion Rate</span>
            <div className="kpi-icon-circle" style={{ color: '#a78bfa' }}><Percent size={18} /></div>
          </div>
          <div className="kpi-value">{kpis.conversion_rate}%</div>
          <div className="kpi-meta text-muted">Lead to Customer Ratio</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-card-header">
            <span className="kpi-label">Today's Follow-ups</span>
            <div className="kpi-icon-circle" style={{ color: '#38bdf8' }}><Clock size={18} /></div>
          </div>
          <div className="kpi-value">{kpis.today_followups}</div>
          <div className="kpi-meta text-muted">
            <span>{kpis.followup_completion_rate}% completion rate</span>
          </div>
        </div>
      </div>

      {/* Visual Analytics Charts Grid */}
      <div className="dashboard-charts-grid">
        {/* Leads by Status */}
        <div className="chart-card col-span-6">
          <div className="chart-card-header">
            <h3 className="chart-title"><BarChart2 size={18} /> Leads by Stage</h3>
          </div>
          <div className="bar-chart-container">
            {byStatus.length === 0 ? (
              <p className="text-muted" style={{ padding: '1rem' }}>No stage data recorded yet.</p>
            ) : (
              byStatus.map((item) => {
                const pct = (item.count / statusMax) * 100;
                return (
                <div key={item.status} className="bar-chart-row">
                  <div className="bar-chart-info">
                    <span className="bar-chart-label">{item.label}</span>
                    <span className="bar-chart-count">{item.count}</span>
                  </div>
                  <div className="bar-track">
                    <div
                      className="bar-fill"
                      style={{
                        width: `${pct}%`,
                        backgroundColor:
                          item.status === 'WON'
                            ? 'var(--success)'
                            : item.status === 'LOST'
                            ? 'var(--danger)'
                            : 'var(--primary-light)',
                      }}
                    />
                  </div>
                </div>
              );
              })
            )}
          </div>
        </div>

        {/* Leads by Source */}
        <div className="chart-card col-span-6">
          <div className="chart-card-header">
            <h3 className="chart-title"><TrendingUp size={18} /> Leads by Source</h3>
          </div>
          <div className="bar-chart-container">
            {bySource.length === 0 ? (
              <p className="text-muted" style={{ padding: '1rem' }}>No source data recorded yet.</p>
            ) : (
              bySource.map((item) => {
                const pct = (item.count / sourceMax) * 100;
                return (
                  <div key={item.source} className="bar-chart-row">
                    <div className="bar-chart-info">
                      <span className="bar-chart-label">{item.source}</span>
                      <span className="bar-chart-count">{item.count}</span>
                    </div>
                    <div className="bar-track">
                      <div
                        className="bar-fill"
                        style={{ width: `${pct}%`, backgroundColor: '#38bdf8' }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Won vs Lost Comparison */}
        <div className="chart-card col-span-5">
          <div className="chart-card-header">
            <h3 className="chart-title"><CheckCircle size={18} /> Deal Outcomes</h3>
          </div>
          <div className="funnel-comparison-container">
            <div className="funnel-stat-box">
              <span className="kpi-label">Won</span>
              <div className="funnel-stat-value funnel-won">{wonVsLost.won ?? 0}</div>
              <span className="text-dim font-sm">Converted to Customers</span>
            </div>
            <div className="funnel-stat-box">
              <span className="kpi-label">Lost</span>
              <div className="funnel-stat-value funnel-lost">{wonVsLost.lost ?? 0}</div>
              <span className="text-dim font-sm">Archived with reason</span>
            </div>
            <div className="funnel-stat-box">
              <span className="kpi-label">Active</span>
              <div className="funnel-stat-value funnel-active">{wonVsLost.active ?? 0}</div>
              <span className="text-dim font-sm">In Pipeline</span>
            </div>
          </div>
        </div>

        {/* Leads by Priority */}
        <div className="chart-card col-span-7">
          <div className="chart-card-header">
            <h3 className="chart-title"><TrendingUp size={18} /> Lead Priorities</h3>
          </div>
          <div className="bar-chart-container">
            {byPriority.map((item) => {
              const pct = (item.count / priorityMax) * 100;
              const color =
                item.priority === 'URGENT'
                  ? 'var(--danger)'
                  : item.priority === 'HIGH'
                  ? '#ea580c'
                  : item.priority === 'MEDIUM'
                  ? '#0284c7'
                  : '#64748b';
              return (
                <div key={item.priority} className="bar-chart-row">
                  <div className="bar-chart-info">
                    <span className="bar-chart-label">{item.label}</span>
                    <span className="bar-chart-count">{item.count}</span>
                  </div>
                  <div className="bar-track">
                    <div className="bar-fill" style={{ width: `${pct}%`, backgroundColor: color }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Manager / Admin Team Performance & Handover Analytics */}
      {!isExecutive && (
        <div className="dashboard-charts-grid" style={{ marginTop: '1.5rem' }}>
          {/* Leads by Executive */}
          <div className="chart-card col-span-6">
            <div className="chart-card-header">
              <h3 className="chart-title">
                <Users size={18} /> Leads by Executive
              </h3>
            </div>
            <div className="bar-chart-container">
              {(!data.leads_by_executive || data.leads_by_executive.length === 0) ? (
                <p className="text-muted" style={{ padding: '1.5rem 1rem', textAlign: 'center' }}>
                  No sales executives found.
                </p>
              ) : (
                data.leads_by_executive.map((item) => {
                  const pct = (item.count / execMax) * 100;
                  return (
                    <div key={item.user_id} className="bar-chart-row">
                      <div className="bar-chart-info">
                        <span className="bar-chart-label" style={{ fontWeight: 500 }}>
                          {item.name}
                        </span>
                        <span className="bar-chart-count" style={{ fontWeight: 600 }}>
                          {item.count} leads
                        </span>
                      </div>
                      <div className="bar-track">
                        <div
                          className="bar-fill"
                          style={{ width: `${pct}%`, backgroundColor: 'var(--primary)' }}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Recently Handed Over Leads */}
          <div className="chart-card col-span-6">
            <div className="chart-card-header">
              <h3 className="chart-title">
                <Share2 size={18} /> Recently Handed Over Leads
              </h3>
            </div>
            <div style={{ padding: '0.75rem 1rem' }}>
              {(!data.recent_handovers || data.recent_handovers.length === 0) ? (
                <p className="text-muted" style={{ padding: '1.5rem 1rem', textAlign: 'center' }}>
                  No recent lead handovers.
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                  {data.recent_handovers.map((item) => (
                    <div
                      key={item.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '0.75rem',
                        background: 'rgba(255,255,255,0.02)',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--border-subtle)',
                      }}
                    >
                      <div>
                        <Link
                          to={`/leads/${item.lead_id}`}
                          style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.875rem' }}
                        >
                          {item.company_name ? `${item.company_name} (${item.lead_name})` : item.lead_name}
                        </Link>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '0.2rem' }}>
                          <span style={{ color: '#fbbf24' }}>{item.previous_assignee}</span> →{' '}
                          <span style={{ color: 'var(--success)' }}>{item.new_assignee}</span>
                          {item.reason && ` • Reason: ${item.reason}`}
                        </div>
                      </div>
                      <span className="text-dim font-sm" style={{ whiteSpace: 'nowrap', fontSize: '0.75rem' }}>
                        {formatRelativeTime(item.created_at)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
