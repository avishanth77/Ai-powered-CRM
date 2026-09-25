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
import { NotFound } from './pages/NotFound';

import './styles/global.css';
import './styles/layout.css';
import './styles/dashboard.css';
import './styles/leads.css';
import './styles/pipeline.css';
import './styles/forms.css';
import './styles/modal.css';
import './styles/responsive.css';


const AppLayout = () => {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [overdueCount, setOverdueCount] = useState(0);

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
        />
        <main className="page-container">
          <Outlet />
        </main>
      </div>
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
                <Route path="*" element={<NotFound />} />
              </Route>
            </Routes>
          </ToastProvider>
        </AuthProvider>
      </ThemeProvider>
    </Router>
  );
}
