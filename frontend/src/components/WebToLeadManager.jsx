import React, { useState } from 'react';
import {
  Globe,
  Code,
  Copy,
  Check,
  Send,
  Sparkles,
  ExternalLink,
  ShieldCheck,
  AlertCircle,
  HelpCircle,
  Zap,
  CheckCircle2,
} from 'lucide-react';
import { leadApi } from '../api/leadApi';
import { useToast } from '../context/ToastContext';
import { extractErrorMessage } from '../utils/validation';

export const WebToLeadManager = () => {
  const { showToast } = useToast();

  // Code snippet tab state
  const [snippetTab, setSnippetTab] = useState('html');
  const [copiedKey, setCopiedKey] = useState(null);

  // Live test form state
  const [testForm, setTestForm] = useState({
    name: 'Sarah Connor',
    email: 'sarah.connor@cyberdyne.io',
    phone: '+1 415-555-0192',
    company_name: 'Cyberdyne Systems',
    subject: 'Enterprise Cloud Deployment Inquiry',
    message: 'Hello, our engineering team is evaluating your platform for 30 sales executives. Please share pricing and arrange a live demo.',
    expected_value: '15000',
    source: 'Website',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionResult, setSubmissionResult] = useState(null);

  const endpointUrl = `${window.location.origin.replace(':5173', ':8000')}/api/leads/web-to-lead/`;

  const copyToClipboard = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    showToast('Copied to clipboard!', 'success');
    setTimeout(() => {
      setCopiedKey(null);
    }, 2500);
  };

  const handleTestSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmissionResult(null);

    try {
      const res = await leadApi.submitWebToLead(testForm);
      setSubmissionResult({
        success: true,
        data: res,
      });
      showToast(res.message || 'Lead successfully captured from website!', 'success');
    } catch (err) {
      const errMsg = extractErrorMessage(err, 'Failed to submit test lead.');
      setSubmissionResult({
        success: false,
        error: errMsg,
      });
      showToast(errMsg, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const htmlSnippet = `<!-- CRM Lite Website Contact Form Integration -->
<form action="${endpointUrl}" method="POST" class="crm-contact-form">
  <!-- Anti-spam Honeypot (leave invisible to humans) -->
  <input type="text" name="website_url_hp" style="display:none !important;" tabindex="-1" autocomplete="off" />

  <div>
    <label for="contact_name">Full Name *</label>
    <input type="text" id="contact_name" name="name" required placeholder="Your Name" />
  </div>

  <div>
    <label for="contact_email">Email Address</label>
    <input type="email" id="contact_email" name="email" placeholder="name@company.com" />
  </div>

  <div>
    <label for="contact_phone">Phone / WhatsApp *</label>
    <input type="tel" id="contact_phone" name="phone" required placeholder="+1 234 567 890" />
  </div>

  <div>
    <label for="contact_company">Company Name</label>
    <input type="text" id="contact_company" name="company_name" placeholder="Acme Corp" />
  </div>

  <div>
    <label for="contact_subject">Subject</label>
    <input type="text" id="contact_subject" name="subject" placeholder="Product Inquiry / Demo" />
  </div>

  <div>
    <label for="contact_message">Inquiry / Message</label>
    <textarea id="contact_message" name="message" rows="4" placeholder="How can we help you?"></textarea>
  </div>

  <button type="submit">Send Message</button>
</form>`;

  const jsFetchSnippet = `// Modern JavaScript fetch() / AJAX example
async function submitContactForm(formData) {
  try {
    const response = await fetch('${endpointUrl}', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        company_name: formData.company_name,
        subject: formData.subject,
        message: formData.message,
        expected_value: formData.expected_value || 0,
        source: 'Website'
      })
    });

    const result = await response.json();
    if (result.success) {
      alert(result.message || 'Thank you! We will get back to you shortly.');
    } else {
      alert('Error: ' + result.message);
    }
  } catch (err) {
    console.error('Contact submission error:', err);
  }
}`;

  const curlSnippet = `curl -X POST "${endpointUrl}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "Alex Mercer",
    "email": "alex@mercercorp.com",
    "phone": "+1 555-0143",
    "company_name": "Mercer Innovations",
    "subject": "Platform Demonstration",
    "message": "Interested in evaluating CRM Lite for our sales team.",
    "expected_value": 7500,
    "source": "Website"
  }'`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Overview Card */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '1rem', marginBottom: '1.25rem' }}>
          <div>
            <h3 style={{ fontSize: '1.25rem', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Globe size={22} color="var(--primary)" />
              Website Contact Webhook & Web-to-Lead Integration
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '0.35rem', marginBottom: 0 }}>
              Capture new inquiries directly from your website contact forms into CRM Lite with automatic stage task instantiation, smart sales rep assignment, and deduplication.
            </p>
          </div>
          <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem', padding: '0.35rem 0.65rem' }}>
            <Zap size={14} />
            Public API Active
          </span>
        </div>

        {/* Endpoint Banner */}
        <div style={{ background: 'var(--bg-subtle, rgba(0,0,0,0.03))', border: '1px solid var(--border-subtle)', borderRadius: '8px', padding: '1rem', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div>
              <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, color: 'var(--text-muted)' }}>
                Target HTTP POST Webhook URL
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
                <span style={{ background: 'var(--primary)', color: '#fff', fontSize: '0.75rem', fontWeight: 700, padding: '0.15rem 0.45rem', borderRadius: '4px' }}>
                  POST
                </span>
                <code style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {endpointUrl}
                </code>
              </div>
            </div>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
              onClick={() => copyToClipboard(endpointUrl, 'url')}
            >
              {copiedKey === 'url' ? <Check size={14} color="#10B981" /> : <Copy size={14} />}
              {copiedKey === 'url' ? 'Copied' : 'Copy Webhook URL'}
            </button>
          </div>
        </div>

        {/* Feature Highlights Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
          <div style={{ border: '1px solid var(--border-subtle)', borderRadius: '8px', padding: '0.875rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
              <ShieldCheck size={18} color="#10B981" />
              <strong style={{ fontSize: '0.875rem' }}>Unauthenticated & Secure</strong>
            </div>
            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Accepts public form submissions without API keys while blocking spam with built-in honeypot filters.
            </p>
          </div>

          <div style={{ border: '1px solid var(--border-subtle)', borderRadius: '8px', padding: '0.875rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
              <Sparkles size={18} color="#6366F1" />
              <strong style={{ fontSize: '0.875rem' }}>Automated Stage Tasks</strong>
            </div>
            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Immediately instantiates all Stage 1 (New) checkpoint tasks and schedules response follow-ups.
            </p>
          </div>

          <div style={{ border: '1px solid var(--border-subtle)', borderRadius: '8px', padding: '0.875rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
              <CheckCircle2 size={18} color="#3B82F6" />
              <strong style={{ fontSize: '0.875rem' }}>Smart Auto-Assignment</strong>
            </div>
            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Routes incoming leads to the least-busy active Sales Executive with load balancing and instant alerts.
            </p>
          </div>

          <div style={{ border: '1px solid var(--border-subtle)', borderRadius: '8px', padding: '0.875rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
              <Zap size={18} color="#F59E0B" />
              <strong style={{ fontSize: '0.875rem' }}>Deduplication & Notes</strong>
            </div>
            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              If an active lead submits again, it appends a LeadNote and notifies the rep instead of erroring.
            </p>
          </div>
        </div>
      </div>

      {/* Two Column Layout: Code Integration on Left, Live Submitter on Right */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '1.5rem' }}>
        {/* Left Column: Embed Snippets */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
            <h4 style={{ margin: 0, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Code size={18} color="var(--primary)" />
              Website Integration Snippets
            </h4>
            <div style={{ display: 'flex', gap: '0.35rem' }}>
              <button
                type="button"
                className={`btn btn-sm ${snippetTab === 'html' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
                onClick={() => setSnippetTab('html')}
              >
                HTML Form
              </button>
              <button
                type="button"
                className={`btn btn-sm ${snippetTab === 'js' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
                onClick={() => setSnippetTab('js')}
              >
                JavaScript
              </button>
              <button
                type="button"
                className={`btn btn-sm ${snippetTab === 'curl' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
                onClick={() => setSnippetTab('curl')}
              >
                cURL
              </button>
            </div>
          </div>

          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
            {snippetTab === 'html' && 'Drop this HTML form directly into your landing page or contact section:'}
            {snippetTab === 'js' && 'Use this asynchronous JavaScript function in your React, Vue, or Next.js app:'}
            {snippetTab === 'curl' && 'Test the webhook directly from your command line terminal:'}
          </p>

          <div style={{ position: 'relative', flex: 1 }}>
            <pre
              style={{
                background: '#1E293B',
                color: '#F8FAFC',
                padding: '1rem',
                borderRadius: '8px',
                fontSize: '0.8rem',
                lineHeight: '1.45',
                overflowX: 'auto',
                maxHeight: '380px',
                margin: 0,
                fontFamily: 'monospace',
              }}
            >
              {snippetTab === 'html' && htmlSnippet}
              {snippetTab === 'js' && jsFetchSnippet}
              {snippetTab === 'curl' && curlSnippet}
            </pre>

            <button
              type="button"
              className="btn btn-sm"
              style={{
                position: 'absolute',
                top: '0.5rem',
                right: '0.5rem',
                background: 'rgba(255,255,255,0.15)',
                color: '#fff',
                border: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                fontSize: '0.75rem',
                padding: '0.25rem 0.5rem',
              }}
              onClick={() => {
                const text = snippetTab === 'html' ? htmlSnippet : snippetTab === 'js' ? jsFetchSnippet : curlSnippet;
                copyToClipboard(text, snippetTab);
              }}
            >
              {copiedKey === snippetTab ? <Check size={14} color="#10B981" /> : <Copy size={14} />}
              {copiedKey === snippetTab ? 'Copied' : 'Copy'}
            </button>
          </div>

          {/* Supported Payload Fields Reference */}
          <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--border-subtle)' }}>
            <h5 style={{ margin: '0 0 0.5rem 0', fontSize: '0.85rem' }}>Accepted Payload Fields</h5>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.4rem', fontSize: '0.75rem' }}>
              <div><code>name</code>: Full name <span style={{ color: '#EF4444' }}>*</span></div>
              <div><code>phone</code>: Contact number <span style={{ color: '#EF4444' }}>*</span></div>
              <div><code>email</code>: Email address</div>
              <div><code>company_name</code>: Organization</div>
              <div><code>message</code>: Inquiry / Notes</div>
              <div><code>subject</code>: Topic headline</div>
              <div><code>expected_value</code>: Budget / Deal value</div>
              <div><code>website_url_hp</code>: Spam honeypot</div>
            </div>
          </div>
        </div>

        {/* Right Column: Live Webhook Tester Form */}
        <div className="card">
          <div style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
            <h4 style={{ margin: 0, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Send size={18} color="var(--primary)" />
              Live Contact Form Simulator
            </h4>
            <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Submit a real test inquiry below. It will post to the endpoint and immediately show up in your Leads & Pipeline.
            </p>
          </div>

          <form onSubmit={handleTestSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: '0.8rem' }}>Full Name *</label>
                <input
                  type="text"
                  className="form-input"
                  style={{ fontSize: '0.85rem', padding: '0.45rem 0.65rem' }}
                  required
                  value={testForm.name}
                  onChange={(e) => setTestForm({ ...testForm, name: e.target.value })}
                />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: '0.8rem' }}>Phone / WhatsApp *</label>
                <input
                  type="text"
                  className="form-input"
                  style={{ fontSize: '0.85rem', padding: '0.45rem 0.65rem' }}
                  required
                  value={testForm.phone}
                  onChange={(e) => setTestForm({ ...testForm, phone: e.target.value })}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: '0.8rem' }}>Email Address</label>
                <input
                  type="email"
                  className="form-input"
                  style={{ fontSize: '0.85rem', padding: '0.45rem 0.65rem' }}
                  value={testForm.email}
                  onChange={(e) => setTestForm({ ...testForm, email: e.target.value })}
                />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: '0.8rem' }}>Company Name</label>
                <input
                  type="text"
                  className="form-input"
                  style={{ fontSize: '0.85rem', padding: '0.45rem 0.65rem' }}
                  value={testForm.company_name}
                  onChange={(e) => setTestForm({ ...testForm, company_name: e.target.value })}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '0.75rem' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: '0.8rem' }}>Subject</label>
                <input
                  type="text"
                  className="form-input"
                  style={{ fontSize: '0.85rem', padding: '0.45rem 0.65rem' }}
                  value={testForm.subject}
                  onChange={(e) => setTestForm({ ...testForm, subject: e.target.value })}
                />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: '0.8rem' }}>Budget / Deal (₹)</label>
                <input
                  type="number"
                  className="form-input"
                  style={{ fontSize: '0.85rem', padding: '0.45rem 0.65rem' }}
                  value={testForm.expected_value}
                  onChange={(e) => setTestForm({ ...testForm, expected_value: e.target.value })}
                />
              </div>
            </div>

            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontSize: '0.8rem' }}>Message / Inquiry</label>
              <textarea
                className="form-input"
                rows="3"
                style={{ fontSize: '0.85rem', padding: '0.45rem 0.65rem' }}
                value={testForm.message}
                onChange={(e) => setTestForm({ ...testForm, message: e.target.value })}
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSubmitting}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                marginTop: '0.5rem',
                padding: '0.65rem 1rem',
              }}
            >
              {isSubmitting ? (
                <>Posting Inquiry...</>
              ) : (
                <>
                  <Send size={16} />
                  Simulate Website Form Submission
                </>
              )}
            </button>
          </form>

          {/* Submission Feedback Result */}
          {submissionResult && (
            <div
              style={{
                marginTop: '1.25rem',
                padding: '1rem',
                borderRadius: '8px',
                border: submissionResult.success ? '1px solid #A7F3D0' : '1px solid #FECACA',
                background: submissionResult.success ? '#F0FDF4' : '#FEF2F2',
              }}
            >
              {submissionResult.success ? (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#065F46', fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.35rem' }}>
                    <CheckCircle2 size={18} color="#10B981" />
                    {submissionResult.data.is_new ? 'New Lead Captured Successfully!' : 'Repeat Inquiry Recorded!'}
                  </div>
                  <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.8rem', color: '#047857' }}>
                    {submissionResult.data.message}
                  </p>
                  {submissionResult.data.lead && (
                    <div style={{ fontSize: '0.75rem', color: '#065F46', background: 'rgba(255,255,255,0.7)', padding: '0.5rem', borderRadius: '6px', marginBottom: '0.5rem' }}>
                      <div><strong>Lead ID:</strong> #{submissionResult.data.lead.id} ({submissionResult.data.lead.name})</div>
                      <div><strong>Stage:</strong> {submissionResult.data.lead.stage} | <strong>Assigned Rep:</strong> {submissionResult.data.lead.assigned_to || 'Unassigned'}</div>
                    </div>
                  )}
                  <a
                    href={`/leads/${submissionResult.data.lead_id || submissionResult.data.lead?.id}`}
                    className="btn btn-sm btn-primary"
                    style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                  >
                    <ExternalLink size={12} />
                    View Lead in CRM
                  </a>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', color: '#991B1B', fontSize: '0.85rem' }}>
                  <AlertCircle size={18} color="#EF4444" style={{ flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    <strong>Submission Failed:</strong>
                    <div>{submissionResult.error}</div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default WebToLeadManager;

