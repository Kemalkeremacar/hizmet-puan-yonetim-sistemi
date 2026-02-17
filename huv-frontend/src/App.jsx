// ============================================
// APP COMPONENT
// ============================================
// Ana uygulama component'i - Modern Architecture
// React.lazy ile code splitting
// ============================================

import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Box } from '@mui/material';
import { AppProvider } from './app/providers/AppProvider';
import { ROUTES } from './app/config/constants';
import Layout from './components/layout/Layout';
import { LoadingSpinner, ErrorBoundary } from './components/common';
import ProtectedRoute from './components/common/ProtectedRoute';
import { useAuth } from './app/context/AuthContext';

// ============================================
// Lazy loaded pages (Code Splitting)
// ============================================
const Login = lazy(() => import('./pages/Login'));
const HuvListe = lazy(() => import('./pages/HiyerarsiAgaci'));
const SutListe = lazy(() => import('./pages/SutListe'));
const IlKatsayilariListesi = lazy(() => import('./pages/IlKatsayilariListesi'));
const HuvTarihsel = lazy(() => import('./pages/HuvTarihsel'));
const SutTarihsel = lazy(() => import('./pages/SutTarihsel'));
const HuvYonetimi = lazy(() => import('./pages/HuvYonetimi'));
const SutYonetimi = lazy(() => import('./pages/SutYonetimi'));
const IlKatsayiYonetimi = lazy(() => import('./pages/IlKatsayiYonetimi'));

// ============================================
// App Routes Component
// ============================================
function AppRoutes() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <LoadingSpinner message="Yükleniyor..." />
      </Box>
    );
  }

  return (
    <Routes>
      {/* Public Routes */}
      <Route path={ROUTES.login} element={<Login />} />
      
      {/* Protected Routes - Authenticated Users */}
      <Route path={ROUTES.home} element={
        <ProtectedRoute>
          <HuvListe />
        </ProtectedRoute>
      } />
      <Route path={ROUTES.huvListe} element={
        <ProtectedRoute>
          <HuvListe />
        </ProtectedRoute>
      } />
      <Route path={ROUTES.sutListe} element={
        <ProtectedRoute>
          <SutListe />
        </ProtectedRoute>
      } />
      <Route path={ROUTES.ilKatsayilariListesi} element={
        <ProtectedRoute>
          <IlKatsayilariListesi />
        </ProtectedRoute>
      } />
      <Route path={ROUTES.huvTarihsel} element={
        <ProtectedRoute>
          <HuvTarihsel />
        </ProtectedRoute>
      } />
      <Route path={ROUTES.sutTarihsel} element={
        <ProtectedRoute>
          <SutTarihsel />
        </ProtectedRoute>
      } />
      
      {/* Admin Only Routes */}
      <Route path={ROUTES.huvYonetimi} element={
        <ProtectedRoute adminOnly>
          <HuvYonetimi />
        </ProtectedRoute>
      } />
      <Route path={ROUTES.sutYonetimi} element={
        <ProtectedRoute adminOnly>
          <SutYonetimi />
        </ProtectedRoute>
      } />
      <Route path={ROUTES.ilKatsayiYonetimi} element={
        <ProtectedRoute adminOnly>
          <IlKatsayiYonetimi />
        </ProtectedRoute>
      } />
      
      {/* Default redirect */}
      <Route path="*" element={<Navigate to={isAuthenticated ? ROUTES.home : ROUTES.login} replace />} />
    </Routes>
  );
}

// ============================================
// App Content Component (AppProvider içinde)
// ============================================
function AppContent() {
  const location = useLocation();
  const { loading } = useAuth();

  // Login sayfası Layout olmadan render edilmeli
  const isLoginPage = location.pathname === ROUTES.login;

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <LoadingSpinner message="Yükleniyor..." />
      </Box>
    );
  }

  return (
    <>
      {isLoginPage ? (
        <Suspense fallback={<LoadingSpinner message="Sayfa yükleniyor..." />}>
          <AppRoutes />
        </Suspense>
      ) : (
        <Layout>
          <Suspense fallback={<LoadingSpinner message="Sayfa yükleniyor..." />}>
            <AppRoutes />
          </Suspense>
        </Layout>
      )}
    </>
  );
}

// ============================================
// App Component
// ============================================
function App() {
  return (
    <ErrorBoundary>
      <AppProvider>
        <AppContent />
      </AppProvider>
    </ErrorBoundary>
  );
}

export default App;
