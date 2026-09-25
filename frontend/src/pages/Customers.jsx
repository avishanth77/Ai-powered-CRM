import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { customerApi } from '../api/customerApi';
import { leadApi } from '../api/leadApi';
import { formatDate, formatCurrency } from '../utils/formatters';
import { extractErrorMessage } from '../utils/validation';
import { useToast } from '../context/ToastContext';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { EmptyState } from '../components/EmptyState';
import { SearchBar } from '../components/SearchBar';
import { Pagination } from '../components/Pagination';
import {
  Briefcase,
  Phone,
  Mail,
  Building2,
  Eye,
  Trophy,
  Filter,
  ArrowUpDown,
  X,
  DollarSign,
  Layers,
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
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [loadError, setLoadError] = useState(null);
  const [metrics, setMetrics] = useState({ total: 0, wonCount: 0, directCount: 0, totalWonValue: 0 });
  const pageSize = 20;
  // Upper bound for the single metrics snapshot (one extra request, no pagination UI).
  const METRICS_PAGE_SIZE = 100;

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
    setLoadError(null);
    try {
      const params = { page: currentPage, page_size: pageSize };
      if (search.trim()) params.search = search.trim();
      if (originFilter) params.origin = originFilter;
      if (sourceFilter) params.source_id = sourceFilter;
      if (sortOrder) params.ordering = sortOrder;

      // Metrics snapshot shares search/source but ignores the origin filter
      // so the breakdown cards always describe the same universe.
      const metricParams = { ...params, page_size: METRICS_PAGE_SIZE };
      delete metricParams.origin;
      delete metricParams.page;

      const [res, snapRes] = await Promise.all([
        customerApi.getCustomers(params),
        customerApi.getCustomers(metricParams),
      ]);
      const data = res.results || res.data || (Array.isArray(res) ? res : []);
      setCustomers(data);
      setTotalCount(res.count ?? (Array.isArray(res) ? res.length : 0));

      const snapRows = snapRes.results || snapRes.data || (Array.isArray(snapRes) ? snapRes : []);
      setMetrics({
        total: snapRes.count ?? snapRows.length,
        wonCount: snapRows.filter((c) => c.lead || c.is_won_lead).length,
        directCount: snapRows.filter((c) => !c.lead && !c.is_won_lead).length,
        totalWonValue: snapRows.reduce((sum, c) => sum + (parseFloat(c.lead_expected_value) || 0), 0),
      });
    } catch (err) {
      const msg = extractErrorMessage(err, 'Failed to fetch customer accounts');
      setLoadError(msg);
      showToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  }, [search, originFilter, sourceFilter, sortOrder, currentPage, showToast]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  const handleClearFilters = () => {
    setSearch('');
    setOriginFilter('');
    setSourceFilter('');
    setSortOrder('-converted_at');
    setCurrentPage(1);
  };

  const handleOriginShortcut = (value) => {
    setOriginFilter((prev) => (prev === value ? '' : value));
    setCurrentPage(1);
  };

  const hasActiveFilters = Boolean(search || originFilter || sourceFilter || sortOrder !== '-converted_at');

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
      <div className="leads-summary-grid cols-3" style={{ marginBottom: '1.25rem' }}>
        {/* Total Accounts */}
        <div
          className={`lead-summary-card summary-card-accent-blue ${originFilter === '' ? 'summary-card-active' : ''}`}
          style={{ cursor: 'pointer' }}
          role="button"
          tabIndex={0}
          aria-pressed={originFilter === ''}
          aria-label="Show all customer accounts"
          onClick={() => handleOriginShortcut('')}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleOriginShortcut('');
            }
          }}
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
          role="button"
          tabIndex={0}
          aria-pressed={originFilter === 'won_lead'}
          aria-label="Filter to customers converted from won leads"
          onClick={() => handleOriginShortcut('won_lead')}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleOriginShortcut('won_lead');
            }
          }}
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
          role="button"
          tabIndex={0}
          aria-pressed={originFilter === 'direct'}
          aria-label="Filter to direct customer accounts"
          onClick={() => handleOriginShortcut('direct')}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleOriginShortcut('direct');
            }
          }}
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
          onChange={(val) => {
            setSearch(val);
            setCurrentPage(1);
          }}
          placeholder="Search by customer name, company, phone, email, or lead name..."
        />

        <div className="filter-group">
          {/* Origin Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
            <Filter size={14} className="text-dim" />
            <select
              className="filter-select"
              value={originFilter}
              onChange={(e) => {
                setOriginFilter(e.target.value);
                setCurrentPage(1);
              }}
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
              onChange={(e) => {
                setSourceFilter(e.target.value);
                setCurrentPage(1);
              }}
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
              onChange={(e) => {
                setSortOrder(e.target.value);
                setCurrentPage(1);
              }}
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
        ) : loadError ? (
          <EmptyState
            title="Could not load customers"
            message={loadError}
            actionLabel="Retry"
            onAction={() => fetchCustomers()}
          />
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
                  <td className="table-truncate-cell">
                    <div className="lead-name-cell">
                      <Link to={`/customers/${cust.id}`} className="lead-primary-name">
                        {cust.name}
                      </Link>
                      <span className="lead-company-name">
                        {cust.company_name || 'Individual Client'}
                      </span>
                    </div>
                  </td>
                  <td className="table-truncate-cell">
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
                      aria-label={`View details for ${cust.name}`}
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

      {!loading && !loadError && customers.length > 0 && (
        <Pagination
          currentPage={currentPage}
          totalCount={totalCount}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
        />
      )}
    </div>
  );
};
