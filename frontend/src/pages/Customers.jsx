import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { customerApi } from '../api/customerApi';
import { leadApi } from '../api/leadApi';
import { formatDate, formatCurrency } from '../utils/formatters';
import { extractErrorMessage } from '../utils/validation';
import { useToast } from '../context/ToastContext';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { EmptyState } from '../components/EmptyState';
import { SearchBar } from '../components/SearchBar';
import {
  Briefcase,
  Phone,
  Mail,
  Building2,
  Eye,
  Calendar,
  UserCheck,
  Trophy,
  Filter,
  ArrowUpDown,
  X,
  DollarSign,
  Award,
  Layers,
  Sparkles,
} from 'lucide-react';

export const Customers = () => {
  const { showToast } = useToast();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [originFilter, setOriginFilter] = useState(''); // '' | 'won_lead' | 'direct'
  const [sourceFilter, setSourceFilter] = useState('');
  const [sortOrder, setSortOrder] = useState('-converted_at');
  const [sources, setSources] = useState([]);

  // Load sources list for filter dropdown
  useEffect(() => {
    leadApi
      .getSources()
      .then((res) => {
        const list = res.results || (Array.isArray(res) ? res : []);
        setSources(list);
      })
      .catch(() => {});
  }, []);

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (search.trim()) params.search = search.trim();
      if (originFilter) params.origin = originFilter;
      if (sourceFilter) params.source_id = sourceFilter;
      if (sortOrder) params.ordering = sortOrder;

      const res = await customerApi.getCustomers(params);
      const data = res.results || res.data || (Array.isArray(res) ? res : []);
      setCustomers(data);
    } catch (err) {
      showToast(extractErrorMessage(err, 'Failed to fetch customer accounts'), 'error');
    } finally {
      setLoading(false);
    }
  }, [search, originFilter, sourceFilter, sortOrder, showToast]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  const handleClearFilters = () => {
    setSearch('');
    setOriginFilter('');
    setSourceFilter('');
    setSortOrder('-converted_at');
  };

  const hasActiveFilters = Boolean(search || originFilter || sourceFilter || sortOrder !== '-converted_at');

  // Compute metrics from current or total view
  const metrics = useMemo(() => {
    const total = customers.length;
    const wonCount = customers.filter((c) => c.lead || c.is_won_lead).length;
    const directCount = customers.filter((c) => !c.lead && !c.is_won_lead).length;
    const totalWonValue = customers.reduce((sum, c) => {
      const val = parseFloat(c.lead_expected_value) || 0;
      return sum + val;
    }, 0);

    return { total, wonCount, directCount, totalWonValue };
  }, [customers]);

  return (
    <div className="customers-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <Briefcase size={26} />
            <span>Customer Accounts</span>
          </h1>
          <p className="page-subtitle">
            Converted clients and active accounts preserved with original won lead history and provenance
          </p>
        </div>
      </div>

      {/* Metric Summary Cards */}
      <div className="leads-summary-grid" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', marginBottom: '1.25rem' }}>
        {/* Total Accounts */}
        <div
          className={`lead-summary-card summary-card-accent-blue ${originFilter === '' ? 'summary-card-active' : ''}`}
          style={{ cursor: 'pointer' }}
          onClick={() => setOriginFilter('')}
          title="Click to view all accounts"
        >
          <div className="summary-card-header">
            <span className="summary-card-label">Total Accounts</span>
            <div className="summary-card-icon-wrap" style={{ color: 'var(--info, #0284c7)' }}>
              <Layers size={16} />
            </div>
          </div>
          <div className="summary-card-value">{metrics.total}</div>
          <div className="summary-card-sub">
            <span style={{ color: 'var(--info, #0284c7)', fontWeight: 600 }}>Active Portfolio</span>
            <span>• All accounts</span>
          </div>
        </div>

        {/* Converted from Won Leads */}
        <div
          className={`lead-summary-card summary-card-accent-emerald ${originFilter === 'won_lead' ? 'summary-card-active' : ''}`}
          style={{ cursor: 'pointer' }}
          onClick={() => setOriginFilter(originFilter === 'won_lead' ? '' : 'won_lead')}
          title="Click to filter won lead conversions"
        >
          <div className="summary-card-header">
            <span className="summary-card-label">Won Leads</span>
            <div className="summary-card-icon-wrap" style={{ color: 'var(--success, #10b981)' }}>
              <Trophy size={16} />
            </div>
          </div>
          <div className="summary-card-value">{metrics.wonCount}</div>
          <div className="summary-card-sub">
            <span style={{ color: 'var(--success, #10b981)', fontWeight: 600 }}>Pipeline Wins</span>
            <span>• Converted leads</span>
          </div>
        </div>

        {/* Direct Accounts */}
        <div
          className={`lead-summary-card summary-card-accent-purple ${originFilter === 'direct' ? 'summary-card-active' : ''}`}
          style={{ cursor: 'pointer' }}
          onClick={() => setOriginFilter(originFilter === 'direct' ? '' : 'direct')}
          title="Click to filter direct customers"
        >
          <div className="summary-card-header">
            <span className="summary-card-label">Direct Accounts</span>
            <div className="summary-card-icon-wrap" style={{ color: 'var(--accent-purple, #8b5cf6)' }}>
              <Building2 size={16} />
            </div>
          </div>
          <div className="summary-card-value">{metrics.directCount}</div>
          <div className="summary-card-sub">
            <span style={{ color: 'var(--accent-purple, #8b5cf6)', fontWeight: 600 }}>Direct Inbound</span>
            <span>• Direct clients</span>
          </div>
        </div>

        {/* Converted Value */}
        <div className="lead-summary-card summary-card-accent-amber">
          <div className="summary-card-header">
            <span className="summary-card-label">Won Pipeline Value</span>
            <div className="summary-card-icon-wrap" style={{ color: '#f59e0b' }}>
              <DollarSign size={16} />
            </div>
          </div>
          <div className="summary-card-value">{formatCurrency(metrics.totalWonValue)}</div>
          <div className="summary-card-sub">
            <span style={{ color: '#f59e0b', fontWeight: 600 }}>Realized Revenue</span>
            <span>• Converted deals</span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="filter-toolbar">
        <SearchBar
          value={search}
          onChange={(val) => setSearch(val)}
          placeholder="Search by customer name, company, phone, email, or lead name..."
        />

        <div className="filter-group">
          {/* Origin Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
            <Filter size={14} className="text-dim" />
            <select
              className="filter-select"
              value={originFilter}
              onChange={(e) => setOriginFilter(e.target.value)}
              aria-label="Filter by Customer Origin"
            >
              <option value="">All Origins</option>
              <option value="won_lead">🏆 Converted from Won Leads</option>
              <option value="direct">🏢 Direct Accounts Only</option>
            </select>
          </div>

          {/* Source Filter */}
          <select
            className="filter-select"
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            aria-label="Filter by Lead Source"
          >
            <option value="">All Lead Sources</option>
            {sources.map((src) => (
              <option key={src.id} value={src.id}>
                {src.name}
              </option>
            ))}
          </select>

          {/* Sort Order */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
            <ArrowUpDown size={14} className="text-dim" />
            <select
              className="filter-select"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              aria-label="Sort Customer Records"
            >
              <option value="-converted_at">Latest Converted First</option>
              <option value="converted_at">Oldest Converted First</option>
              <option value="name">Customer Name (A-Z)</option>
              <option value="-name">Customer Name (Z-A)</option>
              <option value="company_name">Company Name (A-Z)</option>
            </select>
          </div>

          {/* Clear Filters Button */}
          {hasActiveFilters && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleClearFilters}
              title="Reset all search and filter options"
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
          <LoadingSpinner text="Retrieving customer records..." />
        ) : customers.length === 0 ? (
          <EmptyState
            title="No customer accounts match your criteria"
            message={
              hasActiveFilters
                ? 'Try adjusting your search query, origin filter, or lead source.'
                : 'No converted customers found in the system yet. Leads moved to "Won" stage will automatically appear here.'
            }
            actionLabel={hasActiveFilters ? 'Clear All Filters' : undefined}
            onAction={hasActiveFilters ? handleClearFilters : undefined}
          />
        ) : (
          <table className="crm-table">
            <thead>
              <tr>
                <th>Customer / Company</th>
                <th>Contact Details</th>
                <th>Originated From Lead</th>
                <th>Lead Source</th>
                <th>Converted Date</th>
                <th className="table-action-col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((cust) => (
                <tr key={cust.id}>
                  <td>
                    <div className="lead-name-cell">
                      <Link to={`/customers/${cust.id}`} className="lead-primary-name">
                        {cust.name}
                      </Link>
                      <span className="lead-company-name">
                        {cust.company_name || 'Individual Client'}
                      </span>
                    </div>
                  </td>
                  <td>
                    <div className="lead-contact-cell">
                      <span className="contact-item">
                        <Phone size={13} className="text-dim" /> {cust.phone || '—'}
                      </span>
                      {cust.email && (
                        <span className="contact-item">
                          <Mail size={13} className="text-dim" /> {cust.email}
                        </span>
                      )}
                    </div>
                  </td>
                  <td>
                    {cust.lead ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                        <Link
                          to={`/leads/${cust.lead}`}
                          className="text-main font-semibold"
                          style={{ textDecoration: 'none' }}
                          title="View original lead record"
                        >
                          {cust.lead_name || `Lead #${cust.lead}`}
                        </Link>
                        {cust.lead_expected_value && (
                          <span
                            className="font-sm"
                            style={{ color: 'var(--warning, #d97706)', fontWeight: 600 }}
                          >
                            {formatCurrency(cust.lead_expected_value)}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-dim font-sm">Direct Customer</span>
                    )}
                  </td>
                  <td>
                    <span className="text-muted font-sm">{cust.lead_source || '—'}</span>
                  </td>
                  <td>
                    <span className="text-dim font-sm">{formatDate(cust.converted_at)}</span>
                  </td>
                  <td className="table-action-col">
                    <Link
                      to={`/customers/${cust.id}`}
                      className="icon-action-btn"
                      title="View Customer Details"
                      style={{ marginLeft: 'auto' }}
                    >
                      <Eye size={15} />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
