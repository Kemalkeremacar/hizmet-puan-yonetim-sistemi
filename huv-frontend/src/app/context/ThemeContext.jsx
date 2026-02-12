// ============================================
// THEME CONTEXT
// ============================================
// Dark/Light mode yönetimi
// ============================================

import { createContext, useContext, useState, useMemo, useEffect } from 'react';
import { ThemeProvider as MuiThemeProvider } from '@mui/material/styles';
import { createAppTheme } from '../theme';
import { STORAGE_KEYS } from '../config/constants';

const ThemeContext = createContext();

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
};

export const ThemeProvider = ({ children }) => {
  // LocalStorage'dan tema tercihini al
  const [mode, setMode] = useState(() => {
    const savedMode = localStorage.getItem(STORAGE_KEYS.theme);
    return savedMode || 'light';
  });

  // Tema değiştiğinde localStorage'a kaydet
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.theme, mode);
  }, [mode]);

  // Tema toggle fonksiyonu
  const toggleTheme = () => {
    setMode((prevMode) => (prevMode === 'light' ? 'dark' : 'light'));
  };

  // Tema objesini oluştur
  const theme = useMemo(() => createAppTheme(mode), [mode]);

  const value = {
    mode,
    toggleTheme,
    isDark: mode === 'dark',
  };

  return (
    <ThemeContext.Provider value={value}>
      <MuiThemeProvider theme={theme}>
        {children}
      </MuiThemeProvider>
    </ThemeContext.Provider>
  );
};
