// ============================================
// AUTH CONTEXT
// ============================================
// Authentication state management
// ============================================

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from '../../api/axios';
import { showError, showSuccess } from '../../utils/toast';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token') || null);
  const [loading, setLoading] = useState(true);

  // ============================================
  // Mevcut kullanıcı bilgisini yükle
  // ============================================
  const fetchUser = useCallback(async () => {
    try {
      const response = await axios.get('/auth/me');
      // Axios interceptor response.data'yı backend'in data kısmı ile değiştiriyor
      // Yani response.data artık direkt kullanıcı bilgisi
      setUser(response.data);
      setLoading(false);
    } catch (err) {
      console.error('Kullanıcı bilgisi yüklenemedi:', err);
      // Token geçersizse temizle
      if (err.response?.status === 401) {
        localStorage.removeItem('token');
        setToken(null);
        setUser(null);
        delete axios.defaults.headers.common['Authorization'];
      }
      setLoading(false);
    }
  }, []);

  // ============================================
  // Token'ı axios header'ına ekle
  // ============================================
  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      // Mevcut kullanıcı bilgisini yükle
      fetchUser();
    } else {
      delete axios.defaults.headers.common['Authorization'];
      setUser(null);
      setLoading(false);
    }
  }, [token, fetchUser]);

  // ============================================
  // Logout
  // ============================================
  const logout = useCallback(async () => {
    try {
      if (token) {
        await axios.post('/auth/logout');
      }
    } catch (err) {
      console.error('Logout hatası:', err);
    } finally {
      // Her durumda temizle
      localStorage.removeItem('token');
      setToken(null);
      setUser(null);
      delete axios.defaults.headers.common['Authorization'];
    }
  }, [token]);

  // ============================================
  // Login
  // ============================================
  const login = async (kullaniciAdi, sifre) => {
    try {
      setLoading(true);
      const response = await axios.post('/auth/login', {
        kullaniciAdi,
        sifre
      });

      // Axios interceptor response.data'yı backend'in data kısmı ile değiştiriyor
      // Yani response.data artık {token, user} formatında
      // Backend'den gelen format: {success: true, message: '...', data: {token, user}}
      // Interceptor sonrası: response.data = {token, user}
      
      // Token ve user'ı direkt response.data'dan al
      if (!response.data || !response.data.token) {
        console.log('[LOGIN DEBUG] Token bulunamadi, response.data:', response.data);
        showError('Token alınamadı');
        return { success: false, error: 'Token alınamadı' };
      }

      const { token: newToken, user: userData } = response.data;
      
      console.log('[LOGIN DEBUG] Token alindi, kullanici:', userData);
      
      // Token'ı kaydet
      localStorage.setItem('token', newToken);
      setToken(newToken);
      setUser(userData);
      
      showSuccess('Giriş başarılı');
      return { success: true };
    } catch (err) {
      console.error('[LOGIN DEBUG] Catch error:', err);
      console.error('[LOGIN DEBUG] Error response:', err.response);
      const errorMessage = err.response?.data?.message || 'Giriş başarısız';
      showError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  };


  // ============================================
  // Rol kontrolü
  // ============================================
  const isAdmin = user?.rol === 'ADMIN';
  const isUser = user?.rol === 'USER';
  const isAuthenticated = !!user;

  const value = {
    user,
    token,
    loading,
    login,
    logout,
    isAdmin,
    isUser,
    isAuthenticated,
    fetchUser
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
