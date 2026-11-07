import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { customerApi } from '../api/customerApi';
import { formatDate, formatCurrency } from '../utils/formatters';
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
  Package,
  CheckCircle2,
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

      {/* Purchased Products & Subscriptions */}
      <div className="card" style={{ maxWidth: '720px', marginTop: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
          <h3 style={{ fontSize: '1.125rem', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Package size={18} className="text-primary" />
            <span>Purchased Products & Subscriptions</span>
          </h3>
          <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', borderRadius: '9999px', backgroundColor: 'rgba(99, 102, 241, 0.15)', color: 'var(--primary)', fontWeight: 600 }}>
            {customer.products?.length || 0} Products
          </span>
        </div>

        {customer.products && customer.products.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {customer.products.map((item, idx) => (
              <div
                key={item.id || idx}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '0.75rem 1rem',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--bg-card-subtle)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.95rem' }}>
                    {item.name}
                  </div>
                  <div className="text-dim font-xs" style={{ display: 'flex', gap: '0.75rem', marginTop: '0.2rem' }}>
                    <span>Code: {item.code}</span>
                    {item.category && <span>• Category: {item.category}</span>}
                    <span>• Qty: {item.quantity}</span>
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--warning)', fontFamily: 'Outfit' }}>
                    {formatCurrency(item.total_price || item.unit_price)}
                  </div>
                  <div className="text-dim font-xs">
                    {formatCurrency(item.unit_price)} each
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-dim font-sm" style={{ fontStyle: 'italic', padding: '1rem 0', textAlign: 'center' }}>
            No specific products recorded with this customer account.
          </div>
        )}
      </div>
    </div>
  );
};
