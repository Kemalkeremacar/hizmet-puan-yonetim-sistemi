// ============================================
// PROTECTED ROUTE COMPONENT
// ============================================
// Yetkilendirme kontrolü ile route koruması
// ============================================

import { Navigate } from 'react-router-dom';
import { CircularProgress, Box } from '@mui/material';
import { useAuth } from '../../app/context/AuthContext';
import { ROUTES } from '../../app/config/constants';

// ============================================
// ProtectedRoute Component
// ============================================
// adminOnly: true ise sadece admin erişebilir
// ============================================
function ProtectedRoute({ children, adminOnly = false }) {
  const { isAuthenticated, isAdmin, loading } = useAuth();

  // Loading durumu
  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  // Giriş yapılmamışsa login'e yönlendir
  if (!isAuthenticated) {
    return <Navigate to={ROUTES.login} replace />;
  }

  // Admin yetkisi gerekiyorsa kontrol et
  if (adminOnly && !isAdmin) {
    return <Navigate to={ROUTES.home} replace />;
  }

  return children;
}

export default ProtectedRoute;
