// ============================================
// LOGIN SAYFASI
// ============================================
// Modern ve kullanıcı dostu giriş sayfası
// ============================================

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Box,
  Paper,
  TextField,
  Button,
  Typography,
  Alert,
  CircularProgress,
  Card,
  CardContent,
  InputAdornment,
  Fade,
  Stack,
  Divider,
  Chip,
  Backdrop
} from '@mui/material';
import {
  Login as LoginIcon,
  Person as PersonIcon,
  Lock as LockIcon,
  AdminPanelSettings as AdminIcon,
  PersonOutline as UserIcon
} from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';
import { useAuth } from '../app/context/AuthContext';
import { ROUTES } from '../app/config/constants';

// ============================================
// Login Component
// ============================================
function Login() {
  const [kullaniciAdi, setKullaniciAdi] = useState('');
  const [sifre, setSifre] = useState('');
  const [error, setError] = useState('');
  const { login, isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();
  const theme = useTheme();

  // ============================================
  // Zaten giriş yapılmışsa yönlendir
  // ============================================
  useEffect(() => {
    if (isAuthenticated && !loading) {
      navigate(ROUTES.home);
    }
  }, [isAuthenticated, loading, navigate]);

  // ============================================
  // Form submit
  // ============================================
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!kullaniciAdi || !sifre) {
      setError('Lütfen kullanıcı adı ve şifrenizi girin');
      return;
    }

    const result = await login(kullaniciAdi, sifre);
    
    if (result.success) {
      // Güzel geçiş için kısa bir gecikme
      setTimeout(() => {
        navigate(ROUTES.home);
      }, 500);
    } else {
      setError(result.error || 'Giriş başarısız');
    }
  };

  // ============================================
  // Test kullanıcısı ile hızlı giriş
  // ============================================
  const handleQuickLogin = async (username, password) => {
    setKullaniciAdi(username);
    setSifre(password);
    setError('');
    
    const result = await login(username, password);
    if (result.success) {
      // Güzel geçiş için kısa bir gecikme
      setTimeout(() => {
        navigate(ROUTES.home);
      }, 500);
    } else {
      setError(result.error || 'Giriş başarısız');
    }
  };

  // ============================================
  // Render
  // ============================================
  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: theme.palette.mode === 'dark'
          ? 'linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%)'
          : 'linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%)',
        position: 'relative',
        overflow: 'hidden',
        '&::before': {
          content: '""',
          position: 'absolute',
          width: '200%',
          height: '200%',
          background: 'radial-gradient(circle, rgba(255,255,255,0.1) 1px, transparent 1px)',
          backgroundSize: '50px 50px',
          animation: 'float 20s ease-in-out infinite',
          '@keyframes float': {
            '0%, 100%': { transform: 'translate(0, 0) rotate(0deg)' },
            '50%': { transform: 'translate(-50px, -50px) rotate(180deg)' },
          },
        },
      }}
    >
      <Container maxWidth="sm" sx={{ position: 'relative', zIndex: 1 }}>
        <Fade in={!loading} timeout={600}>
          <Card
            elevation={24}
            sx={{
              borderRadius: 4,
              overflow: 'hidden',
              background: theme.palette.mode === 'dark'
                ? 'rgba(30, 30, 30, 0.95)'
                : 'rgba(255, 255, 255, 0.95)',
              backdropFilter: 'blur(10px)',
              position: 'relative',
              opacity: loading ? 0.6 : 1,
              transition: 'opacity 0.3s ease',
            }}
          >
            {/* Header Section */}
            <Box
              sx={{
                background: 'linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%)',
                p: 4,
                textAlign: 'center',
                color: 'white',
              }}
            >
              <Box
                sx={{
                  display: 'inline-flex',
                  p: 2,
                  borderRadius: '50%',
                  bgcolor: 'rgba(255, 255, 255, 0.2)',
                  mb: 2,
                  backdropFilter: 'blur(10px)',
                }}
              >
                <LoginIcon sx={{ fontSize: 48 }} />
              </Box>
              <Typography variant="h4" component="h1" fontWeight="700" gutterBottom>
                HUV Yönetim Sistemi
              </Typography>
              <Typography variant="body1" sx={{ opacity: 0.9 }}>
                Lütfen giriş yapın
              </Typography>
            </Box>

            <CardContent sx={{ p: 4 }}>
              {error && (
                <Alert
                  severity="error"
                  sx={{
                    mb: 3,
                    borderRadius: 2,
                    '& .MuiAlert-icon': {
                      alignItems: 'center',
                    },
                  }}
                >
                  {error}
                </Alert>
              )}

              <Box component="form" onSubmit={handleSubmit}>
                <TextField
                  fullWidth
                  label="Kullanıcı Adı"
                  value={kullaniciAdi}
                  onChange={(e) => setKullaniciAdi(e.target.value)}
                  margin="normal"
                  required
                  autoFocus
                  disabled={loading}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <PersonIcon color="action" />
                      </InputAdornment>
                    ),
                  }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 2,
                    },
                  }}
                />
                <TextField
                  fullWidth
                  label="Şifre"
                  type="password"
                  value={sifre}
                  onChange={(e) => setSifre(e.target.value)}
                  margin="normal"
                  required
                  disabled={loading}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <LockIcon color="action" />
                      </InputAdornment>
                    ),
                  }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 2,
                    },
                  }}
                />
                <Button
                  type="submit"
                  fullWidth
                  variant="contained"
                  size="large"
                  disabled={loading}
                  sx={{
                    mt: 3,
                    mb: 2,
                    py: 1.5,
                    borderRadius: 2,
                    background: 'linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%)',
                    fontWeight: 600,
                    fontSize: '1rem',
                    textTransform: 'none',
                    boxShadow: '0 4px 15px rgba(59, 130, 246, 0.4)',
                    '&:hover': {
                      background: 'linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)',
                      boxShadow: '0 6px 20px rgba(59, 130, 246, 0.6)',
                      transform: 'translateY(-2px)',
                    },
                    '&:disabled': {
                      background: 'linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%)',
                    },
                    transition: 'all 0.3s ease',
                  }}
                >
                  {loading ? (
                    <CircularProgress size={24} sx={{ color: 'white' }} />
                  ) : (
                    'Giriş Yap'
                  )}
                </Button>
              </Box>

              <Divider sx={{ my: 3 }}>
                <Chip label="Test Kullanıcıları" size="small" />
              </Divider>

              <Stack spacing={2}>
                <Button
                  variant="outlined"
                  fullWidth
                  startIcon={<AdminIcon />}
                  onClick={() => handleQuickLogin('admin', 'admin123')}
                  disabled={loading}
                  sx={{
                    py: 1.5,
                    borderRadius: 2,
                    textTransform: 'none',
                    borderColor: 'primary.main',
                    '&:hover': {
                      borderColor: 'primary.dark',
                      bgcolor: 'primary.light',
                      color: 'white',
                    },
                  }}
                >
                  <Box sx={{ flex: 1, textAlign: 'left' }}>
                    <Typography variant="body2" fontWeight="600">
                      Admin
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      admin / admin123
                    </Typography>
                  </Box>
                </Button>

                <Button
                  variant="outlined"
                  fullWidth
                  startIcon={<UserIcon />}
                  onClick={() => handleQuickLogin('user', 'user123')}
                  disabled={loading}
                  sx={{
                    py: 1.5,
                    borderRadius: 2,
                    textTransform: 'none',
                    borderColor: 'primary.main',
                    '&:hover': {
                      borderColor: 'primary.dark',
                      bgcolor: 'primary.light',
                      color: 'white',
                    },
                  }}
                >
                  <Box sx={{ flex: 1, textAlign: 'left' }}>
                    <Typography variant="body2" fontWeight="600">
                      User
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      user / user123
                    </Typography>
                  </Box>
                </Button>
              </Stack>
            </CardContent>
          </Card>
        </Fade>
        
        {/* Loading Overlay - Güzel geçiş animasyonu */}
        <Backdrop
          open={loading}
          sx={{
            position: 'absolute',
            zIndex: 2,
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            backdropFilter: 'blur(4px)',
            transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        >
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 2,
            }}
          >
            <CircularProgress 
              size={60} 
              thickness={4}
              sx={{ 
                color: '#3b82f6',
                '& .MuiCircularProgress-circle': {
                  strokeLinecap: 'round',
                },
              }} 
            />
            <Typography 
              variant="h6" 
              sx={{ 
                color: '#3b82f6',
                fontWeight: 600,
                animation: 'pulse 2s ease-in-out infinite',
                '@keyframes pulse': {
                  '0%, 100%': { opacity: 1 },
                  '50%': { opacity: 0.6 },
                },
              }}
            >
              Giriş yapılıyor...
            </Typography>
          </Box>
        </Backdrop>
      </Container>
    </Box>
  );
}

export default Login;
