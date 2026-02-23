---
inclusion: auto
---

# HUV Yönetim Sistemi - Proje Özeti

## Proje Tanımı
Sağlık Uygulama Tebliği (SUT) kodlarını HUV (Hastane Uygulama Veri) alt teminatlarıyla otomatik eşleştiren web uygulaması.

## Teknoloji Stack

### Backend
- **Framework:** Node.js + Express
- **Database:** SQL Server (localhost\SQLEXPRESS)
- **Database Name:** HuvDB
- **Port:** 3000
- **API Prefix:** /api

### Frontend
- **Framework:** React + Vite
- **UI Library:** Material-UI (MUI)
- **State Management:** React Context API
- **Port:** 5173
- **Routing:** React Router

## Veritabanı Yapısı

### Ana Tablolar
1. **SutIslemler** - SUT işlemleri (7,129 kayıt)
   - SutID, SutKodu, IslemAdi, Puan, AnaBaslikNo, HiyerarsiID
   
2. **SutAnaBasliklar** - SUT ana başlıklar (10 adet, 1-10)
   - AnaBaslikNo, AnaBaslikAdi, HiyerarsiID
   
3. **SutHiyerarsi** - SUT hiyerarşik yapı
   - HiyerarsiID, ParentID, SeviyeNo, Baslik, Sira
   
4. **HuvAltTeminatlar** - HUV alt teminatlar
   - AltTeminatID, AltTeminatAdi, UstTeminatAdi, AnaDalKodu
   
5. **AnaDallar** - HUV ana dallar (34 adet)
   - AnaDalKodu, BolumAdi
   
6. **AltTeminatIslemler** - Eşleşme tablosu
   - ID, SutID, AltTeminatID, ConfidenceScore, MatchingRuleType
   - IsAutomatic, IsApproved, IsOverridden
   - OriginalAltTeminatID, OriginalConfidenceScore (manuel değişiklik için)

## Eşleştirme Sistemi

### Otomatik Eşleştirme Stratejileri (Öncelik Sırasıyla)
1. **DirectSutCodeStrategy** - HUV işlemlerinde SUT kodu varsa %100 eşleştir
2. **HierarchyMatchingStrategy** - SUT hiyerarşi başlıklarını kullan
3. **FirstLetterStrategy** - İlk harf eşleşmesi (sadece laboratuvar)
4. **GeneralSimilarityStrategy** - 51+ kural ile genel benzerlik

### Eşleştirme Threshold
- **Minimum:** %70
- **Orta Güven:** %70-84
- **Yüksek Güven:** %85+

### Mevcut İstatistikler
- Toplam: 7,129 SUT işlemi
- Eşleşen: 7,005 (%98.26)
- Eşleşmemiş: 124 (%1.74)

## Önemli Özellikler

### 1. Otomatik Eşleştirme
- SUT import sonrası otomatik batch eşleştirme
- `IsOverridden = 1` kayıtlar korunur (manuel değişiklikler)
- Sadece yeni/eşleşmemiş kayıtlar işlenir

### 2. Manuel Eşleştirme
- Eşleşmemiş kayıtlar için benzerlik skorları gösterilir
- Eşleşmiş kayıtlar için alfabetik liste (skor yok)

### 3. Batch Eşleştirme
- Manuel tetikleme mümkün
- Batch boyutu: 1-10,000
- "Yeniden Eşleştir" seçeneği (manuel değişiklikleri korur)

## Sayfa Yapısı

### Admin Sayfaları
1. **HUV Yönetimi** - Excel import, versiyon yönetimi
2. **SUT Yönetimi** - Excel import + otomatik eşleştirme
3. **İl Katsayıları Yönetimi** - Excel import
4. **Eşleşme Yönetimi** - Eşleşmeleri gör, filtrele, düzenle, batch
5. **Eşleşmemiş Kayıtlar** - Manuel eşleştirme (benzerlik skorlu)

### Ortak Sayfalar
6. **Alt Teminatlar** - Görüntüleme (işlem sayıları)
7. **HUV Liste** - Hiyerarşik görünüm
8. **SUT Liste** - Kategori görünümü
9. **HUV Tarihsel** - Geçmiş fiyat sorguları
10. **SUT Tarihsel** - Geçmiş puan sorguları

## Önemli Kurallar

### SUT vs HUV Hiyerarşi
- **SUT Ana Başlık** (10 adet) ≠ **HUV Ana Dal** (34 adet)
- Farklı sistemler, direkt mapping YOK
- SUT işlemleri → HUV Alt Teminatlarına eşleştirilir

### Manuel Değişiklikler
- `IsOverridden = 1` → Manuel değiştirilmiş
- Batch eşleştirme bu kayıtları ATLAR
- Orijinal değerler saklanır (OriginalAltTeminatID, vb.)

### Filtreler (Eşleşme Yönetimi)
- SUT Kodu, İşlem Adı
- SUT Üst/Alt Teminat
- HUV Üst/Alt Teminat
- Güven Skoru (Min-Max)

## API Endpoints

### Matching
- `POST /api/matching/run-batch` - Batch eşleştirme
- `GET /api/matching/results` - Eşleşmeleri listele (filtreli)
- `GET /api/matching/stats` - İstatistikler
- `GET /api/matching/huv-options/:sutId` - HUV seçenekleri
- `POST /api/matching/approve/:sutId` - Eşleşmeyi onayla
- `PUT /api/matching/change/:sutId` - Eşleşmeyi değiştir

### SUT
- `GET /api/sut/unmatched` - Eşleşmemiş kayıtlar
- `POST /api/sut/import` - SUT import (+ otomatik eşleştirme)

## Kullanıcılar
- **Admin:** admin / admin123
- Tüm yönetim sayfalarına erişim

## Geliştirme Notları

### Son Değişiklikler
1. Batch paneli geri eklendi (manuel yeniden eşleştirme için)
2. SUT import sonrası otomatik eşleştirme
3. Manuel değişiklikleri koruma (`IsOverridden` kontrolü)
4. Benzerlik algoritması geliştirildi (laboratuvar özel kuralı)
5. Eşleşmiş kayıtlarda benzerlik skoru gösterilmiyor

### Bilinen Sorunlar
- Laboratuvar tek harf teminatları (A, B, C, D) için benzerlik skoru %65 (manuel kontrol gerekebilir)

## Türkçe Karakter Desteği
- Database: Turkish_CI_AS collation
- Backend: UTF-8 encoding
- Frontend: Türkçe locale support
