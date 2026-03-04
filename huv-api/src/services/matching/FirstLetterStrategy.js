// ============================================
// FIRST LETTER MATCHING STRATEGY
// ============================================
// Strategy for Ana Dal 9 (Laboratory Tests)
// Matches based on first letter of işlem name
// ============================================

const MatchingStrategy = require('./MatchingStrategy');
const SimilarityCalculator = require('../../utils/matching/SimilarityCalculator');
const StringNormalizer = require('../../utils/matching/StringNormalizer');

/**
 * First Letter Matching Strategy
 * Used ONLY for Ana Dal 9 (Laboratory Tests)
 * 
 * Algorithm:
 * 1. Verify this is a laboratory test (not surgical procedure)
 * 2. Filter HUV teminatlar by first letter match
 * 3. Ensure HUV is also laboratory-related (not surgical)
 * 4. Select best match by highest similarity
 * 5. Apply minimum similarity threshold (50%)
 */
class FirstLetterStrategy extends MatchingStrategy {
  constructor() {
    super();
    this.minSimilarity = 0.70; // Standart %70 threshold (GeneralSimilarityStrategy ile aynı)
    
    // Cerrahi/işlem terimleri - bunlar varsa laboratuvar değildir
    this.nonLabKeywords = [
      'cerrahi', 'ameliyat', 'operasyon', 'eksizyon', 'rezeksiyon',
      'trakea', 'bronş', 'toraks', 'göğüs', 'kalp', 'damar',
      'kateter', 'dren', 'sonda', 'entübasyon', 'anestezi'
    ];
    
    // Pozitif laboratuvar terimleri - bunlar varsa kesinlikle laboratuvardır
    this.labKeywords = [
      'vitamin', 'hormon', 'test', 'testi', 'antikor', 'antijen',
      'elisa', 'ifa', 'ifat', 'iha', 'pcr', 'kültür', 'kultur',
      'panel', 'tayini', 'ölçüm', 'olcum', 'analiz', 'tarama',
      'kortizol', 'progesteron', 'testosteron', 'östrojen', 'estrojen',
      'tiroid', 'insülin', 'insulin', 'glukoz', 'hemoglobin',
      'lökosit', 'eritrosit', 'trombosit', 'sedim', 'üre', 'kreatinin',
      'kolesterol', 'trigliserid', 'alt', 'ast', 'ggt', 'ldh',
      'uyarı testi', 'baskılama testi', 'yükleme testi',
      // Yeni eklenen laboratuvar terimleri
      'hematolojik', 'boya', 'boyalar', 'esteraz', 'periyodik asit',
      'peroksidaz', 'prusya mavisi', 'sudan black', 'tartarat rezistan',
      'asit fosfataz', 'jak2', 'geni', 'mutasyon', 'ekzon', 'qf pcr',
      'anoploidi', 'molekuler genetik', 'genetik tetkik'
    ];
  }
  
  /**
   * Check if text is laboratory-related (not surgical)
   * @param {string} text - Text to check
   * @returns {boolean} True if laboratory-related
   */
  isLaboratoryRelated(text) {
    if (!text) return false;
    
    const normalized = StringNormalizer.normalizeForKeywords(text);
    
    // Önce pozitif laboratuvar terimleri kontrol et
    for (const keyword of this.labKeywords) {
      if (normalized.includes(keyword)) {
        return true; // Kesinlikle laboratuvar
      }
    }
    
    // Cerrahi terimleri varsa laboratuvar değil
    for (const keyword of this.nonLabKeywords) {
      if (normalized.includes(keyword)) {
        return false;
      }
    }
    
    // Hiçbir terimi içermiyorsa, varsayılan olarak laboratuvar kabul et
    // (Ana Başlık 9 zaten laboratuvar ana başlığı)
    return true;
  }
  getFirstLetter(text) {
    return StringNormalizer.getFirstLetter(text);
  }
  
  /**
   * Match SUT işlem with HUV teminatlar using first letter strategy
   * ONLY for laboratory tests - filters out surgical procedures
   * @param {Object} sutIslem - SUT işlem object
   * @param {Array} huvList - Array of HUV teminat objects
   * @returns {Object} Match result
   */
  async match(sutIslem, huvList) {
    if (!sutIslem || !sutIslem.islemAdi || !huvList || huvList.length === 0) {
      return { matched: false, ruleType: this.getRuleType() };
    }
    
    // Önce SUT işleminin laboratuvar testi olduğunu kontrol et
    const isLab = this.isLaboratoryRelated(sutIslem.islemAdi);
    
    if (!isLab) {
      return { matched: false, ruleType: this.getRuleType() };
    }
    
    // İlk harfi bul (sayıları atla)
    const sutFirstLetter = this.getFirstLetter(sutIslem.islemAdi);
    
    if (!sutFirstLetter) {
      return { matched: false, ruleType: this.getRuleType() };
    }
    
    // Filter HUV teminatlar by first letter AND laboratory-related
    const candidates = huvList.filter(huv => {
      const huvFirstLetter = this.getFirstLetter(huv.altTeminatAdi);
      const firstLetterMatch = huvFirstLetter === sutFirstLetter;
      
      // Ana Dal 34 (LABORATUVAR) ise direkt kabul et - tek harf alt teminatlar
      const isAnaDal34 = huv.anaDalKodu === 34;
      const isLabRelated = isAnaDal34 || this.isLaboratoryRelated(huv.altTeminatAdi);
      
      return firstLetterMatch && isLabRelated;
    });
    
    if (candidates.length === 0) {
      return { matched: false, ruleType: this.getRuleType() };
    }
    
    // If multiple candidates, select by highest similarity
    let bestMatch = null;
    let bestSimilarity = 0;
    
    for (const huv of candidates) {
      const similarity = SimilarityCalculator.calculateSimilarity(
        sutIslem.islemAdi,
        huv.altTeminatAdi
      );
      
      if (similarity > bestSimilarity) {
        bestSimilarity = similarity;
        bestMatch = huv;
      }
    }
    
    // Ana Dal 34 için özel durum: Tek harf alt teminatlar
    // İlk harf eşleşmesi yeterli, similarity kontrolü yapma
    const isAnaDal34 = huvList.length > 0 && huvList[0].anaDalKodu === 34;
    
    if (isAnaDal34 && bestMatch) {
      // Ana Dal 34'te tek harf eşleşmesi %85 güven (standart formül)
      const confidence = 85;
      
      return {
        matched: true,
        altTeminatId: bestMatch.altTeminatId,
        confidence: confidence,
        ruleType: this.getRuleType()
      };
    }
    
    // Diğer Ana Dallar için minimum similarity kontrolü
    if (!bestMatch || bestSimilarity < this.minSimilarity) {
      return { matched: false, ruleType: this.getRuleType() };
    }
    
    // Calculate confidence score: standart formül kullan
    const confidence = this.calculateConfidence(bestSimilarity);
    
    return {
      matched: true,
      altTeminatId: bestMatch.altTeminatId,
      confidence: Math.round(confidence * 100) / 100,
      ruleType: this.getRuleType()
    };
  }
  
  /**
   * Calculate confidence score - STANDART FORMÜL
   * Formula: similarity * 100 (0-100 arası)
   * @param {number} similarity - Similarity score (0.0 to 1.0)
   * @returns {number} Confidence score (0 to 100)
   */
  calculateConfidence(similarity) {
    return similarity * 100; // Standart formül
  }
  
  /**
   * Get rule type identifier
   * @returns {string} 'first_letter'
   */
  getRuleType() {
    return 'first_letter';
  }
}

module.exports = FirstLetterStrategy;
