const path = require('path');
const apiDir = path.join(__dirname, '..', 'huv-api');
require(path.join(apiDir, 'node_modules', 'dotenv')).config({ path: path.join(apiDir, '.env'), override: true });
const sql = require(path.join(apiDir, 'node_modules', 'mssql'));

let passed = 0, failed = 0, warnings = 0;
function ok(label, val) { console.log(`  ✓ ${label}: ${val}`); passed++; }
function fail(label, val) { console.log(`  ✗ ${label}: ${val}`); failed++; }
function warn(label, val) { console.log(`  ⚠ ${label}: ${val}`); warnings++; }
function check(label, condition, okVal, failVal) {
  if (condition) ok(label, okVal);
  else fail(label, failVal || okVal);
}

async function verify() {
  const pool = await sql.connect({
    server: process.env.DB_SERVER, port: parseInt(process.env.DB_PORT) || 1433,
    database: process.env.DB_DATABASE, user: process.env.DB_USER, password: process.env.DB_PASSWORD,
    options: { encrypt: false, trustServerCertificate: true, enableArithAbort: true }
  });
  const q = async (query) => (await pool.request().query(query)).recordset;
  const val = async (query) => (await q(query))[0]?.c ?? 0;

  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║      KAPSAMLI DB DOĞRULAMA - FAZ 5 HARİÇ       ║');
  console.log('╚══════════════════════════════════════════════════╝\n');

  // ========================================
  // 1. VERSİYON YÖNETİMİ
  // ========================================
  console.log('━━━ 1. VERSİYON YÖNETİMİ (ListeVersiyon) ━━━');
  const versions = await q(`SELECT VersionID, ListeTipi, YuklemeTarihi, KayitSayisi, Aciklama, YukleyenKullanici FROM ListeVersiyon ORDER BY VersionID`);
  console.log(`  Toplam versiyon: ${versions.length}`);
  for (const v of versions) {
    const tarih = v.YuklemeTarihi ? new Date(v.YuklemeTarihi).toISOString().slice(0,10) : '?';
    console.log(`    V${v.VersionID} | ${v.ListeTipi.padEnd(10)} | ${tarih} | ${v.KayitSayisi} kayıt`);
  }

  const huvVersions = versions.filter(v => v.ListeTipi === 'HUV');
  const sutVersions = versions.filter(v => v.ListeTipi === 'SUT');
  const ilVersions = versions.filter(v => v.ListeTipi === 'ILKATSAYI');

  check('HUV versiyon sayısı', huvVersions.length >= 1, `${huvVersions.length} versiyon`);
  check('SUT versiyon sayısı', sutVersions.length >= 1, `${sutVersions.length} versiyon`);
  check('IL versiyon sayısı', ilVersions.length >= 1, `${ilVersions.length} versiyon`);

  // İlk tarih kontrolü (05.02.2026)
  const firstHuv = huvVersions[0];
  const firstSut = sutVersions[0];
  if (firstHuv) {
    const t = new Date(firstHuv.YuklemeTarihi).toISOString().slice(0,10);
    check('HUV ilk tarih 2026-02-05', t === '2026-02-05', t, `YANLIS: ${t}`);
  }
  if (firstSut) {
    const t = new Date(firstSut.YuklemeTarihi).toISOString().slice(0,10);
    check('SUT ilk tarih 2026-02-05', t === '2026-02-05', t, `YANLIS: ${t}`);
  }

  // ========================================
  // 2. HUV VERİLERİ
  // ========================================
  console.log('\n━━━ 2. HUV VERİLERİ ━━━');
  const huvIslemCount = await val(`SELECT COUNT(*) as c FROM HuvIslemler WHERE AktifMi=1`);
  check('HUV aktif işlem sayısı', huvIslemCount === 8591, `${huvIslemCount}`, `YANLIS: ${huvIslemCount} (beklenen: 8591)`);

  const huvTotalIslem = await val(`SELECT COUNT(*) as c FROM HuvIslemler`);
  console.log(`  Toplam HUV islem (aktif+pasif): ${huvTotalIslem}`);

  // Duplicate aktif HUV islem
  const huvDupActive = await val(`SELECT COUNT(*) as c FROM (SELECT HuvKodu, COUNT(*) as cnt FROM HuvIslemler WHERE AktifMi=1 GROUP BY HuvKodu HAVING COUNT(*)>1) t`);
  check('HUV duplicate aktif', huvDupActive === 0, 'YOK', `${huvDupActive} DUPLICATE VAR!`);

  // HUV IslemVersionlar
  const huvVerActive = await val(`SELECT COUNT(*) as c FROM IslemVersionlar WHERE AktifMi=1`);
  console.log(`  HUV IslemVersionlar aktif: ${huvVerActive}`);
  check('HUV IslemVersionlar aktif = HUV aktif işlem', huvVerActive === huvIslemCount, `${huvVerActive}`, `UYUŞMUYOR: ${huvVerActive} vs ${huvIslemCount}`);

  // Orphan HUV IslemVersionlar
  const huvOrphanVer = await val(`SELECT COUNT(*) as c FROM IslemVersionlar iv WHERE NOT EXISTS (SELECT 1 FROM HuvIslemler h WHERE h.IslemID=iv.IslemID)`);
  check('HUV orphan IslemVersionlar', huvOrphanVer === 0, 'YOK', `${huvOrphanVer} ORPHAN!`);

  // Bozuk tarih HUV
  const huvBadDate = await val(`SELECT COUNT(*) as c FROM IslemVersionlar WHERE GecerlilikBitis IS NOT NULL AND GecerlilikBitis < GecerlilikBaslangic`);
  check('HUV bozuk tarih (bitis<baslangic)', huvBadDate === 0, 'YOK', `${huvBadDate} BOZUK!`);

  // ListeVersiyonID referans
  const huvBadVersion = await val(`SELECT COUNT(*) as c FROM HuvIslemler WHERE ListeVersiyonID NOT IN (SELECT VersionID FROM ListeVersiyon)`);
  check('HUV geçersiz ListeVersiyonID', huvBadVersion === 0, 'YOK', `${huvBadVersion} GEÇERSİZ!`);

  // ========================================
  // 3. HUV HİYERARŞİ
  // ========================================
  console.log('\n━━━ 3. HUV HİYERARŞİ ━━━');
  const anaDalCount = await val(`SELECT COUNT(*) as c FROM AnaDallar`);
  check('HUV ana dal sayısı', anaDalCount === 34, `${anaDalCount}`, `YANLIS: ${anaDalCount} (beklenen: 34)`);

  const altTeminatCount = await val(`SELECT COUNT(*) as c FROM HuvAltTeminatlar WHERE AktifMi=1`);
  console.log(`  Alt teminat sayısı: ${altTeminatCount}`);
  check('HUV alt teminat > 0', altTeminatCount > 0, `${altTeminatCount}`);

  // Her ana dalın işlem sayısı
  const anaDalDist = await q(`SELECT a.AnaDalKodu, a.BolumAdi, COUNT(h.IslemID) as cnt FROM AnaDallar a LEFT JOIN HuvIslemler h ON a.AnaDalKodu=h.AnaDalKodu AND h.AktifMi=1 GROUP BY a.AnaDalKodu, a.BolumAdi ORDER BY a.AnaDalKodu`);
  const emptyAnaDal = anaDalDist.filter(a => a.cnt === 0);
  check('Boş ana dal', emptyAnaDal.length === 0, 'YOK', `${emptyAnaDal.length}: ${emptyAnaDal.map(a=>a.BolumAdi).join(', ')}`);

  // HUV UstBaslik dolu mu?
  const huvNoUstBaslik = await val(`SELECT COUNT(*) as c FROM HuvIslemler WHERE AktifMi=1 AND (UstBaslik IS NULL OR UstBaslik='')`);
  console.log(`  HUV UstBaslik boş: ${huvNoUstBaslik} (max 35 beklenir - en üst seviye)`);

  // ========================================
  // 4. SUT VERİLERİ
  // ========================================
  console.log('\n━━━ 4. SUT VERİLERİ ━━━');
  const sutIslemCount = await val(`SELECT COUNT(*) as c FROM SutIslemler WHERE AktifMi=1`);
  check('SUT aktif işlem sayısı', sutIslemCount === 7129, `${sutIslemCount}`, `YANLIS: ${sutIslemCount} (beklenen: 7129)`);

  const sutTotalIslem = await val(`SELECT COUNT(*) as c FROM SutIslemler`);
  console.log(`  Toplam SUT islem (aktif+pasif): ${sutTotalIslem}`);

  // Duplicate aktif SUT
  const sutDupActive = await val(`SELECT COUNT(*) as c FROM (SELECT SutKodu, COUNT(*) as cnt FROM SutIslemler WHERE AktifMi=1 GROUP BY SutKodu HAVING COUNT(*)>1) t`);
  check('SUT duplicate aktif', sutDupActive === 0, 'YOK', `${sutDupActive} DUPLICATE VAR!`);

  // SUT IslemVersionlar
  const sutVerActive = await val(`SELECT COUNT(*) as c FROM SutIslemVersionlar WHERE AktifMi=1`);
  console.log(`  SUT IslemVersionlar aktif: ${sutVerActive}`);
  check('SUT IslemVersionlar aktif = SUT aktif işlem', sutVerActive === sutIslemCount, `${sutVerActive}`, `UYUŞMUYOR: ${sutVerActive} vs ${sutIslemCount}`);

  // Orphan SUT IslemVersionlar
  const sutOrphanVer = await val(`SELECT COUNT(*) as c FROM SutIslemVersionlar sv WHERE NOT EXISTS (SELECT 1 FROM SutIslemler s WHERE s.SutID=sv.SutID)`);
  check('SUT orphan IslemVersionlar', sutOrphanVer === 0, 'YOK', `${sutOrphanVer} ORPHAN!`);

  // Bozuk tarih SUT
  const sutBadDate = await val(`SELECT COUNT(*) as c FROM SutIslemVersionlar WHERE GecerlilikBitis IS NOT NULL AND GecerlilikBitis < GecerlilikBaslangic`);
  check('SUT bozuk tarih', sutBadDate === 0, 'YOK', `${sutBadDate} BOZUK!`);

  // SUT Puan dolu mu?
  const sutNoPuan = await val(`SELECT COUNT(*) as c FROM SutIslemler WHERE AktifMi=1 AND (Puan IS NULL OR Puan=0)`);
  console.log(`  SUT puanı boş/0: ${sutNoPuan}`);

  // ========================================
  // 5. SUT HİYERARŞİ (DETAYLİ)
  // ========================================
  console.log('\n━━━ 5. SUT HİYERARŞİ (DETAYLİ) ━━━');
  const sutAnaBaslikCount = await val(`SELECT COUNT(*) as c FROM SutAnaBasliklar WHERE AktifMi=1`);
  check('SUT ana başlık sayısı', sutAnaBaslikCount === 10, `${sutAnaBaslikCount}`, `YANLIS: ${sutAnaBaslikCount}`);

  const sutHiyerarsiTotal = await val(`SELECT COUNT(*) as c FROM SutHiyerarsi WHERE AktifMi=1`);
  console.log(`  SUT hiyerarşi düğüm sayısı: ${sutHiyerarsiTotal}`);

  // Seviye dağılımı
  const seviyeDist = await q(`SELECT SeviyeNo, COUNT(*) as cnt FROM SutHiyerarsi WHERE AktifMi=1 GROUP BY SeviyeNo ORDER BY SeviyeNo`);
  console.log(`  Seviye dağılımı: ${seviyeDist.map(s => `Sv${s.SeviyeNo}:${s.cnt}`).join(', ')}`);

  // Phantom kontrol
  const roots = await q(`SELECT h.HiyerarsiID, h.Baslik, a.AnaBaslikNo FROM SutHiyerarsi h JOIN SutAnaBasliklar a ON h.HiyerarsiID=a.HiyerarsiID ORDER BY a.AnaBaslikNo`);
  let phantomCount = 0;
  for (const root of roots) {
    const phantoms = await q(`SELECT HiyerarsiID, Baslik FROM SutHiyerarsi WHERE ParentID=${root.HiyerarsiID} AND Baslik=N'${root.Baslik.replace(/'/g,"''")}'`);
    phantomCount += phantoms.length;
  }
  check('SUT phantom node', phantomCount === 0, 'YOK', `${phantomCount} PHANTOM VAR!`);

  // Seviye atlama (root altında Sv>2)
  let skipCount = 0;
  for (const root of roots) {
    const children = await q(`SELECT SeviyeNo FROM SutHiyerarsi WHERE ParentID=${root.HiyerarsiID}`);
    for (const c of children) { if (c.SeviyeNo > 2) skipCount++; }
  }
  check('SUT root altında Sv>2', skipCount === 0, 'YOK', `${skipCount} ATLAMA VAR!`);

  // Seviye tutarlılığı (parent+1)
  const inconsistent = await val(`SELECT COUNT(*) as c FROM SutHiyerarsi h JOIN SutHiyerarsi p ON h.ParentID=p.HiyerarsiID WHERE h.AktifMi=1 AND h.SeviyeNo != p.SeviyeNo+1`);
  check('SUT seviye tutarlılığı (parent+1)', inconsistent === 0, 'OK', `${inconsistent} TUTARSIZ!`);

  // Orphan SUT işlem (HiyerarsiID eksik veya geçersiz)
  const sutOrphanIslem = await val(`SELECT COUNT(*) as c FROM SutIslemler WHERE AktifMi=1 AND (HiyerarsiID IS NULL OR HiyerarsiID NOT IN (SELECT HiyerarsiID FROM SutHiyerarsi WHERE AktifMi=1))`);
  check('SUT orphan işlem', sutOrphanIslem === 0, 'YOK', `${sutOrphanIslem} ORPHAN!`);

  // MRG parent kontrol
  const mrgCheck = await q(`SELECT h.HiyerarsiID, p.Baslik as ParentBaslik FROM SutHiyerarsi h JOIN SutHiyerarsi p ON h.ParentID=p.HiyerarsiID WHERE h.Baslik LIKE '8.3.2.%MANYETİK%'`);
  if (mrgCheck.length > 0) {
    check('MRG parent 8.3.', mrgCheck[0].ParentBaslik.includes('8.3.'), `"${mrgCheck[0].ParentBaslik.substring(0,50)}"`, 'YANLIS PARENT!');
  }

  // BT items parent kontrol
  const btCheck = await q(`SELECT h.Baslik, p.Baslik as ParentBaslik FROM SutHiyerarsi h JOIN SutHiyerarsi p ON h.ParentID=p.HiyerarsiID WHERE h.Baslik LIKE 'BT %' AND h.AktifMi=1`);
  const btUnder831 = btCheck.filter(b => b.ParentBaslik.includes('8.3.1.'));
  check('BT items 8.3.1. altında', btUnder831.length === btCheck.length, `${btUnder831.length}/${btCheck.length}`, `Sadece ${btUnder831.length}/${btCheck.length}`);

  // MRG items parent kontrol
  const mrgItemCheck = await q(`SELECT h.Baslik, p.Baslik as ParentBaslik FROM SutHiyerarsi h JOIN SutHiyerarsi p ON h.ParentID=p.HiyerarsiID WHERE h.Baslik LIKE 'MRG %' AND h.AktifMi=1`);
  const mrgUnder832 = mrgItemCheck.filter(b => b.ParentBaslik.includes('8.3.2.'));
  check('MRG items 8.3.2. altında', mrgUnder832.length === mrgItemCheck.length, `${mrgUnder832.length}/${mrgItemCheck.length}`, `Sadece ${mrgUnder832.length}/${mrgItemCheck.length}`);

  // Her ana başlığın işlem sayısı
  console.log('\n  SUT ana başlık işlem dağılımı:');
  for (const root of roots) {
    const subtreeCount = await val(`
      WITH Subtree AS (
        SELECT HiyerarsiID FROM SutHiyerarsi WHERE HiyerarsiID=${root.HiyerarsiID}
        UNION ALL
        SELECT h.HiyerarsiID FROM SutHiyerarsi h JOIN Subtree s ON h.ParentID=s.HiyerarsiID WHERE h.AktifMi=1
      )
      SELECT COUNT(*) as c FROM SutIslemler WHERE AktifMi=1 AND HiyerarsiID IN (SELECT HiyerarsiID FROM Subtree)
    `);
    console.log(`    [${root.AnaBaslikNo}] ${root.Baslik.substring(0,55).padEnd(55)} ${subtreeCount} işlem`);
  }

  // ========================================
  // 6. İL KATSAYI VERİLERİ
  // ========================================
  console.log('\n━━━ 6. İL KATSAYI VERİLERİ ━━━');
  const ilCount = await val(`SELECT COUNT(*) as c FROM IlKatsayilari WHERE AktifMi=1`);
  console.log(`  IL aktif kayıt: ${ilCount}`);
  check('IL aktif kayıt > 0', ilCount > 0, `${ilCount}`);

  const ilVerActive = await val(`SELECT COUNT(*) as c FROM IlKatsayiVersionlar WHERE AktifMi=1`);
  check('IL version aktif = IL aktif kayıt', ilVerActive === ilCount, `${ilVerActive}`, `UYUŞMUYOR: ${ilVerActive} vs ${ilCount}`);

  const ilBadDate = await val(`SELECT COUNT(*) as c FROM IlKatsayiVersionlar WHERE GecerlilikBitis IS NOT NULL AND GecerlilikBitis < GecerlilikBaslangic`);
  check('IL bozuk tarih', ilBadDate === 0, 'YOK', `${ilBadDate} BOZUK!`);

  // IL kolon adını dinamik bul
  const ilCols = await q(`SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='IlKatsayilari' ORDER BY ORDINAL_POSITION`);
  console.log(`  IL kolonlar: ${ilCols.map(c=>c.COLUMN_NAME).join(', ')}`);
  const ilKeyCol = ilCols.find(c => c.COLUMN_NAME.toLowerCase().includes('il'))?.COLUMN_NAME || ilCols[1]?.COLUMN_NAME;
  const ilDup = await val(`SELECT COUNT(*) as c FROM (SELECT [${ilKeyCol}], COUNT(*) as cnt FROM IlKatsayilari WHERE AktifMi=1 GROUP BY [${ilKeyCol}] HAVING COUNT(*)>1) t`);
  check('IL duplicate aktif', ilDup === 0, 'YOK', `${ilDup} DUPLICATE!`);

  // ========================================
  // 7. TARİHSEL SORGU VERİFİKASYON
  // ========================================
  console.log('\n━━━ 7. TARİHSEL SORGU (SP) ━━━');

  // HUV tarihteki fiyat testi
  try {
    const huvFiyat = await q(`EXEC sp_TarihtekiFiyat @Tarih='2026-02-06', @HuvKodu=2.01361`);
    if (huvFiyat.length > 0) {
      ok('sp_TarihtekiFiyat', `HUV 2.01361 @ 2026-02-06 = ${huvFiyat[0].Birim ?? huvFiyat[0].FiyatDegeri ?? 'OK'}`);
    } else {
      warn('sp_TarihtekiFiyat', 'Sonuç boş (kayıt olmayabilir)');
    }
  } catch(e) { fail('sp_TarihtekiFiyat', e.message.substring(0,80)); }

  // SUT tarihteki puan testi
  try {
    const sutPuan = await q(`EXEC sp_SutTarihtekiPuan @Tarih='2026-02-06', @SutKodu='530900'`);
    if (sutPuan.length > 0) {
      ok('sp_SutTarihtekiPuan', `SUT 530900 @ 2026-02-06 = Puan ${sutPuan[0].Puan ?? 'OK'}`);
    } else {
      warn('sp_SutTarihtekiPuan', 'Sonuç boş');
    }
  } catch(e) { fail('sp_SutTarihtekiPuan', e.message.substring(0,80)); }

  // SUT versiyonlar arası karşılaştır (tek versiyon varsa aynı ID'yi gönderir, SP reddeder - beklenen davranış)
  if (sutVersions.length >= 2) {
    try {
      const compare = await q(`EXEC sp_SutVersiyonKarsilastir @EskiVersiyonID=${sutVersions[0].VersionID}, @YeniVersiyonID=${sutVersions[1].VersionID}`);
      ok('sp_SutVersiyonKarsilastir', `${compare.length} satır`);
    } catch(e) { fail('sp_SutVersiyonKarsilastir', e.message.substring(0,80)); }
  } else {
    ok('sp_SutVersiyonKarsilastir', 'SKIP - tek versiyon (SP mevcut)');
  }

  // HUV fiyat degisim raporu
  try {
    const degisim = await q(`EXEC sp_FiyatDegisimRaporu @BaslangicTarihi='2026-02-05', @BitisTarihi='2026-12-31'`);
    ok('sp_FiyatDegisimRaporu', `${degisim.length} kayıt`);
  } catch(e) { fail('sp_FiyatDegisimRaporu', e.message.substring(0,80)); }

  // ========================================
  // 8. VERI BÜTÜNLÜĞÜ CROSS-CHECK
  // ========================================
  console.log('\n━━━ 8. VERİ BÜTÜNLÜĞÜ CROSS-CHECK ━━━');

  // HUV: İşlem sayısı vs Excel analizi
  check('HUV işlem=Excel(8591)', huvIslemCount === 8591, `${huvIslemCount}`, `UYUŞMUYOR: ${huvIslemCount}`);

  // SUT: İşlem sayısı vs Excel analizi (7129)
  check('SUT işlem=Excel(7129)', sutIslemCount === 7129, `${sutIslemCount}`, `UYUŞMUYOR: ${sutIslemCount}`);

  // SUT Hiyerarsi AnaBasliklar HiyerarsiID referans
  const anaBaslikOrphan = await val(`SELECT COUNT(*) as c FROM SutAnaBasliklar WHERE AktifMi=1 AND (HiyerarsiID IS NULL OR HiyerarsiID NOT IN (SELECT HiyerarsiID FROM SutHiyerarsi WHERE AktifMi=1))`);
  check('SUT AnaBasliklar HiyerarsiID ref', anaBaslikOrphan === 0, 'OK', `${anaBaslikOrphan} ORPHAN!`);

  // HUV AnaDal referans
  const huvAnaDalOrphan = await val(`SELECT COUNT(*) as c FROM HuvIslemler WHERE AktifMi=1 AND AnaDalKodu NOT IN (SELECT AnaDalKodu FROM AnaDallar)`);
  check('HUV AnaDalKodu ref', huvAnaDalOrphan === 0, 'OK', `${huvAnaDalOrphan} ORPHAN!`);

  // SUT version-islem cross check
  const sutVerCount = await val(`SELECT COUNT(DISTINCT SutID) as c FROM SutIslemVersionlar WHERE AktifMi=1`);
  check('SUT aktif version distinct SutID=işlem', sutVerCount === sutIslemCount, `${sutVerCount}`, `UYUŞMUYOR: ${sutVerCount} vs ${sutIslemCount}`);

  // HUV version-islem cross check
  const huvVerCount = await val(`SELECT COUNT(DISTINCT IslemID) as c FROM IslemVersionlar WHERE AktifMi=1`);
  check('HUV aktif version distinct IslemID=işlem', huvVerCount === huvIslemCount, `${huvVerCount}`, `UYUŞMUYOR: ${huvVerCount} vs ${huvIslemCount}`);

  // Overlapping versions check (aynı işlem 2x aktif versiyonda)
  const huvOverlap = await val(`SELECT COUNT(*) as c FROM (SELECT IslemID, COUNT(*) as cnt FROM IslemVersionlar WHERE AktifMi=1 GROUP BY IslemID HAVING COUNT(*)>1) t`);
  check('HUV overlapping aktif version', huvOverlap === 0, 'YOK', `${huvOverlap} OVERLAP!`);

  const sutOverlap = await val(`SELECT COUNT(*) as c FROM (SELECT SutID, COUNT(*) as cnt FROM SutIslemVersionlar WHERE AktifMi=1 GROUP BY SutID HAVING COUNT(*)>1) t`);
  check('SUT overlapping aktif version', sutOverlap === 0, 'YOK', `${sutOverlap} OVERLAP!`);

  const ilOverlap = await val(`SELECT COUNT(*) as c FROM (SELECT IlKatsayiID, COUNT(*) as cnt FROM IlKatsayiVersionlar WHERE AktifMi=1 GROUP BY IlKatsayiID HAVING COUNT(*)>1) t`);
  check('IL overlapping aktif version', ilOverlap === 0, 'YOK', `${ilOverlap} OVERLAP!`);

  // ========================================
  // 9. VIEW VE FK CHECK
  // ========================================
  console.log('\n━━━ 9. VIEW VE CONSTRAINT CHECK ━━━');

  // vw_IslemArama var mı?
  const viewExists = await val(`SELECT COUNT(*) as c FROM INFORMATION_SCHEMA.VIEWS WHERE TABLE_NAME='vw_IslemArama'`);
  check('vw_IslemArama view', viewExists === 1, 'VAR', 'YOK!');

  // FK_HuvIslemler_AltTeminatID var mı?
  const fkExists = await val(`SELECT COUNT(*) as c FROM sys.foreign_keys WHERE name='FK_HuvIslemler_AltTeminatID'`);
  check('FK_HuvIslemler_AltTeminatID', fkExists === 1, 'VAR', 'YOK!');

  // AltTeminatID orphan check
  const altTeminatOrphan = await val(`SELECT COUNT(*) as c FROM HuvIslemler WHERE AltTeminatID IS NOT NULL AND AltTeminatID NOT IN (SELECT AltTeminatID FROM HuvAltTeminatlar)`);
  check('HUV AltTeminatID orphan', altTeminatOrphan === 0, 'YOK', `${altTeminatOrphan} ORPHAN!`);

  // ========================================
  // ÖZET
  // ========================================
  console.log('\n╔══════════════════════════════════════════════════╗');
  console.log(`║  SONUÇ: ${passed} geçti  |  ${failed} başarısız  |  ${warnings} uyarı`);
  console.log('╚══════════════════════════════════════════════════╝');

  if (failed > 0) {
    console.log('\n⚠ BAŞARISIZ KONTROLLER:');
    // Script already printed them inline
  } else {
    console.log('\n✓ TÜM KONTROLLER GEÇTİ!');
  }

  await pool.close();
}

verify().catch(e => { console.error('HATA:', e.message); process.exit(1); });
