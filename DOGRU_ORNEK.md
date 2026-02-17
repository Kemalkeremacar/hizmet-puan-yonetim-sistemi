# Doğru Eşleştirme Mantığı - Örnek

## ✅ Düzeltilmiş Mantık

### HUV İşlemleri
- **Üst Teminat:** AnaDal (GENEL CERRAHİ)
- **Alt Teminat:** UstBaslik (FITIKLAR) - eğer yoksa AnaDal

### SUT İşlemleri
- **Üst Teminat:** Ana Başlık (TIBBİ UYGULAMALAR)
- **Alt Teminat:** Seviye 2 parent (7.4. SİNDİRİM SİSTEMİ) - eğer yoksa Ana Başlık

## 📋 Örnek Senaryolar

### Senaryo 1: HUV İşlemi

**İşlem:**
```
İnguinal herni onarımı (femoral, inguinal, skrotal, obturator), tek taraflı
```

**Teminat Bilgileri:**
- AnaDalKodu: 3
- AnaDalAdi: "GENEL CERRAHİ"
- UstBaslik: "FITIKLAR"

**Sonuç:**
```json
{
  "islemId": 123,
  "huvKodu": "3.45",
  "islemAdi": "İnguinal herni onarımı (femoral, inguinal, skrotal, obturator), tek taraflı",
  "birim": 500.00,
  "ustTeminat": {
    "kod": 3,
    "adi": "GENEL CERRAHİ",
    "tip": "HUV"
  },
  "altTeminat": {
    "kod": 3,
    "adi": "FITIKLAR",
    "tip": "HUV"
  }
}
```

**Eşleştirme Key:** `"genel cerrahi|||fitiklar"`

### Senaryo 2: SUT İşlemi

**İşlem:**
```
24 saatlik pH monitörizasyon veya 24 saatlik empedans ölçümü uygulaması
```

**Teminat Bilgileri:**
- AnaBaslikNo: 7
- AnaBaslikAdi: "TIBBİ UYGULAMALAR"
- HiyerarsiID: 789 (işlemin bağlı olduğu hiyerarşi)
- Seviye 2 Parent: "7.4. SİNDİRİM SİSTEMİ"

**Sonuç:**
```json
{
  "sutId": 456,
  "sutKodu": "R701010",
  "islemAdi": "24 saatlik pH monitörizasyon veya 24 saatlik empedans ölçümü uygulaması",
  "puan": 15.5,
  "ustTeminat": {
    "kod": 7,
    "adi": "TIBBİ UYGULAMALAR",
    "tip": "SUT"
  },
  "altTeminat": {
    "kod": 234,
    "adi": "7.4. SİNDİRİM SİSTEMİ",
    "tip": "SUT"
  }
}
```

**Eşleştirme Key:** `"tibbi uygulamalar|||74 sindirim sistemi"`

### Senaryo 3: Eşleşme Örneği

**HUV:**
- Üst: "GENEL CERRAHİ"
- Alt: "FITIKLAR"
- Key: `"genel cerrahi|||fitiklar"`

**SUT:**
- Üst: "GENEL CERRAHİ" (normalize: "genel cerrahi")
- Alt: "FITIKLAR" (normalize: "fitiklar")
- Key: `"genel cerrahi|||fitiklar"`

**Sonuç:** ✅ BİRLEŞİK GRUP
```json
{
  "ustTeminat": {
    "kod": 3,
    "adi": "GENEL CERRAHİ",
    "tip": "BIRLESIK"
  },
  "altTeminat": {
    "kod": 3,
    "adi": "FITIKLAR",
    "tip": "BIRLESIK"
  },
  "huvIslemler": [
    {
      "islemId": 123,
      "huvKodu": "3.45",
      "islemAdi": "İnguinal herni onarımı...",
      "ustTeminat": {"kod": 3, "adi": "GENEL CERRAHİ", "tip": "HUV"},
      "altTeminat": {"kod": 3, "adi": "FITIKLAR", "tip": "HUV"}
    }
  ],
  "sutIslemler": [
    {
      "sutId": 789,
      "sutKodu": "R301010",
      "islemAdi": "Fıtık onarımı...",
      "ustTeminat": {"kod": 3, "adi": "GENEL CERRAHİ", "tip": "SUT"},
      "altTeminat": {"kod": 123, "adi": "FITIKLAR", "tip": "SUT"}
    }
  ]
}
```

## 🎯 Önemli Noktalar

1. **Her işlemin kendi üst ve alt teminatı var** ✅
2. **HUV'de alt teminat = UstBaslik** (eğer varsa)
3. **SUT'te alt teminat = Seviye 2 parent** (eğer varsa)
4. **Eşleştirme normalize edilmiş adlara göre yapılır**
5. **Aradaki kırılımlar önemli değil** - sadece üst ve alt teminat önemli

## 📊 Normalizasyon Örnekleri

```
"GENEL CERRAHİ" → "genel cerrahi"
"FITIKLAR" → "fitiklar"
"TIBBİ UYGULAMALAR" → "tibbi uygulamalar"
"7.4. SİNDİRİM SİSTEMİ" → "74 sindirim sistemi"
```

## ✅ Artık Doğru Çalışıyor!

- Her HUV işlemi: AnaDal (üst) + UstBaslik (alt)
- Her SUT işlemi: Ana Başlık (üst) + Seviye 2 parent (alt)
- Eşleştirme: Normalize edilmiş üst + alt teminat kombinasyonuna göre
