// ============================================
// İL KATSAYILARI EXCEL PARSER SERVICE
// ============================================
// Excel'den il katsayıları parse etme ve validate etme
// ============================================

const XLSX = require('xlsx');
const { fixTurkishEncoding } = require('../utils/turkishCharFix');

// ============================================
// İl adından plaka kodunu bul
// Türkiye'nin 81 ili ve plaka kodları
// ============================================
const getPlakaKoduFromIlAdi = (ilAdi) => {
  if (!ilAdi) return null;
  
  const ilAdiNormalized = fixTurkishEncoding(ilAdi.trim().toLowerCase());
  
  const ilPlakaMap = {
    'adana': 1, 'adiyaman': 2, 'afyonkarahisar': 3, 'afyon': 3,
    'ağrı': 4, 'agri': 4, 'amasya': 5, 'ankara': 6,
    'antalya': 7, 'artvin': 8, 'aydın': 9, 'aydin': 9,
    'balıkesir': 10, 'balikesir': 10, 'bilecik': 11,
    'bingöl': 12, 'bingol': 12, 'bitlis': 13, 'bolu': 14,
    'burdur': 15, 'bursa': 16, 'çanakkale': 17, 'canakkale': 17,
    'çankırı': 18, 'cankiri': 18, 'çorum': 19, 'corum': 19,
    'denizli': 20, 'diyarbakır': 21, 'diyarbakir': 21,
    'edirne': 22, 'elazığ': 23, 'elazig': 23, 'erzincan': 24,
    'erzurum': 25, 'eskişehir': 26, 'eskisehir': 26, 'gaziantep': 27,
    'giresun': 28, 'gümüşhane': 29, 'gumushane': 29, 'hakkari': 30,
    'hatay': 31, 'ısparta': 32, 'isparta': 32, 'mersin': 33, 'içel': 33, 'icel': 33,
    'istanbul': 34, 'izmir': 35, 'kars': 36, 'kastamonu': 37,
    'kayseri': 38, 'kırklareli': 39, 'kirklareli': 39, 'kırşehir': 40, 'kirsehir': 40,
    'kocaeli': 41, 'konya': 42, 'kütahya': 43, 'kutahya': 43,
    'malatya': 44, 'manisa': 45, 'kahramanmaraş': 46, 'kahramanmaras': 46, 'maraş': 46, 'maras': 46,
    'mardin': 47, 'muğla': 48, 'mugla': 48, 'muş': 49, 'mus': 49,
    'nevşehir': 50, 'nevsehir': 50, 'niğde': 51, 'nigde': 51,
    'ordu': 52, 'rize': 53, 'sakarya': 54, 'samsun': 55,
    'siirt': 56, 'sinop': 57, 'sivas': 58, 'tekirdağ': 59, 'tekirdag': 59,
    'tokat': 60, 'trabzon': 61, 'tunceli': 62, 'şanlıurfa': 63, 'sanliurfa': 63, 'urfa': 63,
    'uşak': 64, 'usak': 64, 'van': 65, 'yozgat': 66,
    'zonguldak': 67, 'aksaray': 68, 'bayburt': 69, 'karaman': 70,
    'kırıkkale': 71, 'kirikkale': 71, 'batman': 72, 'şırnak': 73, 'sirnak': 73,
    'bartın': 74, 'bartin': 74, 'ardahan': 75, 'ığdır': 76, 'igdir': 76,
    'yalova': 77, 'karabük': 78, 'karabuk': 78, 'kilis': 79,
    'osmaniye': 80, 'düzce': 81, 'duzce': 81
  };
  
  return ilPlakaMap[ilAdiNormalized] || null;
};

// ============================================
// Excel dosyasını oku ve parse et
// Format: 
//   Satır 1: Başlık (atlanır)
//   Satır 2: Kolon başlıkları (İL, KATSAYI)
//   Satır 3+: Veri (İl adı, katsayı değeri)
// ============================================
const parseIlKatsayiExcel = (filePath) => {
  try {
    const workbook = XLSX.readFile(filePath, {
      type: 'buffer',
      codepage: 65001, // UTF-8
      cellDates: true,
      cellNF: false,
      cellText: false
    });
    
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // Tüm satırları array olarak oku
    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
    const allRows = [];
    
    for (let rowIndex = 0; rowIndex <= range.e.r; rowIndex++) {
      const row = [];
      for (let colIndex = range.s.c; colIndex <= range.e.c; colIndex++) {
        const cellAddress = XLSX.utils.encode_cell({ r: rowIndex, c: colIndex });
        const cell = worksheet[cellAddress];
        const value = cell ? (cell.v !== undefined ? cell.v : '') : '';
        row.push(value);
      }
      allRows.push(row);
    }
    
    // Başlık satırını bul (İL ve KATSAYI kelimelerini içeren satır)
    let headerRowIndex = -1;
    for (let i = 0; i < Math.min(10, allRows.length); i++) {
      const rowText = allRows[i].join(' ').toLowerCase();
      if (rowText.includes('il') && (rowText.includes('katsay') || rowText.includes('katsayi'))) {
        headerRowIndex = i;
        break;
      }
    }
    
    if (headerRowIndex === -1) {
      return {
        success: false,
        error: 'Başlık satırı bulunamadı'
      };
    }
    
    // Dönem bilgisini başlık satırından çıkar
    const donemBaslangic = extractDonemBaslangic(allRows[headerRowIndex]);
    const donemBitis = extractDonemBitis(allRows[headerRowIndex]);
    
    // Veri satırlarını parse et
    const data = [];
    for (let i = headerRowIndex + 1; i < allRows.length; i++) {
      const row = allRows[i];
      const ilAdi = row[0] ? fixTurkishEncoding(row[0].toString().trim()) : '';
      const katsayiValue = row[1];
      
      // Boş satırları atla
      if (!ilAdi || ilAdi === '') {
        continue;
      }
      
      // Katsayı değerini parse et
      let katsayi = null;
      if (katsayiValue !== null && katsayiValue !== undefined && katsayiValue !== '') {
        if (typeof katsayiValue === 'number') {
          katsayi = katsayiValue;
        } else {
          const katsayiStr = katsayiValue.toString().trim().replace(/[^\d.,]/g, '');
          katsayi = parseFloat(katsayiStr.replace(',', '.'));
          if (isNaN(katsayi)) {
            katsayi = null;
          }
        }
      }
      
      if (katsayi === null) {
        continue; // Katsayı değeri yoksa atla
      }
      
      data.push({
        IlAdi: ilAdi,
        Katsayi: katsayi,
        DonemBaslangic: donemBaslangic,
        DonemBitis: donemBitis,
        rowIndex: i
      });
    }
    
    return {
      success: true,
      data: data,
      rowCount: data.length,
      sheetName: sheetName,
      donemBaslangic: donemBaslangic,
      donemBitis: donemBitis
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
};

// ============================================
// Dönem başlangıç tarihini çıkar
// Örnek: "2025 YILI 2. DÖNEM KATSAYISI ( 01.07.2025 – 31.12.2025 )"
// -> "2025-07-01"
// ============================================
const extractDonemBaslangic = (headerRow) => {
  try {
    const headerText = headerRow.join(' ');
    // Tarih formatı: DD.MM.YYYY
    const match = headerText.match(/(\d{2})\.(\d{2})\.(\d{4})/);
    if (match) {
      const [, day, month, year] = match;
      return `${year}-${month}-${day}`;
    }
    return null;
  } catch (err) {
    return null;
  }
};

// ============================================
// Dönem bitiş tarihini çıkar
// Örnek: "2025 YILI 2. DÖNEM KATSAYISI ( 01.07.2025 – 31.12.2025 )"
// -> "2025-12-31"
// ============================================
const extractDonemBitis = (headerRow) => {
  try {
    const headerText = headerRow.join(' ');
    // İkinci tarih formatı: DD.MM.YYYY
    const matches = headerText.match(/(\d{2})\.(\d{2})\.(\d{4})/g);
    if (matches && matches.length >= 2) {
      const secondMatch = matches[1].match(/(\d{2})\.(\d{2})\.(\d{4})/);
      if (secondMatch) {
        const [, day, month, year] = secondMatch;
        return `${year}-${month}-${day}`;
      }
    }
    return null;
  } catch (err) {
    return null;
  }
};

// ============================================
// İl katsayı verilerini validate et
// ============================================
const validateIlKatsayiData = (data) => {
  const errors = [];
  const warnings = [];
  const validData = [];
  
  if (!data || data.length === 0) {
    return {
      valid: false,
      errors: ['Veri bulunamadı'],
      warnings: [],
      validData: [],
      stats: {
        total: 0,
        valid: 0,
        invalid: 0,
        warnings: 0
      }
    };
  }
  
  data.forEach((row, index) => {
    const rowErrors = [];
    const rowWarnings = [];
    
    // İl adı kontrolü
    if (!row.IlAdi || row.IlAdi.trim() === '') {
      rowErrors.push('İl adı boş olamaz');
    }
    
    // Katsayı kontrolü
    if (row.Katsayi === null || row.Katsayi === undefined) {
      rowErrors.push('Katsayı değeri boş olamaz');
    } else if (typeof row.Katsayi !== 'number' || isNaN(row.Katsayi)) {
      rowErrors.push('Katsayı değeri geçerli bir sayı olmalıdır');
    } else if (row.Katsayi <= 0) {
      rowWarnings.push('Katsayı değeri 0\'dan büyük olmalıdır');
    }
    
    if (rowErrors.length === 0) {
      validData.push(row);
      if (rowWarnings.length > 0) {
        warnings.push({
          row: index + 1,
          ilAdi: row.IlAdi,
          warnings: rowWarnings
        });
      }
    } else {
      errors.push({
        row: index + 1,
        ilAdi: row.IlAdi || 'Bilinmeyen',
        errors: rowErrors
      });
    }
  });
  
  return {
    valid: errors.length === 0,
    errors: errors,
    warnings: warnings,
    validData: validData,
    stats: {
      total: data.length,
      valid: validData.length,
      invalid: errors.length,
      warnings: warnings.length
    }
  };
};

// ============================================
// İl katsayı verilerini normalize et
// ============================================
const normalizeIlKatsayiData = (data) => {
  return data.map(row => {
    const ilAdi = row.IlAdi.trim();
    const plakaKodu = row.PlakaKodu || getPlakaKoduFromIlAdi(ilAdi);
    
    return {
      IlAdi: ilAdi,
      PlakaKodu: plakaKodu,
      Katsayi: parseFloat(row.Katsayi.toFixed(2)),
      DonemBaslangic: row.DonemBaslangic,
      DonemBitis: row.DonemBitis
    };
  });
};

module.exports = {
  parseIlKatsayiExcel,
  validateIlKatsayiData,
  normalizeIlKatsayiData,
  extractDonemBaslangic,
  extractDonemBitis
};
