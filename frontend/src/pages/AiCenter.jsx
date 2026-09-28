import React from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { Bot, Mic, Sparkles, MessageSquare, ArrowRight, FileText, CheckCircle2, ShieldCheck } from 'lucide-react';

export const AiCenter = ({ onOpenAssistant: propOpenAssistant }) => {
  const navigate = useNavigate();
  const outletCtx = useOutletContext() || {};
  const onOpenAssistant = propOpenAssistant || outletCtx.onOpenAssistant;

  return (
    <div className="ai-center-page">
      <div className="page-header">
        <div>
          <div className="ai-header-badge">
            <Sparkles size={13} />
            <span>AI Workspace • Production Gemini Integration</span>
          </div>
          <h1 className="page-title">AI Center</h1>
          <p className="page-subtitle">Real AI speech-to-text call analysis and intelligent CRM copilot</p>
        </div>
      </div>

      <div className="ai-grid">
        {/* Card 1: AI Assistant */}
        <div className="ai-card">
          <div className="ai-card-accent-strip" />
          <div>
            <div className="ai-card-header">
              <div className="ai-card-icon">
                <Bot size={26} />
              </div>
              <div>
                <h2 className="ai-card-title">
                  AI Assistant
                  <span className="ai-card-badge" style={{ background: 'var(--primary-subtle)', color: 'var(--primary)' }}>
                    Gemini Copilot
                  </span>
                </h2>
                <span className="text-dim" style={{ fontSize: '0.8125rem' }}>
                  Conversational CRM Assistant
                </span>
              </div>
            </div>

            <p className="ai-card-description">
              Ask questions about your live CRM pipeline, overdue follow-ups, lead summaries, and daily tasks in natural language with controlled safety for CRM actions.
            </p>

            <ul className="ai-card-features-list">
              <li>
                <CheckCircle2 size={15} />
                <span>Instant summaries of pipeline health and lead status</span>
              </li>
              <li>
                <CheckCircle2 size={15} />
                <span>Quick inspection of overdue follow-ups and high-value deals</span>
              </li>
              <li>
                <CheckCircle2 size={15} />
                <span>Confirmation-based safe CRM actions (stage transitions)</span>
              </li>
            </ul>
          </div>

          <div className="ai-card-footer">
            <span className="text-dim" style={{ fontSize: '0.8125rem' }}>Live CRM Tools Connected</span>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                if (onOpenAssistant) {
                  onOpenAssistant();
                } else {
                  navigate('/ai/assistant');
                }
              }}
            >
              <MessageSquare size={16} />
              <span>Open</span>
              <ArrowRight size={14} />
            </button>
          </div>
        </div>

        {/* Card 2: AI Voice Call Summary */}
        <div className="ai-card">
          <div className="ai-card-accent-strip" />
          <div>
            <div className="ai-card-header">
              <div className="ai-card-icon" style={{ background: 'rgba(124, 58, 237, 0.1)', color: 'var(--accent-purple)' }}>
                <Mic size={26} />
              </div>
              <div>
                <h2 className="ai-card-title">
                  Call Summary
                  <span className="ai-card-badge" style={{ background: 'rgba(124, 58, 237, 0.15)', color: 'var(--accent-purple)' }}>
                    Speech-to-Text
                  </span>
                </h2>
                <span className="text-dim" style={{ fontSize: '0.8125rem' }}>
                  Multimodal Audio & Deal Intelligence
                </span>
              </div>
            </div>

            <p className="ai-card-description">
              Record voice notes or upload audio recordings (.mp3, .wav, .m4a, .webm). Transcribe conversations verbatim and extract customer objections, requirements, and next actions.
            </p>

            <ul className="ai-card-features-list">
              <li>
                <CheckCircle2 size={15} />
                <span>In-browser microphone recording or audio file upload</span>
              </li>
              <li>
                <CheckCircle2 size={15} />
                <span>Verbatim transcript generation with speaker labeling</span>
              </li>
              <li>
                <CheckCircle2 size={15} />
                <span>Structured synthesis: key points, intent, objections, next steps</span>
              </li>
              <li>
                <CheckCircle2 size={15} />
                <span>1-click save to Lead profile & Activity Timeline</span>
              </li>
            </ul>
          </div>

          <div className="ai-card-footer">
            <span className="text-dim" style={{ fontSize: '0.8125rem' }}>Multimodal STT Ready</span>
            <button
              type="button"
              className="btn btn-primary"
              style={{ background: 'linear-gradient(135deg, var(--accent-purple-soft), var(--accent-purple))' }}
              onClick={() => navigate('/ai/call-summary')}
            >
              <FileText size={16} />
              <span>Open</span>
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Production Architecture Banner */}
      <div
        className="card"
        style={{
          background: 'var(--bg-surface-elevated)',
          border: '1px solid var(--border-subtle)',
          padding: '1.25rem 1.5rem',
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          marginTop: '1.25rem',
        }}
      >
        <ShieldCheck size={22} color="var(--primary)" style={{ flexShrink: 0 }} />
        <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
          <strong style={{ color: 'var(--text-main)' }}>Production AI Architecture:</strong> Audio transcription and deal intelligence run through the Google Gemini multimodal API behind a secure Django server service layer. All credentials remain server-side, and CRM business rules and role permissions are strictly enforced.
        </div>
      </div>
    </div>
  );
};
