import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { LoginPage } from '@/pages/auth/LoginPage';
import { ForgotPasswordPage } from '@/pages/auth/ForgotPasswordPage';
import { ResetPasswordPage } from '@/pages/auth/ResetPasswordPage';
import { ChangePasswordPage } from '@/pages/auth/ChangePasswordPage';
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

function PlaceholderPage({ title }: { title: string }) {
  const logout = useAuthStore((s) => s.logout);
  return (
    <div className="min-h-screen bg-muted/40 flex items-center justify-center">
      <div className="bg-card p-8 rounded-lg shadow-md max-w-lg w-full text-center space-y-4">
        <h1 className="text-2xl font-bold">{title}</h1>
        <p className="text-muted-foreground">Tela em construcao</p>
        <button
          onClick={logout}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors underline"
        >
          Sair
        </button>
      </div>
    </div>
  );
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
      <Route path="/" element={<ProtectedRoute><PlaceholderPage title="Dashboard Admin" /></ProtectedRoute>} />
      <Route path="/dashboard" element={<ProtectedRoute><PlaceholderPage title="Dashboard Profissional" /></ProtectedRoute>} />
      <Route path="/dashboard/cards" element={<ProtectedRoute><PlaceholderPage title="Dashboard Cards" /></ProtectedRoute>} />

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
