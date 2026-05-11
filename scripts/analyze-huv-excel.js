const XLSX = require('xlsx');
const path = require('path');

// ===== HUV EXCEL ANALİZİ =====
function analyzeHuvExcel() {
  const filePath = path.join(__dirname, '..', '05.02.2026.xlsx');
  console.log('='.repeat(80));
  console.log('HUV EXCEL ANALİZİ: ' + filePath);
  console.log('='.repeat(80));

  const workbook = XLSX.readFile(filePath, { codepage: 65001, cellDates: true });
  const sheetName = workbook.SheetNames[0];
  const data = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
    raw: false, defval: null, blankrows: false
  });

  console.log(`\nSheet adi: ${sheetName}`);
  console.log(`Toplam satir: ${data.length}`);

  const columns = Object.keys(data[0] || {});
  console.log(`\nKolon sayisi: ${columns.length}`);
  console.log('Kolonlar:');
  columns.forEach((c, i) => console.log(`  ${i + 1}. "${c}"`));

  console.log('\nKolon Doluluk Oranlari:');
  columns.forEach(col => {
    const filled = data.filter(r => r[col] !== null && r[col] !== undefined && r[col].toString().trim() !== '').length;
    console.log(`  ${col}: ${filled}/${data.length} (${((filled / data.length) * 100).toFixed(1)}%)`);
  });

  const ustBaslikCol = columns.find(c => c.toLowerCase().includes('üst') || c.toLowerCase().includes('ust') || c.toLowerCase().includes('başlık'));
  if (ustBaslikCol) {
    console.log(`\nUst Baslik Kolonu: "${ustBaslikCol}"`);
    const ustBaslikValues = data.map(r => r[ustBaslikCol]).filter(v => v && v.toString().trim() !== '');
    console.log(`Dolu UstBaslik sayisi: ${ustBaslikValues.length}/${data.length}`);

    const topLevels = new Set();
    let maxDepth = 0;
    ustBaslikValues.forEach(v => {
      const parts = v.toString().split('→').map(p => p.trim());
      if (parts[0]) topLevels.add(parts[0]);
      if (parts.length > maxDepth) maxDepth = parts.length;
    });

    console.log(`\nBenzersiz ust seviye kategori sayisi: ${topLevels.size}`);
    console.log(`Maksimum hiyerarsi derinligi: ${maxDepth}`);
    console.log('\nUst seviye kategoriler:');
    [...topLevels].sort().forEach((t, i) => console.log(`  ${i + 1}. ${t}`));

    const depthDist = {};
    ustBaslikValues.forEach(v => {
      const depth = v.toString().split('→').length;
      depthDist[depth] = (depthDist[depth] || 0) + 1;
    });
    console.log('\nDerinlik dagilimi:');
    Object.keys(depthDist).sort((a, b) => a - b).forEach(d => {
      console.log(`  Seviye ${d}: ${depthDist[d]} satir`);
    });
  }

  const huvKoduCol = columns.find(c => c.toLowerCase().includes('huv') && c.toLowerCase().includes('kod'));
  if (huvKoduCol) {
    console.log(`\nHuvKodu Kolonu: "${huvKoduCol}"`);
    const kodlar = data.map(r => r[huvKoduCol]).filter(v => v != null);
    const numericKodlar = kodlar.map(k => parseFloat(k.toString().replace(',', '.'))).filter(n => !isNaN(n));
    const anaDallar = new Set(numericKodlar.map(k => Math.floor(k)));
    console.log(`Toplam HuvKodu: ${kodlar.length}`);
    console.log(`Benzersiz AnaDalKodu (Math.floor): ${anaDallar.size}`);
    console.log('AnaDal dagilimi:');
    const anaDalDist = {};
    numericKodlar.forEach(k => {
      const ad = Math.floor(k);
      anaDalDist[ad] = (anaDalDist[ad] || 0) + 1;
    });
    Object.keys(anaDalDist).sort((a, b) => a - b).forEach(ad => {
      console.log(`  AnaDal ${ad}: ${anaDalDist[ad]} islem`);
    });

    console.log('\nOrnek HuvKodlari (ilk 5):');
    kodlar.slice(0, 5).forEach(k => console.log(`  ${k}`));
  }

  const birimCol = columns.find(c => c.toLowerCase() === 'birim' || c.toLowerCase() === 'bİrİm');
  if (birimCol) {
    const birimler = data.map(r => r[birimCol]).filter(v => v != null && v.toString().trim() !== '');
    const numBirimler = birimler.map(b => parseFloat(b.toString().replace(',', '.'))).filter(n => !isNaN(n));
    console.log(`\nBirim Kolonu: "${birimCol}"`);
    console.log(`Dolu birim: ${birimler.length}/${data.length}`);
    if (numBirimler.length > 0) {
      console.log(`Min: ${Math.min(...numBirimler)}, Max: ${Math.max(...numBirimler)}`);
      console.log(`Sifir birim sayisi: ${numBirimler.filter(b => b === 0).length}`);
    }
  }

  const sutKoduCol = columns.find(c => c.toLowerCase().includes('sut') && c.toLowerCase().includes('kod'));
  if (sutKoduCol) {
    const sutDolu = data.filter(r => r[sutKoduCol] && r[sutKoduCol].toString().trim() !== '').length;
    console.log(`\nSutKodu Kolonu: "${sutKoduCol}"`);
    console.log(`Dolu: ${sutDolu}/${data.length} (${((sutDolu / data.length) * 100).toFixed(1)}%)`);
    const sutOrnekler = data.filter(r => r[sutKoduCol] && r[sutKoduCol].toString().trim() !== '').slice(0, 5);
    console.log('Ornek SUT kodlari:');
    sutOrnekler.forEach(r => console.log(`  HUV: ${r[huvKoduCol]} -> SUT: ${r[sutKoduCol]}`));
  }

  console.log('\nOrnek satirlar (ilk 3):');
  data.slice(0, 3).forEach((r, i) => {
    console.log(`\n  Satir ${i + 1}:`);
    columns.forEach(c => {
      if (r[c] != null && r[c].toString().trim() !== '') {
        console.log(`    ${c}: ${r[c].toString().substring(0, 100)}`);
      }
    });
  });
}

// Calistir: node scripts/analyze-huv-excel.js (huv-api klasorunden)
// veya: cd huv-api && node ../scripts/analyze-huv-excel.js
analyzeHuvExcel();
