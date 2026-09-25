import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { customerApi } from '../api/customerApi';
import { formatDate } from '../utils/formatters';
import { extractErrorMessage } from '../utils/validation';
import { useToast } from '../context/ToastContext';
import { LoadingSpinner } from '../components/LoadingSpinner';
import {
  ArrowLeft,
  Phone,
  Mail,
  Building2,
  User,
  MapPin,
  ExternalLink,
} from 'lucide-react';

export const CustomerDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const loadCustomer = () => {
    setLoading(true);
    setLoadError(null);
    customerApi
      .getCustomerById(id)
      .then((res) => setCustomer(res))
      .catch((err) => {
        const msg = extractErrorMessage(err, 'Failed to fetch customer profile');
        setLoadError(msg);
        showToast(msg, 'error');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadCustomer();
  }, [id]);

  if (loading) {
    return <LoadingSpinner text="Loading customer profile..." />;
  }

  if (loadError || !customer) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '3rem', maxWidth: '640px', margin: '0 auto' }}>
        <h3>Unable to load customer</h3>
        <p className="text-muted" style={{ margin: '0.5rem 0 1.5rem' }}>
          {loadError || 'This customer account could not be found.'}
        </p>
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-primary" onClick={loadCustomer}>
            Retry
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => navigate('/customers')}>
            Back to Customers
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="customer-details-page">
      <div className="page-header">
        <div>
          <Link to="/customers" className="contact-item mb-2" style={{ marginBottom: '0.5rem' }}>
            <ArrowLeft size={16} /> Back to Customer Accounts
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <h1 className="page-title">{customer.name}</h1>
            <span className="status-badge" style={{ color: 'var(--success)', backgroundColor: 'rgba(16, 185, 129, 0.12)' }}>
              Official Customer
            </span>
          </div>
          <p className="page-subtitle">
            {customer.company_name ? `${customer.company_name} • ` : ''}Converted on {formatDate(customer.converted_at)}
          </p>
        </div>

        {customer.lead && (
          <div className="page-actions">
            <Link to={`/leads/${customer.lead}`} className="btn btn-secondary">
              <ExternalLink size={16} />
              <span>View Original Lead #{customer.lead}</span>
            </Link>
          </div>
        )}
      </div>

      <div className="card" style={{ maxWidth: '720px' }}>
        <h3 style={{ fontSize: '1.125rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.75rem', marginBottom: '1.25rem' }}>
          Account Information
        </h3>

        <div className="lead-info-list">
          <div className="lead-info-item">
            <span className="lead-info-label">Customer Name</span>
            <span className="lead-info-value">{customer.name}</span>
          </div>

          <div className="lead-info-item">
            <span className="lead-info-label">Company Name</span>
            <span className="lead-info-value contact-item">
              <Building2 size={14} className="text-dim" />
              {customer.company_name || 'Individual'}
            </span>
          </div>

          <div className="lead-info-item">
            <span className="lead-info-label">Phone Number</span>
            <span className="lead-info-value contact-item">
              <Phone size={14} className="text-dim" />
              {customer.phone ? <a href={`tel:${customer.phone}`}>{customer.phone}</a> : '—'}
            </span>
          </div>

          <div className="lead-info-item">
            <span className="lead-info-label">Email Address</span>
            <span className="lead-info-value contact-item">
              <Mail size={14} className="text-dim" />
              {customer.email ? <a href={`mailto:${customer.email}`}>{customer.email}</a> : '—'}
            </span>
          </div>

          <div className="lead-info-item">
            <span className="lead-info-label">Original Acquisition Channel</span>
            <span className="lead-info-value">{customer.lead_source || 'N/A'}</span>
          </div>

          <div className="lead-info-item">
            <span className="lead-info-label">Converted By Staff</span>
            <span className="lead-info-value contact-item">
              <User size={14} className="text-dim" />
              {customer.created_by_details?.full_name || customer.created_by_details?.email || 'System'}
            </span>
          </div>

          {customer.address && (
            <div className="lead-info-item">
              <span className="lead-info-label">Billing / Office Address</span>
              <span className="lead-info-value contact-item">
                <MapPin size={14} className="text-dim" />
                {customer.address}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
