// ============================================
// TOAST UTILITY - DEPRECATED
// ============================================
// Bu dosya backward compatibility için korunuyor
// Yeni projeler ToastManager kullanmalı
// ============================================

import ToastManager from './toastManager';

// ============================================
// Deprecated: Yeni kod ToastManager kullanmalı
// ============================================
export const showSuccess = ToastManager.success;
export const showError = ToastManager.error;
export const showInfo = ToastManager.info;
export const showWarning = ToastManager.warning;
export const showPromise = ToastManager.promise;

// ============================================
// Yeni API'yi export et
// ============================================
export { default as ToastManager } from './toastManager';
