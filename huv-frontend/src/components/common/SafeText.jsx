// ============================================
// SAFE TEXT COMPONENT
// ============================================
// HTML entity'leri decode ederek güvenli metin gösterimi
// ============================================

import { Typography } from '@mui/material';
import { decodeHtmlEntities } from '../../utils/textUtils';

/**
 * HTML entity'leri decode ederek güvenli metin gösterir
 * @param {object} props - Component props
 * @param {string} props.text - Gösterilecek metin
 * @param {object} props.TypographyProps - Typography component'ine geçirilecek props
 * @returns {JSX.Element} SafeText component
 */
export default function SafeText({ text, ...TypographyProps }) {
  if (!text) {
    return <Typography {...TypographyProps}>-</Typography>;
  }
  
  // HTML entity'leri decode et
  const decodedText = decodeHtmlEntities(text);
  
  return (
    <Typography {...TypographyProps}>
      {decodedText}
    </Typography>
  );
}

/**
 * Sadece decode edilmiş metni döndürür (Typography wrapper olmadan)
 * @param {string} text - Decode edilecek metin
 * @returns {string} Decode edilmiş metin
 */
export const useSafeText = (text) => {
  if (!text) return '';
  return decodeHtmlEntities(text);
};