const XLSX = require('xlsx');
const path = require('path');

// ===== SUT EXCEL ANALİZİ =====
// Calistirmak icin: cd huv-api && node ../scripts/analyze-sut-excel.js
// (xlsx modulu huv-api/node_modules altinda)

const filePath = path.join(__dirname, '..', 'EK-2B HİZMET BAŞI İŞLEM PUAN LİSTESİ (Yür.01.01.2026).xlsx');
const workbook = XLSX.readFile(filePath, { codepage: 65001, cellDates: true });
const ws = workbook.Sheets[workbook.SheetNames[0]];
const rawData = XLSX.utils.sheet_to_json(ws, { raw: false, defval: '', blankrows: false, header: 1 });

// Excel yapisi:
// Satir 0: Birlestirilmis baslik "HİZMET BAŞI İŞLEM PUAN LİSTESİ (EK-2/B)"
// Satir 1: Kolon basliklari: İŞLEM KODU | İŞLEM ADI | AÇIKLAMA | İŞLEM PUANI
// Satir 2+: Veri satirlari
const dataRows = rawData.slice(2);

console.log('='.repeat(80));
console.log('SUT EXCEL DETAYLI ANALIZ');
console.log('='.repeat(80));
console.log(`Toplam veri satiri: ${dataRows.length}\n`);

let islemSatiri = 0, hiyerarsiSatiri = 0, bosSatir = 0;
let currentAnaBaslik = 0;
const anaBasliklar = [];
const stats = {};

dataRows.forEach((row, idx) => {
  const kod = (row[0] || '').toString().trim();
  const islemAdi = (row[1] || '').toString().trim();
  const aciklama = (row[2] || '').toString().trim();
  const puan = (row[3] || '').toString().trim();
  const hasKod = kod !== '';
  const hasIslem = islemAdi !== '';

  const textToCheck = hasIslem ? islemAdi : kod;
  const anaMatch = textToCheck.match(/^(\d{1,2})\.\s+([^\d].+)/);

  if (anaMatch && !hasKod && parseInt(anaMatch[1]) >= 1 && parseInt(anaMatch[1]) <= 10) {
    currentAnaBaslik = parseInt(anaMatch[1]);
    anaBasliklar.push({
      no: currentAnaBaslik,
      adi: anaMatch[2].trim().replace(/\n/g, ' ').substring(0, 100),
      satirNo: idx + 3
    });
    stats[currentAnaBaslik] = { islem: 0, hiyerarsi: 0, ornekHiyerarsi: [], ornekIslem: [] };
    hiyerarsiSatiri++;
    return;
  }

  if (hasKod && hasIslem) {
    islemSatiri++;
    if (currentAnaBaslik > 0 && stats[currentAnaBaslik]) {
      stats[currentAnaBaslik].islem++;
      if (stats[currentAnaBaslik].ornekIslem.length < 3) {
        stats[currentAnaBaslik].ornekIslem.push({ kod, islem: islemAdi.substring(0, 80), puan });
      }
    }
  } else if (hasIslem && !hasKod) {
    if (islemAdi.length >= 3) {
      hiyerarsiSatiri++;
      if (currentAnaBaslik > 0 && stats[currentAnaBaslik]) {
        stats[currentAnaBaslik].hiyerarsi++;
        if (stats[currentAnaBaslik].ornekHiyerarsi.length < 10) {
          stats[currentAnaBaslik].ornekHiyerarsi.push(islemAdi.replace(/\n/g, ' ').substring(0, 120));
        }
      }
    }
  } else if (hasKod && !hasIslem) {
    if (/^[A-Z]/.test(kod) && !/^\d/.test(kod) && kod.length > 5) {
      hiyerarsiSatiri++;
      if (currentAnaBaslik > 0 && stats[currentAnaBaslik]) {
        stats[currentAnaBaslik].hiyerarsi++;
        if (stats[currentAnaBaslik].ornekHiyerarsi.length < 10) {
          stats[currentAnaBaslik].ornekHiyerarsi.push(`[KOD kolonu] ${kod.replace(/\n/g, ' ').substring(0, 120)}`);
        }
      }
    } else {
      bosSatir++;
    }
  } else {
    bosSatir++;
  }
});

console.log(`Satir tipi dagilimi:`);
console.log(`  Islem satiri (kod+isim): ${islemSatiri}`);
console.log(`  Hiyerarsi/baslik satiri: ${hiyerarsiSatiri}`);
console.log(`  Bos/diger: ${bosSatir}`);

console.log(`\n${'='.repeat(80)}`);
console.log('10 ANA BASLIK ve DAGILIM');
console.log('='.repeat(80));
anaBasliklar.forEach(ab => {
  const s = stats[ab.no] || { islem: 0, hiyerarsi: 0 };
  console.log(`  ${ab.no}. ${ab.adi}`);
  console.log(`     Excel satir: ~${ab.satirNo} | ${s.islem} islem | ${s.hiyerarsi} hiyerarsi satiri`);
});

console.log(`\n${'='.repeat(80)}`);
console.log('HER ANA BASLIKTAN HIYERARSI ORNEKLERI');
console.log('='.repeat(80));
anaBasliklar.forEach(ab => {
  const s = stats[ab.no];
  if (s && s.ornekHiyerarsi.length > 0) {
    console.log(`\n--- ${ab.no}. ${ab.adi} (${s.hiyerarsi} hiyerarsi satiri) ---`);
    s.ornekHiyerarsi.forEach(o => console.log(`  "${o}"`));
  }
});

console.log(`\n${'='.repeat(80)}`);
console.log('HER ANA BASLIKTAN ISLEM ORNEKLERI');
console.log('='.repeat(80));
anaBasliklar.forEach(ab => {
  const s = stats[ab.no];
  if (s && s.ornekIslem.length > 0) {
    console.log(`\n--- ${ab.no}. ${ab.adi} ---`);
    s.ornekIslem.forEach(o => console.log(`  Kod: ${o.kod} | ${o.islem} | Puan: ${o.puan}`));
  }
});

// Kod format analizi
const tumKodlar = dataRows
  .filter(r => r[0] && r[0].toString().trim() !== '' && r[1] && r[1].toString().trim() !== '')
  .map(r => r[0].toString().trim());

console.log(`\n${'='.repeat(80)}`);
console.log('KOD FORMAT ANALIZI');
console.log('='.repeat(80));
console.log(`Toplam islem kodu: ${tumKodlar.length}`);
const harfli = tumKodlar.filter(k => /^[A-Z]/.test(k));
const rakamli = tumKodlar.filter(k => /^\d/.test(k));
console.log(`Harf ile baslayan: ${harfli.length}`);
console.log(`Rakam ile baslayan: ${rakamli.length}`);
console.log(`\nHarfli kod ornekleri (ilk 10):`);
harfli.slice(0, 10).forEach(k => console.log(`  "${k}"`));
console.log(`\nRakamli kod ornekleri (ilk 10):`);
rakamli.slice(0, 10).forEach(k => console.log(`  "${k}"`));

const uniqueKodlar = new Set(tumKodlar);
console.log(`\nBenzersiz islem kodu: ${uniqueKodlar.size}`);
if (uniqueKodlar.size !== tumKodlar.length) {
  console.log(`UYARI: ${tumKodlar.length - uniqueKodlar.size} tekrarlayan kod var!`);
}

const puanlar = dataRows
  .filter(r => r[3] && r[3].toString().trim() !== '' && r[0] && r[0].toString().trim() !== '')
  .map(r => {
    let p = r[3].toString().trim().replace(/\./g, '').replace(',', '.');
    return parseFloat(p);
  })
  .filter(n => !isNaN(n));

console.log(`\nPuan analizi:`);
console.log(`  Dolu puan: ${puanlar.length}`);
if (puanlar.length > 0) {
  console.log(`  Min: ${Math.min(...puanlar)}`);
  console.log(`  Max: ${Math.max(...puanlar)}`);
  console.log(`  Sifir puan: ${puanlar.filter(p => p === 0).length}`);
}
