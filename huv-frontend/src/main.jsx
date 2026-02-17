import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// ============================================
// GLOBAL ERROR HANDLERS
// ============================================
// Unhandled promise rejections ve genel hataları yakala
// Browser extension hatalarını filtrele
// ============================================

// Unhandled promise rejection handler
window.addEventListener('unhandledrejection', (event) => {
  // Browser extension hatalarını yoksay
  if (event.reason?.message?.includes('message channel closed') ||
      event.reason?.message?.includes('Extension context invalidated') ||
      event.reason?.message?.includes('A listener indicated an asynchronous response')) {
    event.preventDefault();
    return;
  }
  
  console.error('Unhandled Promise Rejection:', {
    reason: event.reason,
    promise: event.promise,
    timestamp: new Date().toISOString()
  });
  
  // Sadece gerçek hataları göster
  if (event.reason && !event.reason.message?.includes('message channel')) {
    console.error('Promise rejection details:', event.reason);
  }
  
  // Event'i prevent et ki console'da görünmesin
  event.preventDefault();
});

// Global error handler
window.addEventListener('error', (event) => {
  // Browser extension hatalarını yoksay
  if (event.message?.includes('message channel closed') || 
      event.message?.includes('Extension context invalidated') ||
      event.message?.includes('A listener indicated an asynchronous response')) {
    event.preventDefault();
    return;
  }
  
  console.error('Global Error:', {
    message: event.message,
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
    error: event.error,
    timestamp: new Date().toISOString()
  });
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
