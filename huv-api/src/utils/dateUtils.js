// ============================================
// TARİH UTILITY FONKSİYONLARI (BACKEND)
// ============================================
// SQL Server ile uyumlu tarih işlemleri
// ============================================

/**
 * JavaScript Date objesini SQL Server DATE formatına çevirir
 * @param {Date|string} date - Date objesi veya ISO string
 * @returns {string} YYYY-MM-DD formatında string
 */
const toSqlDate = (date) => {
  if (!date) return null;
  const d = date instanceof Date ? date : new Date(date);
  return d.toISOString().split('T')[0];
};

/**
 * JavaScript Date objesini SQL Server DATETIME formatına çevirir
 * @param {Date|string} date - Date objesi veya ISO string
 * @returns {string} YYYY-MM-DD HH:MM:SS formatında string
 */
const toSqlDateTime = (date) => {
  if (!date) return null;
  const d = date instanceof Date ? date : new Date(date);
  return d.toISOString().slice(0, 19).replace('T', ' ');
};

/**
 * SQL Server DATE/DATETIME'ı JavaScript Date'e çevirir
 * @param {string} sqlDate - SQL Server tarih string'i
 * @returns {Date} JavaScript Date objesi
 */
const fromSqlDate = (sqlDate) => {
  if (!sqlDate) return null;
  return new Date(sqlDate);
};

/**
 * Bugünün tarihini SQL DATE formatında döndürür
 * @returns {string} YYYY-MM-DD
 */
const getTodaySql = () => {
  return toSqlDate(new Date());
};

/**
 * Şu anki zamanı SQL DATETIME formatında döndürür
 * @returns {string} YYYY-MM-DD HH:MM:SS
 */
const getNowSql = () => {
  return toSqlDateTime(new Date());
};

/**
 * İki tarihi karşılaştırır
 * @param {Date|string} date1 - İlk tarih
 * @param {Date|string} date2 - İkinci tarih
 * @returns {number} -1: date1 < date2, 0: eşit, 1: date1 > date2
 */
const compareDates = (date1, date2) => {
  const d1 = date1 instanceof Date ? date1 : new Date(date1);
  const d2 = date2 instanceof Date ? date2 : new Date(date2);
  
  if (d1 < d2) return -1;
  if (d1 > d2) return 1;
  return 0;
};

/**
 * Tarihin gelecekte olup olmadığını kontrol eder
 * @param {Date|string} date - Kontrol edilecek tarih
 * @returns {boolean} Gelecek tarih ise true
 */
const isFutureDate = (date) => {
  const checkDate = date instanceof Date ? date : new Date(date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  checkDate.setHours(0, 0, 0, 0);
  return checkDate > today;
};

/**
 * Tarih validasyonu yapar
 * @param {any} date - Kontrol edilecek değer
 * @returns {boolean} Geçerli tarih ise true
 */
const isValidDate = (date) => {
  if (!date) return false;
  const d = date instanceof Date ? date : new Date(date);
  return d instanceof Date && !isNaN(d);
};

/**
 * Tarih aralığı validasyonu yapar
 * @param {Date|string} startDate - Başlangıç tarihi
 * @param {Date|string} endDate - Bitiş tarihi
 * @returns {object} { valid: boolean, error: string }
 */
const validateDateRange = (startDate, endDate) => {
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
 * Tarihe gün ekler
 * @param {Date|string} date - Başlangıç tarihi
 * @param {number} days - Eklenecek gün sayısı
 * @returns {Date} Yeni tarih
 */
const addDays = (date, days) => {
  const d = date instanceof Date ? new Date(date) : new Date(date);
  d.setDate(d.getDate() + days);
  return d;
};

/**
 * İki tarih arasındaki gün farkını hesaplar
 * @param {Date|string} startDate - Başlangıç tarihi
 * @param {Date|string} endDate - Bitiş tarihi
 * @returns {number} Gün farkı
 */
const getDaysDifference = (startDate, endDate) => {
  const start = startDate instanceof Date ? startDate : new Date(startDate);
  const end = endDate instanceof Date ? endDate : new Date(endDate);
  
  const diffTime = Math.abs(end - start);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

module.exports = {
  toSqlDate,
  toSqlDateTime,
  fromSqlDate,
  getTodaySql,
  getNowSql,
  compareDates,
  isFutureDate,
  isValidDate,
  validateDateRange,
  addDays,
  getDaysDifference
};
