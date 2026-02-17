// ============================================
// APP PROVIDER
// ============================================
// Tüm provider'ları birleştiren wrapper
// ============================================

import { BrowserRouter } from 'react-router-dom';
import CssBaseline from '@mui/material/CssBaseline';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { ThemeProvider } from '../context/ThemeContext';
import { AppProvider as AppContextProvider } from '../context/AppContext';
import { AuthProvider } from '../context/AuthContext';
import { TOAST_CONFIG } from '../config/constants';

export const AppProvider = ({ children }) => {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <AppContextProvider>
            <CssBaseline />
            <ToastContainer {...TOAST_CONFIG} />
            {children}
          </AppContextProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
};
