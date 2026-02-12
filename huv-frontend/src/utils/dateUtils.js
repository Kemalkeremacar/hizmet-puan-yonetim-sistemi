// ============================================
// TARİH UTILITY FONKSİYONLARI
// ============================================
// Tüm sistemde tutarlı tarih işlemleri için merkezi fonksiyonlar
// ============================================

/**
 * String tarih değerini local timezone'da Date objesine çevirir
 * @param {string} dateString - YYYY-MM-DD formatında tarih
 * @returns {Date} Local timezone'da Date objesi
 */
export const parseLocalDate = (dateString) => {
  if (!dateString) return null;
  // T00:00:00 ekleyerek local timezone'da parse et
  return new Date(dateString + 'T00:00:00');
};

/**
 * Date objesini YYYY-MM-DD formatına çevirir
 * @param {Date} date - Date objesi
 * @returns {string} YYYY-MM-DD formatında string
 */
export const formatDateToInput = (date) => {
  if (!date) return '';
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Bugünün tarihini YYYY-MM-DD formatında döndürür
 * @returns {string} Bugünün tarihi
 */
export const getTodayString = () => {
  return formatDateToInput(new Date());
};

/**
 * Bugünün Date objesini döndürür (saat 00:00:00)
 * @returns {Date} Bugünün tarihi
 */
export const getTodayDate = () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
};

/**
 * İki tarihi karşılaştırır (sadece gün bazında)
 * @param {string|Date} date1 - İlk tarih
 * @param {string|Date} date2 - İkinci tarih
 * @returns {number} -1: date1 < date2, 0: eşit, 1: date1 > date2
 */
export const compareDates = (date1, date2) => {
  const d1 = typeof date1 === 'string' ? parseLocalDate(date1) : new Date(date1);
  const d2 = typeof date2 === 'string' ? parseLocalDate(date2) : new Date(date2);
  
  d1.setHours(0, 0, 0, 0);
  d2.setHours(0, 0, 0, 0);
  
  if (d1 < d2) return -1;
  if (d1 > d2) return 1;
  return 0;
};

/**
 * Tarihin gelecekte olup olmadığını kontrol eder
 * @param {string|Date} date - Kontrol edilecek tarih
 * @returns {boolean} Gelecek tarih ise true
 */
export const isFutureDate = (date) => {
  const checkDate = typeof date === 'string' ? parseLocalDate(date) : new Date(date);
  const today = getTodayDate();
  return checkDate > today;
};

/**
 * Tarihin geçmişte olup olmadığını kontrol eder
 * @param {string|Date} date - Kontrol edilecek tarih
 * @returns {boolean} Geçmiş tarih ise true
 */
export const isPastDate = (date) => {
  const checkDate = typeof date === 'string' ? parseLocalDate(date) : new Date(date);
  const today = getTodayDate();
  return checkDate < today;
};

/**
 * Tarihin bugün olup olmadığını kontrol eder
 * @param {string|Date} date - Kontrol edilecek tarih
 * @returns {boolean} Bugün ise true
 */
export const isToday = (date) => {
  return compareDates(date, getTodayDate()) === 0;
};

/**
 * İki tarih arasındaki gün farkını hesaplar
 * @param {string|Date} startDate - Başlangıç tarihi
 * @param {string|Date} endDate - Bitiş tarihi
 * @returns {number} Gün farkı
 */
export const getDaysDifference = (startDate, endDate) => {
  const start = typeof startDate === 'string' ? parseLocalDate(startDate) : new Date(startDate);
  const end = typeof endDate === 'string' ? parseLocalDate(endDate) : new Date(endDate);
  
  const diffTime = Math.abs(end - start);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

/**
 * Tarihe gün ekler
 * @param {string|Date} date - Başlangıç tarihi
 * @param {number} days - Eklenecek gün sayısı
 * @returns {string} YYYY-MM-DD formatında yeni tarih
 */
export const addDays = (date, days) => {
  const d = typeof date === 'string' ? parseLocalDate(date) : new Date(date);
  d.setDate(d.getDate() + days);
  return formatDateToInput(d);
};

/**
 * Tarihi Türkçe formatta gösterir
 * @param {string|Date} date - Tarih
 * @param {object} options - Intl.DateTimeFormat options
 * @returns {string} Formatlanmış tarih
 */
export const formatDateTurkish = (date, options = {}) => {
  if (!date) return '-';
  // ISO formatı veya basit format olabilir
  const d = new Date(date);
  if (isNaN(d.getTime())) return '-';
  
  const defaultOptions = {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    ...options
  };
  
  return d.toLocaleDateString('tr-TR', defaultOptions);
};

/**
 * Tarihi kısa Türkçe formatta gösterir (GG.AA.YYYY)
 * @param {string|Date} date - Tarih
 * @returns {string} Formatlanmış tarih
 */
export const formatDateShort = (date) => {
  if (!date) return '-';
  // ISO formatı (2026-02-04T21:00:00.000Z) veya basit format (2026-02-04) olabilir
  const d = new Date(date);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('tr-TR');
};

/**
 * Tarih ve saati Türkçe formatta gösterir
 * @param {string|Date} datetime - Tarih ve saat
 * @returns {string} Formatlanmış tarih ve saat
 */
export const formatDateTime = (datetime) => {
  if (!datetime) return '-';
  const d = new Date(datetime);
  return d.toLocaleString('tr-TR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
};

/**
 * Tarih validasyonu yapar
 * @param {string} dateString - YYYY-MM-DD formatında tarih
 * @returns {boolean} Geçerli tarih ise true
 */
export const isValidDate = (dateString) => {
  if (!dateString) return false;
  const date = parseLocalDate(dateString);
  return date instanceof Date && !isNaN(date);
};

/**
 * Tarih aralığı validasyonu yapar
 * @param {string} startDate - Başlangıç tarihi
 * @param {string} endDate - Bitiş tarihi
 * @returns {object} { valid: boolean, error: string }
 */
export const validateDateRange = (startDate, endDate) => {
  if (!startDate || !endDate) {
    return { valid: false, error: 'Başlangıç ve bitiş tarihleri zorunludur' };
  }
  
  if (!isValidDate(startDate) || !isValidDate(endDate)) {
    return { valid: false, error: 'Geçersiz tarih formatı' };
  }
  
  if (compareDates(startDate, endDate) > 0) {
    return { valid: false, error: 'Başlangıç tarihi bitiş tarihinden sonra olamaz' };
  }
  
  return { valid: true, error: null };
};

/**
 * N gün öncesinin tarihini döndürür
 * @param {number} days - Gün sayısı
 * @returns {string} YYYY-MM-DD formatında tarih
 */
export const getDaysAgo = (days) => {
  return addDays(getTodayString(), -days);
};

/**
 * Ay başlangıç tarihini döndürür
 * @param {string|Date} date - Tarih (opsiyonel, varsayılan bugün)
 * @returns {string} YYYY-MM-DD formatında ay başlangıcı
 */
export const getMonthStart = (date = null) => {
  const d = date ? (typeof date === 'string' ? parseLocalDate(date) : new Date(date)) : new Date();
  return formatDateToInput(new Date(d.getFullYear(), d.getMonth(), 1));
};

/**
 * Ay bitiş tarihini döndürür
 * @param {string|Date} date - Tarih (opsiyonel, varsayılan bugün)
 * @returns {string} YYYY-MM-DD formatında ay bitişi
 */
export const getMonthEnd = (date = null) => {
  const d = date ? (typeof date === 'string' ? parseLocalDate(date) : new Date(date)) : new Date();
  return formatDateToInput(new Date(d.getFullYear(), d.getMonth() + 1, 0));
};
