import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { customerApi } from '../api/customerApi';
import { formatDate } from '../utils/formatters';
import { extractErrorMessage } from '../utils/validation';
import { useToast } from '../context/ToastContext';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { EmptyState } from '../components/EmptyState';
import { SearchBar } from '../components/SearchBar';
import { Briefcase, Phone, Mail, Building2, Eye, Calendar, UserCheck } from 'lucide-react';

export const Customers = () => {
  const { showToast } = useToast();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchCustomers = async (searchQuery = '') => {
    setLoading(true);
    try {
      const res = await customerApi.getCustomers({ search: searchQuery || undefined });
      setCustomers(res.results || res);
    } catch (err) {
      showToast(extractErrorMessage(err, 'Failed to fetch customer accounts'), 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers(search);
  }, [search]);

  return (
    <div className="customers-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <Briefcase size={26} />
            <span>Customer Accounts</span>
          </h1>
          <p className="page-subtitle">
            Converted clients and active accounts preserved with original lead history
          </p>
        </div>
      </div>

      <div className="filter-toolbar">
        <SearchBar
          value={search}
          onChange={(val) => setSearch(val)}
          placeholder="Search by customer name, company, phone, or email..."
        />
      </div>

      <div className="table-responsive">
        {loading ? (
          <LoadingSpinner text="Retrieving customer records..." />
        ) : customers.length === 0 ? (
          <EmptyState
            title="No customers found"
            message="No converted customers found in the system yet. Convert qualified leads to create customer accounts."
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
                <th>Converted By</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
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
                        <Phone size={13} className="text-dim" /> {cust.phone}
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
                      <Link to={`/leads/${cust.lead}`} className="text-main font-semibold">
                        {cust.lead_name || `Lead #${cust.lead}`}
                      </Link>
                    ) : (
                      'Direct Customer'
                    )}
                  </td>
                  <td>
                    <span className="text-muted font-sm">{cust.lead_source || 'N/A'}</span>
                  </td>
                  <td>
                    <span className="text-dim font-sm">{formatDate(cust.converted_at)}</span>
                  </td>
                  <td>
                    <span className="text-main font-sm">
                      {cust.created_by_details?.full_name || cust.created_by_details?.email || 'System'}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <Link
                      to={`/customers/${cust.id}`}
                      className="icon-action-btn"
                      title="View Customer Details"
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
