export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export const USER_ROLES = {
  ADMIN: 'ADMIN',
  MANAGER: 'MANAGER',
  EXECUTIVE: 'EXECUTIVE',
};

export const ROLE_LABELS = {
  ADMIN: 'Admin / Mentor',
  MANAGER: 'Sales Manager',
  EXECUTIVE: 'Sales Executive / Intern',
};

export const LEAD_STATUS = {
  NEW: 'NEW',
  CONTACTED: 'CONTACTED',
  DEMO_SCHEDULED: 'DEMO_SCHEDULED',
  NEGOTIATION: 'NEGOTIATION',
  QUALIFIED: 'QUALIFIED',
  WON: 'WON',
  LOST: 'LOST',
};

export const LEAD_STATUS_CONFIG = {
  NEW: { label: 'New', color: '#0284c7', bg: 'rgba(2, 132, 199, 0.12)', border: '#38bdf8' },
  CONTACTED: { label: 'Contacted', color: '#2563eb', bg: 'rgba(37, 99, 235, 0.12)', border: '#60a5fa' },
  DEMO_SCHEDULED: { label: 'Demo Scheduled', color: '#7c3aed', bg: 'rgba(124, 58, 237, 0.12)', border: '#a78bfa' },
  NEGOTIATION: { label: 'Negotiation', color: '#d97706', bg: 'rgba(217, 119, 6, 0.12)', border: '#fbbf24' },
  QUALIFIED: { label: 'Qualified', color: '#059669', bg: 'rgba(5, 150, 105, 0.12)', border: '#34d399' },
  WON: { label: 'Won', color: '#0d9488', bg: 'rgba(13, 148, 136, 0.15)', border: '#2dd4bf' },
  LOST: { label: 'Lost', color: '#e11d48', bg: 'rgba(225, 29, 72, 0.12)', border: '#fb7185' },
};

export const LEAD_PRIORITY = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  URGENT: 'URGENT',
};

export const LEAD_PRIORITY_CONFIG = {
  LOW: { label: 'Low', color: '#64748b', bg: 'rgba(100, 116, 139, 0.12)' },
  MEDIUM: { label: 'Medium', color: '#0284c7', bg: 'rgba(2, 132, 199, 0.12)' },
  HIGH: { label: 'High', color: '#ea580c', bg: 'rgba(234, 88, 12, 0.12)' },
  URGENT: { label: 'Urgent', color: '#dc2626', bg: 'rgba(220, 38, 38, 0.15)' },
};

export const FOLLOWUP_STATUS = {
  PENDING: 'PENDING',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
  OVERDUE: 'OVERDUE',
};

export const FOLLOWUP_STATUS_CONFIG = {
  PENDING: { label: 'Pending', color: '#0284c7', bg: 'rgba(2, 132, 199, 0.12)' },
  COMPLETED: { label: 'Completed', color: '#059669', bg: 'rgba(5, 150, 105, 0.12)' },
  CANCELLED: { label: 'Cancelled', color: '#64748b', bg: 'rgba(100, 116, 139, 0.12)' },
  OVERDUE: { label: 'Overdue', color: '#dc2626', bg: 'rgba(220, 38, 38, 0.15)' },
};

export const FOLLOWUP_PURPOSES = [
  'Phone Call',
  'WhatsApp',
  'Meeting',
  'Demo',
  'Email',
  'Proposal',
  'Payment Follow-up',
  'Other',
];

export const NOTE_TYPES = [
  { value: 'CALL', label: 'Phone Call', icon: 'Phone' },
  { value: 'WHATSAPP', label: 'WhatsApp', icon: 'MessageSquare' },
  { value: 'EMAIL', label: 'Email', icon: 'Mail' },
  { value: 'MEETING', label: 'Meeting', icon: 'Users' },
  { value: 'DEMO', label: 'Demo', icon: 'Presentation' },
  { value: 'OBJECTION', label: 'Objection', icon: 'ShieldAlert' },
  { value: 'GENERAL', label: 'General Note', icon: 'FileText' },
];
