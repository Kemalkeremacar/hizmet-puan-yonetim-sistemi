---
title: Matching Algorithms Documentation
description: Detailed documentation of SUT-HUV matching strategies and algorithms
inclusion: auto
fileMatchPattern: "**/matching/**"
---

# Matching Algorithms Documentation

This document provides comprehensive documentation of the SUT-HUV automatic matching system, including all strategies, algorithms, and implementation details.

## Overview

The matching system automatically pairs SUT işlemleri (procedures) with HUV alt teminatları (coverage categories) using multiple strategies with priority-based execution.

### Terminology Clarification

**HUV Structure**:
- Üst Teminat = Ana Dal (34 medical specialties) - Example: "Radyoloji", "Laboratuvar"
- Alt Teminat = Coverage Category under Ana Dal - Example: "BT İnceleme", "Kan Tahlili"

**SUT Structure**:
- Üst Teminat = Ana Başlık (10 main categories) - Example: "Cerrahi İşlemler"
- Alt Teminat = Hiyerarşi Başlığı (Seviye 2-3) - Example: "Radyolojik Görüntüleme"

**Matching Target**:
```
SUT İşlem → HUV Alt Teminat (Coverage Category)
```

Note: HUV İşlemler (HuvIslemler table) is separate - it contains specific procedures with prices.

### Matching Flow

```
1. Direct SUT Code Strategy (Priority 1) - 100% confidence
   ↓ (if no match)
2. Hierarchy Matching Strategy (Priority 2) - 70-95% confidence
   ↓ (if no match)
3. Ana Dal-Specific Strategies (Priority 3) - 70-95% confidence
   - FirstLetterStrategy (Ana Dal 9, 34)
   - GeneralSimilarityStrategy (All others)
   ↓ (if no match)
4. Fallback: Alternative Ana Dal Search
```

## Matching Strategies

### 1. DirectSutCodeStrategy (Priority 1)

**Purpose**: Match when HUV işlem contains the exact SUT code

**Algorithm**:
- Query `HuvIslemler` table for matching `SutKodu`
- If found, return the `AltTeminatID` directly
- Confidence: 100% (exact match)

**Rule Type**: `direct_sut_code`

**Usage**: Checked first for all SUT işlemleri

**Example**:
```javascript
// SUT: 10.01.0001
// HUV İşlem: "Muayene (SUT: 10.01.0001)"
// Result: Direct match → 100% confidence
```

---

### 2. HierarchyMatchingStrategy (Priority 2)

**Purpose**: Match using SUT hierarchy titles (Seviye 2-3)

**Algorithm**:
1. Get SUT işlem's hierarchy titles (Seviye 2 and Seviye 3)
2. Calculate similarity between hierarchy titles and HUV alt teminat names
3. Select best match above 70% threshold
4. Confidence: 70 + (similarity * 25) = 70-95%

**Rule Type**: `hierarchy_matching`

**Database Query**:
```sql
-- Recursive CTE to get hierarchy levels
WITH HierarchyCTE AS (
  SELECT HiyerarsiID, ParentID, SeviyeNo, Baslik, 0 as Level
  FROM SutHiyerarsi
  WHERE HiyerarsiID = @hiyerarsiId
  
  UNION ALL
  
  SELECT h.HiyerarsiID, h.ParentID, h.SeviyeNo, h.Baslik, cte.Level + 1
  FROM SutHiyerarsi h
  INNER JOIN HierarchyCTE cte ON h.HiyerarsiID = cte.ParentID
  WHERE cte.Level < 3
)
SELECT SeviyeNo, Baslik
FROM HierarchyCTE
WHERE Baslik IS NOT NULL AND SeviyeNo >= 2
ORDER BY SeviyeNo
```

**Example**:
```javascript
// SUT Hierarchy: "Radyolojik Görüntüleme" → "BT Anjiyografi"
// HUV Teminat: "Bilgisayarlı Tomografi Anjiyografik İnceleme"
// Similarity: 0.85 → Confidence: 91.25%
```

---

### 3. FirstLetterStrategy (Ana Dal 9, 34)

**Purpose**: Match laboratory tests by first letter

**Ana Dallar**: 
- Ana Dal 9: GÖĞÜS CERRAHİSİ (laboratory tests only)
- Ana Dal 34: LABORATUVAR İNCELEMELERİ

**Algorithm**:
1. Verify SUT işlem is laboratory-related (not surgical)
2. Extract first alphabetic character (skip numbers)
3. Filter HUV teminatlar by first letter match
4. Ensure HUV is also laboratory-related
5. Select best match by highest similarity
6. Minimum threshold: 50%

**Laboratory Keywords** (positive):
```javascript
['vitamin', 'hormon', 'test', 'testi', 'antikor', 'antijen',
 'elisa', 'ifa', 'ifat', 'iha', 'pcr', 'kültür', 'kultur',
 'panel', 'tayini', 'ölçüm', 'olcum', 'analiz', 'tarama',
 'kortizol', 'progesteron', 'testosteron', 'östrojen', 'estrojen',
 'tiroid', 'insülin', 'insulin', 'glukoz', 'hemoglobin',
 'lökosit', 'eritrosit', 'trombosit', 'sedim', 'üre', 'kreatinin',
 'kolesterol', 'trigliserid', 'alt', 'ast', 'ggt', 'ldh',
 'uyarı testi', 'baskılama testi', 'yükleme testi']
```

**Non-Laboratory Keywords** (negative):
```javascript
['cerrahi', 'ameliyat', 'operasyon', 'eksizyon', 'rezeksiyon',
 'trakea', 'bronş', 'toraks', 'göğüs', 'kalp', 'damar',
 'kateter', 'dren', 'sonda', 'entübasyon', 'anestezi']
```

**Confidence Calculation**:
- Ana Dal 34 (single letter teminatlar): 85% (fixed)
- Other Ana Dallar: 70 + (similarity * 25) = 70-95%

**Rule Type**: `first_letter`

**Example**:
```javascript
// SUT: "Vitamin D Tayini"
// HUV: "V" (Ana Dal 34)
// First letter: V = V → Match
// Confidence: 85%
```

---

### 4. GeneralSimilarityStrategy (Default)

**Purpose**: Default strategy for all other Ana Dallar

**Algorithm**:
1. Check rule-based matches first (medical terms)
2. If no rule matches, calculate similarity
3. Select best match above 70% threshold
4. Return confidence score

**Rule-Based Matching** (50+ rules):

#### Negative Filters (Prevent Wrong Matches)
```javascript
// NEG 1: Cerrahi → Dermatoloji/Akne/Epilasyon
// NEG 2: Herni → Pansuman/Epilasyon
// NEG 3: Endoskopi → Dermatoskopi
// NEG 4: Fraktür/Kırık → Akne/Dermatoloji
// NEG 5: Antidot/İlaç → Ağrı tedavisi
```

#### Positive Rules (High Confidence Matches)

**Radiology Rules** (85-95%):
```javascript
// BT + Anjiyografi → Anjiyografik: 90%
// MRG + Anjiyografi → Anjiyografik/Rezonans: 90%
// BT + Tomografi → Tomografi: 88%
// MRG + Rezonans → Rezonans: 88%
// Ultrason/USG → Ultrason: 85%
// RDUS → Doppler/Ultrason: 88%
// Grafi → Grafi/Radyografi: 85%
// Sintigrafi → Sintigrafi: 90%
// SPECT → SPECT/Sintigrafi: 90%
// PET → PET: 90%
// Anjiyografi → Anjiyografi: 88%
// Floroskopi → Floroskopi: 88%
// Mammografi → Mammografi: 90%
```

**Laboratory Rules** (90%):
```javascript
// Patoloji → Patoloji: 90%
// Mikrobiyoloji → Mikrobiyoloji: 90%
// Biyokimya → Biyokimya: 90%
// Hematoloji → Hematoloji: 90%
// Onkoloji → Onkoloji: 90%
```

**Endoscopy Rules** (80-88%):
```javascript
// Endoskopi → Endoskopi: 88%
// Endoskopik → Endoskopik/Endoskopi: 85%
// ERCP → Endoskopik: 82%
// Endosonografi → Endoskopik: 82%
// Enteroskopi → Endoskopik: 82%
// Sfinkterotomi → Endoskopik: 80%
// Kolonoskopi → Kolonoskopi: 88%
// Gastroskopi → Gastroskopi: 88%
// Bronkoskopi → Bronkoskopi: 88%
```

**Anesthesia & Surgery Rules** (82-85%):
```javascript
// Anestezi → Anestezi: 85%
// Cerrahi → Cerrahi: 85%
// Ameliyat → Cerrahi/Ameliyat: 82%
// Operasyon → Cerrahi/Operasyon: 82%
```

**Interventional Procedures** (80-85%):
```javascript
// Biyopsi → Biyopsi: 85%
// Kateter → Kateter: 82%
// Girişimsel → Girişimsel: 82%
// Ponksiyon → Ponksiyon: 82%
// Aspirasyon → Aspirasyon: 82%
// Drenaj → Drenaj: 80%
```

**Orthopedics Rules** (85%):
```javascript
// Fraktür/Kırık → Fraktür/Kırık: 85%
// Çıkık/Dislokasyon → Çıkık/Dislokasyon: 85%
// Alçı → Alçı: 85%
// Protez → Protez: 85%
```

**Special Treatments** (85-90%):
```javascript
// Fizik Tedavi/Rehabilitasyon: 88%
// Radyoterapi: 90%
// Brakiterapi: 90%
// Kemoterapi: 90%
// Diyaliz: 90%
// Hemodiyaliz: 90%
// Aferez: 90%
// Plazmaferez: 90%
```

**General Medical Rules** (75-90%):
```javascript
// Tam eşleşme: 95%
// Acil → Acil: 88%
// Poliklinik → Poliklinik: 82%
// Yatan Hasta → Yatan Hasta/Yatak: 85%
// Rapor → Rapor: 82%
// Konsültasyon → Konsültasyon: 90%
// Muayene → Muayene: 80%
// 2+ ortak önemli kelime: 75%
```

**Rule Type**: `general_similarity`

**Threshold**: 70% minimum

**Example**:
```javascript
// SUT: "BT Anjiyografi"
// HUV: "Bilgisayarlı Tomografi Anjiyografik İnceleme"
// Rule: BT + Anjiyografi → Anjiyografik
// Confidence: 90%
```

---

### 5. SurgicalSimilarityStrategy (Unused)

**Status**: Currently not used in production

**Purpose**: Specialized strategy for surgical procedures

**Algorithm**: Simple similarity calculation with 70% threshold

**Rule Type**: `surgical_similarity`

---

### 6. RadiologyKeywordStrategy (Disabled)

**Status**: Disabled (too aggressive with fallback)

**Purpose**: Filter by "Radyoloji" keyword

**Algorithm**:
1. Filter HUV teminatlar containing "radyoloji"
2. Calculate similarity with filtered list
3. Fallback to general similarity if no match

**Rule Type**: `radiology_keyword`

**Note**: Replaced by GeneralSimilarityStrategy with comprehensive radiology rules

---

## Similarity Calculation

### Jaro-Winkler Algorithm

The system uses Jaro-Winkler distance for string similarity:

```javascript
// Formula
jaroWinkler = jaro + (prefixLen * p * (1 - jaro))
// where p = 0.1, prefixLen = max 4 characters
```

**Normalization**:
- Convert to lowercase
- Trim whitespace
- Replace multiple spaces with single space
- Preserve Turkish characters (ç, ğ, ı, ö, ş, ü)

**Example**:
```javascript
calculateSimilarity("BT Anjiyografi", "Bilgisayarlı Tomografi Anjiyografik")
// Result: 0.78 (78% similarity)
```

---

## Manual Matching Similarity (Frontend)

For manual matching in the UI, an improved similarity algorithm is used:

### Special Cases

**1. Laboratory Single-Letter Teminatlar** (A, B, C, D):
```javascript
// Check for lab keywords
const labKeywords = ['kan', 'tahlil', 'test', 'hemogram', 'biyokimya', 
                     'hormon', 'vitamin', 'mineral', 'enzim', 'protein'];

// If lab keyword found: 65%
// If no lab keyword: 15%
```

**2. Exact Match**: 100%

**3. Substring Match**: 75-95%
```javascript
// HUV in SUT: 75 + (lengthRatio * 20)
// SUT in HUV: 70 + (lengthRatio * 20)
```

**4. Word-Based Similarity**: 10-95%
```javascript
// Calculate match score for each word
// Consider:
// - Exact word match: 1.0
// - Substring match (4+ chars): 0.7 * lengthRatio
// - Prefix match (5 chars): 0.5
// - Word count ratio penalty

finalScore = matchScore / avgWords * (0.6 + wordCountRatio * 0.4)
```

---

## Ana Dal Mapping & Fallback

### Special Ana Dal Mappings

```javascript
// Ana Dal 9 (GÖĞÜS CERRAHİSİ) → Ana Dal 34 (LABORATUVAR)
// Reason: Laboratory tests incorrectly categorized

// Ana Dal 8 (GENEL CERRAHİ) → Multiple Ana Dallar
// - Radyoterapi keywords → Ana Dal 27 (RADYASYON ONKOLOJİSİ)
// - Nükleer keywords → Ana Dal 19 (NÜKLEER TIP)
// - Görüntüleme keywords → Ana Dal 24 (RADYOLOJİ)

// Ana Dal 10 (GÖĞÜS HASTALIKLARI) → Ana Dal 34 (LABORATUVAR)
// Reason: Laboratory tests in respiratory diseases
```

### Fallback Strategy

If no match found in target Ana Dal, try alternative Ana Dallar:

```javascript
// KBB keywords → Ana Dal 16 (KULAK-BURUN-BOĞAZ)
// Plastik cerrahi keywords → Ana Dal 21 (PLASTİK CERRAHİ)
// Radyoterapi keywords → Ana Dal 27 (RADYASYON ONKOLOJİSİ)
// Laboratuvar keywords → Ana Dal 34 (LABORATUVAR)
```

---

## Batch Processing

### Batch Matching Flow

```javascript
1. Fetch unmatched SUT işlemleri (or all if forceRematch = true)
2. Limit to batchSize records (default: 100, max: 10,000)
3. Process in chunks of 50 using BatchProcessor
4. For each SUT işlem:
   a. Try DirectSutCodeStrategy
   b. Try HierarchyMatchingStrategy
   c. Try Ana Dal-specific strategy
   d. Try fallback Ana Dallar
5. Save matches to database (skip if IsOverridden = 1)
6. Return summary statistics
```

### Batch Statistics

```javascript
{
  totalProcessed: 7129,
  matchedCount: 6845,
  unmatchedCount: 284,
  highConfidenceCount: 5234,  // >= 85%
  mediumConfidenceCount: 1421, // 70-84%
  lowConfidenceCount: 190,     // < 70%
  errors: [],
  durationMs: 45230
}
```

---

## Manual Override Protection

### IsOverridden Flag

When a user manually changes a match, the system sets `IsOverridden = 1`:

```javascript
// In saveMatch function
if (existing.IsOverridden === 1) {
  console.log(`⚠️  Skipping SutID ${sutId} - manually overridden`);
  return existing; // Don't update
}
```

**Protected Fields**:
- `AltTeminatID` - The matched HUV teminat
- `ConfidenceScore` - Original confidence score
- `MatchingRuleType` - Original rule type
- `OriginalAltTeminatID` - Backup of automatic match
- `OriginalConfidenceScore` - Backup of automatic confidence
- `OriginalRuleType` - Backup of automatic rule

**Tracking Fields**:
- `IsOverridden` - Flag indicating manual change
- `OverriddenAt` - Timestamp of manual change
- `OverriddenBy` - User ID who made the change

---

## Confidence Score Ranges

| Range | Category | Action Required |
|-------|----------|----------------|
| 85-100% | High Confidence | Auto-approve recommended |
| 70-84% | Medium Confidence | Manual review recommended |
| < 70% | Low Confidence | Manual review required |

---

## Performance Optimization

### Database Indexes

```sql
-- AltTeminatIslemler
CREATE INDEX IX_AltTeminatIslemler_SutID ON AltTeminatIslemler(SutID);
CREATE INDEX IX_AltTeminatIslemler_AltTeminatID ON AltTeminatIslemler(AltTeminatID);
CREATE INDEX IX_AltTeminatIslemler_ConfidenceScore ON AltTeminatIslemler(ConfidenceScore);

-- SutIslemler
CREATE INDEX IX_SutIslemler_AktifMi ON SutIslemler(AktifMi);
CREATE INDEX IX_SutIslemler_AnaBaslikNo ON SutIslemler(AnaBaslikNo);
CREATE INDEX IX_SutIslemler_HiyerarsiID ON SutIslemler(HiyerarsiID);

-- HuvAltTeminatlar
CREATE INDEX IX_HuvAltTeminatlar_AnaDalKodu ON HuvAltTeminatlar(AnaDalKodu);
CREATE INDEX IX_HuvAltTeminatlar_AktifMi ON HuvAltTeminatlar(AktifMi);
```

### Batch Processing

- Chunk size: 50 records per batch
- Total batch size: Configurable (default 100, max 10,000)
- Parallel processing: No (sequential for database consistency)

---

## Testing & Validation

### Test Cases

1. **Direct SUT Code Match**: 100% confidence
2. **Hierarchy Match**: 70-95% confidence
3. **First Letter Match (Lab)**: 70-95% confidence
4. **General Similarity Match**: 70-95% confidence
5. **Manual Override**: Protected from batch updates
6. **Fallback Ana Dal**: Alternative Ana Dal search

### Validation Rules

- Minimum confidence: 70%
- Maximum batch size: 10,000
- Manual overrides: Never auto-updated
- Duplicate prevention: One match per SutID

---

## Future Improvements

1. **Machine Learning**: Train ML model on approved matches
2. **Confidence Tuning**: Adjust thresholds based on approval rates
3. **Rule Expansion**: Add more medical term rules
4. **Performance**: Parallel batch processing
5. **Analytics**: Track strategy effectiveness

---

## Related Files

- `huv-api/src/services/matching/MatchingEngine.js` - Main matching coordinator
- `huv-api/src/services/matching/DirectSutCodeStrategy.js` - Priority 1 strategy
- `huv-api/src/services/matching/HierarchyMatchingStrategy.js` - Priority 2 strategy
- `huv-api/src/services/matching/FirstLetterStrategy.js` - Laboratory strategy
- `huv-api/src/services/matching/GeneralSimilarityStrategy.js` - Default strategy
- `huv-api/src/utils/matching/SimilarityCalculator.js` - Jaro-Winkler implementation
- `huv-frontend/src/components/matching/HuvTeminatSelectionDialog.jsx` - Manual matching UI
