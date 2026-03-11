// ============================================
// TOAST MANAGER - Merkezi Toast Yönetimi
// ============================================
// Tüm toast mesajlarını merkezi olarak yönetir
// Duplicate mesajları önler, konfigürasyonu merkezi tutar
// ============================================

import { toast } from 'react-toastify';
import { TOAST_CONFIG } from '../app/config/constants';

// ============================================
// Aktif toast'ları takip et (duplicate önlemek için)
// ============================================
const activeToasts = new Set();

// ============================================
// Toast ID oluştur (duplicate kontrolü için)
// ============================================
const generateToastId = (type, message) => {
  return `${type}-${message.substring(0, 50)}`;
};

// ============================================
// Duplicate toast kontrolü
// ============================================
const isDuplicate = (toastId) => {
  if (activeToasts.has(toastId)) {
    return true;
  }
  
  activeToasts.add(toastId);
  
  // Toast kapandığında set'ten çıkar
  setTimeout(() => {
    activeToasts.delete(toastId);
  }, TOAST_CONFIG.autoClose + 500);
  
  return false;
};

// ============================================
// Base toast fonksiyonu
// ============================================
const showToast = (type, message, options = {}) => {
  if (!message || typeof message !== 'string') {
    console.warn('Toast message must be a non-empty string');
    return;
  }

  const toastId = generateToastId(type, message);
  
  // Duplicate kontrolü
  if (isDuplicate(toastId)) {
    console.log(`Duplicate toast prevented: ${type} - ${message}`);
    return;
  }

  const config = {
    ...TOAST_CONFIG,
    ...options,
    toastId, // React-toastify'ın kendi duplicate kontrolü için
  };

  switch (type) {
    case 'success':
      return toast.success(message, config);
    case 'error':
      return toast.error(message, { ...config, autoClose: 5000 });
    case 'warning':
      return toast.warning(message, { ...config, autoClose: 4000 });
    case 'info':
      return toast.info(message, config);
    default:
      return toast(message, config);
  }
};

// ============================================
// Public API
// ============================================

export const ToastManager = {
  // Başarı mesajı
  success: (message, options = {}) => {
    return showToast('success', message, options);
  },

  // Hata mesajı
  error: (message, options = {}) => {
    return showToast('error', message, options);
  },

  // Uyarı mesajı
  warning: (message, options = {}) => {
    return showToast('warning', message, options);
  },

  // Bilgi mesajı
  info: (message, options = {}) => {
    return showToast('info', message, options);
  },

  // Promise toast (loading -> success/error)
  promise: (promise, messages, options = {}) => {
    const promiseId = `promise-${Date.now()}`;
    
    if (activeToasts.has(promiseId)) {
      return promise; // Aynı promise zaten çalışıyor
    }
    
    activeToasts.add(promiseId);
    
    return toast.promise(
      promise,
      {
        pending: messages.pending || 'İşlem yapılıyor...',
        success: messages.success || 'İşlem başarılı!',
        error: messages.error || 'İşlem başarısız!',
      },
      {
        ...TOAST_CONFIG,
        ...options,
      }
    ).finally(() => {
      activeToasts.delete(promiseId);
    });
  },

  // Tüm toast'ları temizle
  dismiss: (toastId) => {
    if (toastId) {
      toast.dismiss(toastId);
      activeToasts.delete(toastId);
    } else {
      toast.dismiss();
      activeToasts.clear();
    }
  },

  // Aktif toast sayısını al
  getActiveCount: () => {
    return activeToasts.size;
  },

  // Debug için aktif toast'ları listele
  getActiveToasts: () => {
    return Array.from(activeToasts);
  },
};

// ============================================
// Backward Compatibility (eski API)
// ============================================
export const showSuccess = ToastManager.success;
export const showError = ToastManager.error;
export const showWarning = ToastManager.warning;
export const showInfo = ToastManager.info;
export const showPromise = ToastManager.promise;

// ============================================
// Default export
// ============================================
export default ToastManager;