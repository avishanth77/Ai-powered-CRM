import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { chatApi } from '../api/chatApi';
import { getInitials, formatTime, formatDate } from '../utils/formatters';
import { extractErrorMessage } from '../utils/validation';
import {
  MessageSquare,
  Send,
  Search,
  Check,
  CheckCheck,
  ArrowLeft,
  User as UserIcon,
  Shield,
  Clock,
  Sparkles,
} from 'lucide-react';
import '../styles/chat.css';

export const Chat = () => {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const { showToast } = useToast();

  const [conversations, setConversations] = useState([]);
  const [activeContact, setActiveContact] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);

  const messagesEndRef = useRef(null);

  // Auto scroll to bottom of chat
  const scrollToBottom = useCallback((smooth = true) => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
    }
  }, []);

  // Fetch all conversations
  const fetchConversations = useCallback(async (silently = false) => {
    if (!silently) setLoadingConversations(true);
    try {
      const res = await chatApi.getConversations();
      if (res.success && res.data) {
        setConversations(res.data);
      }
    } catch (err) {
      if (!silently) {
        showToast(extractErrorMessage(err, 'Failed to load conversations'), 'error');
      }
    } finally {
      if (!silently) setLoadingConversations(false);
    }
  }, [showToast]);

  // Fetch messages with the selected teammate
  const fetchMessages = useCallback(async (targetUserId, silently = false) => {
    if (!targetUserId) return;
    if (!silently) setLoadingMessages(true);
    try {
      const res = await chatApi.getMessages(targetUserId);
      if (res.success && res.data) {
        setMessages(res.data);
        if (res.other_user) {
          setActiveContact((prev) => (prev?.id === res.other_user.id ? prev : res.other_user));
        }
      }
    } catch (err) {
      if (!silently) {
        showToast(extractErrorMessage(err, 'Failed to load messages'), 'error');
      }
    } finally {
      if (!silently) {
        setLoadingMessages(false);
        setTimeout(() => scrollToBottom(false), 100);
      }
    }
  }, [showToast, scrollToBottom]);

  // Initial load
  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // Handle URL param `:userId`
  useEffect(() => {
    if (userId) {
      const targetId = parseInt(userId, 10);
      if (!isNaN(targetId)) {
        fetchMessages(targetId);
      }
    } else if (conversations.length > 0 && !userId) {
      // Default to first contact if none selected
      const first = conversations[0].user;
      setActiveContact(first);
      navigate(`/chat/${first.id}`, { replace: true });
    }
  }, [userId, conversations.length, navigate, fetchMessages]);

  // Live polling (every 6 seconds for new incoming messages)
  useEffect(() => {
    const targetId = userId ? parseInt(userId, 10) : activeContact?.id;
    if (!targetId || isNaN(targetId)) return;

    const timer = setInterval(() => {
      fetchMessages(targetId, true);
      fetchConversations(true);
    }, 6000);

    return () => {
      clearInterval(timer);
    };
  }, [userId, activeContact?.id, fetchMessages, fetchConversations]);

  // Scroll on message change
  useEffect(() => {
    scrollToBottom(true);
  }, [messages.length, scrollToBottom]);

  // Select a teammate to chat with
  const handleSelectContact = (contact) => {
    if (activeContact?.id === contact.id) return;
    setActiveContact(contact);
    navigate(`/chat/${contact.id}`);
  };

  // Send message
  const handleSendMessage = async (e) => {
    if (e) e.preventDefault();
    const cleanText = messageText.trim();
    if (!cleanText || !activeContact || sending) return;

    setSending(true);
    try {
      const res = await chatApi.sendMessage(activeContact.id, cleanText);
      if (res.success && res.data) {
        setMessages((prev) => [...prev, res.data]);
        setMessageText('');
        fetchConversations(true);
        setTimeout(() => scrollToBottom(true), 50);
      }
    } catch (err) {
      showToast(extractErrorMessage(err, 'Failed to send message'), 'error');
    } finally {
      setSending(false);
    }
  };

  // Key press handler (Enter sends, Shift+Enter new line)
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Filter contacts by search query
  const filteredConversations = conversations.filter((c) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const name = (c.user.full_name || '').toLowerCase();
    const email = (c.user.email || '').toLowerCase();
    const role = (c.user.role || '').toLowerCase();
    return name.includes(q) || email.includes(q) || role.includes(q);
  });

  // Group messages by date
  const renderMessagesWithDateHeaders = () => {
    let lastDate = null;
    return messages.map((msg) => {
      const msgDate = new Date(msg.created_at).toLocaleDateString();
      const showDateHeader = msgDate !== lastDate;
      lastDate = msgDate;

      const isMe = msg.is_me;

      return (
        <React.Fragment key={msg.id}>
          {showDateHeader && (
            <div className="chat-date-separator">
              <span className="chat-date-pill">{formatDate(msg.created_at)}</span>
            </div>
          )}

          <div className={`chat-bubble-row ${isMe ? 'outgoing' : 'incoming'}`}>
            <div className="chat-bubble">
              {msg.message}
            </div>
            <div className="chat-bubble-footer">
              <span>{formatTime(msg.created_at)}</span>
              {isMe && (
                <span className="chat-check-read" title={msg.is_read ? 'Seen' : 'Delivered'}>
                  {msg.is_read ? <CheckCheck size={13} /> : <Check size={13} />}
                </span>
              )}
            </div>
          </div>
        </React.Fragment>
      );
    });
  };

  return (
    <div className="page-container" style={{ paddingBottom: 0 }}>
      <div className="page-header" style={{ marginBottom: 0 }}>
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <MessageSquare size={24} color="var(--primary)" />
            <span>Team Chat & Direct Messaging</span>
          </h1>
          <p className="page-subtitle">
            One-on-one direct internal messaging with sales executives, managers & admins.
          </p>
        </div>
      </div>

      <div className="chat-container">
        {/* Left Panel: Contacts & Conversations List */}
        <div className={`chat-sidebar ${activeContact ? 'hidden-mobile' : ''}`}>
          <div className="chat-sidebar-header">
            <div className="chat-sidebar-title-row">
              <h2 className="chat-sidebar-title">
                <span>Teammates</span>
                <span className="badge badge-secondary" style={{ fontSize: '0.6875rem' }}>
                  {filteredConversations.length}
                </span>
              </h2>
            </div>
            <div className="chat-search-wrap">
              <Search size={15} className="chat-search-icon" />
              <input
                type="text"
                className="chat-search-input"
                placeholder="Search colleagues..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="chat-conversation-list">
            {loadingConversations ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-dim)' }}>
                Loading colleagues...
              </div>
            ) : filteredConversations.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-dim)', fontSize: '0.8125rem' }}>
                No teammates found matching "{searchQuery}"
              </div>
            ) : (
              filteredConversations.map((item) => {
                const u = item.user;
                const isSelected = activeContact?.id === u.id;
                return (
                  <div
                    key={u.id}
                    className={`chat-user-item ${isSelected ? 'active' : ''}`}
                    onClick={() => handleSelectContact(u)}
                  >
                    <div className="chat-avatar status-online">
                      {getInitials(u.full_name || u.email)}
                    </div>
                    <div className="chat-user-info">
                      <div className="chat-user-top">
                        <span className="chat-user-name">{u.full_name}</span>
                        {item.last_message_at && (
                          <span className="chat-user-time">{formatTime(item.last_message_at)}</span>
                        )}
                      </div>
                      <div className="chat-user-bottom">
                        <span className="chat-user-snippet">
                          {item.last_message
                            ? (item.last_message_sender_id === currentUser?.id ? 'You: ' : '') + item.last_message
                            : `${u.role.toLowerCase()}`}
                        </span>
                        {item.unread_count > 0 && (
                          <span className="chat-unread-badge">{item.unread_count}</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Panel: Active Chat Stream */}
        <div className={`chat-main ${!activeContact ? 'hidden-mobile' : ''}`}>
          {activeContact ? (
            <>
              {/* Chat Header */}
              <div className="chat-header">
                <div className="chat-header-user">
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ padding: '0.4rem', marginRight: '0.25rem', display: 'flex' }}
                    onClick={() => setActiveContact(null)}
                    title="Back to teammates list"
                  >
                    <ArrowLeft size={16} />
                  </button>

                  <div className="chat-avatar" style={{ width: 36, height: 36, fontSize: '0.75rem' }}>
                    {getInitials(activeContact.full_name || activeContact.email)}
                  </div>
                  <div>
                    <h3 className="chat-header-title">
                      <span>{activeContact.full_name}</span>
                      <span className="badge badge-secondary" style={{ fontSize: '0.6875rem' }}>
                        {activeContact.role}
                      </span>
                    </h3>
                    <div className="chat-header-subtitle">
                      <span>{activeContact.email}</span>
                      <span>•</span>
                      <span style={{ color: 'var(--success)', fontWeight: 600 }}>Active in CRM</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Messages Stream */}
              <div className="chat-messages-container">
                {loadingMessages ? (
                  <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-dim)' }}>
                    Loading conversation...
                  </div>
                ) : messages.length === 0 ? (
                  <div className="chat-empty-state">
                    <div className="chat-empty-icon">
                      <Sparkles size={28} />
                    </div>
                    <h4 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-main)', fontSize: '1rem' }}>
                      Start a 1-on-1 Conversation with {activeContact.full_name}
                    </h4>
                    <p style={{ margin: 0, fontSize: '0.8125rem', maxWidth: '380px' }}>
                      Coordinate on leads, share deal updates, or ask quick questions. Messages are private between you two.
                    </p>
                  </div>
                ) : (
                  <>
                    {renderMessagesWithDateHeaders()}
                    <div ref={messagesEndRef} />
                  </>
                )}
              </div>

              {/* Chat Input Bar */}
              <form onSubmit={handleSendMessage} className="chat-input-bar">
                <textarea
                  className="chat-textarea"
                  placeholder={`Write a message to ${activeContact.full_name}... (Enter to send)`}
                  rows={1}
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={sending}
                  autoFocus
                />
                <button
                  type="submit"
                  className="chat-send-btn"
                  disabled={!messageText.trim() || sending}
                  title="Send message (Enter)"
                >
                  <Send size={18} />
                </button>
              </form>
            </>
          ) : (
            <div className="chat-empty-state">
              <div className="chat-empty-icon">
                <MessageSquare size={32} />
              </div>
              <h3 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-main)' }}>
                Your Direct Team Chat
              </h3>
              <p style={{ margin: 0, fontSize: '0.875rem', maxWidth: '380px' }}>
                Select a teammate from the left sidebar to start or continue a private 1-on-1 conversation.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Chat;
