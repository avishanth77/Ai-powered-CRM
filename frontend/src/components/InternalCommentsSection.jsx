import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  MessageSquare,
  Lock,
  Reply,
  Edit2,
  Trash2,
  Check,
  X,
  AlertCircle
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { commentApi } from '../api/commentApi';
import { MentionInput } from './MentionInput';
import { getInitials } from '../utils/formatters';

export const InternalCommentsSection = ({ leadId }) => {
  const { user, isAdmin, isManager } = useAuth();
  const { showToast } = useToast();

  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [replyingToId, setReplyingToId] = useState(null);
  const [editingCommentId, setEditingCommentId] = useState(null);

  const fetchComments = useCallback(async () => {
    if (!leadId) return;
    setLoading(true);
    try {
      const res = await commentApi.getLeadComments(leadId);
      setComments(res.results || []);
    } catch (err) {
      console.error('Failed to load internal comments:', err);
    } finally {
      setLoading(false);
    }
  }, [leadId]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  // Build tree of comments (parents and nested replies)
  const commentTree = useMemo(() => {
    const parentMap = {};
    const rootComments = [];

    // Separate roots and replies
    comments.forEach((c) => {
      if (!c.parent) {
        rootComments.push({ ...c, replies: [] });
      } else {
        if (!parentMap[c.parent]) parentMap[c.parent] = [];
        parentMap[c.parent].push(c);
      }
    });

    // Attach replies to roots
    rootComments.forEach((root) => {
      root.replies = parentMap[root.id] || [];
    });

    return rootComments;
  }, [comments]);

  // Handle post root comment
  const handleCreateRootComment = async ({ content, mentioned_user_ids }) => {
    try {
      const created = await commentApi.createComment(leadId, {
        content,
        mentioned_user_ids,
      });
      setComments((prev) => [...prev, created]);
      showToast('Internal comment posted', 'success');
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to post comment', 'error');
      throw err;
    }
  };

  // Handle post reply
  const handleCreateReply = async (parentId, { content, mentioned_user_ids }) => {
    try {
      const created = await commentApi.createComment(leadId, {
        content,
        parent: parentId,
        mentioned_user_ids,
      });
      setComments((prev) => [...prev, created]);
      setReplyingToId(null);
      showToast('Reply posted', 'success');
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to post reply', 'error');
      throw err;
    }
  };

  // Handle edit comment
  const handleUpdateComment = async (commentId, { content, mentioned_user_ids }) => {
    try {
      const updated = await commentApi.updateComment(commentId, {
        content,
        mentioned_user_ids,
      });
      setComments((prev) =>
        prev.map((c) => (c.id === commentId ? updated : c))
      );
      setEditingCommentId(null);
      showToast('Comment updated', 'success');
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to update comment', 'error');
      throw err;
    }
  };

  // Handle delete comment
  const handleDeleteComment = async (commentId) => {
    if (!window.confirm('Are you sure you want to delete this comment?')) return;
    try {
      await commentApi.deleteComment(commentId);
      setComments((prev) =>
        prev.map((c) =>
          c.id === commentId
            ? { ...c, is_deleted: true, display_content: '[This comment has been deleted]' }
            : c
        )
      );
      showToast('Comment deleted', 'info');
    } catch (err) {
      showToast('Failed to delete comment', 'error');
    }
  };

  const formatRelativeTime = (isoString) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    const now = new Date();
    const diffSecs = Math.floor((now - date) / 1000);

    if (diffSecs < 60) return 'Just now';
    const diffMins = Math.floor(diffSecs / 60);
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return 'Yesterday';
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  // Render text highlighting @mentions
  const renderFormattedContent = (text) => {
    if (!text) return null;
    const parts = text.split(/(@[a-zA-Z0-9_.-]+(?:\s[a-zA-Z0-9_.-]+)?)/g);

    return parts.map((part, index) => {
      if (part.startsWith('@')) {
        return (
          <span key={index} className="mention-pill">
            {part}
          </span>
        );
      }
      return part;
    });
  };

  // Comment Node Renderer (used for root and replies)
  const renderCommentCard = (comment, isReply = false) => {
    const isAuthor = user?.id === comment.author;
    const canManage = isAuthor || isAdmin || isManager;
    const isEditing = editingCommentId === comment.id;

    return (
      <div key={comment.id} className="comment-node" style={isReply ? { background: 'var(--bg-surface-elevated)' } : {}}>
        <div className="comment-header">
          <div className="comment-author-group">
            <div className="comment-avatar">
              {getInitials(comment.author_details?.full_name || comment.author_details?.email)}
            </div>
            <div>
              <span className="comment-author-name">
                {comment.author_details?.full_name || comment.author_details?.email}
              </span>
              {comment.author_details?.role && (
                <span className="comment-author-role" style={{ marginLeft: '6px' }}>
                  {comment.author_details.role.toLowerCase()}
                </span>
              )}
            </div>
          </div>

          <div className="comment-meta-group">
            <span>{formatRelativeTime(comment.created_at)}</span>
            {comment.is_edited && !comment.is_deleted && (
              <span className="comment-edited-badge">(edited)</span>
            )}
          </div>
        </div>

        {/* Comment Content / Edit Form */}
        {isEditing ? (
          <div style={{ marginTop: '8px' }}>
            <MentionInput
              initialContent={comment.content}
              submitLabel="Save Edit"
              onSubmit={(data) => handleUpdateComment(comment.id, data)}
              onCancel={() => setEditingCommentId(null)}
              autoFocus
            />
          </div>
        ) : (
          <div className={`comment-body ${comment.is_deleted ? 'deleted' : ''}`}>
            {comment.is_deleted
              ? '[This comment has been deleted]'
              : renderFormattedContent(comment.content)}
          </div>
        )}

        {/* Actions Bar (Reply, Edit, Delete) */}
        {!isEditing && !comment.is_deleted && (
          <div className="comment-actions-bar">
            {!isReply && (
              <button
                type="button"
                className="comment-btn"
                onClick={() =>
                  setReplyingToId(replyingToId === comment.id ? null : comment.id)
                }
              >
                <Reply size={13} />
                <span>Reply</span>
              </button>
            )}

            {canManage && (
              <>
                <button
                  type="button"
                  className="comment-btn"
                  onClick={() => setEditingCommentId(comment.id)}
                >
                  <Edit2 size={13} />
                  <span>Edit</span>
                </button>
                <button
                  type="button"
                  className="comment-btn delete"
                  onClick={() => handleDeleteComment(comment.id)}
                >
                  <Trash2 size={13} />
                  <span>Delete</span>
                </button>
              </>
            )}
          </div>
        )}

        {/* Reply Input Box */}
        {replyingToId === comment.id && (
          <div className="reply-input-box">
            <MentionInput
              placeholder={`Replying to ${comment.author_details?.full_name || 'comment'}...`}
              submitLabel="Post Reply"
              onSubmit={(data) => handleCreateReply(comment.id, data)}
              onCancel={() => setReplyingToId(null)}
              autoFocus
            />
          </div>
        )}

        {/* Render Nested Replies */}
        {comment.replies && comment.replies.length > 0 && (
          <div className="comment-replies-list">
            {comment.replies.map((reply) => renderCommentCard(reply, true))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="internal-comments-container">
      {/* Privacy Guarantee Notice */}
      <div className="internal-badge-banner">
        <Lock size={15} />
        <div>
          <strong>Internal Team Discussion</strong> — These comments are visible only to internal CRM users. They are strictly excluded from customer communication and external emails.
        </div>
      </div>

      {/* Main Comment Composer */}
      <div className="comment-input-card">
        <MentionInput
          placeholder="Share an internal update, ask a question, or @mention a team member..."
          submitLabel="Post Internal Comment"
          onSubmit={handleCreateRootComment}
        />
      </div>

      {/* Comments List */}
      <div className="comments-list">
        {loading ? (
          <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-dim)' }}>
            Loading internal discussion...
          </div>
        ) : commentTree.length === 0 ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '16px' }}>
            <MessageSquare size={32} style={{ color: 'var(--text-dim)', opacity: 0.5, marginBottom: '8px' }} />
            <h4 style={{ margin: '4px 0', color: 'var(--text-main)' }}>No internal comments yet</h4>
            <p style={{ margin: 0, fontSize: '0.84rem', color: 'var(--text-muted)' }}>
              Use this space to collaborate with your team, request discount approvals, or leave notes for other executives.
            </p>
          </div>
        ) : (
          commentTree.map((rootComment) => renderCommentCard(rootComment))
        )}
      </div>
    </div>
  );
};
