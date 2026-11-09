import React, { useState, useEffect } from 'react';
import { telegramApi } from '../api/telegramApi';
import { useToast } from '../context/ToastContext';
import { extractErrorMessage } from '../utils/validation';
import {
  Send,
  CheckCircle2,
  XCircle,
  Copy,
  ExternalLink,
  Bell,
  RefreshCw,
  PowerOff,
  Sparkles,
  Kanban,
  CheckSquare,
  MessageSquare,
  ShieldCheck,
  Terminal,
} from 'lucide-react';

export const TelegramManager = () => {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [statusData, setStatusData] = useState(null);
  const [codeData, setCodeData] = useState(null);
  const [generatingCode, setGeneratingCode] = useState(false);
  const [updatingPrefs, setUpdatingPrefs] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);

  const fetchStatus = async () => {
    try {
      setLoading(true);
      const res = await telegramApi.getStatus();
      setStatusData(res.data || null);
    } catch (err) {
      showToast(extractErrorMessage(err, 'Failed to load Telegram status.'), 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleGenerateCode = async () => {
    try {
      setGeneratingCode(true);
      const res = await telegramApi.generateLinkCode();
      setCodeData(res.data);
      showToast('6-digit connection PIN generated!', 'success');
    } catch (err) {
      showToast(extractErrorMessage(err, 'Failed to generate connection code.'), 'error');
    } finally {
      setGeneratingCode(false);
    }
  };

  const handleTogglePreference = async (prefKey) => {
    if (!statusData) return;
    const newPrefs = {
      notify_new_leads: prefKey === 'notify_new_leads' ? !statusData.notify_new_leads : statusData.notify_new_leads,
      notify_followups: prefKey === 'notify_followups' ? !statusData.notify_followups : statusData.notify_followups,
      notify_stage_changes: prefKey === 'notify_stage_changes' ? !statusData.notify_stage_changes : statusData.notify_stage_changes,
    };

    // Optimistic UI update
    setStatusData((prev) => ({ ...prev, ...newPrefs }));

    try {
      setUpdatingPrefs(true);
      const res = await telegramApi.updatePreferences(newPrefs);
      if (res.data) {
        setStatusData(res.data);
      }
      showToast('Notification preferences updated.', 'success');
    } catch (err) {
      // Revert on error
      fetchStatus();
      showToast(extractErrorMessage(err, 'Failed to update preferences.'), 'error');
    } finally {
      setUpdatingPrefs(false);
    }
  };

  const handleDisconnect = async () => {
    if (!window.confirm('Are you sure you want to unlink your Telegram account from CRM Lite?')) return;
    try {
      await telegramApi.disconnect();
      setCodeData(null);
      await fetchStatus();
      showToast('Telegram account disconnected.', 'info');
    } catch (err) {
      showToast(extractErrorMessage(err, 'Failed to disconnect Telegram account.'), 'error');
    }
  };

  const handleSendTestAlert = async () => {
    try {
      setSendingTest(true);
      const res = await telegramApi.sendTestMessage();
      showToast(res.message || 'Test alert sent! Check your Telegram chat.', 'success');
    } catch (err) {
      showToast(extractErrorMessage(err, 'Could not send test message.'), 'error');
    } finally {
      setSendingTest(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    showToast('Copied to clipboard!', 'info');
  };

  if (loading && !statusData) {
    return (
      <div className="card" style={{ padding: '2rem', textAlign: 'center' }}>
        <RefreshCw size={24} className="animate-spin text-primary" style={{ margin: '0 auto 0.75rem auto' }} />
        <p className="text-dim">Loading Telegram Bot connection status...</p>
      </div>
    );
  }

  const isVerified = statusData?.is_verified;
  const botHandle = statusData?.bot_username || '@CrmLiteCopilotBot';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header Card */}
      <div className="card" style={{ padding: '1.5rem 1.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #229ED9 0%, #0088cc 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                boxShadow: '0 4px 12px rgba(0, 136, 204, 0.3)',
              }}
            >
              <Send size={22} style={{ marginLeft: '-2px', marginTop: '1px' }} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                Telegram CRM Copilot
                {isVerified ? (
                  <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.75rem' }}>
                    <CheckCircle2 size={12} /> Connected
                  </span>
                ) : (
                  <span className="badge badge-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.75rem' }}>
                    <XCircle size={12} /> Not Linked
                  </span>
                )}
              </h2>
              <p className="text-dim" style={{ margin: '0.25rem 0 0 0', fontSize: '0.875rem' }}>
                Query pipeline metrics, advance lead stages, and receive instant push notifications right on your phone.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button className="btn btn-secondary btn-sm" onClick={fetchStatus} title="Refresh Status">
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              <span>Refresh</span>
            </button>
            {isVerified && (
              <button className="btn btn-outline-danger btn-sm" onClick={handleDisconnect} title="Unlink Telegram Account">
                <PowerOff size={14} />
                <span>Disconnect</span>
              </button>
            )}
          </div>
        </div>

        {/* Status Details / Connect Box */}
        <div style={{ marginTop: '1.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.25rem' }}>
          {isVerified ? (
            <div
              style={{
                background: 'rgba(34, 197, 94, 0.06)',
                border: '1px solid rgba(34, 197, 94, 0.25)',
                borderRadius: '8px',
                padding: '1.25rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '1rem',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, color: 'var(--success)' }}>
                  <ShieldCheck size={18} />
                  <span>Account Linked to Telegram</span>
                </div>
                <div style={{ marginTop: '0.35rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                  Telegram User: <strong>@{statusData.telegram_username || 'user'}</strong> • Chat ID: <code>{statusData.chat_id}</code>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={handleSendTestAlert}
                  disabled={sendingTest}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                >
                  <Bell size={14} />
                  <span>{sendingTest ? 'Sending...' : 'Send Test Alert'}</span>
                </button>
                <a
                  href={`https://t.me/${statusData.bot_username || 'CrmLiteCopilotBot'}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-secondary btn-sm"
                  style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                >
                  <ExternalLink size={14} />
                  <span>Open Bot</span>
                </a>
              </div>
            </div>
          ) : (
            <div
              style={{
                background: 'var(--surface-raised, rgba(255, 255, 255, 0.02))',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                padding: '1.25rem',
              }}
            >
              {!codeData ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
                  <div>
                    <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: 0 }}>Connect your Telegram Account</h3>
                    <p className="text-dim" style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem' }}>
                      Generate a one-time 6-digit PIN to link your Telegram chat securely with your CRM user role.
                    </p>
                  </div>
                  <button
                    className="btn btn-primary"
                    onClick={handleGenerateCode}
                    disabled={generatingCode}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                  >
                    <Send size={15} />
                    <span>{generatingCode ? 'Generating...' : 'Generate Connection PIN'}</span>
                  </button>
                </div>
              ) : (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: 0, color: 'var(--primary)' }}>
                      🔑 Your 6-Digit Telegram Link PIN
                    </h3>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>Valid for 15 minutes</span>
                  </div>

                  {/* Big PIN Display */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.5rem',
                      background: 'var(--bg-chassis, #0b0f17)',
                      padding: '1.25rem',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)',
                      marginBottom: '1.25rem',
                    }}
                  >
                    {codeData.code.split('').map((char, i) => (
                      <span
                        key={i}
                        style={{
                          width: '42px',
                          height: '52px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '1.75rem',
                          fontWeight: 700,
                          borderRadius: '6px',
                          background: 'rgba(99, 102, 241, 0.15)',
                          color: '#818cf8',
                          border: '1px solid rgba(99, 102, 241, 0.3)',
                          fontFamily: 'monospace',
                        }}
                      >
                        {char}
                      </span>
                    ))}
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => copyToClipboard(codeData.code)}
                      title="Copy PIN"
                      style={{ marginLeft: '1rem' }}
                    >
                      <Copy size={15} />
                      <span>Copy</span>
                    </button>
                  </div>

                  {/* Connect Steps */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', fontSize: '0.875rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span className="badge badge-primary" style={{ width: '22px', height: '22px', borderRadius: '50%', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>1</span>
                      <span>
                        Click the button below to open <strong>{codeData.bot_username}</strong> on Telegram:
                      </span>
                    </div>

                    <div style={{ margin: '0.25rem 0 0.5rem 1.85rem' }}>
                      <a
                        href={codeData.deep_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-primary"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', textDecoration: 'none' }}
                      >
                        <ExternalLink size={15} />
                        <span>Open Bot &amp; Auto-Connect (1-Click)</span>
                      </a>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span className="badge badge-primary" style={{ width: '22px', height: '22px', borderRadius: '50%', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>2</span>
                      <span>
                        Or manually open the bot and send: <code>/connect {codeData.code}</code>
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Push Notification Preferences */}
      <div className="card" style={{ padding: '1.5rem 1.75rem' }}>
        <h3 style={{ fontSize: '1.05rem', fontWeight: 600, margin: '0 0 0.35rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Bell size={17} className="text-primary" />
          <span>Telegram Push Alerts</span>
        </h3>
        <p className="text-dim" style={{ fontSize: '0.85rem', margin: '0 0 1.25rem 0' }}>
          Select which CRM real-time events should trigger an instant Telegram push alert to your phone.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.85rem 1rem',
              background: 'var(--surface-raised, rgba(255, 255, 255, 0.02))',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              cursor: 'pointer',
            }}
          >
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>New Inbound Leads &amp; Lead Assignments</div>
              <div className="text-dim" style={{ fontSize: '0.8rem' }}>
                Instant ping whenever a website contact form arrives or a lead is assigned to you.
              </div>
            </div>
            <input
              type="checkbox"
              checked={Boolean(statusData?.notify_new_leads)}
              onChange={() => handleTogglePreference('notify_new_leads')}
              disabled={updatingPrefs || !isVerified}
              style={{ width: '18px', height: '18px', accentColor: 'var(--primary)' }}
            />
          </label>

          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.85rem 1rem',
              background: 'var(--surface-raised, rgba(255, 255, 255, 0.02))',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              cursor: 'pointer',
            }}
          >
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Follow-Up Reminders &amp; Overdue Tasks</div>
              <div className="text-dim" style={{ fontSize: '0.8rem' }}>
                Alerts 15 minutes before scheduled discovery calls and reminders for overdue tasks.
              </div>
            </div>
            <input
              type="checkbox"
              checked={Boolean(statusData?.notify_followups)}
              onChange={() => handleTogglePreference('notify_followups')}
              disabled={updatingPrefs || !isVerified}
              style={{ width: '18px', height: '18px', accentColor: 'var(--primary)' }}
            />
          </label>

          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.85rem 1rem',
              background: 'var(--surface-raised, rgba(255, 255, 255, 0.02))',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              cursor: 'pointer',
            }}
          >
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Stage Changes &amp; Deal Won Celebrations</div>
              <div className="text-dim" style={{ fontSize: '0.8rem' }}>
                Updates when assigned leads advance through pipeline checkpoints or convert to Won.
              </div>
            </div>
            <input
              type="checkbox"
              checked={Boolean(statusData?.notify_stage_changes)}
              onChange={() => handleTogglePreference('notify_stage_changes')}
              disabled={updatingPrefs || !isVerified}
              style={{ width: '18px', height: '18px', accentColor: 'var(--primary)' }}
            />
          </label>
        </div>
      </div>

      {/* Bot Commands & AI Capabilities Guide */}
      <div className="card" style={{ padding: '1.5rem 1.75rem' }}>
        <h3 style={{ fontSize: '1.05rem', fontWeight: 600, margin: '0 0 0.35rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Sparkles size={17} className="text-primary" />
          <span>Telegram Commands &amp; AI Capabilities</span>
        </h3>
        <p className="text-dim" style={{ fontSize: '0.85rem', margin: '0 0 1.25rem 0' }}>
          Once connected, you can type slash commands or talk to your CRM in natural language.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
          <div style={{ background: 'var(--surface-raised, rgba(255, 255, 255, 0.02))', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.35rem' }}>
              <Kanban size={16} className="text-primary" />
              <code>/pipeline</code>
            </div>
            <p className="text-dim" style={{ fontSize: '0.825rem', margin: 0 }}>
              Shows a visual snapshot of your deals funnel, stage distribution, and total pipeline deal value.
            </p>
          </div>

          <div style={{ background: 'var(--surface-raised, rgba(255, 255, 255, 0.02))', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.35rem' }}>
              <CheckSquare size={16} className="text-primary" />
              <code>/leads</code>
            </div>
            <p className="text-dim" style={{ fontSize: '0.825rem', margin: 0 }}>
              Lists your top active deals with 1-click interactive buttons to view details or advance stages.
            </p>
          </div>

          <div style={{ background: 'var(--surface-raised, rgba(255, 255, 255, 0.02))', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.35rem' }}>
              <CheckSquare size={16} className="text-primary" />
              <code>/today</code>
            </div>
            <p className="text-dim" style={{ fontSize: '0.825rem', margin: 0 }}>
              Lists scheduled calls and overdue tasks for today with 1-click <code>[✅ Complete]</code> buttons.
            </p>
          </div>

          <div style={{ background: 'var(--surface-raised, rgba(255, 255, 255, 0.02))', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.35rem' }}>
              <MessageSquare size={16} className="text-primary" />
              <span>Natural Language AI</span>
            </div>
            <p className="text-dim" style={{ fontSize: '0.825rem', margin: 0 }}>
              Type <i>"Move Acme Corp to Qualified"</i> or <i>"Create lead John, phone 9876543210"</i>.
            </p>
          </div>
        </div>
      </div>

      {/* Developer / Setup Card */}
      <div
        className="card"
        style={{
          padding: '1.25rem 1.5rem',
          background: 'rgba(99, 102, 241, 0.04)',
          border: '1px solid rgba(99, 102, 241, 0.2)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
          <Terminal size={18} className="text-primary" style={{ marginTop: '2px', flexShrink: 0 }} />
          <div>
            <h4 style={{ margin: '0 0 0.25rem 0', fontSize: '0.9rem', fontWeight: 600 }}>
              Local Testing Without Public HTTPS or Ngrok
            </h4>
            <p className="text-dim" style={{ margin: '0 0 0.5rem 0', fontSize: '0.825rem', lineHeight: 1.5 }}>
              To test the bot locally on your development machine, configure your <code>TELEGRAM_BOT_TOKEN</code> in <code>backend/.env</code> and run:
            </p>
            <div
              style={{
                background: 'var(--bg-chassis, #0b0f17)',
                padding: '0.5rem 0.75rem',
                borderRadius: '6px',
                fontFamily: 'monospace',
                fontSize: '0.825rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                border: '1px solid var(--border-color)',
              }}
            >
              <span>python backend/manage.py run_telegram_bot</span>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => copyToClipboard('python backend/manage.py run_telegram_bot')}
                style={{ padding: '0.15rem 0.35rem', height: 'auto' }}
              >
                <Copy size={12} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

