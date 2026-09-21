import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { leadApi } from '../api/leadApi';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { formatCurrency, formatDate } from '../utils/formatters';
import { extractErrorMessage } from '../utils/validation';
import { LEAD_STATUS, LEAD_PRIORITY } from '../utils/constants';

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
  CalendarPlus,
  Plus,
  Filter,
  Phone,
  Mail,
  Building2,
  Users,
} from 'lucide-react';

export const Leads = () => {
  const { user, canDeleteLeads } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  // State
  const [leads, setLeads] = useState([]);
  const [sources, setSources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(20);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');

  // Delete modal
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [leadToDelete, setLeadToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Load Lead Sources for filter dropdown
  useEffect(() => {
    leadApi
      .getSources()
      .then((res) => {
        if (res.results) setSources(res.results);
        else if (Array.isArray(res)) setSources(res);
      })
      .catch(() => {});
  }, []);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        page: currentPage,
        keyword: search || undefined,
        status: statusFilter || undefined,
        priority: priorityFilter || undefined,
        source: sourceFilter || undefined,
      };

      const res = await leadApi.getLeads(params);
      if (res.results) {
        setLeads(res.results);
        setTotalCount(res.count || res.results.length);
      } else if (Array.isArray(res)) {
        setLeads(res);
        setTotalCount(res.length);
      }
    } catch (err) {
      showToast(extractErrorMessage(err, 'Failed to fetch leads'), 'error');
    } finally {
      setLoading(false);
    }
  }, [currentPage, search, statusFilter, priorityFilter, sourceFilter, showToast]);

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

  const handleSourceChange = (e) => {
    setSourceFilter(e.target.value);
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
      fetchLeads();
    } catch (err) {
      showToast(extractErrorMessage(err, 'Failed to delete lead'), 'error');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="leads-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <Users size={26} />
            <span>Lead Management</span>
          </h1>
          <p className="page-subtitle">
            Manage your prospecting database, contact status, and assignment
          </p>
        </div>
        <div className="page-actions">
          <Link to="/leads/create" className="btn btn-primary">
            <Plus size={18} />
            <span>Create New Lead</span>
          </Link>
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
              aria-label="Filter by Status"
            >
              <option value="">All Statuses</option>
              {Object.entries(LEAD_STATUS).map(([key, val]) => (
                <option key={key} value={val}>
                  {val.replace('_', ' ')}
                </option>
              ))}
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
        </div>
      </div>

      {/* Leads Table */}
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
                <th>Lead / Company</th>
                <th>Contact</th>
                <th>Source</th>
                <th>Status</th>
                <th>Priority</th>
                <th>Assigned To</th>
                <th>Expected Value</th>
                <th>Created</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => (
                <tr key={lead.id}>
                  <td>
                    <div className="lead-name-cell">
                      <Link to={`/leads/${lead.id}`} className="lead-primary-name">
                        {lead.name}
                      </Link>
                      <span className="lead-company-name">
                        {lead.company_name ? lead.company_name : 'Individual / No Company'}
                      </span>
                    </div>
                  </td>
                  <td>
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
                    <span className="text-muted font-sm">
                      {lead.source_name || 'N/A'}
                    </span>
                  </td>
                  <td>
                    <StatusBadge status={lead.status} />
                  </td>
                  <td>
                    <PriorityBadge priority={lead.priority} />
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
                  <td>
                    <div className="action-buttons-group" style={{ justifyContent: 'flex-end' }}>
                      <Link
                        to={`/leads/${lead.id}`}
                        className="icon-action-btn"
                        title="View Lead Details"
                      >
                        <Eye size={15} />
                      </Link>
                      <Link
                        to={`/leads/${lead.id}/edit`}
                        className="icon-action-btn"
                        title="Edit Lead"
                      >
                        <Edit size={15} />
                      </Link>
                      {canDeleteLeads && (
                        <button
                          type="button"
                          className="icon-action-btn icon-action-btn-danger"
                          title="Delete Lead (Admin Only)"
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

        <Pagination
          currentPage={currentPage}
          totalCount={totalCount}
          pageSize={pageSize}
          onPageChange={(page) => setCurrentPage(page)}
        />
      </div>

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
