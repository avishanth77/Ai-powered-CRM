import api from './axios';

export const chatApi = {
  // Get all active team conversations
  getConversations: async () => {
    const res = await api.get('/api/chat/conversations/');
    return res.data;
  },

  // Get message history with a specific teammate
  getMessages: async (userId) => {
    const res = await api.get(`/api/chat/messages/?user_id=${userId}`);
    return res.data;
  },

  // Send a direct message to a teammate
  sendMessage: async (recipientId, message) => {
    const res = await api.post('/api/chat/messages/', {
      recipient: recipientId,
      message,
    });
    return res.data;
  },

  // Mark all messages from a teammate as read
  markRead: async (senderId) => {
    const res = await api.post('/api/chat/messages/mark-read/', {
      sender_id: senderId,
    });
    return res.data;
  },

  // Get total unread direct message count
  getUnreadCount: async () => {
    const res = await api.get('/api/chat/unread-count/');
    return res.data;
  },
};
