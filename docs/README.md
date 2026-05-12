# HUV Projesi - Dokümantasyon İndeksi

**Oluşturulma Tarihi:** 12.05.2026  
**Proje:** Sağlık Uygulama Tebliği (HUV) Yönetim Sistemi

---

## 📚 Dokümantasyon Listesi

Bu klasörde HUV projesinin tüm teknik dokümantasyonu bulunmaktadır.

### 1. 📊 DATABASE-ANALYSIS.md
**Veritabanı Detaylı Analiz Raporu**

Otomatik olarak oluşturulan kapsamlı veritabanı analiz raporu.

**İçerik**:
- Veritabanı genel bilgileri ve istatistikler
- Tüm tabloların detaylı yapısı (15 tablo)
- Kolon tanımları ve veri tipleri
- Primary Key, Foreign Key, Index bilgileri
- Trigger'lar ve constraint'ler
- View tanımları (4 view)
- Stored Procedure'lar (16 SP)
- Function'lar
- Mermaid ER diyagramı

**Kullanım**: Veritabanı yapısını anlamak, tablo ilişkilerini görmek

---

### 2. 🔌 API-DOCUMENTATION.md
**API Endpoint Dokümantasyonu**

Tüm REST API endpoint'lerinin detaylı dokümantasyonu.

**İçerik**:
- 61 endpoint'in tam listesi
- HTTP method'ları (GET, POST, PUT, DELETE, PATCH)
- Yetkilendirme gereksinimleri (Public, Auth, Admin)
- Path parametreleri
- Request/Response formatları
- Authentication bilgileri
- Error response'ları
- HTTP status code'ları

**Kullanım**: API entegrasyonu, frontend geliştirme

---

### 3. 🏗️ ARCHITECTURE.md
**Proje Mimari Dokümantasyonu**

Projenin genel mimarisi ve teknik detayları.

**İçerik**:
- Proje genel bakış
- Teknoloji stack (Backend & Frontend)
- Proje klasör yapısı
- Veritabanı mimarisi
- API mimarisi (Katmanlı mimari)
- Frontend mimarisi (Component yapısı)
- Güvenlik özellikleri
- Performans optimizasyonları
- Deployment bilgileri
- Monitoring ve logging

**Kullanım**: Proje mimarisini anlamak, yeni geliştirici onboarding

---

### 4. 🗄️ DATABASE-SCHEMA.md
**Veritabanı Şema Dokümantasyonu**

Veritabanı şemasının detaylı açıklaması.

**İçerik**:
- Tablo grupları ve kategorileri
- Her tablonun detaylı açıklaması
- İlişki diyagramları
- View'ların kullanımı
- Stored Procedure parametreleri
- Güvenlik özellikleri (Constraints, Triggers)
- Performans istatistikleri
- Bakım ve optimizasyon bilgileri

**Kullanım**: Veritabanı tasarımını anlamak, sorgu yazımı

---

### 5. 📄 PROJE-DOKUMANTASYONU.md
**Proje Genel Dokümantasyonu**

Projenin genel tanıtımı ve kullanım kılavuzu.

**İçerik**:
- Proje tanımı ve amaç
- Özellikler listesi
- Kurulum talimatları
- Kullanım kılavuzu
- Ekran görüntüleri
- Sık sorulan sorular

**Kullanım**: Proje hakkında genel bilgi, kullanıcı kılavuzu

---

### 6. 📊 database-structure.json
**Veritabanı Yapısı (JSON)**

Veritabanı yapısının makine okunabilir JSON formatı.

**İçerik**:
- Tüm tablo yapıları
- Kolon tanımları
- İlişkiler
- Index'ler
- Constraint'ler
- View'lar
- Stored Procedure'lar

**Kullanım**: Otomatik kod üretimi, analiz araçları

---

## 🚀 Hızlı Başlangıç

### Yeni Geliştiriciler İçin

1. **İlk Adım**: `PROJE-DOKUMANTASYONU.md` - Projeyi tanıyın
2. **Mimari**: `ARCHITECTURE.md` - Proje yapısını anlayın
3. **Veritabanı**: `DATABASE-SCHEMA.md` - DB yapısını öğrenin
4. **API**: `API-DOCUMENTATION.md` - Endpoint'leri inceleyin
5. **Detay**: `DATABASE-ANALYSIS.md` - Derinlemesine analiz

### Frontend Geliştiriciler İçin

1. `API-DOCUMENTATION.md` - Endpoint'leri öğrenin
2. `ARCHITECTURE.md` → Frontend Mimarisi bölümü
3. `DATABASE-SCHEMA.md` - Veri modelini anlayın

### Backend Geliştiriciler İçin

1. `ARCHITECTURE.md` → API Mimarisi bölümü
2. `DATABASE-SCHEMA.md` - Tablo yapılarını öğrenin
3. `DATABASE-ANALYSIS.md` - Detaylı DB analizi
4. `API-DOCUMENTATION.md` - Mevcut endpoint'leri görün

### DevOps İçin

1. `ARCHITECTURE.md` → Deployment bölümü
2. `DATABASE-SCHEMA.md` → Bakım ve Optimizasyon
3. Environment variables ve konfigürasyon

---

## 📊 Proje İstatistikleri

### Veritabanı
- **Toplam Tablo**: 15
- **Toplam View**: 4
- **Toplam SP**: 16
- **Toplam Satır**: ~70,000
- **Toplam Alan**: ~57 MB

### API
- **Toplam Endpoint**: 61
- **Public Endpoint**: 3
- **Auth Required**: 58
- **Admin Only**: 18

### Kod
- **Backend Dosya**: 50+
- **Frontend Dosya**: 100+
- **Toplam Satır**: 15,000+

---

## 🔄 Dokümantasyon Güncelleme

### Otomatik Güncelleme

Bazı dokümantasyonlar otomatik scriptler ile güncellenebilir:

```bash
# Veritabanı analizi
cd huv-api
node scripts/db-analyzer.js

# API dokümantasyonu
node scripts/api-doc-generator.js
```

### Manuel Güncelleme

Aşağıdaki dokümantasyonlar manuel güncelleme gerektirir:
- `PROJE-DOKUMANTASYONU.md`
- `ARCHITECTURE.md`
- `DATABASE-SCHEMA.md`

---

## 📝 Dokümantasyon Standartları

### Markdown Formatı

- Başlıklar: `#`, `##`, `###`
- Kod blokları: \`\`\`language
- Tablolar: Markdown table syntax
- Listeler: `-` veya `1.`
- Vurgulama: `**bold**`, `*italic*`, \`code\`

### Emoji Kullanımı

- 📊 Veri/İstatistik
- 🔌 API/Entegrasyon
- 🏗️ Mimari/Yapı
- 🗄️ Veritabanı
- 🚀 Başlangıç/Deployment
- 🔒 Güvenlik
- ⚡ Performans
- 📝 Dokümantasyon
- ✅ Başarılı/Tamamlandı
- ❌ Hata/Başarısız

---

## 🔗 İlgili Kaynaklar

### Dış Dokümantasyon

- [Node.js Docs](https://nodejs.org/docs/)
- [Express.js Guide](https://expressjs.com/en/guide/routing.html)
- [React Documentation](https://react.dev/)
- [Material-UI Docs](https://mui.com/material-ui/getting-started/)
- [SQL Server Docs](https://docs.microsoft.com/en-us/sql/sql-server/)

### Proje Repository

- GitHub: (Repository URL buraya)
- Issue Tracker: (Issue tracker URL buraya)
- Wiki: (Wiki URL buraya)

---

## 📞 İletişim

### Teknik Sorular

- **Backend**: Backend ekibi
- **Frontend**: Frontend ekibi
- **Database**: DBA ekibi
- **DevOps**: DevOps ekibi

### Dokümantasyon Güncellemeleri

Dokümantasyonda eksik veya hatalı bilgi bulursanız:
1. Issue açın
2. Pull request gönderin
3. Ekip liderine bildirin

---

## 📅 Versiyon Geçmişi

| Versiyon | Tarih | Açıklama |
|----------|-------|----------|
| 1.0.0 | 12.05.2026 | İlk dokümantasyon seti oluşturuldu |
| | | - DATABASE-ANALYSIS.md |
| | | - API-DOCUMENTATION.md |
| | | - ARCHITECTURE.md |
| | | - DATABASE-SCHEMA.md |
| | | - database-structure.json |

---

## ✅ Dokümantasyon Checklist

### Yeni Özellik Eklendiğinde

- [ ] API-DOCUMENTATION.md güncellendi
- [ ] ARCHITECTURE.md güncellendi (gerekirse)
- [ ] DATABASE-SCHEMA.md güncellendi (DB değişikliği varsa)
- [ ] Kod içi comment'ler eklendi
- [ ] README.md güncellendi (gerekirse)

### Veritabanı Değişikliğinde

- [ ] DATABASE-ANALYSIS.md yeniden oluşturuldu
- [ ] DATABASE-SCHEMA.md güncellendi
- [ ] database-structure.json yeniden oluşturuldu
- [ ] Migration script'i oluşturuldu
- [ ] Backup alındı

### Release Öncesi

- [ ] Tüm dokümantasyon gözden geçirildi
- [ ] Versiyon numaraları güncellendi
- [ ] Değişiklik notları eklendi
- [ ] Ekran görüntüleri güncellendi
- [ ] Link'ler kontrol edildi

---

**Son Güncelleme:** 12.05.2026  
**Dokümantasyon Versiyonu:** 1.0.0  
**Proje Versiyonu:** 1.0.0
