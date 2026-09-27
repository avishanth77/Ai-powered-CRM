import React, { useState, useEffect, useRef } from 'react';
import { Bot, Send, X, Trash2, Sparkles, User, CornerDownLeft, AlertCircle } from 'lucide-react';
import { aiApi } from '../api/aiApi';
import { MOCK_SUGGESTED_QUESTIONS } from '../services/mockAiService';
import { formatTime } from '../utils/formatters';

export const AiAssistantDrawer = ({ isOpen, onClose }) => {
  const [messages, setMessages] = useState([
    {
      id: 1,
      sender: 'assistant',
      text: "Hello! I'm your CRM AI Assistant.\n\nI can help you explore your CRM, inspect overdue follow-ups, summarize leads, and evaluate your sales pipeline.",
      timestamp: new Date().toISOString(),
      suggestions: MOCK_SUGGESTED_QUESTIONS.slice(0, 3),
    },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
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

    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setLoading(true);

    try {
      const res = await aiApi.sendMessage(text);
      const assistantText = res?.data?.response || res?.response || "I couldn't process that query.";
      const assistantSuggestions = res?.data?.suggestions || [];

      const assistantMessage = {
        id: Date.now() + 1,
        sender: 'assistant',
        text: assistantText,
        timestamp: new Date().toISOString(),
        suggestions: assistantSuggestions,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch {
      setError('Unable to process your request. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setMessages([
      {
        id: Date.now(),
        sender: 'assistant',
        text: "Conversation cleared. How can I help you with your CRM today?",
        timestamp: new Date().toISOString(),
        suggestions: MOCK_SUGGESTED_QUESTIONS.slice(0, 3),
      },
    ]);
    setError(null);
  };

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
              <span>CRM AI Assistant</span>
              <span className="ai-card-badge" style={{ margin: 0 }}>Demo</span>
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--primary)' }} />
              Active Copilot
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

      {/* Messages */}
      <div className="chat-messages-container">
        {messages.map((msg) => (
          <div key={msg.id} className={`chat-message-row ${msg.sender}`}>
            <div className="message-bubble">
              <div style={{ whiteSpace: 'pre-wrap' }}>{msg.text}</div>
              <div className="message-timestamp">
                {formatTime(msg.timestamp)}
              </div>
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {loading && (
          <div className="chat-message-row assistant">
            <div className="typing-indicator" aria-label="AI is thinking">
              <Sparkles size={14} color="var(--primary)" />
              <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginRight: '0.25rem' }}>AI is thinking...</span>
              <span className="typing-dot" />
              <span className="typing-dot" />
              <span className="typing-dot" />
            </div>
          </div>
        )}

        {/* Error notice */}
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

      {/* Suggestions Strip */}
      <div className="chat-suggestions-strip" aria-label="Suggested Questions">
        {MOCK_SUGGESTED_QUESTIONS.map((question) => (
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
          placeholder="Ask something about leads, overdue tasks, pipeline..."
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
