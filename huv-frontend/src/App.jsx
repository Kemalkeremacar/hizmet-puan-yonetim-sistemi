// ============================================
// APP COMPONENT
// ============================================
// Ana uygulama component'i - Modern Architecture
// React.lazy ile code splitting
// ============================================

import { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import { AppProvider } from './app/providers/AppProvider';
import { ROUTES } from './app/config/constants';
import Layout from './components/layout/Layout';
import { LoadingSpinner, ErrorBoundary } from './components/common';

// ============================================
// Lazy loaded pages (Code Splitting)
// ============================================
const HuvListe = lazy(() => import('./pages/HiyerarsiAgaci'));
const SutListe = lazy(() => import('./pages/SutListe'));
const HuvTarihsel = lazy(() => import('./pages/HuvTarihsel'));
const SutTarihsel = lazy(() => import('./pages/SutTarihsel'));
const HuvYonetimi = lazy(() => import('./pages/HuvYonetimi'));
const SutYonetimi = lazy(() => import('./pages/SutYonetimi'));

// ============================================
// App Component
// ============================================
function App() {
  return (
    <ErrorBoundary>
      <AppProvider>
        <Layout>
          <Suspense fallback={<LoadingSpinner message="Sayfa yükleniyor..." />}>
            <Routes>
              <Route path={ROUTES.home} element={<HuvListe />} />
              <Route path={ROUTES.huvListe} element={<HuvListe />} />
              <Route path={ROUTES.sutListe} element={<SutListe />} />
              <Route path={ROUTES.huvTarihsel} element={<HuvTarihsel />} />
              <Route path={ROUTES.sutTarihsel} element={<SutTarihsel />} />
              <Route path={ROUTES.huvYonetimi} element={<HuvYonetimi />} />
              <Route path={ROUTES.sutYonetimi} element={<SutYonetimi />} />
            </Routes>
          </Suspense>
        </Layout>
      </AppProvider>
    </ErrorBoundary>
  );
}

export default App;
