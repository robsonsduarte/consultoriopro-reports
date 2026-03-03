import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { LoginPage } from '@/pages/auth/LoginPage';
import { ForgotPasswordPage } from '@/pages/auth/ForgotPasswordPage';
import { ResetPasswordPage } from '@/pages/auth/ResetPasswordPage';
import { ChangePasswordPage } from '@/pages/auth/ChangePasswordPage';
import { DashboardTablePage } from '@/pages/dashboard/DashboardTablePage';
import { DashboardCardsPage } from '@/pages/dashboard/DashboardCardsPage';
import { ProfessionalDashPage } from '@/pages/dashboard/ProfessionalDashPage';
import { ShiftsPage } from '@/pages/shifts/ShiftsPage';
import { ConfigPage } from '@/pages/config/ConfigPage';
import { UsersPage } from '@/pages/users/UsersPage';
import { ReportPage } from '@/pages/report/ReportPage';
import type { ReactNode } from 'react';

function ProtectedRoute({ children }: { children: ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return children;
}

function GuestRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, user } = useAuthStore();
  if (!isAuthenticated) return children;
  if (user?.role === 'super_admin' || user?.role === 'admin') {
    return <Navigate to="/" replace />;
  }
  return <Navigate to="/dashboard" replace />;
}


export function App() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<GuestRoute><LoginPage /></GuestRoute>} />
      <Route path="/forgot-password" element={<GuestRoute><ForgotPasswordPage /></GuestRoute>} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />

      {/* Protected routes */}
      <Route path="/change-password" element={<ProtectedRoute><ChangePasswordPage /></ProtectedRoute>} />
      <Route path="/" element={<ProtectedRoute><DashboardTablePage /></ProtectedRoute>} />
      <Route path="/dashboard" element={<ProtectedRoute><ProfessionalDashPage /></ProtectedRoute>} />
      <Route path="/dashboard/cards" element={<ProtectedRoute><DashboardCardsPage /></ProtectedRoute>} />
      <Route path="/shifts" element={<ProtectedRoute><ShiftsPage /></ProtectedRoute>} />
      <Route path="/shifts/:id" element={<ProtectedRoute><ShiftsPage /></ProtectedRoute>} />
      <Route path="/config" element={<ProtectedRoute><ConfigPage /></ProtectedRoute>} />
      <Route path="/users" element={<ProtectedRoute><UsersPage /></ProtectedRoute>} />
      <Route path="/report/:id" element={<ProtectedRoute><ReportPage /></ProtectedRoute>} />

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
