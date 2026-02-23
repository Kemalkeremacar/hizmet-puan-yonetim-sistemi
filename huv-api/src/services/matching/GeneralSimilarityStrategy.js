// ============================================
// GENERAL SIMILARITY MATCHING STRATEGY
// ============================================
// Default strategy for all other Ana Dallar
// Matches based on similarity threshold
// ============================================

const MatchingStrategy = require('./MatchingStrategy');
const SimilarityCalculator = require('../../utils/matching/SimilarityCalculator');

/**
 * General Similarity Matching Strategy
 * Used for all Ana Dallar not covered by specific strategies
 * 
 * Algorithm:
 * 1. Check rule-based matches first (medical terms)
 * 2. If no rule matches, calculate similarity
 * 3. Select best match above threshold (70%)
 * 4. Return confidence score
 */
class GeneralSimilarityStrategy extends MatchingStrategy {
  constructor() {
    super();
    this.threshold = 0.70; // Minimum %70 benzerlik - manuel kontrol için
  }
  
  /**
   * Normalize string for keyword matching
   * @param {string} str - String to normalize
   * @returns {string} Normalized string
   */
  normalizeForKeywords(str) {
    if (!str) return '';
    return str
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[şŞ]/g, 's')
      .replace(/[ğĞ]/g, 'g')
      .replace(/[üÜ]/g, 'u')
      .replace(/[öÖ]/g, 'o')
      .replace(/[çÇ]/g, 'c')
      .replace(/[ıİ]/g, 'i')
      .trim();
  }
  
  /**
   * Check if there's a rule-based match
   * Returns a confidence score if rule matches, null otherwise
   * @param {string} sutIslemAdi - SUT işlem name
   * @param {string} huvTeminatAdi - HUV teminat name
   * @returns {number|null} Confidence score (0.70-1.0) or null
   */
  checkRuleBasedMatch(sutIslemAdi, huvTeminatAdi) {
    const sutNorm = this.normalizeForKeywords(sutIslemAdi);
    const huvNorm = this.normalizeForKeywords(huvTeminatAdi);
    
    // ============================================
    // NEGATİF FİLTRELER - Yanlış eşleşmeleri engelle
    // ============================================
    
    // NEGATİF 1: Cerrahi işlem → Dermatoloji/Akne/Epilasyon (yanlış)
    const cerrahiKeywords = ['cerrahi', 'ameliyat', 'operasyon', 'eksizyon', 'rezeksiyon', 'onarım', 'girisim'];
    const isSutCerrahi = cerrahiKeywords.some(k => sutNorm.includes(k));
    const wrongDermaCategories = ['akne', 'epilasyon', 'verruka', 'molluskum', 'kondilom'];
    const isHuvWrongDerma = wrongDermaCategories.some(k => huvNorm.includes(k));
    
    if (isSutCerrahi && isHuvWrongDerma) {
      return null; // Bu eşleşmeyi engelle
    }
    
    // NEGATİF 2: Herni → Pansuman/Epilasyon (yanlış)
    if (sutNorm.includes('herni') && (huvNorm.includes('pansuman') || huvNorm.includes('epilasyon'))) {
      return null;
    }
    
    // NEGATİF 3: Endoskopi → Dermatoloji/Dermatoskopi (sadece "skopi" benzerliği)
    if (sutNorm.includes('endoskopi') && huvNorm.includes('dermatoskopi')) {
      return null;
    }
    
    // NEGATİF 4: Fraktür/Kırık → Akne/Dermatoloji (yanlış)
    if ((sutNorm.includes('fraktur') || sutNorm.includes('kirik')) && 
        (huvNorm.includes('akne') || huvNorm.includes('dermatoloji'))) {
      return null;
    }
    
    // NEGATİF 5: Antidot/İlaç tedavisi → Ağrı tedavisi (yanlış)
    if ((sutNorm.includes('antidot') || sutNorm.includes('ilac')) && 
        huvNorm.includes('agri tedavisi')) {
      return null;
    }
    
    // ============================================
    // POZİTİF KURALLAR
    // ============================================
    
    // KURAL 1: Tam eşleşme → %95
    if (sutNorm === huvNorm) {
      return 0.95;
    }
    
    // ============================================
    // RADYOLOJİ KURALLARI
    // ============================================
    
    // KURAL 2: BT + Anjiyografi → Anjiyografik → %90
    if (sutNorm.includes('bt') && sutNorm.includes('anjiyografi') && 
        huvNorm.includes('anjiyografik')) {
      return 0.90;
    }
    
    // KURAL 3: MRG/MR + Anjiyografi → Anjiyografik/Rezonans → %90
    if ((sutNorm.includes('mrg') || sutNorm.includes('mr')) && 
        sutNorm.includes('anjiyografi') && 
        (huvNorm.includes('anjiyografik') || huvNorm.includes('rezonans'))) {
      return 0.90;
    }
    
    // KURAL 4: BT + Tomografi → Tomografi → %88
    if (sutNorm.includes('bt') && huvNorm.includes('tomografi')) {
      return 0.88;
    }
    
    // KURAL 5: MRG/MR + Rezonans → Rezonans → %88
    if ((sutNorm.includes('mrg') || sutNorm.includes('mr')) && 
        huvNorm.includes('rezonans')) {
      return 0.88;
    }
    
    // KURAL 6: BT genel → Tomografi → %85
    if (sutNorm.includes('bt') && huvNorm.includes('tomografi')) {
      return 0.85;
    }
    
    // KURAL 7: MRG genel → Rezonans → %85
    if ((sutNorm.includes('mrg') || sutNorm.includes('mr')) && 
        huvNorm.includes('rezonans')) {
      return 0.85;
    }
    
    // ============================================
    // LABORATUVAR KURALLARI
    // ============================================
    
    // KURAL 8: Patoloji → Patoloji → %90
    if (sutNorm.includes('patoloji') && huvNorm.includes('patoloji')) {
      return 0.90;
    }
    
    // KURAL 9: Mikrobiyoloji → Mikrobiyoloji → %90
    if (sutNorm.includes('mikrobiyoloji') && huvNorm.includes('mikrobiyoloji')) {
      return 0.90;
    }
    
    // KURAL 10: Biyokimya → Biyokimya → %90
    if (sutNorm.includes('biyokimya') && huvNorm.includes('biyokimya')) {
      return 0.90;
    }
    
    // KURAL 11: Hematoloji → Hematoloji → %90
    if (sutNorm.includes('hematoloji') && huvNorm.includes('hematoloji')) {
      return 0.90;
    }
    
    // KURAL 12: Onkoloji → Onkoloji → %90
    if (sutNorm.includes('onkoloji') && huvNorm.includes('onkoloji')) {
      return 0.90;
    }
    
    // ============================================
    // ENDOSKOPİ KURALLARI
    // ============================================
    
    // KURAL 13: Endoskopi → Endoskopi → %88
    if (sutNorm.includes('endoskopi') && huvNorm.includes('endoskopi')) {
      return 0.88;
    }
    
    // KURAL 13.1: Endoskopik → Endoskopik/Endoskopi → %85
    if (sutNorm.includes('endoskopik') && 
        (huvNorm.includes('endoskopik') || huvNorm.includes('endoskopi'))) {
      return 0.85;
    }
    
    // KURAL 13.2: ERCP → Endoskopik → %82
    if ((sutNorm.includes('ercp') || sutNorm.includes('kolanjiyopankreatografi')) && 
        huvNorm.includes('endoskopik')) {
      return 0.82;
    }
    
    // KURAL 13.3: Endosonografi → Endoskopik → %82
    if (sutNorm.includes('endosonografi') && huvNorm.includes('endoskopik')) {
      return 0.82;
    }
    
    // KURAL 13.4: Enteroskopi → Endoskopik → %82
    if (sutNorm.includes('enteroskopi') && huvNorm.includes('endoskopik')) {
      return 0.82;
    }
    
    // KURAL 13.5: Sfinkterotomi → Endoskopik → %80
    if (sutNorm.includes('sfinkterotomi') && huvNorm.includes('endoskopik')) {
      return 0.80;
    }
    
    // KURAL 14: Kolonoskopi → Kolonoskopi → %88
    if (sutNorm.includes('kolonoskopi') && huvNorm.includes('kolonoskopi')) {
      return 0.88;
    }
    
    // KURAL 15: Gastroskopi → Gastroskopi → %88
    if (sutNorm.includes('gastroskopi') && huvNorm.includes('gastroskopi')) {
      return 0.88;
    }
    
    // KURAL 16: Bronkoskopi → Bronkoskopi → %88
    if (sutNorm.includes('bronkoskopi') && huvNorm.includes('bronkoskopi')) {
      return 0.88;
    }
    
    // ============================================
    // RADYOLOJİ VE GÖRÜNTÜLEME KURALLARI (DETAYLI)
    // ============================================
    
    // KURAL 17: Ultrason/USG → Ultrason → %85
    if ((sutNorm.includes('ultrason') || sutNorm.includes('usg')) && 
        huvNorm.includes('ultrason')) {
      return 0.85;
    }
    
    // KURAL 17.1: RDUS (Renkli Doppler Ultrason) → Doppler/Ultrason → %88
    if (sutNorm.includes('rdus') && 
        (huvNorm.includes('doppler') || huvNorm.includes('ultrason'))) {
      return 0.88;
    }
    
    // KURAL 17.2: Grafi → Grafi/Radyografi → %85
    if (sutNorm.includes('grafi') && 
        (huvNorm.includes('grafi') || huvNorm.includes('radyografi'))) {
      return 0.85;
    }
    
    // KURAL 17.2.1: Grafi → Direkt radyolojik inceleme → %82
    if (sutNorm.includes('grafi') && huvNorm.includes('direkt radyolojik')) {
      return 0.82;
    }
    
    // KURAL 17.2.2: Röntgen → Direkt radyolojik/Radyoloji → %80
    if (sutNorm.includes('rontgen') && 
        (huvNorm.includes('direkt radyolojik') || huvNorm.includes('radyoloji'))) {
      return 0.80;
    }
    
    // KURAL 17.3: Sintigrafi → Sintigrafi → %90
    if (sutNorm.includes('sintigraf') && huvNorm.includes('sintigraf')) {
      return 0.90;
    }
    
    // KURAL 17.3.1: Akciğer sintigrafi → Solunum sistemi → %85
    if ((sutNorm.includes('akciger') || sutNorm.includes('akciger')) && 
        sutNorm.includes('sintigraf') && 
        huvNorm.includes('solunum')) {
      return 0.85;
    }
    
    // KURAL 17.3.2: Böbrek sintigrafi → Genitoüriner sistem → %85
    if (sutNorm.includes('bobrek') && sutNorm.includes('sintigraf') && 
        huvNorm.includes('genitoüriner')) {
      return 0.85;
    }
    
    // KURAL 17.3.3: Kalp/Miyokard sintigrafi → Kardiyovasküler sistem → %85
    if ((sutNorm.includes('kalp') || sutNorm.includes('miyokard')) && 
        sutNorm.includes('sintigraf') && 
        huvNorm.includes('kardiyovaskul')) {
      return 0.85;
    }
    
    // KURAL 17.3.4: Kemik sintigrafi → İskelet sistemi → %85
    if (sutNorm.includes('kemik') && sutNorm.includes('sintigraf') && 
        huvNorm.includes('iskelet')) {
      return 0.85;
    }
    
    // KURAL 17.3.5: Tiroid sintigrafi → Endokrin sistem → %85
    if (sutNorm.includes('tiroid') && sutNorm.includes('sintigraf') && 
        huvNorm.includes('endokrin')) {
      return 0.85;
    }
    
    // KURAL 17.3.6: Tümör görüntüleme → Nükleer onkoloji → %82
    if (sutNorm.includes('tumor goruntulem') && huvNorm.includes('onkoloji')) {
      return 0.82;
    }
    
    // KURAL 17.4: SPECT → SPECT/Sintigrafi → %90
    if (sutNorm.includes('spect') && 
        (huvNorm.includes('spect') || huvNorm.includes('sintigraf'))) {
      return 0.90;
    }
    
    // KURAL 17.5: PET → PET → %90
    if (sutNorm.includes('pet') && huvNorm.includes('pet')) {
      return 0.90;
    }
    
    // KURAL 17.6: Anjiyografi → Anjiyografi → %88
    if (sutNorm.includes('anjiyografi') && huvNorm.includes('anjiyografi')) {
      return 0.88;
    }
    
    // KURAL 17.7: Floroskopi → Floroskopi → %88
    if (sutNorm.includes('floroskopi') && huvNorm.includes('floroskopi')) {
      return 0.88;
    }
    
    // KURAL 17.8: Mammografi → Mammografi → %90
    if (sutNorm.includes('mammografi') && huvNorm.includes('mammografi')) {
      return 0.90;
    }
    
    // KURAL 17.9: Doz hesabı/planlama → Doz/Planlama → %85
    if ((sutNorm.includes('doz hesab') || sutNorm.includes('doz hesapl')) && 
        (huvNorm.includes('doz') || huvNorm.includes('planlama'))) {
      return 0.85;
    }
    
    // KURAL 17.10: Tasarım (radyoterapi) → Tasarım/Planlama → %85
    if (sutNorm.includes('tasarim') && 
        (huvNorm.includes('tasarim') || huvNorm.includes('planlama'))) {
      return 0.85;
    }
    
    // KURAL 18: Doppler → Doppler → %85
    if (sutNorm.includes('doppler') && huvNorm.includes('doppler')) {
      return 0.85;
    }
    
    // KURAL 19: EKG/Elektrokardiyografi → EKG → %85
    if ((sutNorm.includes('ekg') || sutNorm.includes('elektrokardiyografi')) && 
        huvNorm.includes('ekg')) {
      return 0.85;
    }
    
    // KURAL 20: Ekokardiyografi → Ekokardiyografi → %88
    if (sutNorm.includes('ekokardiyografi') && huvNorm.includes('ekokardiyografi')) {
      return 0.88;
    }
    
    // ============================================
    // ANESTEZİ VE CERRAHİ KURALLARI
    // ============================================
    
    // KURAL 21: Anestezi → Anestezi → %85
    if (sutNorm.includes('anestezi') && huvNorm.includes('anestezi')) {
      return 0.85;
    }
    
    // KURAL 22: Cerrahi → Cerrahi → %85
    if (sutNorm.includes('cerrahi') && huvNorm.includes('cerrahi')) {
      return 0.85;
    }
    
    // KURAL 23: Ameliyat → Cerrahi/Ameliyat → %82
    if (sutNorm.includes('ameliyat') && 
        (huvNorm.includes('cerrahi') || huvNorm.includes('ameliyat'))) {
      return 0.82;
    }
    
    // KURAL 24: Operasyon → Cerrahi/Operasyon → %82
    if (sutNorm.includes('operasyon') && 
        (huvNorm.includes('cerrahi') || huvNorm.includes('operasyon'))) {
      return 0.82;
    }
    
    // ============================================
    // GİRİŞİMSEL İŞLEM KURALLARI
    // ============================================
    
    // KURAL 25: Biyopsi → Biyopsi → %85
    if (sutNorm.includes('biyopsi') && huvNorm.includes('biyopsi')) {
      return 0.85;
    }
    
    // KURAL 26: Kateter → Kateter → %82
    if (sutNorm.includes('kateter') && huvNorm.includes('kateter')) {
      return 0.82;
    }
    
    // KURAL 27: Girişimsel → Girişimsel → %82
    if (sutNorm.includes('girisimsel') && huvNorm.includes('girisimsel')) {
      return 0.82;
    }
    
    // KURAL 28: Ponksiyon → Ponksiyon → %82
    if (sutNorm.includes('ponksiyon') && huvNorm.includes('ponksiyon')) {
      return 0.82;
    }
    
    // KURAL 29: Aspirasyon → Aspirasyon → %82
    if (sutNorm.includes('aspirasyon') && huvNorm.includes('aspirasyon')) {
      return 0.82;
    }
    
    // KURAL 30: Drenaj → Drenaj → %80
    if (sutNorm.includes('drenaj') && huvNorm.includes('drenaj')) {
      return 0.80;
    }
    
    // ============================================
    // LAZER VE DERMATOLOJİ KURALLARI
    // ============================================
    
    // KURAL 31: Lazer → Lazer → %85
    if (sutNorm.includes('lazer') && huvNorm.includes('lazer')) {
      return 0.85;
    }
    
    // KURAL 32: Dermatoloji/Deri → Dermatoloji/Deri → %82
    if ((sutNorm.includes('dermatoloji') || sutNorm.includes('deri')) && 
        (huvNorm.includes('dermatoloji') || huvNorm.includes('deri'))) {
      return 0.82;
    }
    
    // ============================================
    // GENEL TIP KURALLARI
    // ============================================
    
    // KURAL 33: Muayene → Muayene → %80
    if (sutNorm.includes('muayene') && huvNorm.includes('muayene')) {
      return 0.80;
    }
    
    // KURAL 34: Konsültasyon → Konsültasyon → %80
    if (sutNorm.includes('konsultasyon') && huvNorm.includes('konsultasyon')) {
      return 0.80;
    }
    
    // KURAL 34.1: Acil → Acil → %88
    if (sutNorm.includes('acil') && huvNorm.includes('acil')) {
      return 0.88;
    }
    
    // KURAL 34.2: Poliklinik → Poliklinik → %82
    if (sutNorm.includes('poliklinik') && huvNorm.includes('poliklinik')) {
      return 0.82;
    }
    
    // KURAL 34.3: Yatan Hasta → Yatan Hasta/Yatak → %85
    if ((sutNorm.includes('yatan hasta') || sutNorm.includes('yatak')) && 
        (huvNorm.includes('yatan hasta') || huvNorm.includes('yatak'))) {
      return 0.85;
    }
    
    // KURAL 34.4: Rapor → Rapor → %82
    if (sutNorm.includes('rapor') && huvNorm.includes('rapor')) {
      return 0.82;
    }
    
    // KURAL 34.5: Konsültasyon → Konsültasyon → %90
    if (sutNorm.includes('konsultasyon') && huvNorm.includes('konsultasyon')) {
      return 0.90;
    }
    
    // KURAL 34.6: Poliklinik muayenesi → Muayene → %85
    if (sutNorm.includes('poliklinik muayene') && huvNorm.includes('muayene')) {
      return 0.85;
    }
    
    // KURAL 34.7: Sağlık kurulu → Rapor → %80
    if (sutNorm.includes('saglik kurulu') && huvNorm.includes('rapor')) {
      return 0.80;
    }
    
    // KURAL 34.8: Uzaktan hasta değerlendirme → Muayene → %75
    if (sutNorm.includes('uzaktan hasta') && huvNorm.includes('muayene')) {
      return 0.75;
    }
    
    // KURAL 35: Tedavi → Tedavi → %75 (SADECE eğer başka önemli kelime yoksa)
    // Not: "tedavi" çok genel, yanlış eşleşmelere sebep olabiliyor
    // Sadece başka önemli kelime yoksa kullan
    if (sutNorm.includes('tedavi') && huvNorm.includes('tedavi')) {
      // Eğer cerrahi, ameliyat, operasyon gibi kelimeler varsa bu kuralı kullanma
      const excludeWords = ['cerrahi', 'ameliyat', 'operasyon', 'girisim', 'eksizyon'];
      const hasExcluded = excludeWords.some(w => sutNorm.includes(w) || huvNorm.includes(w));
      if (!hasExcluded) {
        return 0.75;
      }
    }
    
    // ============================================
    // ORTOPEDİ VE TRAVMATOLOJİ KURALLARI
    // ============================================
    
    // KURAL 36: Fraktür → Fraktür/Kırık → %85
    if ((sutNorm.includes('fraktur') || sutNorm.includes('kirik')) && 
        (huvNorm.includes('fraktur') || huvNorm.includes('kirik'))) {
      return 0.85;
    }
    
    // KURAL 37: Çıkık → Çıkık/Dislokasyon → %85
    if ((sutNorm.includes('cikik') || sutNorm.includes('dislokasyon')) && 
        (huvNorm.includes('cikik') || huvNorm.includes('dislokasyon'))) {
      return 0.85;
    }
    
    // KURAL 38: Alçı → Alçı → %85
    if (sutNorm.includes('alci') && huvNorm.includes('alci')) {
      return 0.85;
    }
    
    // KURAL 39: Protez → Protez → %85
    if (sutNorm.includes('protez') && huvNorm.includes('protez')) {
      return 0.85;
    }
    
    // ============================================
    // HERNİ KURALLARI
    // ============================================
    
    // KURAL 40: Herni → Herni → %88
    if (sutNorm.includes('herni') && huvNorm.includes('herni')) {
      return 0.88;
    }
    
    // ============================================
    // PANSUMAN VE YARA KURALLARI
    // ============================================
    
    // KURAL 41: Pansuman → Pansuman → %90
    if (sutNorm.includes('pansuman') && huvNorm.includes('pansuman')) {
      return 0.90;
    }
    
    // KURAL 42: Yara → Yara → %82
    if (sutNorm.includes('yara') && huvNorm.includes('yara')) {
      return 0.82;
    }
    
    // KURAL 43: Sütür → Sütür/Dikiş → %82
    if ((sutNorm.includes('sutur') || sutNorm.includes('dikis')) && 
        (huvNorm.includes('sutur') || huvNorm.includes('dikis'))) {
      return 0.82;
    }
    
    // ============================================
    // ÖZEL TANI/TEDAVİ KURALLARI
    // ============================================
    
    // KURAL 44: Fizik Tedavi/Rehabilitasyon → Fizik Tedavi/Rehabilitasyon → %88
    if ((sutNorm.includes('fizik tedavi') || sutNorm.includes('rehabilitasyon')) && 
        (huvNorm.includes('fizik tedavi') || huvNorm.includes('rehabilitasyon'))) {
      return 0.88;
    }
    
    // KURAL 45: Radyoterapi → Radyoterapi → %90
    if (sutNorm.includes('radyoterapi') && huvNorm.includes('radyoterapi')) {
      return 0.90;
    }
    
    // KURAL 45.1: Brakiterapi → Brakiterapi → %90
    if (sutNorm.includes('brakiterapi') && huvNorm.includes('brakiterapi')) {
      return 0.90;
    }
    
    // KURAL 46: Kemoterapi → Kemoterapi → %90
    if (sutNorm.includes('kemoterapi') && huvNorm.includes('kemoterapi')) {
      return 0.90;
    }
    
    // KURAL 47: Diyaliz → Diyaliz → %90
    if (sutNorm.includes('diyaliz') && huvNorm.includes('diyaliz')) {
      return 0.90;
    }
    
    // KURAL 47.1: Hemodiyaliz → Hemodiyaliz/Diyaliz → %90
    if (sutNorm.includes('hemodiyaliz') && 
        (huvNorm.includes('hemodiyaliz') || huvNorm.includes('diyaliz'))) {
      return 0.90;
    }
    
    // KURAL 47.2: Aferez → Aferez → %90
    if (sutNorm.includes('aferez') && huvNorm.includes('aferez')) {
      return 0.90;
    }
    
    // KURAL 47.3: Plazmaferez → Plazmaferez/Aferez → %90
    if (sutNorm.includes('plazmaferez') && 
        (huvNorm.includes('plazmaferez') || huvNorm.includes('aferez'))) {
      return 0.90;
    }
    
    // KURAL 47.4: Kan grubu → Kan grubu → %88
    if (sutNorm.includes('kan grubu') && huvNorm.includes('kan grubu')) {
      return 0.88;
    }
    
    // KURAL 47.5: Gruplama (kan) → Gruplama → %85
    if (sutNorm.includes('gruplama') && huvNorm.includes('gruplama')) {
      return 0.85;
    }
    
    // KURAL 47.6: Monitörizasyon → Monitörizasyon/Monitorizasyon → %85
    if ((sutNorm.includes('monitoriz') || sutNorm.includes('monitoriz')) && 
        (huvNorm.includes('monitoriz') || huvNorm.includes('monitoriz'))) {
      return 0.85;
    }
    
    // KURAL 47.7: EEG → EEG/Elektroensefalografi → %88
    if (sutNorm.includes('eeg') && 
        (huvNorm.includes('eeg') || huvNorm.includes('elektroensefalografi'))) {
      return 0.88;
    }
    
    // KURAL 47.8: EMG → EMG/Elektromiyografi → %88
    if (sutNorm.includes('emg') && 
        (huvNorm.includes('emg') || huvNorm.includes('elektromiyografi'))) {
      return 0.88;
    }
    
    // KURAL 47.9: Holter → Holter → %88
    if (sutNorm.includes('holter') && huvNorm.includes('holter')) {
      return 0.88;
    }
    
    // KURAL 47.10: Efor testi → Efor → %85
    if (sutNorm.includes('efor') && huvNorm.includes('efor')) {
      return 0.85;
    }
    
    // KURAL 47.11: Fototerapi → Fototerapi → %88
    if (sutNorm.includes('fototerapi') && huvNorm.includes('fototerapi')) {
      return 0.88;
    }
    
    // KURAL 47.12: Fotokemoterapi/PUVA → Fototerapi → %85
    if ((sutNorm.includes('fotokemoterapi') || sutNorm.includes('puva')) && 
        huvNorm.includes('fototerapi')) {
      return 0.85;
    }
    
    // KURAL 47.13: Odyometri → Odyometri/İşitme → %85
    if (sutNorm.includes('odyometri') && 
        (huvNorm.includes('odyometri') || huvNorm.includes('isitme'))) {
      return 0.85;
    }
    
    // KURAL 47.14: Biyometri → Biyometri/Ölçüm → %82
    if (sutNorm.includes('biyometri') && 
        (huvNorm.includes('biyometri') || huvNorm.includes('olcum'))) {
      return 0.82;
    }
    
    // KURAL 47.15: ERG/VER/EOG → Elektroretinografi → %85
    if ((sutNorm.includes('erg') || sutNorm.includes('ver') || sutNorm.includes('eog')) && 
        (huvNorm.includes('elektroretinografi') || huvNorm.includes('erg'))) {
      return 0.85;
    }
    
    // KURAL 48: Transfüzyon → Transfüzyon → %88
    if (sutNorm.includes('transfuzyon') && huvNorm.includes('transfuzyon')) {
      return 0.88;
    }
    
    // KURAL 48.1: Kan transfüzyonu → Transfüzyon/Kan → %88
    if (sutNorm.includes('kan transfuz') && 
        (huvNorm.includes('transfuzyon') || huvNorm.includes('kan'))) {
      return 0.88;
    }
    
    // KURAL 48.2: Ablasyon → Ablasyon → %88
    if (sutNorm.includes('ablasyon') && huvNorm.includes('ablasyon')) {
      return 0.88;
    }
    
    // KURAL 48.3: Stent → Stent → %88
    if (sutNorm.includes('stent') && huvNorm.includes('stent')) {
      return 0.88;
    }
    
    // KURAL 48.4: Greft → Greft/Graft → %85
    if ((sutNorm.includes('greft') || sutNorm.includes('graft')) && 
        (huvNorm.includes('greft') || huvNorm.includes('graft'))) {
      return 0.85;
    }
    
    // KURAL 48.5: Trombektomi → Trombektomi → %88
    if (sutNorm.includes('trombektomi') && huvNorm.includes('trombektomi')) {
      return 0.88;
    }
    
    // KURAL 48.6: Embolizasyon → Embolizasyon → %88
    if (sutNorm.includes('embolizasyon') && huvNorm.includes('embolizasyon')) {
      return 0.88;
    }
    
    // KURAL 48.7: Skleroterapi → Skleroterapi → %85
    if (sutNorm.includes('skleroterapi') && huvNorm.includes('skleroterapi')) {
      return 0.85;
    }
    
    // KURAL 48.8: Enjeksiyon → Enjeksiyon/İnjeksiyon → %80
    if ((sutNorm.includes('enjeksiyon') || sutNorm.includes('injeksiyon')) && 
        (huvNorm.includes('enjeksiyon') || huvNorm.includes('injeksiyon'))) {
      return 0.80;
    }
    
    // KURAL 48.9: İnfüzyon → İnfüzyon → %82
    if (sutNorm.includes('infuzyon') && huvNorm.includes('infuzyon')) {
      return 0.82;
    }
    
    // KURAL 48.10: Perfüzyon → Perfüzyon → %85
    if (sutNorm.includes('perfuzyon') && huvNorm.includes('perfuzyon')) {
      return 0.85;
    }
    
    // ============================================
    // YOĞUN BAKIM KURALLARI
    // ============================================
    
    // KURAL 49: Yoğun Bakım → Yoğun Bakım → %90
    if (sutNorm.includes('yogun bakim') && huvNorm.includes('yogun bakim')) {
      return 0.90;
    }
    
    // KURAL 50: Mekanik Ventilasyon → Mekanik Ventilasyon/Solunum → %88
    if ((sutNorm.includes('mekanik ventilasyon') || sutNorm.includes('ventilatör')) && 
        (huvNorm.includes('mekanik ventilasyon') || huvNorm.includes('ventilatör') || huvNorm.includes('solunum'))) {
      return 0.88;
    }
    
    // KURAL 51: 2+ ortak önemli kelime → %75
    const sutWords = sutNorm.split(/\s+/).filter(w => w.length > 3);
    const huvWords = huvNorm.split(/\s+/).filter(w => w.length > 3);
    const commonWords = sutWords.filter(w => huvWords.includes(w));
    
    if (commonWords.length >= 2) {
      return 0.75;
    }
    
    return null; // Kural yok, normal similarity kullan
  }
  
  /**
   * Match SUT işlem with HUV teminatlar using general similarity strategy
   * @param {Object} sutIslem - SUT işlem object
   * @param {Array} huvList - Array of HUV teminat objects
   * @returns {Object} Match result
   */
  match(sutIslem, huvList) {
    if (!sutIslem || !sutIslem.islemAdi || !huvList || huvList.length === 0) {
      return { matched: false, ruleType: this.getRuleType() };
    }
    
    // Calculate similarity with all HUV teminatlar
    let bestMatch = null;
    let bestScore = 0;
    let usedRule = false;
    
    for (const huv of huvList) {
      // Önce kural tabanlı eşleşme kontrol et
      const ruleScore = this.checkRuleBasedMatch(
        sutIslem.islemAdi,
        huv.altTeminatAdi
      );
      
      let finalScore;
      
      if (ruleScore !== null) {
        // Kural bulundu, direkt skoru kullan
        finalScore = ruleScore;
        usedRule = true;
      } else {
        // Kural yok, normal similarity hesapla
        finalScore = SimilarityCalculator.calculateSimilarity(
          sutIslem.islemAdi,
          huv.altTeminatAdi
        );
      }
      
      if (finalScore > bestScore) {
        bestScore = finalScore;
        bestMatch = huv;
      }
    }
    
    // Check if best match exceeds threshold
    if (bestScore < this.threshold) {
      return { matched: false, ruleType: this.getRuleType() };
    }
    
    // Calculate confidence score (already 0-1, convert to 0-100)
    const confidence = bestScore * 100;
    
    return {
      matched: true,
      altTeminatId: bestMatch.altTeminatId,
      confidence: Math.round(confidence * 100) / 100,
      ruleType: this.getRuleType(),
      usedRule: usedRule // Debug için
    };
  }
  
  /**
   * Calculate confidence score for general similarity strategy
   * Formula: similarity * 100
   * Range: 0-100 (but only matches above threshold are returned)
   * @param {number} similarity - Similarity score (0.0 to 1.0)
   * @returns {number} Confidence score (0 to 100)
   */
  calculateConfidence(similarity) {
    return similarity * 100;
  }
  
  /**
   * Get rule type identifier
   * @returns {string} 'general_similarity'
   */
  getRuleType() {
    return 'general_similarity';
  }
}

module.exports = GeneralSimilarityStrategy;
