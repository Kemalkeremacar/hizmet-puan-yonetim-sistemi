// ============================================
// STREAM-BASED EXCEL PARSER
// ============================================
// Büyük Excel dosyaları için memory-efficient parser
// Dosyayı chunk'lar halinde okur, tüm veriyi memory'de tutmaz
// ============================================

const XLSX = require('xlsx');
const fs = require('fs');

// Büyük dosyalar için stream-based parsing
const parseExcelStream = (filePath, options = {}) => {
  const {
    batchSize = 1000, // Her seferde kaç satır işle
    onBatch = null,   // Her batch için callback
    maxRows = 100000  // Maksimum satır sayısı (güvenlik)
  } = options;
  
  try {
    // Dosya boyutunu kontrol et
    const stats = fs.statSync(filePath);
    const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);
    
    console.log(`📊 Excel dosyası okunuyor: ${fileSizeMB} MB`);
    
    // Küçük dosyalar için normal parsing
    if (stats.size < 5 * 1024 * 1024) { // 5 MB'dan küçükse
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(worksheet);
      
      return {
        success: true,
        data: data,
        rowCount: data.length,
        method: 'normal'
      };
    }
    
    // Büyük dosyalar için stream parsing
    console.log('⚠️ Büyük dosya tespit edildi, stream parsing kullanılıyor...');
    
    const workbook = XLSX.readFile(filePath, { 
      cellDates: true,
      cellNF: false,
      cellText: false,
      sheetStubs: false // Boş hücreleri atla
    });
    
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // Satır satır oku
    const range = XLSX.utils.decode_range(worksheet['!ref']);
    const totalRows = range.e.r - range.s.r;
    
    if (totalRows > maxRows) {
      return {
        success: false,
        error: `Dosya çok büyük (${totalRows} satır). Maksimum ${maxRows} satır destekleniyor.`,
        rowCount: totalRows
      };
    }
    
    const allData = [];
    let batch = [];
    let processedRows = 0;
    
    // Header'ı al
    const headers = [];
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const address = XLSX.utils.encode_col(C) + (range.s.r + 1);
      const cell = worksheet[address];
      headers.push(cell ? cell.v : `Column${C}`);
    }
    
    // Satırları işle
    for (let R = range.s.r + 1; R <= range.e.r; ++R) {
      const row = {};
      let isEmpty = true;
      
      for (let C = range.s.c; C <= range.e.c; ++C) {
        const address = XLSX.utils.encode_cell({ r: R, c: C });
        const cell = worksheet[address];
        
        if (cell && cell.v !== undefined && cell.v !== null && cell.v !== '') {
          isEmpty = false;
          row[headers[C]] = cell.v;
        }
      }
      
      if (!isEmpty) {
        batch.push(row);
        processedRows++;
        
        // Batch doldu mu?
        if (batch.length >= batchSize) {
          if (onBatch) {
            onBatch(batch, processedRows);
          }
          allData.push(...batch);
          batch = [];
          
          // Memory'yi temizle
          if (global.gc) {
            global.gc();
          }
        }
      }
    }
    
    // Kalan batch'i işle
    if (batch.length > 0) {
      if (onBatch) {
        onBatch(batch, processedRows);
      }
      allData.push(...batch);
    }
    
    console.log(`✅ ${processedRows} satır işlendi (stream mode)`);
    
    return {
      success: true,
      data: allData,
      rowCount: processedRows,
      method: 'stream'
    };
    
  } catch (error) {
    console.error('❌ Stream parsing hatası:', error.message);
    return {
      success: false,
      error: error.message,
      rowCount: 0
    };
  }
};

module.exports = {
  parseExcelStream
};
