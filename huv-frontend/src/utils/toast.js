// ============================================
// TOAST NOTIFICATION UTILITY
// ============================================
// Başarı, hata, bilgi mesajları için toast sistemi
// ============================================

import { toast } from 'react-toastify';

// ============================================
// Başarı mesajı
// ============================================
export const showSuccess = (message) => {
  toast.success(message, {
    position: 'top-right',
    autoClose: 3000,
    hideProgressBar: false,
    closeOnClick: true,
    pauseOnHover: true,
    draggable: true,
  });
};

// ============================================
// Hata mesajı
// ============================================
export const showError = (message) => {
  toast.error(message, {
    position: 'top-right',
    autoClose: 5000,
    hideProgressBar: false,
    closeOnClick: true,
    pauseOnHover: true,
    draggable: true,
  });
};

// ============================================
// Bilgi mesajı
// ============================================
export const showInfo = (message) => {
  toast.info(message, {
    position: 'top-right',
    autoClose: 3000,
    hideProgressBar: false,
    closeOnClick: true,
    pauseOnHover: true,
    draggable: true,
  });
};

// ============================================
// Uyarı mesajı
// ============================================
export const showWarning = (message) => {
  toast.warning(message, {
    position: 'top-right',
    autoClose: 4000,
    hideProgressBar: false,
    closeOnClick: true,
    pauseOnHover: true,
    draggable: true,
  });
};

// ============================================
// Promise toast (loading -> success/error)
// ============================================
export const showPromise = (promise, messages) => {
  return toast.promise(
    promise,
    {
      pending: messages.pending || 'İşlem yapılıyor...',
      success: messages.success || 'İşlem başarılı!',
      error: messages.error || 'İşlem başarısız!',
    },
    {
      position: 'top-right',
    }
  );
};
