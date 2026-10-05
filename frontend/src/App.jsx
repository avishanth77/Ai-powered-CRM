import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { ThemeProvider } from './context/ThemeContext';
import { followupApi } from './api/followupApi';

import { ProtectedRoute } from './components/ProtectedRoute';
import { RoleGuard } from './components/RoleGuard';
import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';

import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Leads } from './pages/Leads';
import { LeadCreate } from './pages/LeadCreate';
import { LeadEdit } from './pages/LeadEdit';
import { LeadDetails } from './pages/LeadDetails';
import { Pipeline } from './pages/Pipeline';
import { FollowUps } from './pages/FollowUps';
import { Customers } from './pages/Customers';
import { CustomerDetails } from './pages/CustomerDetails';
import { Reports } from './pages/Reports';
import { Users } from './pages/Users';
import { Settings } from './pages/Settings';
import { Notifications } from './pages/Notifications';
import { Calendar } from './pages/Calendar';
import { AiCenter } from './pages/AiCenter';
import { AiCallSummaryPage } from './pages/AiCallSummaryPage';
import { Bot } from 'lucide-react';
import { AiAssistantDrawer } from './components/AiAssistantDrawer';
import { NotFound } from './pages/NotFound';

import './styles/global.css';
import './styles/layout.css';
import './styles/dashboard.css';
import './styles/leads.css';
import './styles/pipeline.css';
import './styles/forms.css';
import './styles/modal.css';
import './styles/responsive.css';
import './styles/notifications.css';
import './styles/calendar.css';
import './styles/ai.css';
import './styles/icp.css';


const AppLayout = () => {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [overdueCount, setOverdueCount] = useState(0);
  const [aiDrawerOpen, setAiDrawerOpen] = useState(false);

  useEffect(() => {
    followupApi
      .getOverdue()
      .then((res) => {
        const count = res.count !== undefined ? res.count : Array.isArray(res.data) ? res.data.length : 0;
        setOverdueCount(count);
      })
      .catch(() => { });
  }, []);

  return (
    <div className="app-layout">
      <Sidebar
        isMobileOpen={mobileSidebarOpen}
        onCloseMobile={() => setMobileSidebarOpen(false)}
      />

      <div className="main-content-wrapper">
        <Navbar
          onToggleMobileSidebar={() => setMobileSidebarOpen(!mobileSidebarOpen)}
          overdueCount={overdueCount}
          mobileSidebarOpen={mobileSidebarOpen}
          onOpenAi={() => setAiDrawerOpen((prev) => !prev)}
          isAiOpen={aiDrawerOpen}
        />
        <main className="page-container">
          <Outlet
            context={{
              onOpenAssistant: () => setAiDrawerOpen(true),
              onCloseAssistant: () => setAiDrawerOpen(false),
              onToggleAssistant: () => setAiDrawerOpen((prev) => !prev),
              isAssistantOpen: aiDrawerOpen,
            }}
          />
        </main>
      </div>

      {/* Floating AI Assistant Trigger Button (Bottom Right) */}
      {!aiDrawerOpen && (
        <button
          type="button"
          className="floating-ai-trigger"
          onClick={() => setAiDrawerOpen(true)}
          title="Open CRM AI Assistant"
          aria-label="Open CRM AI Assistant"
        >
          <Bot size={22} />
        </button>
      )}

      {/* Floating CRM AI Assistant Drawer */}
      <AiAssistantDrawer
        isOpen={aiDrawerOpen}
        onClose={() => setAiDrawerOpen(false)}
      />
    </div>
  );
};

export default function App() {
  return (
    <Router>
      <ThemeProvider>
        <AuthProvider>
          <ToastProvider>
            <Routes>
              <Route path="/login" element={<Login />} />

              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <AppLayout />
                  </ProtectedRoute>
                }
              >
                <Route index element={<Navigate to="/dashboard" replace />} />
                <Route path="dashboard" element={<Dashboard />} />
                <Route path="leads" element={<Leads />} />
                <Route path="leads/create" element={<LeadCreate />} />
                <Route path="leads/:id" element={<LeadDetails />} />
                <Route path="leads/:id/edit" element={<LeadEdit />} />
                <Route path="pipeline" element={<Pipeline />} />
                <Route path="calendar" element={<Calendar />} />
                <Route path="follow-ups" element={<FollowUps />} />
                <Route path="customers" element={<Customers />} />
                <Route path="customers/:id" element={<CustomerDetails />} />
                <Route path="reports" element={<Reports />} />
                <Route
                  path="users"
                  element={
                    <RoleGuard allowedRoles={['ADMIN', 'MANAGER']}>
                      <Users />
                    </RoleGuard>
                  }
                />
                <Route path="settings" element={<Settings />} />
                <Route path="notifications" element={<Notifications />} />
                <Route path="ai" element={<AiCenter />} />
                <Route path="ai/call-summary" element={<AiCallSummaryPage />} />
                <Route path="*" element={<NotFound />} />
              </Route>
            </Routes>
          </ToastProvider>
        </AuthProvider>
      </ThemeProvider>
    </Router>
  );
}
