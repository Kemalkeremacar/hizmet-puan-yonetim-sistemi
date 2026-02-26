---
title: Important System Notes
description: Önemli sistem notları ve tasarım kararları
inclusion: auto
---

# Önemli Sistem Notları

Bu dosya, sistemdeki önemli tasarım kararlarını ve dikkat edilmesi gereken noktaları içerir.

## 1. External API - Hiyerarşi Kırılımı

### Durum
External API (`/api/external/huv`) **sadece ilk 2 seviye** hiyerarşi döner.

### Neden?
- Basitleştirilmiş gruplama
- Üçüncü parti sistemler için kolay kullanım
- Response boyutunu küçük tutma

### Detay
```javascript
// İç Sistem (HuvIslemler.UstBaslik):
"KALP VE DAMAR CERRAHİSİ → ERİŞKİN KALP CERRAHİSİ → Kapak Cerrahisi → Mitral Kapak"
// 4 seviye

// External API Gruplama:
ustTeminat: "KALP VE DAMAR CERRAHİSİ"      // Seviye 1
altTeminat: "ERİŞKİN KALP CERRAHİSİ"       // Seviye 2
// Seviye 3-4 gruplama için kullanılmaz

// Ama işlem detayında tam bilgi var:
islemler[0].ustBaslik: "KALP VE DAMAR CERRAHİSİ → ERİŞKİN KALP CERRAHİSİ → Kapak Cerrahisi → Mitral Kapak"
islemler[0].hiyerarsiSeviyesi: 4
```

### Sonuç
- ✅ Farklı alt seviyeler aynı grupta toplanır (kasıtlı)
- ✅ Tam hiyerarşi bilgisi kaybolmaz (işlem detayında var)
- ✅ Bu şekilde kullanmaya devam edilecek

### İlgili Dosyalar
- `huv-api/src/controllers/externalController.js` - getHuvList()
- `.kiro/steering/external-api-documentation.md` - Detaylı açıklama

---

## 2. Eşleştirme Sistemi - Manuel Değişiklik Koruması

### Durum
Manuel değiştirilen eşleşmeler (`IsOverridden=1`) batch eşleştirmeden korunur.

### Neden?
- Kullanıcının manuel kararlarını korumak
- Otomatik sistemin manuel değişiklikleri ezmesini önlemek

### Detay
```javascript
// MatchingEngine.saveMatch() içinde
if (existing.IsOverridden === 1) {
  console.log(`⚠️  Skipping SutID ${sutId} - manually overridden`);
  return existing; // Değiştirme, koru
}
```

### Sonuç
- ✅ Manuel değişiklikler güvende
- ✅ Batch yeniden eşleştirme çalışabilir
- ⚠️ Orijinal değerler saklanır (geri dönüş için)

### İlgili Dosyalar
- `huv-api/src/services/matching/MatchingEngine.js` - saveMatch()
- `.kiro/steering/matching-system-analysis.md` - Detaylı analiz

---

## 3. Potansiyel Race Condition (Bilinen Sorun)

### Durum
`saveMatch()` fonksiyonu transaction kullanmıyor.

### Risk
Aynı anda iki işlem aynı SUT'u eşleştirmeye çalışırsa UNIQUE constraint hatası.

### Olasılık
Çok düşük (batch + manuel eşzamanlı çalışırsa)

### Çözüm
Transaction eklenebilir (öncelik: orta)

### İlgili Dosyalar
- `huv-api/src/services/matching/MatchingEngine.js` - saveMatch()
- `.kiro/steering/matching-system-analysis.md` - Potansiyel Sorunlar bölümü

---

## 4. Frontend External API Kullanmıyor

### Durum
`externalService.js` var ama hiçbir component kullanmıyor.

### Neden?
- External API üçüncü parti sistemler için
- Frontend kendi internal API'lerini kullanıyor (`/api/sut`, `/api/alt-teminatlar`, vb.)

### Sonuç
- ✅ Bu normal ve kasıtlı
- ✅ İki farklı API farklı ihtiyaçlar için

### İlgili Dosyalar
- `huv-frontend/src/services/externalService.js` - Kullanılmayan service
- `.kiro/steering/external-api-documentation.md` - Açıklama

---

## 5. IsApproved Sıfırlanmıyor (Küçük Bug)

### Durum
Onaylanan eşleşme değiştirilince `IsApproved` sıfırlanmıyor.

### Beklenen
```javascript
// changeMatch() içinde
IsApproved = 0  // Yeni eşleşme onaysız olmalı
```

### Mevcut
```javascript
// IsApproved değişmiyor, eski değer kalıyor
```

### Etki
Düşük (sadece UI'da "Onaylı" görünmeye devam eder)

### Çözüm
`changeMatch()` fonksiyonuna `IsApproved = 0` eklenebilir

### İlgili Dosyalar
- `huv-api/src/services/matching/MatchingEngine.js` - changeMatch()

---

## Güncelleme Tarihi
2024-02-26

## Notlar
Bu dosya sistem geliştikçe güncellenmelidir.
