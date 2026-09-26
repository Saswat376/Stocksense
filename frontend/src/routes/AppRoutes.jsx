import { Route, Routes, Navigate } from 'react-router-dom';
import { useAuth } from '../store/AuthContext.jsx';
import LoginPage         from '../pages/auth/LoginPage.jsx';
import SignupPage        from '../pages/auth/SignupPage.jsx';
import ForgotPasswordPage from '../pages/auth/ForgotPasswordPage.jsx';
import VerifyOtpPage    from '../pages/auth/VerifyOtpPage.jsx';
import ResetPasswordPage from '../pages/auth/ResetPasswordPage.jsx';
import ProtectedRoute   from './ProtectedRoute.jsx';

// Lazy-loaded to keep auth bundle small
import { lazy, Suspense } from 'react';
const DashboardPage   = lazy(() => import('../pages/dashboard/DashboardPage.jsx'));
const ProductListPage = lazy(() => import('../pages/products/ProductListPage.jsx'));

function LoadingFallback() {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#0b0f1a', color: '#00d084', fontFamily: 'Inter, sans-serif',
    }}>
      <span style={{ opacity: 0.6 }}>Loading…</span>
    </div>
  );
}

export default function AppRoutes() {
  const { isAuthenticated } = useAuth();

  return (
    <Suspense fallback={<LoadingFallback />}>
      <Routes>
        {/* Public auth routes — redirect away if already logged in */}
        <Route path="/login"          element={isAuthenticated ? <Navigate to="/" replace /> : <LoginPage />} />
        <Route path="/signup"         element={isAuthenticated ? <Navigate to="/" replace /> : <SignupPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/verify-otp"     element={<VerifyOtpPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />

        {/* Protected routes */}
        <Route element={<ProtectedRoute />}>
          <Route path="/"         element={<DashboardPage />} />
          <Route path="/products" element={<ProductListPage />} />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to={isAuthenticated ? '/' : '/login'} replace />} />
      </Routes>
    </Suspense>
  );
}
