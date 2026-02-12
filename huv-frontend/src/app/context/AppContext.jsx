// ============================================
// APP CONTEXT
// ============================================
// Global uygulama state yönetimi
// ============================================

import { createContext, useContext, useState, useCallback } from 'react';

const AppContext = createContext();

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within AppProvider');
  }
  return context;
};

export const AppProvider = ({ children }) => {
  // Sidebar state
  const [sidebarOpen, setSidebarOpen] = useState(true);
  
  // Loading state
  const [globalLoading, setGlobalLoading] = useState(false);
  
  // User state (future authentication)
  const [user, setUser] = useState(null);
  
  // Breadcrumb state
  const [breadcrumbs, setBreadcrumbs] = useState([]);

  // Sidebar toggle
  const toggleSidebar = useCallback(() => {
    setSidebarOpen((prev) => !prev);
  }, []);

  // Set loading
  const setLoading = useCallback((loading) => {
    setGlobalLoading(loading);
  }, []);

  // Update breadcrumbs
  const updateBreadcrumbs = useCallback((crumbs) => {
    setBreadcrumbs(crumbs);
  }, []);

  const value = {
    // Sidebar
    sidebarOpen,
    setSidebarOpen,
    toggleSidebar,
    
    // Loading
    globalLoading,
    setLoading,
    
    // User
    user,
    setUser,
    
    // Breadcrumbs
    breadcrumbs,
    updateBreadcrumbs,
  };

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
};
