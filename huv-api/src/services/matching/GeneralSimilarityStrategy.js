// ============================================
// GENERAL SIMILARITY MATCHING STRATEGY
// ============================================
// Default strategy for all other Ana Dallar
// Matches based on similarity threshold
// ============================================

const MatchingStrategy = require('./MatchingStrategy');
const SimilarityCalculator = require('../../utils/matching/SimilarityCalculator');
const StringNormalizer = require('../../utils/matching/StringNormalizer');

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
  // String normalizasyon artık StringNormalizer utility'sinde
  
  /**
   * Check if there's a rule-based match
   * Returns a confidence score if rule matches, null otherwise
   * @param {string} sutIslemAdi - SUT işlem name
   * @param {string} huvTeminatAdi - HUV teminat name
   * @returns {number|null} Confidence score (0.70-1.0) or null
   */
  checkRuleBasedMatch(sutIslem, huvTeminatAdi) {
    const sutNorm = StringNormalizer.normalizeForKeywords(sutIslem.islemAdi);
    const huvNorm = StringNormalizer.normalizeForKeywords(huvTeminatAdi);
    
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
    // SPESİFİK SUT ALT TEMİNAT EŞLEŞTİRMELERİ
    // ============================================
    
    // SUT Alt Teminat kontrolü - eğer sutIslem.sutAltTeminat varsa
    if (sutIslem.sutAltTeminat) {
      const sutAltTeminatNorm = StringNormalizer.normalizeForKeywords(sutIslem.sutAltTeminat);
      
      // KURAL 150: MOLEKÜLER GENETİK TETKİKLER → G (Ana Dal 34) → %95
      if ((sutAltTeminatNorm.includes('molekuler genetik tetkikler') || 
           sutAltTeminatNorm.includes('molekuler genetik')) && huvNorm === 'g') {
        return 0.95;
      }
      
      // KURAL 151: Brakiterapi doz hesapları → Brakiterapi/Doz/Radyoterapi → %90
      if ((sutAltTeminatNorm.includes('brakiterapi doz hesaplari') || 
           sutAltTeminatNorm.includes('brakiterapi')) && 
          (huvNorm.includes('brakiterapi') || huvNorm.includes('doz') || huvNorm.includes('radyoterapi'))) {
        return 0.90;
      }
      
      // KURAL 152: Portal görüntüleme → Portal/Radyoloji/Görüntüleme → %90
      if ((sutAltTeminatNorm.includes('portal goruntulem') || sutAltTeminatNorm.includes('portal')) && 
          (huvNorm.includes('portal') || huvNorm.includes('radyoloji') || huvNorm.includes('goruntulem'))) {
        return 0.90;
      }
      
      // KURAL 153: ÜRİNER SİSTEM-NEFROLOJİ-DİYALİZ → Nefroloji/Diyaliz/Üroloji/Muayene → %90
      if (sutAltTeminatNorm.includes('uriner sistem-nefroloji-diyaliz') && 
          (huvNorm.includes('nefroloji') || huvNorm.includes('diyaliz') || huvNorm.includes('uroloji') ||
           huvNorm.includes('muayene') || huvNorm.includes('tani'))) {
        return 0.90;
      }
      
      // KURAL 154: HEMATOLOJİ-ONKOLOJİ-KEMOTERAPİ → Hematoloji/Onkoloji → %90
      if (sutAltTeminatNorm.includes('hematoloji-onkoloji-kemoterapi') && 
          (huvNorm.includes('hematoloji') || huvNorm.includes('onkoloji'))) {
        return 0.90;
      }
      
      // KURAL 155: SİNDİRİM SİSTEMİ → Sindirim/Gastroenteroloji/Endoskopi → %90
      if (sutAltTeminatNorm.includes('sindirim sistemi') && 
          (huvNorm.includes('sindirim') || huvNorm.includes('gastroenteroloji') || huvNorm.includes('endoskopi'))) {
        return 0.90;
      }
      
      // KURAL 156: GÖZ VE ADNEKSLERİ → Göz/Adneks/Oftalmoloji/Muayene/Cerrahi → %90
      if (sutAltTeminatNorm.includes('goz ve adneksleri') && 
          (huvNorm.includes('goz') || huvNorm.includes('adneks') || huvNorm.includes('oftalmoloji') ||
           huvNorm.includes('muayene') || huvNorm.includes('cerrahi') || huvNorm.includes('optik'))) {
        return 0.90;
      }
      
      // KURAL 157: SES VE İŞİTME İLE İLGİLİ ÇALIŞMALAR → Ses/İşitme/Odyoloji/Muayene → %90
      if (sutAltTeminatNorm.includes('ses ve isitme ile ilgili calismalar') && 
          (huvNorm.includes('ses') || huvNorm.includes('isitme') || huvNorm.includes('odyoloji') ||
           huvNorm.includes('muayene') || huvNorm.includes('tani'))) {
        return 0.90;
      }
      
      // KURAL 158: Brakiterapi doz hesapları (spesifik) → Brakiterapi/Doz/Radyoterapi/Planlama → %95
      // SUT Kodu: 800235 - "a) Temel radyasyon doz hesapları"
      if ((sutAltTeminatNorm.includes('brakiterapi doz hesaplari') || 
           sutAltTeminatNorm.includes('brakiterapi')) && 
          (huvNorm.includes('brakiterapi') || huvNorm.includes('doz') || 
           huvNorm.includes('radyoterapi') || huvNorm.includes('planlama') || 
           huvNorm.includes('tasarim'))) {
        return 0.95;
      }
      
      // KURAL 159: ÜRİNER SİSTEM-NEFROLOJİ-DİYALİZ (kemoterapi içeren) → Onkoloji/Kemoterapi/Hematoloji → %95
      // SUT Kodu: 704370 - "İntrakaviter kemo veya immünoterapi"
      if (sutAltTeminatNorm.includes('uriner sistem-nefroloji-diyaliz') && 
          (sutNorm.includes('kemo') || sutNorm.includes('immuno')) &&
          (huvNorm.includes('onkoloji') || huvNorm.includes('kemoterapi') || 
           huvNorm.includes('hematoloji') || huvNorm.includes('tibbi onkoloji'))) {
        return 0.95;
      }
      
      // KURAL 160: ÜRİNER SİSTEM-NEFROLOJİ-DİYALİZ (sinir/mesane içeren) → Üroloji/Mesane/Nefroloji → %95
      // SUT Kodu: 704410 - "Perkütan sinir incelemesi (PNE), mesane için"
      if (sutAltTeminatNorm.includes('uriner sistem-nefroloji-diyaliz') && 
          (sutNorm.includes('sinir') || sutNorm.includes('pne') || sutNorm.includes('mesane')) &&
          (huvNorm.includes('uroloji') || huvNorm.includes('mesane') || 
           huvNorm.includes('nefroloji') || huvNorm.includes('urodinamik') ||
           huvNorm.includes('muayene') || huvNorm.includes('tani'))) {
        return 0.95;
      }
    }
    
    // ============================================
    // SPESİFİK SUT ALT TEMİNAT EŞLEŞTİRMELERİ
    // ============================================
    
    // ============================================
    // SPESİFİK SUT İŞLEM ADI EŞLEŞTİRMELERİ (SUT Alt Teminat yerine)
    // ============================================
    
    // KURAL 138: Göz işlemleri (işlem adından) → Cerrahi İşlemler (Göz) → %95
    if ((sutNorm.includes('kamara') || sutNorm.includes('iris') || sutNorm.includes('lens') || 
         sutNorm.includes('silikon') || sutNorm.includes('goz')) && 
        huvNorm.includes('cerrahi islemler')) {
      return 0.95;
    }
    
    // KURAL 139: Hematoloji işlemleri (işlem adından) → Tıbbi Onkoloji, Hematoloji → %95
    if ((sutNorm.includes('cd 34') || sutNorm.includes('hucre seleksiyon') || 
         sutNorm.includes('infuzyon kemoterapi') || sutNorm.includes('kemoterapi')) && 
        huvNorm.includes('tibbi onkoloji')) {
      return 0.95;
    }
    
    // KURAL 140: Laboratuvar işlemleri (işlem adından) → A, B, C, D, E, F, G, H, I, K, L, M, N, O, P, R, S, T, U, V, W, Y → %95
    if ((sutNorm.includes('jak2 geni') || sutNorm.includes('pcr') || sutNorm.includes('mutasyon analizi') ||
         sutNorm.includes('anaplasma') || sutNorm.includes('coxiella') || sutNorm.includes('erlichia')) && 
        (huvNorm === 'a' || huvNorm === 'b' || huvNorm === 'c' || huvNorm === 'd' || huvNorm === 'e' || 
         huvNorm === 'f' || huvNorm === 'g' || huvNorm === 'h' || huvNorm === 'i' || huvNorm === 'k' || 
         huvNorm === 'l' || huvNorm === 'm' || huvNorm === 'n' || huvNorm === 'o' || huvNorm === 'p' || 
         huvNorm === 'r' || huvNorm === 's' || huvNorm === 't' || huvNorm === 'u' || huvNorm === 'v' || 
         huvNorm === 'w' || huvNorm === 'y')) {
      return 0.95;
    }
    
    // KURAL 141: Üroloji işlemleri (işlem adından) → Nefroloji, Böbrek, Mesane, Prostat → %90
    if ((sutNorm.includes('hemodiyaliz') || sutNorm.includes('diyaliz') || sutNorm.includes('sistometri') ||
         sutNorm.includes('urodinamik') || sutNorm.includes('prostat') || sutNorm.includes('penil') ||
         sutNorm.includes('kateter') || sutNorm.includes('hemoperfuzyon') || sutNorm.includes('ultrafiltrasyon') ||
         sutNorm.includes('heparinizasyon') || sutNorm.includes('empotans') || sutNorm.includes('vezikul')) && 
        (huvNorm.includes('nefroloji') || huvNorm.includes('bobrek') || huvNorm.includes('mesane') || 
         huvNorm.includes('prostat') || huvNorm.includes('urodinam') || huvNorm.includes('ureter') ||
         huvNorm.includes('uretra') || huvNorm.includes('penis'))) {
      return 0.90;
    }
    
    // KURAL 142: Dermatoloji işlemleri (işlem adından) → Genel İşlemler, Cerrahi İşlemler → %85
    if ((sutNorm.includes('fototerapi') || sutNorm.includes('puva') || sutNorm.includes('kriyoterapi') ||
         sutNorm.includes('kimyasal') || sutNorm.includes('peeling')) && 
        (huvNorm.includes('genel islemler') || huvNorm.includes('cerrahi islemler'))) {
      return 0.85;
    }
    
    // KURAL 143: Sindirim işlemleri (işlem adından) → Gastroenteroloji → %90
    if ((sutNorm.includes('ph monitoriz') || sutNorm.includes('enteroskopi') || sutNorm.includes('endoskopik') ||
         sutNorm.includes('biliyer') || sutNorm.includes('polipektomi')) && 
        huvNorm.includes('gastroenteroloji')) {
      return 0.90;
    }
    
    // KURAL 144: KBB işlemleri (işlem adından) → Muayene, Tanı, Tedavi İşlemleri → %90
    if ((sutNorm.includes('bekesy') || sutNorm.includes('odyometri') || sutNorm.includes('timpanometri') ||
         sutNorm.includes('videonistagmografi') || sutNorm.includes('enog')) && 
        huvNorm.includes('muayene, tani, tedavi')) {
      return 0.90;
    }
    
    // KURAL 145: Göz muayene işlemleri (işlem adından) → Muayene ve Tanısal İşlemler → %85
    if ((sutNorm.includes('biyometri') || sutNorm.includes('erg') || sutNorm.includes('ver') ||
         sutNorm.includes('eog') || sutNorm.includes('perimetri') || sutNorm.includes('pakimetri')) && 
        huvNorm.includes('muayene ve tanisal')) {
      return 0.85;
    }
    
    // KURAL 161: Radyasyon doz hesapları (işlem adından) → Radyoterapi/Brakiterapi/Doz/Planlama → %95
    // SUT Kodu: 800235 - "a) Temel radyasyon doz hesapları"
    if ((sutNorm.includes('radyasyon doz hesab') || sutNorm.includes('temel radyasyon doz') ||
         sutNorm.includes('radyasyon doz') || sutNorm.includes('doz hesab')) && 
        (huvNorm.includes('radyoterapi') || huvNorm.includes('brakiterapi') || 
         huvNorm.includes('doz') || huvNorm.includes('planlama') || huvNorm.includes('tasarim') ||
         huvNorm.includes('radyasyon') || huvNorm.includes('tedavi'))) {
      return 0.95;
    }
    
    // KURAL 161.1: Radyasyon/Doz (genel) → Radyoterapi/Brakiterapi/Doz → %85
    if ((sutNorm.includes('radyasyon') || sutNorm.includes('doz hesab')) && 
        (huvNorm.includes('radyoterapi') || huvNorm.includes('brakiterapi') || 
         huvNorm.includes('doz') || huvNorm.includes('radyasyon'))) {
      return 0.85;
    }
    
    // KURAL 161.2: Doz hesabı (çok genel) → Herhangi bir doz/planlama/tedavi → %75
    if ((sutNorm.includes('doz hesab') || sutNorm.includes('doz hesapl')) && 
        (huvNorm.includes('doz') || huvNorm.includes('planlama') || 
         huvNorm.includes('tedavi') || huvNorm.includes('tasarim') ||
         huvNorm.includes('radyo') || huvNorm.includes('terapi'))) {
      return 0.75;
    }
    
    // KURAL 162: İntrakaviter kemoterapi (işlem adından) → Onkoloji/Kemoterapi/Hematoloji → %95
    // SUT Kodu: 704370 - "İntrakaviter kemo veya immünoterapi"
    if ((sutNorm.includes('intrakaviter kemo') || sutNorm.includes('intrakaviter immuno')) && 
        (huvNorm.includes('onkoloji') || huvNorm.includes('kemoterapi') || 
         huvNorm.includes('hematoloji') || huvNorm.includes('tibbi onkoloji') ||
         huvNorm.includes('infuzyon') || huvNorm.includes('tedavi'))) {
      return 0.95;
    }
    
    // KURAL 162.1: İntrakaviter/Kemoterapi (genel) → Onkoloji/Kemoterapi → %85
    if ((sutNorm.includes('intrakaviter') || (sutNorm.includes('kemo') && sutNorm.includes('terapi'))) && 
        (huvNorm.includes('onkoloji') || huvNorm.includes('kemoterapi') || 
         huvNorm.includes('hematoloji') || huvNorm.includes('tedavi'))) {
      return 0.85;
    }
    
    // KURAL 162.2: Kemoterapi (çok genel) → Herhangi bir kemo/onkoloji/tedavi → %75
    if ((sutNorm.includes('kemo') || sutNorm.includes('immuno')) && 
        (huvNorm.includes('kemo') || huvNorm.includes('onkoloji') || 
         huvNorm.includes('tedavi') || huvNorm.includes('infuzyon') ||
         huvNorm.includes('hematoloji') || huvNorm.includes('tibbi'))) {
      return 0.75;
    }

    // ============================================
    // POZİTİF KURALLAR (DEVAMI)
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
    // GÖZ HASTALIKLARI KURALLARI (Düzeltilmiş)
    // ============================================
    
    // KURAL 52: İris işlemleri → Göz teminatları → %90
    if (sutNorm.includes('iris') || sutNorm.includes('iridodiyaliz') || sutNorm.includes('pupillaplasti')) {
      // HUV'da göz ile ilgili herhangi bir teminat varsa eşleştir
      return 0.90;
    }
    
    // KURAL 53: Lens işlemleri → Göz teminatları → %90
    if (sutNorm.includes('lens') || sutNorm.includes('fakoemul') || sutNorm.includes('kataraktta') || 
        sutNorm.includes('intraokuler') || sutNorm.includes('lensektomi')) {
      return 0.90;
    }
    
    // KURAL 54: Şaşılık işlemleri → Göz teminatları → %88
    if (sutNorm.includes('sasilik') || sutNorm.includes('tenotomi') || sutNorm.includes('myotomi') || 
        sutNorm.includes('adele transpozisyon') || sutNorm.includes('ayarlanabilir sutur')) {
      return 0.88;
    }
    
    // KURAL 55: Göz cerrahisi genel → Göz teminatları → %85
    if (sutNorm.includes('aci revizyonu') || sutNorm.includes('dissizyon') || 
        sutNorm.includes('kapsulektomi') || sutNorm.includes('vitrektomi')) {
      return 0.85;
    }
    
    // KURAL 56: Pediatrik Oftalmoloji → Göz teminatları → %85
    if (sutNorm.includes('pediatrik oftalmoloji') || sutNorm.includes('cocuk oftalmoloji')) {
      return 0.85;
    }
    
    // KURAL 57: Retina → Retina → %88
    if (sutNorm.includes('retina') && huvNorm.includes('retina')) {
      return 0.88;
    }
    
    // KURAL 58: Kornea → Kornea → %88
    if (sutNorm.includes('kornea') && huvNorm.includes('kornea')) {
      return 0.88;
    }
    
    // KURAL 59: Katarakt → Katarakt → %88
    if (sutNorm.includes('katarakt') && huvNorm.includes('katarakt')) {
      return 0.88;
    }
    
    // KURAL 60: Glokom → Glokom → %88
    if (sutNorm.includes('glokom') && huvNorm.includes('glokom')) {
      return 0.88;
    }
    
    // KURAL 61: Göz → Göz/Oftalmoloji/Adneksler → %82
    if (sutNorm.includes('goz') && 
        (huvNorm.includes('goz') || huvNorm.includes('oftalmoloji') || huvNorm.includes('adneks'))) {
      return 0.82;
    }
    
    // KURAL 62: Göz ve Adneksleri → Göz/Adneksler → %85
    if ((sutNorm.includes('goz ve adneks') || sutNorm.includes('goz adneks')) && 
        (huvNorm.includes('goz') || huvNorm.includes('adneks'))) {
      return 0.85;
    }
    
    // KURAL 63: Adneksler → Adneksler/Göz → %82
    if (sutNorm.includes('adneks') && 
        (huvNorm.includes('adneks') || huvNorm.includes('goz'))) {
      return 0.82;
    }
    
    // ============================================
    // KULAK BURUN BOĞAZ (KBB) KURALLARI
    // ============================================
    
    // KURAL 64: Ses ve İşitme → Ses/İşitme/Odyoloji → %88
    if ((sutNorm.includes('ses ve isitme') || sutNorm.includes('ses isitme')) && 
        (huvNorm.includes('ses') || huvNorm.includes('isitme') || huvNorm.includes('odyoloji'))) {
      return 0.88;
    }
    
    // KURAL 65: İşitme → İşitme/Odyoloji → %85
    if (sutNorm.includes('isitme') && 
        (huvNorm.includes('isitme') || huvNorm.includes('odyoloji'))) {
      return 0.85;
    }
    
    // KURAL 66: Odyoloji → Odyoloji/İşitme → %88
    if (sutNorm.includes('odyoloji') && 
        (huvNorm.includes('odyoloji') || huvNorm.includes('isitme'))) {
      return 0.88;
    }
    
    // KURAL 67: Odyometri → Odyometri/İşitme/Odyoloji → %85
    if (sutNorm.includes('odyometri') && 
        (huvNorm.includes('odyometri') || huvNorm.includes('isitme') || huvNorm.includes('odyoloji'))) {
      return 0.85;
    }
    
    // KURAL 68: Kulak → Kulak/KBB → %82
    if (sutNorm.includes('kulak') && 
        (huvNorm.includes('kulak') || huvNorm.includes('kbb'))) {
      return 0.82;
    }
    
    // KURAL 69: İşitme Cihazı → İşitme/Cihaz → %85
    if (sutNorm.includes('isitme cihaz') && 
        (huvNorm.includes('isitme') || huvNorm.includes('cihaz'))) {
      return 0.85;
    }
    
    // KURAL 70: Ses Terapisi → Ses/Terapi → %82
    if (sutNorm.includes('ses terapi') && 
        (huvNorm.includes('ses') || huvNorm.includes('terapi'))) {
      return 0.82;
    }
    
    // KURAL 71: KBB → KBB/Kulak Burun Boğaz → %85
    if (sutNorm.includes('kbb') && 
        (huvNorm.includes('kbb') || huvNorm.includes('kulak burun bogaz'))) {
      return 0.85;
    }
    
    // ============================================
    // SİNDİRİM SİSTEMİ KURALLARI
    // ============================================
    
    // KURAL 72: Sindirim Sistemi → Sindirim/Gastrointestinal → %88
    if ((sutNorm.includes('sindirim sistem') || sutNorm.includes('sindirim')) && 
        (huvNorm.includes('sindirim') || huvNorm.includes('gastrointestinal') || huvNorm.includes('gastroenteroloji'))) {
      return 0.88;
    }
    
    // KURAL 73: Gastroenteroloji → Gastroenteroloji/Sindirim → %88
    if (sutNorm.includes('gastroenteroloji') && 
        (huvNorm.includes('gastroenteroloji') || huvNorm.includes('sindirim'))) {
      return 0.88;
    }
    
    // KURAL 74: Gastrointestinal → Gastrointestinal/Sindirim → %85
    if (sutNorm.includes('gastrointestinal') && 
        (huvNorm.includes('gastrointestinal') || huvNorm.includes('sindirim'))) {
      return 0.85;
    }
    
    // KURAL 75: Mide → Mide/Gastrik/Sindirim → %82
    if (sutNorm.includes('mide') && 
        (huvNorm.includes('mide') || huvNorm.includes('gastrik') || huvNorm.includes('sindirim'))) {
      return 0.82;
    }
    
    // KURAL 76: Bağırsak → Bağırsak/İntestinal/Sindirim → %82
    if (sutNorm.includes('bagirsak') && 
        (huvNorm.includes('bagirsak') || huvNorm.includes('intestinal') || huvNorm.includes('sindirim'))) {
      return 0.82;
    }
    
    // KURAL 77: Kolon → Kolon/Kolonik/Sindirim → %82
    if (sutNorm.includes('kolon') && 
        (huvNorm.includes('kolon') || huvNorm.includes('kolonik') || huvNorm.includes('sindirim'))) {
      return 0.82;
    }
    
    // KURAL 78: Karaciğer → Karaciğer/Hepatik/Sindirim → %82
    if (sutNorm.includes('karaciger') && 
        (huvNorm.includes('karaciger') || huvNorm.includes('hepatik') || huvNorm.includes('sindirim'))) {
      return 0.82;
    }
    
    // KURAL 79: Safra → Safra/Biliyer/Sindirim → %82
    if (sutNorm.includes('safra') && 
        (huvNorm.includes('safra') || huvNorm.includes('biliyer') || huvNorm.includes('sindirim'))) {
      return 0.82;
    }
    
    // KURAL 80: Pankreas → Pankreas/Pankreatik/Sindirim → %82
    if (sutNorm.includes('pankreas') && 
        (huvNorm.includes('pankreas') || huvNorm.includes('pankreatik') || huvNorm.includes('sindirim'))) {
      return 0.82;
    }
    
    // KURAL 81: Özofagus → Özofagus/Yemek Borusu/Sindirim → %82
    if ((sutNorm.includes('ozofagus') || sutNorm.includes('yemek borusu')) && 
        (huvNorm.includes('ozofagus') || huvNorm.includes('yemek borusu') || huvNorm.includes('sindirim'))) {
      return 0.82;
    }
    
    // ============================================
    // DERMİS VE EPİDERMİS KURALLARI
    // ============================================
    
    // KURAL 82: Dermis ve Epidermis → Dermis/Epidermis/Deri → %88
    if ((sutNorm.includes('dermis') || sutNorm.includes('epidermis')) && 
        (huvNorm.includes('dermis') || huvNorm.includes('epidermis') || huvNorm.includes('deri'))) {
      return 0.88;
    }
    
    // KURAL 83: Deri → Deri/Dermatoloji/Dermis → %82
    if (sutNorm.includes('deri') && 
        (huvNorm.includes('deri') || huvNorm.includes('dermatoloji') || huvNorm.includes('dermis'))) {
      return 0.82;
    }
    
    // ============================================
    // ÜRİNER SİSTEM-NEFROLOJİ-DİYALİZ KURALLARI
    // ============================================
    
    // KURAL 84: Üriner Sistem → Üriner/Genitoüriner/Böbrek → %88
    if (sutNorm.includes('uriner sistem') && 
        (huvNorm.includes('uriner') || huvNorm.includes('genitoüriner') || huvNorm.includes('bobrek'))) {
      return 0.88;
    }
    
    // KURAL 85: Nefroloji → Nefroloji/Böbrek/Üriner → %88
    if (sutNorm.includes('nefroloji') && 
        (huvNorm.includes('nefroloji') || huvNorm.includes('bobrek') || huvNorm.includes('uriner'))) {
      return 0.88;
    }
    
    // KURAL 86: Böbrek → Böbrek/Renal/Nefroloji → %85
    if (sutNorm.includes('bobrek') && 
        (huvNorm.includes('bobrek') || huvNorm.includes('renal') || huvNorm.includes('nefroloji'))) {
      return 0.85;
    }
    
    // KURAL 87: Üroloji → Üroloji/Üriner/Genitoüriner → %85
    if (sutNorm.includes('uroloji') && 
        (huvNorm.includes('uroloji') || huvNorm.includes('uriner') || huvNorm.includes('genitoüriner'))) {
      return 0.85;
    }
    
    // ============================================
    // HEMATOLOJİ-ONKOLOJİ-KEMOTERAPİ KURALLARI
    // ============================================
    
    // KURAL 88: Hematoloji Onkoloji → Hematoloji/Onkoloji/Kan → %90
    if ((sutNorm.includes('hematoloji onkoloji') || sutNorm.includes('hemato onkoloji')) && 
        (huvNorm.includes('hematoloji') || huvNorm.includes('onkoloji') || huvNorm.includes('kan'))) {
      return 0.90;
    }
    
    // KURAL 89: Kan Hastalıkları → Kan/Hematoloji → %85
    if (sutNorm.includes('kan hastaliklari') && 
        (huvNorm.includes('kan') || huvNorm.includes('hematoloji'))) {
      return 0.85;
    }
    
    // ============================================
    // ZOONOTİK HASTALIKLARA YÖNELİK ANALİZLER KURALLARI
    // ============================================
    
    // KURAL 90: Zoonotik Hastalıklar → Zoonotik/Enfeksiyon/Mikrobiyoloji → %85
    if (sutNorm.includes('zoonotik') && 
        (huvNorm.includes('zoonotik') || huvNorm.includes('enfeksiyon') || huvNorm.includes('mikrobiyoloji'))) {
      return 0.85;
    }
    
    // KURAL 91: Zoonotik Analiz → Zoonotik/Analiz/Laboratuvar → %82
    if (sutNorm.includes('zoonotik analiz') && 
        (huvNorm.includes('zoonotik') || huvNorm.includes('analiz') || huvNorm.includes('laboratuvar'))) {
      return 0.82;
    }
    
    // KURAL 92: Hayvan Kaynaklı → Zoonotik/Enfeksiyon → %80
    if (sutNorm.includes('hayvan kaynakli') && 
        (huvNorm.includes('zoonotik') || huvNorm.includes('enfeksiyon'))) {
      return 0.80;
    }
    
    // ============================================
    // ÖRNEKLEME VE BİYOPSİ KURALLARI
    // ============================================
    
    // KURAL 93: Kemik Biyopsisi → Biyopsi/Örnekleme/Genel İşlemler → %85
    if (sutNorm.includes('kemik biyopsi') && 
        (huvNorm.includes('biyopsi') || huvNorm.includes('ornekleme') || huvNorm.includes('genel islemler'))) {
      return 0.85;
    }
    
    // KURAL 94: Tükrük Bezi → Salgı Bezi/Tükrük → %85
    if (sutNorm.includes('tukruk bezi') && 
        (huvNorm.includes('salgi bezi') || huvNorm.includes('tukruk'))) {
      return 0.85;
    }
    
    // ============================================
    // ÖZEL LABORATUVAR KURALLARI
    // ============================================
    
    // KURAL 95: Hematolojik Boyalar → Hematoloji/Boya → %88
    if (sutNorm.includes('hematolojik boya') && 
        (huvNorm.includes('hematoloji') || huvNorm.includes('boya'))) {
      return 0.88;
    }
    
    // KURAL 96: JAK2 Geni → Moleküler Genetik/JAK2 → %90
    if (sutNorm.includes('jak2 geni') && 
        (huvNorm.includes('molekuler genetik') || huvNorm.includes('jak2'))) {
      return 0.90;
    }
    
    // KURAL 97: PCR Analizi → PCR/Moleküler → %85
    if (sutNorm.includes('pcr') && 
        (huvNorm.includes('pcr') || huvNorm.includes('molekuler'))) {
      return 0.85;
    }
    
    // ============================================
    // RADYOTERAPİ VE DOZ HESAPLARI KURALLARI
    // ============================================
    
    // KURAL 98: Radyasyon Doz Hesabı → Radyoterapi/Doz/Brakiterapi → %88
    if ((sutNorm.includes('radyasyon doz hesab') || sutNorm.includes('temel radyasyon doz')) && 
        (huvNorm.includes('radyoterapi') || huvNorm.includes('doz') || huvNorm.includes('brakiterapi'))) {
      return 0.88;
    }
    
    // KURAL 99: Brakiterapi → Brakiterapi/Radyoterapi → %90
    if (sutNorm.includes('brakiterapi') && 
        (huvNorm.includes('brakiterapi') || huvNorm.includes('radyoterapi'))) {
      return 0.90;
    }
    
    // KURAL 100: Portal Görüntüleme → Portal/Radyoloji → %82
    if (sutNorm.includes('portal goruntulem') && 
        (huvNorm.includes('portal') || huvNorm.includes('radyoloji'))) {
      return 0.82;
    }
    
    // ============================================
    // ÜROLOJİ VE EMPOTANS KURALLARI
    // ============================================
    
    // KURAL 101: Empotans → Empotans/Üroloji → %85
    if (sutNorm.includes('empotans') && 
        (huvNorm.includes('empotans') || huvNorm.includes('uroloji'))) {
      return 0.85;
    }
    
    // KURAL 102: Penil Arter → Penil/Üroloji → %82
    if (sutNorm.includes('penil arter') && 
        (huvNorm.includes('penil') || huvNorm.includes('uroloji'))) {
      return 0.82;
    }
    
    // KURAL 103: Sistometri → Sistometri/Ürodinamik → %85
    if (sutNorm.includes('sistometri') && 
        (huvNorm.includes('sistometri') || huvNorm.includes('urodinamik'))) {
      return 0.85;
    }
    
    // KURAL 104: Ürodinamik → Ürodinamik/Üroloji → %85
    if (sutNorm.includes('urodinamik') && 
        (huvNorm.includes('urodinamik') || huvNorm.includes('uroloji'))) {
      return 0.85;
    }
    
    // KURAL 105: Prostat Termoterapi → Prostat/Termoterapi → %85
    if (sutNorm.includes('prostat') && sutNorm.includes('termoterapi') && 
        (huvNorm.includes('prostat') || huvNorm.includes('termoterapi'))) {
      return 0.85;
    }
    
    // ============================================
    // HÜCRE SELEKSİYONU VE KEMOTERAPİ KURALLARI
    // ============================================
    
    // KURAL 106: CD34 Hücre Seleksiyonu → Hücre/Seleksiyon/Hematoloji → %88
    if (sutNorm.includes('cd34') && sutNorm.includes('seleksiyon') && 
        (huvNorm.includes('hucre') || huvNorm.includes('seleksiyon') || huvNorm.includes('hematoloji'))) {
      return 0.88;
    }
    
    // KURAL 107: İnfüzyon Kemoterapisi → İnfüzyon/Kemoterapi → %88
    if (sutNorm.includes('infuzyon kemoterapi') && 
        (huvNorm.includes('infuzyon') || huvNorm.includes('kemoterapi'))) {
      return 0.88;
    }
    
    // KURAL 108: İntrakaviter Kemoterapi → İntrakaviter/Kemoterapi → %88
    if (sutNorm.includes('intrakaviter kemo') && 
        (huvNorm.includes('intrakaviter') || huvNorm.includes('kemoterapi'))) {
      return 0.88;
    }
    
    // ============================================
    // ENDOSKOPİ VE SİNDİRİM KURALLARI
    // ============================================
    
    // KURAL 109: pH Monitörizasyon → pH/Monitörizasyon/Sindirim → %85
    if (sutNorm.includes('ph monitoriz') && 
        (huvNorm.includes('ph') || huvNorm.includes('monitoriz') || huvNorm.includes('sindirim'))) {
      return 0.85;
    }
    
    // KURAL 110: Enteroskopi → Enteroskopi/Endoskopi → %88
    if (sutNorm.includes('enteroskopi') && 
        (huvNorm.includes('enteroskopi') || huvNorm.includes('endoskopi'))) {
      return 0.88;
    }
    
    // KURAL 111: Beslenme Tüpü → Beslenme/Tüp/Sindirim → %82
    if (sutNorm.includes('beslenme tupu') && 
        (huvNorm.includes('beslenme') || huvNorm.includes('tup') || huvNorm.includes('sindirim'))) {
      return 0.82;
    }
    
    // ============================================
    // DETAYLI ENDOSKOPİ VE BİLİYER KURALLARI
    // ============================================
    
    // KURAL 112: Biliyer Dilatasyon → Biliyer/Dilatasyon/Endoskopi → %88
    if (sutNorm.includes('biliyer dilatasy') && 
        (huvNorm.includes('biliyer') || huvNorm.includes('dilatasy') || huvNorm.includes('endoskopi'))) {
      return 0.88;
    }
    
    // KURAL 113: Endoprotez → Endoprotez/Stent/Endoskopi → %85
    if (sutNorm.includes('endoprotez') && 
        (huvNorm.includes('endoprotez') || huvNorm.includes('stent') || huvNorm.includes('endoskopi'))) {
      return 0.85;
    }
    
    // KURAL 114: Kisto-duodenostomi → Kisto/Duodenostomi/Endoskopi → %88
    if (sutNorm.includes('kisto-duodenostomi') && 
        (huvNorm.includes('kisto') || huvNorm.includes('duodenostomi') || huvNorm.includes('endoskopi'))) {
      return 0.88;
    }
    
    // KURAL 115: Kisto-gastrostomi → Kisto/Gastrostomi/Endoskopi → %88
    if (sutNorm.includes('kisto-gastrostomi') && 
        (huvNorm.includes('kisto') || huvNorm.includes('gastrostomi') || huvNorm.includes('endoskopi'))) {
      return 0.88;
    }
    
    // KURAL 116: ERCP → ERCP/Kolanjiyopankreatografi/Endoskopi → %90
    if (sutNorm.includes('kolanjiyopankreatografi') && 
        (huvNorm.includes('ercp') || huvNorm.includes('kolanjiyopankreatografi') || huvNorm.includes('endoskopi'))) {
      return 0.90;
    }
    
    // KURAL 117: Sfinkterotomi → Sfinkterotomi/Endoskopi → %88
    if (sutNorm.includes('sfinkterotomi') && 
        (huvNorm.includes('sfinkterotomi') || huvNorm.includes('endoskopi'))) {
      return 0.88;
    }
    
    // KURAL 118: Polipektomi → Polipektomi/Endoskopi → %88
    if (sutNorm.includes('polipektomi') && 
        (huvNorm.includes('polipektomi') || huvNorm.includes('endoskopi'))) {
      return 0.88;
    }
    
    // KURAL 119: Mukoza Rezeksiyonu → Mukoza/Rezeksiyon/Endoskopi → %85
    if (sutNorm.includes('mukoza rezeksiyon') && 
        (huvNorm.includes('mukoza') || huvNorm.includes('rezeksiyon') || huvNorm.includes('endoskopi'))) {
      return 0.85;
    }
    
    // KURAL 120: Litotripsi → Litotripsi/Taş → %85
    if (sutNorm.includes('litotripsi') && 
        (huvNorm.includes('litotripsi') || huvNorm.includes('tas'))) {
      return 0.85;
    }
    
    // KURAL 121: Pankreatik Drenaj → Pankreatik/Drenaj → %85
    if (sutNorm.includes('pankreatik drenaj') && 
        (huvNorm.includes('pankreatik') || huvNorm.includes('drenaj'))) {
      return 0.85;
    }
    
    // KURAL 122: Konfokal Lazer → Konfokal/Lazer/Endoskopi → %85
    if (sutNorm.includes('konfokal lazer') && 
        (huvNorm.includes('konfokal') || huvNorm.includes('lazer') || huvNorm.includes('endoskopi'))) {
      return 0.85;
    }
    
    // ============================================
    // DETAYLI GÖZ MUAYENELERİ KURALLARI
    // ============================================
    
    // KURAL 123: Az Görenler → Az Görenler/Görme/Göz → %85
    if (sutNorm.includes('az gorenler') && 
        (huvNorm.includes('az gorenler') || huvNorm.includes('gorme') || huvNorm.includes('goz'))) {
      return 0.85;
    }
    
    // KURAL 124: ERG-VER-EOG → ERG/VER/EOG/Elektroretinografi → %90
    if ((sutNorm.includes('erg') || sutNorm.includes('ver') || sutNorm.includes('eog')) && 
        (huvNorm.includes('erg') || huvNorm.includes('ver') || huvNorm.includes('eog') || huvNorm.includes('elektroretinografi'))) {
      return 0.90;
    }
    
    // KURAL 125: Fresnel Prizması → Fresnel/Prizma/Göz → %85
    if (sutNorm.includes('fresnel prizma') && 
        (huvNorm.includes('fresnel') || huvNorm.includes('prizma') || huvNorm.includes('goz'))) {
      return 0.85;
    }
    
    // KURAL 126: Gonyoskopi → Gonyoskopi/Göz → %88
    if (sutNorm.includes('gonyoskopi') && 
        (huvNorm.includes('gonyoskopi') || huvNorm.includes('goz'))) {
      return 0.88;
    }
    
    // KURAL 127: Perimetri → Perimetri/Görme Alanı → %88
    if (sutNorm.includes('perimetri') && 
        (huvNorm.includes('perimetri') || huvNorm.includes('gorme alani'))) {
      return 0.88;
    }
    
    // KURAL 128: Pakimetri → Pakimetri/Göz → %88
    if (sutNorm.includes('pakimetri') && 
        (huvNorm.includes('pakimetri') || huvNorm.includes('goz'))) {
      return 0.88;
    }
    
    // KURAL 129: Sinoptophor → Sinoptophor/Şaşılık/Göz → %85
    if (sutNorm.includes('sinoptophor') && 
        (huvNorm.includes('sinoptophor') || huvNorm.includes('sasilik') || huvNorm.includes('goz'))) {
      return 0.85;
    }
    
    // KURAL 130: Tonografi → Tonografi/Göz İçi Basınç → %88
    if (sutNorm.includes('tonografi') && 
        (huvNorm.includes('tonografi') || huvNorm.includes('goz ici basinc'))) {
      return 0.88;
    }
    
    // ============================================
    // DETAYLI İŞİTME VE KBB KURALLARI
    // ============================================
    
    // KURAL 131: Bekesy Odyometresi → Bekesy/Odyometri/İşitme → %88
    if (sutNorm.includes('bekesy odyometri') && 
        (huvNorm.includes('bekesy') || huvNorm.includes('odyometri') || huvNorm.includes('isitme'))) {
      return 0.88;
    }
    
    // KURAL 132: Videonistagmografi → Videonistagmografi/VNG/Vestibüler → %88
    if (sutNorm.includes('videonistagmografi') && 
        (huvNorm.includes('videonistagmografi') || huvNorm.includes('vng') || huvNorm.includes('vestibuler'))) {
      return 0.88;
    }
    
    // KURAL 133: ENOG → ENOG/Elektronöronografi → %88
    if (sutNorm.includes('enog') && 
        (huvNorm.includes('enog') || huvNorm.includes('elektronoronografi'))) {
      return 0.88;
    }
    
    // KURAL 134: Vestibüler İnceleme → Vestibüler/İnceleme/Denge → %85
    if (sutNorm.includes('vestibuler inceleme') && 
        (huvNorm.includes('vestibuler') || huvNorm.includes('inceleme') || huvNorm.includes('denge'))) {
      return 0.85;
    }
    
    // KURAL 135: Timpanometri → Timpanometri/İşitme → %85
    if (sutNorm.includes('timpanometri') && 
        (huvNorm.includes('timpanometri') || huvNorm.includes('isitme'))) {
      return 0.85;
    }
    
    // KURAL 136: Posturografi → Posturografi/Denge → %85
    if (sutNorm.includes('posturografi') && 
        (huvNorm.includes('posturografi') || huvNorm.includes('denge'))) {
      return 0.85;
    }
    
    // KURAL 146: Tükrük bezi işlemleri → Baş, Boyun, Tiroid/Salgı Bezleri/Genel İşlemler → %85
    if (sutNorm.includes('tukruk bezi') && 
        (huvNorm.includes('bas') || huvNorm.includes('boyun') || huvNorm.includes('tiroid') || 
         huvNorm.includes('salgi bezi') || huvNorm.includes('genel islemler'))) {
      return 0.85;
    }
    
    // KURAL 147: Kemik tümörü biyopsisi → Genel İşlemler/Biyopsi → %85
    if ((sutNorm.includes('kemik tumor') || sutNorm.includes('kemik tumoru')) && sutNorm.includes('biyopsi') && 
        (huvNorm.includes('genel islemler') || huvNorm.includes('biyopsi'))) {
      return 0.85;
    }
    
    // KURAL 148: Eksizyon işlemleri → Cerrahi İşlemler/Genel İşlemler → %80
    if (sutNorm.includes('eksizyon') && 
        (huvNorm.includes('cerrahi islemler') || huvNorm.includes('genel islemler'))) {
      return 0.80;
    }
    
    // KURAL 149: Desensitizasyon → Allerji Testleri/Genel İşlemler → %85
    if (sutNorm.includes('desensitizasyon') && 
        (huvNorm.includes('allerji testleri') || huvNorm.includes('genel islemler'))) {
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
  async match(sutIslem, huvList) {
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
        sutIslem,
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
