// ============================================
// DATE DISPLAY COMPONENT
// ============================================
// Tarihleri tutarlı şekilde göstermek için component
// ============================================

import { formatDateShort, formatDateTime } from '../../utils/dateUtils';

/**
 * Tarih gösterim komponenti
 * @param {string|Date} date - Gösterilecek tarih
 * @param {string} format - 'short' (GG.AA.YYYY) veya 'datetime' (GG.AA.YYYY SS:DD)
 * @param {string} fallback - Tarih yoksa gösterilecek metin
 */
export default function DateDisplay({ date, format = 'short', fallback = '-', ...props }) {
  if (!date) return fallback;
  
  const formattedDate = format === 'datetime' 
    ? formatDateTime(date) 
    : formatDateShort(date);
  
  return <span {...props}>{formattedDate}</span>;
}
