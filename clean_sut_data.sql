-- ============================================
-- SUT VERİLERİNİ TEMİZLE (Ana Başlıkları Koru)
-- ============================================
-- Bu script SUT işlemlerini ve hiyerarşiyi temizler
-- AMA SutAnaBasliklar tablosunu korur (manuel yönetim)
-- ============================================

USE HuvDB;
GO

PRINT 'SUT verileri temizleniyor...';

-- 1. SUT İşlem Versiyonları sil
DELETE FROM SutIslemVersionlar;
PRINT '   SutIslemVersionlar temizlendi';

-- 2. SUT İşlemleri sil
DELETE FROM SutIslemler;
PRINT '   SutIslemler temizlendi';

-- 3. SutAnaBasliklar'daki HiyerarsiID'leri sıfırla (foreign key için önce bu)
UPDATE SutAnaBasliklar SET HiyerarsiID = NULL;
PRINT '   SutAnaBasliklar HiyerarsiID sifirlandi';

-- 4. SUT Hiyerarşi sil
DELETE FROM SutHiyerarsi;
PRINT '   SutHiyerarsi temizlendi';

-- 5. Liste Versiyonları temizle (sadece SUT)
DELETE FROM ListeVersiyon WHERE ListeTipi = 'SUT';
PRINT '   SUT Liste Versiyonlari temizlendi';

PRINT 'SUT verileri temizlendi, ana basliklar korundu!';
PRINT '';
PRINT 'Kalan kayitlar:';
SELECT 'SutAnaBasliklar' AS Tablo, COUNT(*) AS Kayit FROM SutAnaBasliklar WHERE AktifMi = 1
UNION ALL
SELECT 'SutHiyerarsi', COUNT(*) FROM SutHiyerarsi
UNION ALL
SELECT 'SutIslemler', COUNT(*) FROM SutIslemler
UNION ALL
SELECT 'SutIslemVersionlar', COUNT(*) FROM SutIslemVersionlar;

GO
