// ============================================
// AXIOS CONFIGURATION
// ============================================
// Backend API ile iletişim için Axios setup
// Base URL: http://localhost:3000/api
// ============================================

import axios from 'axios';
import ToastManager from '../utils/toastManager';

/**
 * Bozuk karakter kontrolü - Performans için önce kontrol et
 * @param {string} str - Kontrol edilecek string
 * @returns {boolean} Bozuk karakter var mı?
 */
const needsTurkishCharFix = (str) => {
  // Bozuk karakterleri hızlıca kontrol et
  return /[ÄÅÃâ]/.test(str);
};

/**
 * Türkçe karakter encoding sorununu düzelt
 * SQL Server'dan gelen bozuk karakterleri düzelt
 * PERFORMANS OPTİMİZE EDİLMİŞ: Sadece gerektiğinde düzeltir
 */
const fixTurkishChars = (obj, depth = 0) => {
  // Null/undefined kontrolü
  if (obj === null || obj === undefined) return obj;
  
  // Max depth kontrolü (sonsuz döngü önleme)
  if (depth > 10) return obj;
  
  // String ise ve bozuk karakter varsa düzelt
  if (typeof obj === 'string') {
    // Performans: Önce kontrol et, sonra düzelt
    if (!needsTurkishCharFix(obj)) return obj;
    
    // Bozuk karakterleri düzelt
    let fixed = obj;
    
    // Windows-1254 encoding sorunları
    fixed = fixed.replace(/Ä°/g, 'İ');
    fixed = fixed.replace(/Ä±/g, 'ı');
    fixed = fixed.replace(/Åž/g, 'Ş');
    fixed = fixed.replace(/ÅŸ/g, 'ş');
    fixed = fixed.replace(/Ä/g, 'Ğ');
    fixed = fixed.replace(/Ä/g, 'ğ');
    fixed = fixed.replace(/Ã–/g, 'Ö');
    fixed = fixed.replace(/Ã¶/g, 'ö');
    fixed = fixed.replace(/Ãœ/g, 'Ü');
    fixed = fixed.replace(/Ã¼/g, 'ü');
    fixed = fixed.replace(/Ã‡/g, 'Ç');
    fixed = fixed.replace(/Ã§/g, 'ç');
    
    // PowerShell/CMD'den gelen bozuk karakterler
    fixed = fixed.replace(/\?\?/g, 'İ');
    
    // Diğer bozuk karakterler
    fixed = fixed.replace(/â†'/g, '→');
    fixed = fixed.replace(/â€"/g, '–');
    fixed = fixed.replace(/â€™/g, "'");
    fixed = fixed.replace(/â€œ/g, '"');
    fixed = fixed.replace(/â€/g, '"');
    
    // UTF-8 bozuk karakterler
    fixed = fixed.replace(/Ã¢â‚¬â„¢/g, "'");
    fixed = fixed.replace(/Ã¢â‚¬Å"/g, '"');
    fixed = fixed.replace(/Ã¢â‚¬/g, '"');
    fixed = fixed.replace(/Ã¢â€ž/g, '„');
    
    return fixed;
  }
  
  // Array ise - Performans: Sadece gerekli elemanları düzelt
  if (Array.isArray(obj)) {
    // Boş array kontrolü
    if (obj.length === 0) return obj;
    
    // İlk 3 elemanı kontrol et, hiçbirinde bozuk karakter yoksa tümünü atla
    const sampleSize = Math.min(3, obj.length);
    let hasBrokenChars = false;
    
    for (let i = 0; i < sampleSize; i++) {
      const item = obj[i];
      if (typeof item === 'string' && needsTurkishCharFix(item)) {
        hasBrokenChars = true;
        break;
      } else if (typeof item === 'object' && item !== null) {
        // Object içinde string var mı kontrol et
        const values = Object.values(item);
        if (values.some(v => typeof v === 'string' && needsTurkishCharFix(v))) {
          hasBrokenChars = true;
          break;
        }
      }
    }
    
    // Bozuk karakter yoksa array'i olduğu gibi döndür
    if (!hasBrokenChars) return obj;
    
    // Bozuk karakter varsa tüm array'i düzelt
    return obj.map(item => fixTurkishChars(item, depth + 1));
  }
  
  // Object ise - Performans: Sadece string değerleri düzelt
  if (typeof obj === 'object') {
    const fixed = {};
    let hasChanges = false;
    
    for (const key in obj) {
      const value = obj[key];
      
      // String değerleri kontrol et ve düzelt
      if (typeof value === 'string') {
        if (needsTurkishCharFix(value)) {
          fixed[key] = fixTurkishChars(value, depth + 1);
          hasChanges = true;
        } else {
          fixed[key] = value;
        }
      }
      // Nested object/array
      else if (value !== null && typeof value === 'object') {
        fixed[key] = fixTurkishChars(value, depth + 1);
      }
      // Diğer tipler (number, boolean, null)
      else {
        fixed[key] = value;
      }
    }
    
    // Hiç değişiklik yoksa orijinal objeyi döndür (referans korunur)
    return hasChanges ? fixed : obj;
  }
  
  return obj;
};

// ============================================
// AXIOS INSTANCES
// ============================================

// Genel API instance
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api',
  timeout: 30000, // 30 saniye (genel işlemler için)
  headers: {
    'Content-Type': 'application/json'
  }
});

// Import için özel instance (uzun süren işlemler)
export const importApi = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api',
  timeout: 300000, // 5 dakika (Excel import için)
  headers: {
    'Content-Type': 'multipart/form-data'
  }
});

// ============================================
// REQUEST INTERCEPTOR
// Her istekten önce çalışır
// ============================================
const requestInterceptor = (config) => {
  const isDevelopment = import.meta.env.VITE_ENV === 'development';
  
  // JWT token ekle (authenticated endpoint'ler için)
  const token = localStorage.getItem('token');
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  
  if (isDevelopment) {
    console.log('📤 API Request:', config.method.toUpperCase(), config.url);
  }
  
  return config;
};

const requestErrorInterceptor = (error) => {
  console.error('Request Error:', {
    message: error.message,
    config: error.config,
    timestamp: new Date().toISOString()
  });
  return Promise.reject(error);
};

// Genel API'ye interceptor ekle
api.interceptors.request.use(requestInterceptor, requestErrorInterceptor);

// Import API'ye interceptor ekle
importApi.interceptors.request.use(requestInterceptor, requestErrorInterceptor);

// ============================================
// RESPONSE INTERCEPTOR
// Her yanıttan sonra çalışır
// ============================================
api.interceptors.response.use(
  (response) => {
    const isDevelopment = import.meta.env.VITE_ENV === 'development';
    
    if (isDevelopment) {
      console.log('📥 API Response:', response.config.url, response.status);
    }
    
    // Performans ölçümü (sadece development'ta)
    const startTime = isDevelopment ? performance.now() : 0;
    
    // Türkçe karakterleri düzelt (optimize edilmiş)
    const fixedData = fixTurkishChars(response.data);
    
    // Performans raporu (sadece development'ta)
    if (isDevelopment) {
      const duration = performance.now() - startTime;
      
      // Yavaş işlemleri logla (>10ms)
      if (duration > 10) {
        console.warn(`⚠️ Türkçe karakter düzeltme yavaş: ${duration.toFixed(2)}ms`);
      }
      
      // İlk kaydı göster (debug için)
      if (fixedData?.data && Array.isArray(fixedData.data) && fixedData.data.length > 0) {
        const firstItem = fixedData.data[0];
        const firstField = firstItem.IslemAdi || firstItem.BolumAdi || firstItem.KategoriAdi || 'N/A';
        console.log('✅ İlk kayıt:', firstField, `(${duration.toFixed(2)}ms)`);
      }
    }
    
    // Backend'den gelen response.data'yı direkt döndür (eski davranış)
    return fixedData;
  },
  (error) => {
    console.error('Response Error:', {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data,
      url: error.config?.url,
      timestamp: new Date().toISOString()
    });
    
    // INTERCEPTOR'DA TOAST GÖSTERME - Component'te handle edilecek
    // Sadece console'a log at, toast component'te gösterilsin
    
    return Promise.reject(error);
  }
);

// Import API'ye de aynı interceptor'ları ekle
importApi.interceptors.response.use(
  (response) => {
    const isDevelopment = import.meta.env.VITE_ENV === 'development';
    
    if (isDevelopment) {
      console.log('📥 Import API Response:', response.config.url, response.status);
    }
    
    // Türkçe karakterleri düzelt (optimize edilmiş)
    const fixedData = fixTurkishChars(response.data);
    
    // Import API için response nesnesini döndür (status, headers vs. gerekli)
    response.data = fixedData;
    return response;
  },
  (error) => {
    console.error('Import Error:', {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data,
      url: error.config?.url,
      timestamp: new Date().toISOString()
    });
    
    // INTERCEPTOR'DA TOAST GÖSTERME - Component'te handle edilecek
    // Import işlemleri için özel handling gerekebilir
    
    return Promise.reject(error);
  }
);

export default api;
