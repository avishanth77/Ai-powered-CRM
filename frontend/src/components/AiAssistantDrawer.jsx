import React, { useState, useEffect, useRef } from 'react';
import { Bot, Send, X, Trash2, Sparkles, AlertCircle, CheckCircle2, ShieldCheck, Check, CornerDownLeft } from 'lucide-react';
import { aiApi } from '../api/aiApi';
import { formatTime } from '../utils/formatters';

const DEFAULT_SUGGESTIONS = [
  'Show my overdue leads',
  'What should I do today?',
  'Summarize my pipeline',
  'Show high-value leads',
  'Recent customer activity',
];

export const AiAssistantDrawer = ({ isOpen, onClose }) => {
  const [messages, setMessages] = useState([
    {
      id: 1,
      sender: 'assistant',
      text: "Hello! I'm your CRM AI Copilot.\n\nI can help you analyze your live sales pipeline, review overdue follow-ups, summarize leads, and draft deal updates.",
      timestamp: new Date().toISOString(),
      suggestions: DEFAULT_SUGGESTIONS.slice(0, 3),
      action_required: false,
      action_payload: null,
    },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [executingActionId, setExecutingActionId] = useState(null);
  const [error, setError] = useState(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Auto-scroll on new message
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, loading, isOpen]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSendMessage = async (textToSend) => {
    const text = (textToSend || inputValue).trim();
    if (!text || loading) return;

    setError(null);
    const userMessage = {
      id: Date.now(),
      sender: 'user',
      text,
      timestamp: new Date().toISOString(),
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInputValue('');
    setLoading(true);

    try {
      // Build conversation history for coherent multi-turn context
      const history = newMessages.slice(-6).map((m) => ({
        role: m.sender === 'user' ? 'user' : 'assistant',
        content: m.text,
      }));

      const res = await aiApi.sendMessage(text, {}, history);
      const resData = res?.data || res || {};

      const assistantText = resData.response || "I processed your request.";
      const assistantSuggestions = resData.suggestions || DEFAULT_SUGGESTIONS.slice(0, 3);
      const actionRequired = Boolean(resData.action_required);
      const actionPayload = resData.action_payload || null;

      const assistantMessage = {
        id: Date.now() + 1,
        sender: 'assistant',
        text: assistantText,
        timestamp: new Date().toISOString(),
        suggestions: assistantSuggestions,
        action_required: actionRequired,
        action_payload: actionPayload,
        action_status: 'PENDING',
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      const msg = err?.response?.data?.message || 'Unable to connect to AI Assistant. Please try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmAction = async (msgId, actionPayload) => {
    if (!actionPayload || executingActionId) return;

    setExecutingActionId(msgId);
    try {
      const res = await aiApi.executeAction(actionPayload);
      const successMsg = res?.message || 'Action executed successfully in CRM.';

      setMessages((prev) =>
        prev.map((m) =>
          m.id === msgId
            ? {
                ...m,
                action_status: 'EXECUTED',
                action_result: successMsg,
              }
            : m
        )
      );
    } catch (err) {
      const errMsg = err?.response?.data?.message || 'Failed to execute action. Please check permissions.';
      setMessages((prev) =>
        prev.map((m) =>
          m.id === msgId
            ? {
                ...m,
                action_status: 'FAILED',
                action_error: errMsg,
              }
            : m
        )
      );
    } finally {
      setExecutingActionId(null);
    }
  };

  const handleCancelAction = (msgId) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === msgId
          ? {
              ...m,
              action_status: 'CANCELLED',
            }
          : m
      )
    );
  };

  const handleClear = () => {
    setMessages([
      {
        id: Date.now(),
        sender: 'assistant',
        text: "Conversation cleared. How can I help you with your CRM today?",
        timestamp: new Date().toISOString(),
        suggestions: DEFAULT_SUGGESTIONS.slice(0, 3),
        action_required: false,
        action_payload: null,
      },
    ]);
    setError(null);
  };

  // Extract current suggestions from the latest assistant message
  const currentSuggestions =
    messages.slice().reverse().find((m) => m.sender === 'assistant' && m.suggestions?.length > 0)
      ?.suggestions || DEFAULT_SUGGESTIONS.slice(0, 3);

  return (
    <div className="ai-chat-drawer" role="dialog" aria-modal="true" aria-label="CRM AI Assistant">
      {/* Header */}
      <div className="chat-header">
        <div className="chat-header-info">
          <div className="chat-avatar-icon">
            <Bot size={18} />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.9375rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
              <span>CRM AI Copilot</span>
              <span className="ai-card-badge" style={{ margin: 0, background: 'var(--primary-subtle)', color: 'var(--primary)' }}>
                Gemini
              </span>
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--success)' }} />
              Live CRM Tools Connected
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
          <button
            type="button"
            className="mobile-close-btn"
            style={{ width: 28, height: 28 }}
            onClick={handleClear}
            title="Clear Conversation"
            aria-label="Clear Conversation"
          >
            <Trash2 size={15} />
          </button>
          <button
            type="button"
            className="mobile-close-btn"
            style={{ width: 28, height: 28 }}
            onClick={onClose}
            title="Close Assistant"
            aria-label="Close Assistant"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Messages Stream */}
      <div className="chat-messages-container">
        {messages.map((msg) => (
          <div key={msg.id} className={`chat-message-row ${msg.sender}`}>
            <div className="message-bubble">
              <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{msg.text}</div>

              {/* ACTION CONFIRMATION CARD */}
              {msg.action_required && msg.action_payload && (
                <div
                  style={{
                    marginTop: '0.75rem',
                    padding: '0.75rem',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-sm)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontWeight: 600, fontSize: '0.8125rem', color: 'var(--primary)', marginBottom: '0.35rem' }}>
                    <ShieldCheck size={16} />
                    <span>CRM Write Action Confirmation</span>
                  </div>

                  <div style={{ fontSize: '0.8125rem', color: 'var(--text-main)', marginBottom: '0.625rem' }}>
                    {msg.action_payload.description}
                  </div>

                  {msg.action_status === 'PENDING' && (
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={() => handleConfirmAction(msg.id, msg.action_payload)}
                        disabled={executingActionId === msg.id}
                        style={{ padding: '0.3rem 0.65rem', fontSize: '0.75rem' }}
                      >
                        <Check size={13} />
                        <span>{executingActionId === msg.id ? 'Applying…' : 'Confirm'}</span>
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleCancelAction(msg.id)}
                        disabled={executingActionId === msg.id}
                        style={{ padding: '0.3rem 0.65rem', fontSize: '0.75rem' }}
                      >
                        Cancel
                      </button>
                    </div>
                  )}

                  {msg.action_status === 'EXECUTED' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--success)', fontSize: '0.8125rem', fontWeight: 600 }}>
                      <CheckCircle2 size={15} />
                      <span>{msg.action_result || 'Action applied to CRM.'}</span>
                    </div>
                  )}

                  {msg.action_status === 'CANCELLED' && (
                    <div style={{ color: 'var(--text-dim)', fontSize: '0.75rem' }}>
                      Action was cancelled.
                    </div>
                  )}

                  {msg.action_status === 'FAILED' && (
                    <div style={{ color: 'var(--danger)', fontSize: '0.75rem' }}>
                      {msg.action_error || 'Action execution failed.'}
                    </div>
                  )}
                </div>
              )}

              <div className="message-timestamp">
                {formatTime(msg.timestamp)}
              </div>
            </div>
          </div>
        ))}

        {/* Thinking indicator */}
        {loading && (
          <div className="chat-message-row assistant">
            <div className="typing-indicator" aria-label="AI is thinking">
              <Sparkles size={14} color="var(--primary)" />
              <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginRight: '0.25rem' }}>AI Copilot is thinking...</span>
              <span className="typing-dot" />
              <span className="typing-dot" />
              <span className="typing-dot" />
            </div>
          </div>
        )}

        {/* Error notification */}
        {error && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.625rem 0.875rem',
              background: 'var(--danger-bg)',
              color: 'var(--danger)',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.8125rem',
            }}
          >
            <AlertCircle size={15} />
            <span>{error}</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Dynamic Suggestions Strip */}
      <div className="chat-suggestions-strip" aria-label="Suggested Questions">
        {currentSuggestions.map((question) => (
          <button
            key={question}
            type="button"
            className="chat-suggestion-chip"
            onClick={() => handleSendMessage(question)}
            disabled={loading}
          >
            {question}
          </button>
        ))}
      </div>

      {/* Input Form */}
      <form
        className="chat-input-area"
        onSubmit={(e) => {
          e.preventDefault();
          handleSendMessage();
        }}
      >
        <input
          ref={inputRef}
          type="text"
          className="chat-input"
          placeholder="Ask about pipeline, overdue tasks, lead summary..."
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          disabled={loading}
          aria-label="Type your message"
        />
        <button
          type="submit"
          className="btn btn-primary"
          style={{ padding: '0.625rem 0.875rem', borderRadius: 'var(--radius-md)' }}
          disabled={!inputValue.trim() || loading}
          title="Send message"
          aria-label="Send message"
        >
          <Send size={15} />
        </button>
      </form>
    </div>
  );
};
