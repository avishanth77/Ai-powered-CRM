import React, { useState, useRef, useEffect, useCallback } from 'react';
import { AtSign, Send, X } from 'lucide-react';
import { commentApi } from '../api/commentApi';
import { getInitials } from '../utils/formatters';

export const MentionInput = ({
  placeholder = "Write an internal team comment... Use @ to mention a colleague",
  submitLabel = "Post Comment",
  onSubmit,
  onCancel = null,
  initialContent = "",
  initialMentionIds = [],
  autoFocus = false,
}) => {
  const [content, setContent] = useState(initialContent);
  const [mentionedUserIds, setMentionedUserIds] = useState(initialMentionIds);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestionQuery, setSuggestionQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [mentionStartIndex, setMentionStartIndex] = useState(-1);
  const [submitting, setSubmitting] = useState(false);

  const textareaRef = useRef(null);
  const dropdownRef = useRef(null);

  // Fetch suggestions when query changes
  useEffect(() => {
    if (!showSuggestions) return;

    let isCurrent = true;
    const fetchSuggestions = async () => {
      try {
        const users = await commentApi.getMentionSuggestions(suggestionQuery);
        if (isCurrent) {
          setSuggestions(Array.isArray(users) ? users : []);
          setSelectedIndex(0);
        }
      } catch (err) {
        console.error('Failed to load mention suggestions:', err);
      }
    };

    fetchSuggestions();
    return () => {
      isCurrent = false;
    };
  }, [showSuggestions, suggestionQuery]);

  const handleInputChange = (e) => {
    const val = e.target.value;
    const cursorPos = e.target.selectionStart;
    setContent(val);

    // Look back from cursor to find if we're inside an '@mention'
    const textBeforeCursor = val.slice(0, cursorPos);
    const lastAtIdx = textBeforeCursor.lastIndexOf('@');

    if (lastAtIdx !== -1) {
      // Ensure '@' is at the start of text or preceded by whitespace
      const charBeforeAt = lastAtIdx === 0 ? ' ' : textBeforeCursor[lastAtIdx - 1];
      const textAfterAt = textBeforeCursor.slice(lastAtIdx + 1);

      // Only trigger if no newline and preceded by whitespace
      if ((charBeforeAt === ' ' || charBeforeAt === '\n') && !textAfterAt.includes(' ') && !textAfterAt.includes('\n')) {
        setMentionStartIndex(lastAtIdx);
        setSuggestionQuery(textAfterAt);
        setShowSuggestions(true);
        return;
      }
    }

    setShowSuggestions(false);
  };

  const insertMention = (user) => {
    if (mentionStartIndex === -1 || !textareaRef.current) return;

    const displayName = user.full_name || user.email;
    const before = content.slice(0, mentionStartIndex);
    const cursorPos = textareaRef.current.selectionStart;
    const after = content.slice(cursorPos);

    const newContent = `${before}@${displayName} ${after}`;
    setContent(newContent);
    setMentionedUserIds((prev) => Array.from(new Set([...prev, user.id])));
    setShowSuggestions(false);

    // Reset focus and cursor
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        const newCursorPos = before.length + displayName.length + 2;
        textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
      }
    }, 10);
  };

  const handleKeyDown = (e) => {
    if (showSuggestions && suggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % suggestions.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        if (suggestions[selectedIndex]) {
          insertMention(suggestions[selectedIndex]);
        }
        return;
      }
      if (e.key === 'Escape') {
        setShowSuggestions(false);
        return;
      }
    }

    // Ctrl+Enter or Cmd+Enter to submit
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!content.trim() || submitting) return;

    setSubmitting(true);
    try {
      await onSubmit({
        content: content.trim(),
        mentioned_user_ids: mentionedUserIds,
      });
      setContent('');
      setMentionedUserIds([]);
      setShowSuggestions(false);
    } catch (err) {
      console.error('Error submitting comment:', err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mention-input-wrapper">
      {/* Floating Suggestions List */}
      {showSuggestions && suggestions.length > 0 && (
        <div className="mention-suggestions-dropdown" ref={dropdownRef}>
          {suggestions.map((u, idx) => (
            <div
              key={u.id}
              className={`mention-suggestion-item ${idx === selectedIndex ? 'selected' : ''}`}
              onMouseDown={(e) => {
                e.preventDefault();
                insertMention(u);
              }}
            >
              <div className="mention-suggestion-avatar">
                {getInitials(u.full_name || u.email)}
              </div>
              <div className="mention-suggestion-info">
                <span className="mention-suggestion-name">{u.full_name || u.email}</span>
                <span className="mention-suggestion-role">{u.role}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <textarea
        ref={textareaRef}
        className="mention-textarea"
        placeholder={placeholder}
        value={content}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        autoFocus={autoFocus}
        disabled={submitting}
        rows={3}
      />

      <div className="comment-input-footer">
        <div className="comment-hint">
          <AtSign size={13} style={{ color: 'var(--accent-purple)' }} />
          <span>Type @ to mention teammates</span>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          {onCancel && (
            <button
              type="button"
              className="btn btn-secondary"
              style={{ fontSize: '0.8rem', padding: '6px 12px' }}
              onClick={onCancel}
              disabled={submitting}
            >
              Cancel
            </button>
          )}
          <button
            type="button"
            className="btn btn-primary"
            style={{ fontSize: '0.8rem', padding: '6px 14px', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
            onClick={handleSubmit}
            disabled={!content.trim() || submitting}
          >
            <Send size={13} />
            <span>{submitting ? 'Posting...' : submitLabel}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
