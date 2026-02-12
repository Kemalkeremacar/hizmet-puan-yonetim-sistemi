-- ============================================
-- HUV VERİLERİNİ SIFIRLA
-- ============================================
-- Tüm HUV verilerini sil ve temiz başla
-- ============================================

USE HuvDB;
GO

SET QUOTED_IDENTIFIER ON;
GO

PRINT '========================================';
PRINT 'HUV VERİLERİNİ SIFIRLA';
PRINT '========================================';
PRINT '';

-- 1. IslemAudit kayıtlarını sil
PRINT '1. IslemAudit kayıtları siliniyor...';
DELETE FROM IslemAudit;
PRINT CAST(@@ROWCOUNT AS VARCHAR) + ' audit kaydı silindi';
PRINT '';

-- 2. HuvSutEslestirme kayıtlarını sil
PRINT '2. HuvSutEslestirme kayıtları siliniyor...';
DELETE FROM HuvSutEslestirme;
PRINT CAST(@@ROWCOUNT AS VARCHAR) + ' eşleştirme kaydı silindi';
PRINT '';

-- 3. IslemVersionlar kayıtlarını sil
PRINT '3. IslemVersionlar kayıtları siliniyor...';
DELETE FROM IslemVersionlar;
PRINT CAST(@@ROWCOUNT AS VARCHAR) + ' versiyon kaydı silindi';
PRINT '';

-- 4. HuvIslemler kayıtlarını sil
PRINT '4. HuvIslemler kayıtları siliniyor...';
DELETE FROM HuvIslemler;
PRINT CAST(@@ROWCOUNT AS VARCHAR) + ' işlem kaydı silindi';
PRINT '';

-- 5. ListeVersiyon kayıtlarını sil (sadece HUV)
PRINT '5. ListeVersiyon kayıtları siliniyor (HUV)...';
DELETE FROM ListeVersiyon WHERE ListeTipi = 'HUV';
PRINT CAST(@@ROWCOUNT AS VARCHAR) + ' versiyon kaydı silindi';
PRINT '';

PRINT '========================================';
PRINT 'KONTROL';
PRINT '========================================';
PRINT '';

PRINT 'Kalan kayıtlar:';
SELECT 'HuvIslemler' as Tablo, COUNT(*) as Adet FROM HuvIslemler
UNION ALL
SELECT 'IslemVersionlar', COUNT(*) FROM IslemVersionlar
UNION ALL
SELECT 'IslemAudit', COUNT(*) FROM IslemAudit
UNION ALL
SELECT 'HuvSutEslestirme', COUNT(*) FROM HuvSutEslestirme
UNION ALL
SELECT 'ListeVersiyon (HUV)', COUNT(*) FROM ListeVersiyon WHERE ListeTipi = 'HUV';

PRINT '';
PRINT '✅ HUV verileri sıfırlandı!';
PRINT '';
PRINT 'ŞİMDİ YAPILACAKLAR:';
PRINT '1. Frontend''den V4 Excel''ini import et (07.10.2025.xls)';
PRINT '2. Frontend''den V5 Excel''ini import et (05.02.2026.xlsx)';
PRINT '3. Tarihsel testleri yap';
GO
