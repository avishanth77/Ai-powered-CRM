import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Bot, Mic, Sparkles, MessageSquare, ArrowRight, FileText, CheckCircle2, ShieldAlert } from 'lucide-react';

export const AiCenter = ({ onOpenAssistant }) => {
  const navigate = useNavigate();

  return (
    <div className="ai-center-page">
      <div className="page-header">
        <div>
          <div className="ai-header-badge">
            <Sparkles size={13} />
            <span>AI Workspace • Phase 1 Demo</span>
          </div>
          <h1 className="page-title">AI Center</h1>
          <p className="page-subtitle">AI-powered tools and intelligent automation for your CRM</p>
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
                  <span className="ai-card-badge">Demo AI</span>
                </h2>
                <span className="text-dim" style={{ fontSize: '0.8125rem' }}>
                  Conversational CRM Copilot
                </span>
              </div>
            </div>

            <p className="ai-card-description">
              Ask questions about your CRM pipeline, overdue follow-ups, lead summaries, and daily tasks in natural language.
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
                <span>Role-aware CRM queries and actionable suggestions</span>
              </li>
            </ul>
          </div>

          <div className="ai-card-footer">
            <span className="text-dim" style={{ fontSize: '0.8125rem' }}>Ready to chat</span>
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
              <span>Open Assistant</span>
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
                  <span className="ai-card-badge">Voice Note & Notes</span>
                </h2>
                <span className="text-dim" style={{ fontSize: '0.8125rem' }}>
                  Speech-to-Text & Deal Intelligence
                </span>
              </div>
            </div>

            <p className="ai-card-description">
              Record or upload audio voice notes from sales calls. Automatically extract transcripts, customer objections, requirements, and next steps.
            </p>

            <ul className="ai-card-features-list">
              <li>
                <CheckCircle2 size={15} />
                <span>In-browser microphone recording or audio file upload</span>
              </li>
              <li>
                <CheckCircle2 size={15} />
                <span>Structured synthesis: key points, intent & objections</span>
              </li>
              <li>
                <CheckCircle2 size={15} />
                <span>1-click save to Lead profile, follow-ups & activity timeline</span>
              </li>
            </ul>
          </div>

          <div className="ai-card-footer">
            <span className="text-dim" style={{ fontSize: '0.8125rem' }}>Voice note ready</span>
            <button
              type="button"
              className="btn btn-primary"
              style={{ background: 'linear-gradient(135deg, var(--accent-purple-soft), var(--accent-purple))' }}
              onClick={() => navigate('/ai/call-summary')}
            >
              <FileText size={16} />
              <span>Open Call Summary</span>
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Architecture Notice Banner */}
      <div
        className="card"
        style={{
          background: 'var(--bg-surface-elevated)',
          border: '1px solid var(--border-subtle)',
          padding: '1.25rem 1.5rem',
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          marginTop: '1rem',
        }}
      >
        <ShieldAlert size={20} color="var(--primary)" style={{ flexShrink: 0 }} />
        <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
          <strong style={{ color: 'var(--text-main)' }}>AI Architecture Note:</strong> Currently running on Phase 1 mock intelligence services. Backend service boundaries are fully structured to seamlessly integrate Gemini, OpenAI, or local STT models without modifying CRM workflows.
        </div>
      </div>
    </div>
  );
};
