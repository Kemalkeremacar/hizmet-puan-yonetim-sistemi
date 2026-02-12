// ============================================
// EXPORT UTILITY
// ============================================
// Excel ve CSV export işlemleri
// ============================================

import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { format } from 'date-fns';

// ============================================
// Kolon genişliğini otomatik hesapla
// ============================================
const calculateColumnWidths = (data) => {
  if (!data || data.length === 0) return [];
  
  const keys = Object.keys(data[0]);
  const widths = keys.map(key => {
    const maxLength = Math.max(
      key.length, // Başlık uzunluğu
      ...data.map(row => {
        const value = row[key];
        return value ? String(value).length : 0;
      })
    );
    return { wch: Math.min(maxLength + 2, 50) }; // Max 50 karakter
  });
  
  return widths;
};

// ============================================
// Başlık satırını stillendir
// ============================================
const styleHeaderRow = (ws, range) => {
  const headerStyle = {
    font: { bold: true, color: { rgb: 'FFFFFF' } },
    fill: { fgColor: { rgb: '1976D2' } },
    alignment: { horizontal: 'center', vertical: 'center' }
  };
  
  // İlk satırdaki tüm hücreleri stillendir
  for (let col = range.s.c; col <= range.e.c; col++) {
    const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col });
    if (!ws[cellAddress]) continue;
    ws[cellAddress].s = headerStyle;
  }
};

// ============================================
// Sayı formatlarını uygula
// ============================================
const applyNumberFormats = (ws, data, range) => {
  if (!data || data.length === 0) return;
  
  const keys = Object.keys(data[0]);
  
  keys.forEach((key, colIndex) => {
    // Birim, Fiyat gibi para kolonları
    if (key.includes('Birim') || key.includes('Fiyat') || key.includes('TL')) {
      for (let row = 1; row <= range.e.r; row++) {
        const cellAddress = XLSX.utils.encode_cell({ r: row, c: colIndex });
        if (ws[cellAddress] && typeof ws[cellAddress].v === 'number') {
          ws[cellAddress].z = '#,##0.00 ₺'; // Türk Lirası formatı
        }
      }
    }
    
    // Yüzde kolonları
    if (key.includes('Yüzde') || key.includes('%')) {
      for (let row = 1; row <= range.e.r; row++) {
        const cellAddress = XLSX.utils.encode_cell({ r: row, c: colIndex });
        if (ws[cellAddress] && typeof ws[cellAddress].v === 'number') {
          ws[cellAddress].z = '0.00%';
        }
      }
    }
  });
};

// ============================================
// Excel'e export (Gelişmiş)
// ============================================
export const exportToExcel = (data, fileName = 'export', options = {}) => {
  try {
    const {
      sheetName = 'Veri',
      autoWidth = true,
      styleHeader = true,
      formatNumbers = true,
      addFilters = true,
      addSummary = false,
      summaryData = null
    } = options;
    
    if (!data || data.length === 0) {
      console.warn('Export için veri yok');
      return false;
    }
    
    // Worksheet oluştur
    const ws = XLSX.utils.json_to_sheet(data);
    const range = XLSX.utils.decode_range(ws['!ref']);
    
    // Kolon genişliklerini ayarla
    if (autoWidth) {
      ws['!cols'] = calculateColumnWidths(data);
    }
    
    // Başlık stilini uygula
    if (styleHeader) {
      styleHeaderRow(ws, range);
    }
    
    // Sayı formatlarını uygula
    if (formatNumbers) {
      applyNumberFormats(ws, data, range);
    }
    
    // Filtre ekle
    if (addFilters) {
      ws['!autofilter'] = { ref: ws['!ref'] };
    }
    
    // Workbook oluştur
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    
    // Özet sayfa ekle
    if (addSummary && summaryData) {
      const summaryWs = XLSX.utils.json_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(wb, summaryWs, 'Özet');
    }
    
    // Dosya adına tarih ekle
    const timestamp = format(new Date(), 'yyyy-MM-dd_HHmm');
    const fullFileName = `${fileName}_${timestamp}.xlsx`;
    
    // Excel dosyası oluştur ve indir
    const excelBuffer = XLSX.write(wb, { 
      bookType: 'xlsx', 
      type: 'array',
      cellStyles: true 
    });
    
    const blob = new Blob([excelBuffer], { 
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
    });
    
    saveAs(blob, fullFileName);
    
    return true;
  } catch (error) {
    console.error('Excel export hatası:', error);
    return false;
  }
};

// ============================================
// CSV'ye export (Gelişmiş)
// ============================================
export const exportToCSV = (data, fileName = 'export', options = {}) => {
  try {
    const { delimiter = ',', encoding = 'utf-8' } = options;
    
    if (!data || data.length === 0) {
      console.warn('Export için veri yok');
      return false;
    }
    
    // Worksheet oluştur
    const ws = XLSX.utils.json_to_sheet(data);
    
    // CSV string'e çevir
    const csv = XLSX.utils.sheet_to_csv(ws, { FS: delimiter });
    
    // BOM ekle (Türkçe karakter desteği için)
    const bom = '\ufeff';
    const blob = new Blob([bom + csv], { 
      type: `text/csv;charset=${encoding};` 
    });
    
    // Dosya adına tarih ekle
    const timestamp = format(new Date(), 'yyyy-MM-dd_HHmm');
    const fullFileName = `${fileName}_${timestamp}.csv`;
    
    saveAs(blob, fullFileName);
    
    return true;
  } catch (error) {
    console.error('CSV export hatası:', error);
    return false;
  }
};

// ============================================
// Çoklu sayfa Excel export
// ============================================
export const exportMultiSheet = (sheets, fileName = 'export') => {
  try {
    if (!sheets || sheets.length === 0) {
      console.warn('Export için sayfa yok');
      return false;
    }
    
    const wb = XLSX.utils.book_new();
    
    sheets.forEach(({ name, data, options = {} }) => {
      if (!data || data.length === 0) return;
      
      const ws = XLSX.utils.json_to_sheet(data);
      const range = XLSX.utils.decode_range(ws['!ref']);
      
      // Kolon genişlikleri
      if (options.autoWidth !== false) {
        ws['!cols'] = calculateColumnWidths(data);
      }
      
      // Başlık stili
      if (options.styleHeader !== false) {
        styleHeaderRow(ws, range);
      }
      
      // Sayı formatları
      if (options.formatNumbers !== false) {
        applyNumberFormats(ws, data, range);
      }
      
      // Filtre
      if (options.addFilters !== false) {
        ws['!autofilter'] = { ref: ws['!ref'] };
      }
      
      XLSX.utils.book_append_sheet(wb, ws, name);
    });
    
    // Dosya adına tarih ekle
    const timestamp = format(new Date(), 'yyyy-MM-dd_HHmm');
    const fullFileName = `${fileName}_${timestamp}.xlsx`;
    
    // Excel dosyası oluştur ve indir
    const excelBuffer = XLSX.write(wb, { 
      bookType: 'xlsx', 
      type: 'array',
      cellStyles: true 
    });
    
    const blob = new Blob([excelBuffer], { 
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
    });
    
    saveAs(blob, fullFileName);
    
    return true;
  } catch (error) {
    console.error('Multi-sheet export hatası:', error);
    return false;
  }
};

// ============================================
// İşlemler için özel export (Gelişmiş)
// ============================================
export const exportIslemler = (islemler, options = {}) => {
  const {
    includeStats = true,
    filterInfo = null
  } = options;
  
  // Ana veri
  const data = islemler.map(islem => ({
    'HUV Kodu': islem.HuvKodu,
    'İşlem Adı': islem.IslemAdi,
    'Birim (TL)': islem.Birim || 0,
    'SUT Kodu': islem.SutKodu || '-',
    'Ana Dal': islem.BolumAdi || '-',
    'Üst Başlık': islem.UstBaslik || '-',
    'Hiyerarşi Seviyesi': islem.HiyerarsiSeviyesi || 0,
    'Güncelleme Tarihi': islem.GuncellemeTarihi || '-',
    'Ekleme Tarihi': islem.EklemeTarihi || '-',
    'Not': islem.Not || '-'
  }));
  
  // İstatistikler sayfası
  let summaryData = null;
  if (includeStats) {
    const ucretliIslemler = islemler.filter(i => i.Birim && i.Birim > 0);
    const toplamBirim = ucretliIslemler.reduce((sum, i) => sum + (i.Birim || 0), 0);
    const ortalamaBirim = ucretliIslemler.length > 0 ? toplamBirim / ucretliIslemler.length : 0;
    const minBirim = ucretliIslemler.length > 0 ? Math.min(...ucretliIslemler.map(i => i.Birim)) : 0;
    const maxBirim = ucretliIslemler.length > 0 ? Math.max(...ucretliIslemler.map(i => i.Birim)) : 0;
    
    summaryData = [
      { 'İstatistik': 'Toplam İşlem', 'Değer': islemler.length },
      { 'İstatistik': 'Ücretli İşlem', 'Değer': ucretliIslemler.length },
      { 'İstatistik': 'Başlık Satırı', 'Değer': islemler.length - ucretliIslemler.length },
      { 'İstatistik': 'Ortalama Birim', 'Değer': `${ortalamaBirim.toFixed(2)} TL` },
      { 'İstatistik': 'Min Birim', 'Değer': `${minBirim.toFixed(2)} TL` },
      { 'İstatistik': 'Max Birim', 'Değer': `${maxBirim.toFixed(2)} TL` },
      { 'İstatistik': 'Toplam Tutar', 'Değer': `${toplamBirim.toFixed(2)} TL` },
      { 'İstatistik': 'Export Tarihi', 'Değer': format(new Date(), 'dd.MM.yyyy HH:mm') }
    ];
    
    // Filtre bilgisi varsa ekle
    if (filterInfo) {
      summaryData.push({ 'İstatistik': '', 'Değer': '' }); // Boş satır
      summaryData.push({ 'İstatistik': 'Uygulanan Filtreler', 'Değer': '' });
      Object.entries(filterInfo).forEach(([key, value]) => {
        if (value) {
          summaryData.push({ 'İstatistik': key, 'Değer': value });
        }
      });
    }
  }
  
  return exportToExcel(data, 'huv_islemler', {
    sheetName: 'İşlemler',
    autoWidth: true,
    styleHeader: true,
    formatNumbers: true,
    addFilters: true,
    addSummary: includeStats,
    summaryData: summaryData
  });
};

// ============================================
// Ana Dallar için özel export (Gelişmiş)
// ============================================
export const exportAnaDallar = (anaDallar, options = {}) => {
  const { includeDetails = false, detailsData = null } = options;
  
  const data = anaDallar.map(dal => ({
    'Ana Dal Kodu': dal.AnaDalKodu,
    'Bölüm Adı': dal.BolumAdi,
    'Toplam İşlem': dal.ToplamIslemSayisi || 0,
    'Fiyatlı İşlem': dal.FiyatliIslemSayisi || 0,
    'Ortalama Birim': dal.OrtalamaBirim ? `${dal.OrtalamaBirim.toFixed(2)} TL` : '-',
    'Min Birim': dal.MinBirim ? `${dal.MinBirim.toFixed(2)} TL` : '-',
    'Max Birim': dal.MaxBirim ? `${dal.MaxBirim.toFixed(2)} TL` : '-'
  }));
  
  if (includeDetails && detailsData) {
    return exportMultiSheet([
      { name: 'Ana Dallar', data: data },
      { name: 'Detaylar', data: detailsData }
    ], 'ana_dallar');
  }
  
  return exportToExcel(data, 'ana_dallar', {
    sheetName: 'Ana Dallar',
    autoWidth: true,
    styleHeader: true,
    formatNumbers: true,
    addFilters: true
  });
};

// ============================================
// Raporlar için özel export
// ============================================
export const exportRapor = (raporData, raporAdi, options = {}) => {
  const { 
    includeCharts = false,
    chartData = null,
    includeMetadata = true 
  } = options;
  
  const sheets = [
    { name: raporAdi, data: raporData }
  ];
  
  // Grafik verileri varsa ekle
  if (includeCharts && chartData) {
    sheets.push({ name: 'Grafik Verileri', data: chartData });
  }
  
  // Metadata ekle
  if (includeMetadata) {
    const metadata = [
      { 'Bilgi': 'Rapor Adı', 'Değer': raporAdi },
      { 'Bilgi': 'Oluşturma Tarihi', 'Değer': format(new Date(), 'dd.MM.yyyy HH:mm') },
      { 'Bilgi': 'Kayıt Sayısı', 'Değer': raporData.length },
      { 'Bilgi': 'Sistem', 'Değer': 'HUV Yönetim Sistemi v2.0' }
    ];
    sheets.push({ name: 'Bilgiler', data: metadata });
  }
  
  return exportMultiSheet(sheets, `rapor_${raporAdi.toLowerCase().replace(/\s+/g, '_')}`);
};

// ============================================
// Tarihsel veriler için özel export
// ============================================
export const exportTarihsel = (tarihselData, baslik) => {
  const data = tarihselData.map(item => ({
    'HUV Kodu': item.HuvKodu,
    'İşlem Adı': item.IslemAdi,
    'Eski Birim': item.EskiBirim ? `${item.EskiBirim.toFixed(2)} TL` : '-',
    'Yeni Birim': item.YeniBirim ? `${item.YeniBirim.toFixed(2)} TL` : '-',
    'Değişim': item.Degisim ? `${item.Degisim.toFixed(2)} TL` : '-',
    'Değişim %': item.DegisimYuzde ? `%${item.DegisimYuzde.toFixed(2)}` : '-',
    'Geçerlilik Başlangıç': item.GecerlilikBaslangic || '-',
    'Geçerlilik Bitiş': item.GecerlilikBitis || 'Aktif',
    'Ana Dal': item.BolumAdi || '-'
  }));
  
  return exportToExcel(data, `tarihsel_${baslik.toLowerCase().replace(/\s+/g, '_')}`, {
    sheetName: 'Tarihsel Veriler',
    autoWidth: true,
    styleHeader: true,
    formatNumbers: true,
    addFilters: true
  });
};
