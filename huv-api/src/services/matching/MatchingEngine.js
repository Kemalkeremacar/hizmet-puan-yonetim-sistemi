// ============================================
// MATCHING ENGINE SERVICE
// ============================================
// Core service for SUT-HUV automatic matching
// Coordinates matching operations and strategy selection
// ============================================

const sql = require('mssql');
const DirectSutCodeStrategy = require('./DirectSutCodeStrategy');
const HierarchyMatchingStrategy = require('./HierarchyMatchingStrategy');
const FirstLetterStrategy = require('./FirstLetterStrategy');
const GeneralSimilarityStrategy = require('./GeneralSimilarityStrategy');
const BatchProcessor = require('../../utils/BatchProcessor');

/**
 * Matching Engine Service
 * Coordinates SUT-HUV matching operations
 */
class MatchingEngine {
  constructor(dbPool) {
    this.dbPool = dbPool;
    
    // Initialize strategies
    this.strategies = {
      directSutCode: new DirectSutCodeStrategy(dbPool), // EN YÜKSEK ÖNCELİK
      hierarchy: new HierarchyMatchingStrategy(dbPool), // İKİNCİ ÖNCELİK
      firstLetter: new FirstLetterStrategy(),
      general: new GeneralSimilarityStrategy()
    };
  }
  
  /**
   * Select appropriate matching strategy based on Ana Dal code
   * @param {number} anaDalKodu - Ana Dal code
   * @returns {MatchingStrategy} Selected strategy
   */
  /**
   * Get correct Ana Dal code based on SUT alt teminat
   * @param {Object} sutIslem - SUT işlem object
   * @returns {number} Correct Ana Dal code
   */
  /**
   * Get HUV Alt Teminatlar for given Ana Dal
   * Ortak method - kod tekrarını önler
   * @param {number|null} anaDalKodu - Ana Dal kodu (null ise tümü)
   * @returns {Promise<Array>} HUV Alt Teminatlar listesi
   */
  async _getHuvAltTeminatlar(anaDalKodu = null) {
    try {
      const request = this.dbPool.request();
      
      let query = `
        SELECT 
          AltTeminatID as altTeminatId,
          AltTeminatAdi as altTeminatAdi,
          AnaDalKodu as anaDalKodu
        FROM HuvAltTeminatlar
        WHERE AktifMi = 1
      `;
      
      if (anaDalKodu !== null) {
        query += ` AND AnaDalKodu = @anaDalKodu`;
        request.input('anaDalKodu', sql.Int, anaDalKodu);
      }
      
      query += ` ORDER BY Sira, AltTeminatAdi`;
      
      const result = await request.query(query);
      return result.recordset;
      
    } catch (error) {
      console.error('Error in _getHuvAltTeminatlar:', error);
      return [];
    }
  }

  _getCorrectAnaDalKodu(sutIslem) {
    // Manuel SUT kodu bazlı ana dal mapping (eşleşmeyen kayıtlar için)
    const sutKoduMapping = {
      // Göz işlemleri → Ana Dal 11
      '617451': 11, // Ön kamaradan silikon alınması
      
      // Laboratuvar işlemleri → Ana Dal 34
      'G101070': 34, // JAK2 Geni Ekzon 12 Mutasyon Analizi
      'G101080': 34, // JAK2 Geni V617F Mutasyon Analizi
      'G101630': 34, // QF PCR ile Anöploidi Analizi
      '912510': 34, // Anaplasma IFA IgG
      '912540': 34, // Bartonella henselae IFA
      '912570': 34, // Coxiella burnetii IFA IgG
      '912580': 34, // Coxiella burnetii IFA Faz I+II
      '912590': 34, // Coxiella burnetii IFA IgM
      '912600': 34, // Erlichia/Anaplasma IFA IgM
      '912610': 34, // Erlichia IFA IgG
      
      // Hematoloji işlemleri → Ana Dal 12
      '704760': 12, // Lenf bezi aspirasyonu-ponksiyonu
      
      // Üroloji işlemleri → Ana Dal 26
      '704210': 26, // Acil hemodiyaliz
      '704230': 26, // Hemodiyaliz
      '704231': 26, // Hemodiyaliz için kateter yerleştirilmesi
      '704232': 26, // Kalıcı tünelli kateter yerleştirilmesi
      '704233': 26, // Ev hemodiyalizi
      '704240': 26, // Hemoperfüzyon
      '704250': 26, // İzole ultrafiltrasyon
      '704260': 26, // Periton diyalizi takibi
      '704280': 26, // Rejyonel heparinizasyon
      '704330': 26, // Empotansta nörolojik değerlendirmeler
      '704340': 26, // Empotansta uyku çalışmaları
      '704370': 12, // İntrakaviter kemo veya immünoterapi → İç Hastalıkları (Onkoloji alt dalı)
      '704400': 26, // Penil arter basınç ölçümü
      '704410': 26, // Perkütan sinir incelemesi
      '704420': 26, // Seminal vezikülografi
      '704450': 26, // Sistometri ve Üroflowmetri
      '704460': 26, // Ürodinamik çalışma
      '704491': 26, // Prostat Mikrodalga Termoterapisi
      
      // Dermatoloji işlemleri → Ana Dal 6
      '700170': 6, // Fotokemoterapi (PUVA) genel
      '700180': 6, // Fotokemoterapi (PUVA) lokal
      '700190': 6, // Fototerapi (dbUVB) genel
      '700201': 6, // İlaç/besin desensitizasyonu
      '700240': 6, // Kimyasal koterizasyon
      '700260': 6, // Kimyasal peeling
      '700270': 6, // Kriyoterapi benign lezyonlar
      '700280': 6, // Kriyoterapi malign lezyonlar
      
      // Sindirim işlemleri → Ana Dal 12
      '701280': 12, // Duodenum, ince barsak biyopsisi
      '701430': 12, // GİS darlıklarında stent yerleştirilmesi
      '701440': 12, // Koledoktan balon veya basketle taş çıkarılması
      '701470': 12, // Mekanik litotripsi
      '701500': 12, // Nazo pankreatik drenaj
      '701540': 12, // Özefagoskopi, gastroskopi, duodenoskopi
      '701545': 12, // Konfokal lazer endomikroskopik üst GİS endoskopi
      
      // Göz muayene işlemleri → Ana Dal 11
      '703660': 11, // Fresnel Prizması Uygulaması
      '703670': 11, // Gonyoskopi ve kornea çapı ölçümü
      '703790': 11, // Nerve Fiber Analyzer (NFA)
      '703820': 11, // Ön ve arka segment renkli resmi
      '703860': 11, // Scanning lazer oftalmoskopi
      '703890': 11, // Tonografi
      '703910': 11, // Ultrasonografik biyomikroskopi
      
      // KBB işlemleri → Ana Dal 16
      '703970': 16, // Çocuk odyometresi
      '704020': 16, // Çocuk işitme eğitimi
      '704060': 16, // Konuşma, protez değiştirilmesi
      '704140': 16, // Posturografi
      '704160': 16, // Odyolojik araştırma
      
      // Radyoloji işlemleri → Ana Dal 24
      '800235': 24, // Temel radyasyon doz hesapları
      '800320': 24, // Digital Portal görüntüleme
      
      // Genel Cerrahi işlemleri → Ana Dal 8
      '614351': 8, // Kemik tümörü açık biyopsisi
      '614353': 8, // Kapalı kemik biyopsisi
      '603160': 8, // Minör tükrük bezi dokularının eksizyonu
      
      // Dermatoloji işlemleri → Ana Dal 6
      '700201': 6, // İlaç/besin desensitizasyonu
    };
    
    // Önce SUT kodu kontrolü yap
    if (sutKoduMapping[sutIslem.sutKodu]) {
      return sutKoduMapping[sutIslem.sutKodu];
    }
    
    // SUT alt teminat bazlı ana dal mapping (HUV kodlarına göre)
    const altTeminatMapping = {
      // Göz Hastalıkları
      'İRİS VE LENS İLE İLGİLİ İŞLEMLER': 11,
      'ŞAŞILIK VE PEDİYATRİK OFTALMOLOJİ': 11,
      'GÖZ VE ADNEKSLERİ': 11,
      
      // Üroloji
      'ÜRİNER SİSTEM-NEFROLOJİ-DİYALİZ': 26,
      
      // İç Hastalıkları (Gastroenteroloji alt dalı)
      'SİNDİRİM SİSTEMİ': 12,
      
      // Dermatoloji
      'DERMİS VE EPİDERMİS': 6,
      
      // İç Hastalıkları (Hematoloji-Onkoloji alt dalı)
      'HEMATOLOJİ-ONKOLOJİ-KEMOTERAPİ': 12, // İç Hastalıkları
      
      // KBB
      'SES VE İŞİTME İLE İLGİLİ ÇALIŞMALAR': 16,
      
      // Laboratuvar
      'MOLEKÜLER GENETİK TETKİKLER': 34,
      'BİYOKİMYA LABORATUVAR İŞLEMLERİ': 34,
      'ZOONOTIK HASTALIKLARA YÖNELİK ANALİZLER': 34,
      
      // Radyoloji
      'Brakiterapi doz hesapları': 24,
      'Portal görüntüleme': 24,
      
      // Genel Cerrahi
      'Örnekleme Yöntemi': 8,
      'Salgı Bezlerine Yönelik Cerrahi': 8
    };
    
    // SUT alt teminat kontrolü yap
    if (sutIslem.sutAltTeminat && altTeminatMapping[sutIslem.sutAltTeminat]) {
      return altTeminatMapping[sutIslem.sutAltTeminat];
    }
    
    // İşlem adı bazlı ana dal yönlendirmesi (eski hardcoded kontroller)
    const islemAdiLower = sutIslem.islemAdi.toLowerCase();
    
    // Ana Başlık 9 (GÖĞÜS CERRAHİSİ) → Laboratuvar testleri Ana Dal 34'te
    if (sutIslem.anaDalKodu === 9) {
      return 34; // LABORATUVAR İNCELEMELERİ
    }
    
    // Ana Dal 8 (GENEL CERRAHİ) → Özel işlem türlerine göre yönlendirme
    if (sutIslem.anaDalKodu === 8) {
      // Radyoterapi/Brakiterapi → Ana Dal 27
      const radyoKeywords = ['radyo', 'braki', 'imrt', 'stereotaktik', 'konformal', 'volumetrik', 'tedavi'];
      const isRadyoterapi = radyoKeywords.some(k => islemAdiLower.includes(k));
      
      // Sintigrafi/Nükleer → Ana Dal 19
      const nukleerKeywords = ['sintigraf', 'perfüzyon', 'ventilasyon', 'miyokard', 'böbrek', 'tümör görüntüleme', 'pet', 'spect'];
      const isNukleer = nukleerKeywords.some(k => islemAdiLower.includes(k));
      
      // Görüntüleme (mammografi, floroskopi, grafi) → Ana Dal 24
      const goruntuKeywords = ['mammografi', 'floroskopi', 'grafi', 'röntgen', 'survey', 'schuller', 'sella', 'sinüs', 'temporamandibular'];
      const isGoruntu = goruntuKeywords.some(k => islemAdiLower.includes(k));
      
      if (isRadyoterapi) {
        return 27; // RADYASYON ONKOLOJİSİ
      } else if (isNukleer) {
        return 19; // NÜKLEER TIP
      } else if (isGoruntu) {
        return 24; // RADYOLOJİ
      }
    }
    
    // Ana Dal 10 (GÖĞÜS HASTALIKLARI) → Laboratuvar testleri Ana Dal 34'te
    if (sutIslem.anaDalKodu === 10) {
      const labKeywords = ['test', 'antikor', 'elisa', 'kültür', 'kultur', 'panel', 'identifikasyon'];
      const isLabTest = labKeywords.some(k => islemAdiLower.includes(k));
      
      if (isLabTest) {
        return 34; // LABORATUVAR İNCELEMELERİ
      }
    }
    
    // Eğer hiçbiri uymazsa, varsayılan olarak SUT'taki ana dal kodunu kullan
    return sutIslem.anaDalKodu;
  }

  _selectStrategy(anaDalKodu) {
    // Ana Dal 9 (GÖĞÜS CERRAHİSİ) → FirstLetterStrategy (Laboratory Tests ONLY)
    if (anaDalKodu === 9) {
      return this.strategies.firstLetter;
    }
    
    // Ana Dal 11 (GÖZ HASTALIKLARI) → GeneralSimilarityStrategy (özel göz kuralları ile)
    if (anaDalKodu === 11) {
      return this.strategies.general;
    }
    
    // Ana Dal 34 (LABORATUVAR İNCELEMELERİ) → FirstLetterStrategy
    // ANCAK: JAK2, PCR gibi özel işlemler için GeneralSimilarityStrategy de dene
    if (anaDalKodu === 34) {
      return this.strategies.firstLetter;
    }
    
    // Ana Dal 20 (ORTOPEDİ VE TRAVMATOLOJİ) → GeneralSimilarityStrategy
    if (anaDalKodu === 20) {
      return this.strategies.general;
    }
    
    // Ana Dal 21 (PLASTİK, REKONSTRÜKTİF VE ESTETİK CERRAHİ) → GeneralSimilarityStrategy
    if (anaDalKodu === 21) {
      return this.strategies.general;
    }
    
    // Ana Dal 14 (KALP VE DAMAR CERRAHİSİ) → GeneralSimilarityStrategy
    if (anaDalKodu === 14) {
      return this.strategies.general;
    }
    
    // Ana Dal 6 (DERMATOLOJİ) → GeneralSimilarityStrategy
    if (anaDalKodu === 6) {
      return this.strategies.general;
    }
    
    // Ana Dal 26 (ÜROLOJİ) → GeneralSimilarityStrategy
    if (anaDalKodu === 26) {
      return this.strategies.general;
    }
    
    // Ana Dal 12 (İÇ HASTALIKLARI) → GeneralSimilarityStrategy
    if (anaDalKodu === 12) {
      return this.strategies.general;
    }
    
    // Ana Dal 28 (TIBBİ PATOLOJİ) → GeneralSimilarityStrategy
    if (anaDalKodu === 28) {
      return this.strategies.general;
    }
    
    // Ana Dal 16 (KULAK-BURUN-BOĞAZ HASTALIKLARI) → GeneralSimilarityStrategy
    if (anaDalKodu === 16) {
      return this.strategies.general;
    }
    
    // Ana Dal 24 (RADYOLOJİ) → GeneralSimilarityStrategy
    if (anaDalKodu === 24) {
      return this.strategies.general;
    }
    
    // Ana Dal 8 (GENEL CERRAHİ) → GeneralSimilarityStrategy
    if (anaDalKodu === 8) {
      return this.strategies.general;
    }
    
    // All others → GeneralSimilarityStrategy
    return this.strategies.general;
  }
  
  /**
   * Match a single SUT işlem with HUV teminatlar
   * @param {number} sutId - SUT işlem ID
   * @returns {Promise<Object>} Match result
   */
  async matchSingle(sutId) {
    try {
      // Fetch SUT işlem from database with hierarchy info
      const sutResult = await this.dbPool.request()
        .input('sutId', sql.Int, sutId)
        .query(`
          SELECT 
            s.SutID as sutId,
            s.SutKodu as sutKodu,
            s.IslemAdi as islemAdi,
            s.AnaBaslikNo as anaDalKodu,
            sh.Baslik as sutAltTeminat
          FROM SutIslemler s
          LEFT JOIN SutHiyerarsi sh ON s.HiyerarsiID = sh.HiyerarsiID
          WHERE s.SutID = @sutId AND s.AktifMi = 1
        `);
      
      if (sutResult.recordset.length === 0) {
        throw new Error(`SUT işlem not found: ${sutId}`);
      }
      
      const sutIslem = sutResult.recordset[0];
      
      // ÖNCELİK 1: Direct SUT Code Strategy - HUV işlemlerinde bu SUT kodu varsa direkt eşleştir
      const directMatch = await this.strategies.directSutCode.match(sutIslem, null);
      if (directMatch.matched) {
        return {
          ...directMatch,
          sutId: sutIslem.sutId,
          sutKodu: sutIslem.sutKodu,
          islemAdi: sutIslem.islemAdi
        };
      }
      
      // ÖNCELİK 2: Doğru Ana Dal kodunu belirle
      const correctAnaDalKodu = this._getCorrectAnaDalKodu(sutIslem);
      
      // Fetch HUV teminatlar for the correct Ana Dal
      const huvList = await this._getHuvAltTeminatlar(correctAnaDalKodu);
      
      if (huvList.length === 0) {
        return {
          matched: false,
          sutId: sutIslem.sutId,
          error: `No HUV teminatlar found for Ana Dal ${correctAnaDalKodu}`
        };
      }
      
      // Select and execute appropriate matching strategy
      const strategy = this._selectStrategy(correctAnaDalKodu);
      const matchResult = strategy.match(sutIslem, huvList);
      
      return {
        ...matchResult,
        sutId: sutIslem.sutId,
        sutKodu: sutIslem.sutKodu,
        islemAdi: sutIslem.islemAdi
      };
      
    } catch (error) {
      console.error('Error in matchSingle:', error);
      throw error;
    }
  }
  
  /**
   * Save match result to database (upsert logic)
   * @param {number} sutId - SUT işlem ID
   * @param {number} altTeminatId - HUV alt teminat ID
   * @param {number} confidence - Confidence score
   * @param {string} ruleType - Matching rule type
   * @param {number} userId - User ID (optional, null for automatic)
   * @returns {Promise<Object>} Saved match record
   */
  async saveMatch(sutId, altTeminatId, confidence, ruleType, userId = null) {
    const transaction = new sql.Transaction(this.dbPool);
    
    try {
      await transaction.begin();
      
      // Check if match already exists for SutID (with row lock)
      const existingResult = await transaction.request()
        .input('sutId', sql.Int, sutId)
        .query(`
          SELECT ID, SutID, AltTeminatID, IsOverridden
          FROM AltTeminatIslemler WITH (UPDLOCK, HOLDLOCK)
          WHERE SutID = @sutId
        `);
      
      if (existingResult.recordset.length > 0) {
        const existing = existingResult.recordset[0];
        
        // KORUMA: Manuel değiştirilmiş kayıtları (IsOverridden = 1) güncelleme!
        if (existing.IsOverridden === 1 || existing.IsOverridden === true) {
          await transaction.commit();
          return existing; // Mevcut kaydı döndür, değiştirme
        }
        
        // Update existing record (only if not manually overridden)
        const updateResult = await transaction.request()
          .input('sutId', sql.Int, sutId)
          .input('altTeminatId', sql.Int, altTeminatId)
          .input('confidence', sql.Decimal(5, 2), confidence)
          .input('ruleType', sql.NVarChar(50), ruleType)
          .input('userId', sql.Int, userId)
          .query(`
            UPDATE AltTeminatIslemler
            SET 
              AltTeminatID = @altTeminatId,
              ConfidenceScore = @confidence,
              MatchingRuleType = @ruleType,
              UpdatedAt = GETDATE(),
              UpdatedBy = @userId
            WHERE SutID = @sutId;
            
            SELECT 
              ID, SutID, AltTeminatID, ConfidenceScore, MatchingRuleType,
              IsAutomatic, IsApproved, CreatedAt, UpdatedAt
            FROM AltTeminatIslemler
            WHERE SutID = @sutId;
          `);
        
        await transaction.commit();
        return updateResult.recordset[0];
      } else {
        // Insert new record
        const insertResult = await transaction.request()
          .input('sutId', sql.Int, sutId)
          .input('altTeminatId', sql.Int, altTeminatId)
          .input('confidence', sql.Decimal(5, 2), confidence)
          .input('ruleType', sql.NVarChar(50), ruleType)
          .input('userId', sql.Int, userId)
          .query(`
            INSERT INTO AltTeminatIslemler (
              SutID, AltTeminatID, ConfidenceScore, MatchingRuleType,
              IsAutomatic, IsApproved, CreatedAt, CreatedBy
            )
            VALUES (
              @sutId, @altTeminatId, @confidence, @ruleType,
              1, 0, GETDATE(), @userId
            );
            
            SELECT 
              ID, SutID, AltTeminatID, ConfidenceScore, MatchingRuleType,
              IsAutomatic, IsApproved, CreatedAt, UpdatedAt
            FROM AltTeminatIslemler
            WHERE SutID = @sutId;
          `);
        
        await transaction.commit();
        return insertResult.recordset[0];
      }
      
    } catch (error) {
      console.error('Error in saveMatch:', error);
      if (transaction) {
        await transaction.rollback();
      }
      throw error;
    }
  }
  
  /**
   * Approve a match
   * @param {number} sutId - SUT işlem ID
   * @param {number} userId - User ID who approved
   * @returns {Promise<Object>} Updated match record
   */
  async approveMatch(sutId, userId) {
    try {
      const result = await this.dbPool.request()
        .input('sutId', sql.Int, sutId)
        .input('userId', sql.Int, userId)
        .query(`
          UPDATE AltTeminatIslemler
          SET 
            IsApproved = 1,
            UpdatedAt = GETDATE(),
            UpdatedBy = @userId
          WHERE SutID = @sutId;
          
          SELECT 
            ID, SutID, AltTeminatID, ConfidenceScore, MatchingRuleType,
            IsAutomatic, IsApproved, UpdatedAt, UpdatedBy
          FROM AltTeminatIslemler
          WHERE SutID = @sutId;
        `);
      
      if (result.recordset.length === 0) {
        throw new Error(`Match not found for SUT ID: ${sutId}`);
      }
      
      return result.recordset[0];
      
    } catch (error) {
      console.error('Error in approveMatch:', error);
      throw error;
    }
  }
  
  /**
   * Change match to a different HUV teminat (manual override)
   * @param {number} sutId - SUT işlem ID
   * @param {number} newAltTeminatId - New HUV alt teminat ID
   * @param {number} userId - User ID who made the change
   * @returns {Promise<Object>} Updated match record
   */
  async changeMatch(sutId, newAltTeminatId, userId) {
    try {
      // Fetch existing match record
      const existingResult = await this.dbPool.request()
        .input('sutId', sql.Int, sutId)
        .query(`
          SELECT 
            ID, SutID, AltTeminatID, ConfidenceScore, MatchingRuleType
          FROM AltTeminatIslemler
          WHERE SutID = @sutId
        `);
      
      if (existingResult.recordset.length === 0) {
        throw new Error(`Match not found for SUT ID: ${sutId}`);
      }
      
      const existing = existingResult.recordset[0];
      
      // Update with override tracking
      const updateResult = await this.dbPool.request()
        .input('sutId', sql.Int, sutId)
        .input('newAltTeminatId', sql.Int, newAltTeminatId)
        .input('userId', sql.Int, userId)
        .input('originalAltTeminatId', sql.Int, existing.AltTeminatID)
        .input('originalConfidence', sql.Decimal(5, 2), existing.ConfidenceScore)
        .input('originalRuleType', sql.NVarChar(50), existing.MatchingRuleType)
        .query(`
          UPDATE AltTeminatIslemler
          SET 
            AltTeminatID = @newAltTeminatId,
            IsOverridden = 1,
            IsAutomatic = 0,
            IsApproved = 0,
            OriginalAltTeminatID = @originalAltTeminatId,
            OriginalConfidenceScore = @originalConfidence,
            OriginalRuleType = @originalRuleType,
            OverriddenAt = GETDATE(),
            OverriddenBy = @userId,
            UpdatedAt = GETDATE(),
            UpdatedBy = @userId
          WHERE SutID = @sutId;
          
          SELECT 
            ID, SutID, AltTeminatID, ConfidenceScore, MatchingRuleType,
            IsAutomatic, IsApproved, IsOverridden,
            OriginalAltTeminatID, OriginalConfidenceScore, OriginalRuleType,
            OverriddenAt, OverriddenBy, UpdatedAt, UpdatedBy
          FROM AltTeminatIslemler
          WHERE SutID = @sutId;
        `);
      
      return updateResult.recordset[0];
      
    } catch (error) {
      console.error('Error in changeMatch:', error);
      throw error;
    }
  }
  
  /**
   * Run batch matching operation on unmatched SUT işlemleri
   * @param {Object} options - Batch options { batchSize, anaDalKodu, forceRematch }
   * @param {Function} progressCallback - Progress callback (optional)
   * @returns {Promise<Object>} Batch summary
   */
  async runBatch(options = {}, progressCallback = null) {
    const {
      batchSize = 100,
      anaDalKodu = null,
      forceRematch = false
    } = options;
    
    const startTime = Date.now();
    
    try {
      // Fetch unmatched SUT işlemleri (or all if forceRematch = true)
      // LIMIT to batchSize records
      let query = `
        SELECT TOP (@batchSize)
          s.SutID as sutId,
          s.SutKodu as sutKodu,
          s.IslemAdi as islemAdi,
          s.AnaBaslikNo as anaDalKodu,
          s.HiyerarsiID as hiyerarsiId,
          sh.Baslik as sutAltTeminat
        FROM SutIslemler s
        LEFT JOIN SutHiyerarsi sh ON s.HiyerarsiID = sh.HiyerarsiID
        WHERE s.AktifMi = 1
      `;
      
      if (!forceRematch) {
        query += `
          AND NOT EXISTS (
            SELECT 1 FROM AltTeminatIslemler a
            WHERE a.SutID = s.SutID
          )
        `;
      }
      
      if (anaDalKodu !== null) {
        query += ` AND s.AnaBaslikNo = @anaDalKodu`;
      }
      
      const request = this.dbPool.request();
      request.input('batchSize', sql.Int, batchSize);
      if (anaDalKodu !== null) {
        request.input('anaDalKodu', sql.Int, anaDalKodu);
      }
      
      const result = await request.query(query);
      const sutIslemler = result.recordset;
      
      // ============================================
      // PERFORMANS İYİLEŞTİRMESİ: N+1 Query Problemi Çözümü
      // ============================================
      // Tüm HUV teminatlarını batch başında bir kez çek
      // Her SUT işlemi için ayrı sorgu yerine cache kullan
      const allHuvTeminatlar = await this._getHuvAltTeminatlar(); // Tüm HUV teminatları
      
      // Ana Dal bazında grupla (performans için)
      const huvByAnaDal = {};
      allHuvTeminatlar.forEach(huv => {
        if (!huvByAnaDal[huv.anaDalKodu]) {
          huvByAnaDal[huv.anaDalKodu] = [];
        }
        huvByAnaDal[huv.anaDalKodu].push(huv);
      });
      
      // Track counts
      let matchedCount = 0;
      let unmatchedCount = 0;
      let highConfidenceCount = 0;  // >= 85
      let mediumConfidenceCount = 0;  // 70-84
      let lowConfidenceCount = 0;  // < 70
      const errors = [];
      
      // Process each SUT işlem
      const processFn = async (sutIslem) => {
        try {
          // ÖNCELİK 1: Direct SUT Code Strategy - HUV işlemlerinde bu SUT kodu varsa direkt eşleştir
          const directMatch = await this.strategies.directSutCode.match(sutIslem, null);
          if (directMatch.matched) {
            // Save match to database
            await this.saveMatch(
              sutIslem.sutId,
              directMatch.altTeminatId,
              directMatch.confidence,
              directMatch.ruleType
            );
            
            matchedCount++;
            highConfidenceCount++; // Direct match always high confidence (100%)
            return;
          }
          
          // ÖNCELİK 2: Hierarchy Matching Strategy - SUT hiyerarşi başlıklarını kullan
          // Cache'den tüm HUV teminatlarını kullan (N+1 query problemi çözüldü)
          if (allHuvTeminatlar.length > 0) {
            const hierarchyMatch = await this.strategies.hierarchy.match(sutIslem, allHuvTeminatlar);
            if (hierarchyMatch.matched) {
              await this.saveMatch(
                sutIslem.sutId,
                hierarchyMatch.altTeminatId,
                hierarchyMatch.confidence,
                hierarchyMatch.ruleType
              );
              
              matchedCount++;
              
              if (hierarchyMatch.confidence >= 85) {
                highConfidenceCount++;
              } else if (hierarchyMatch.confidence >= 70) {
                mediumConfidenceCount++;
              } else {
                lowConfidenceCount++;
              }
              return;
            }
          }
          
          // ÖNCELİK 3: Normal matching stratejileri
          // ÖZEL DURUM: Ana Dal mapping - bazı işlemler yanlış Ana Dal'da
          // Önce manuel SUT kodu mapping'ini kontrol et
          let targetAnaDalKodu = this._getCorrectAnaDalKodu(sutIslem);
          let shouldTryOriginalAnaDal = (targetAnaDalKodu === sutIslem.anaDalKodu);
          
          // Eğer manuel mapping kullanılmadıysa, eski hardcoded kontrolleri yap
          // NOT: Bu kontroller artık _getCorrectAnaDalKodu() içinde yapılıyor
          // Gereksiz kod tekrarını önlemek için kaldırıldı
          
          // Fetch HUV teminatlar for the target Ana Dal (cache'den)
          const huvList = huvByAnaDal[targetAnaDalKodu] || [];
          
          if (huvList.length === 0) {
            unmatchedCount++;
            return;
          }
          
          // Select and execute appropriate matching strategy
          // Strategy seçimini TARGET Ana Dal'a göre yap
          const strategy = this._selectStrategy(targetAnaDalKodu);
          const matchResult = await strategy.match(sutIslem, huvList);
          
          // FALLBACK: Ana Dal 34 için FirstLetterStrategy başarısız olursa GeneralSimilarityStrategy dene
          // (JAK2, PCR gibi özel işlemler için)
          if (!matchResult.matched && targetAnaDalKodu === 34) {
            const generalMatchResult = await this.strategies.general.match(sutIslem, huvList);
            if (generalMatchResult.matched) {
              await this.saveMatch(
                sutIslem.sutId,
                generalMatchResult.altTeminatId,
                generalMatchResult.confidence,
                generalMatchResult.ruleType
              );
              
              matchedCount++;
              
              if (generalMatchResult.confidence >= 85) {
                highConfidenceCount++;
              } else if (generalMatchResult.confidence >= 70) {
                mediumConfidenceCount++;
              } else {
                lowConfidenceCount++;
              }
              return;
            }
          }
          
          if (matchResult.matched) {
            // Save match to database
            await this.saveMatch(
              sutIslem.sutId,
              matchResult.altTeminatId,
              matchResult.confidence,
              matchResult.ruleType
            );
            
            matchedCount++;
            
            // Track confidence levels
            if (matchResult.confidence >= 85) {
              highConfidenceCount++;
            } else if (matchResult.confidence >= 70) {
              mediumConfidenceCount++;
            } else {
              lowConfidenceCount++;
            }
            return;
          }
          
          // FALLBACK: Eşleşme bulunamadı, içeriğe göre alternatif Ana Dallara bak
          const islemAdiLower = sutIslem.islemAdi.toLowerCase();
          const alternativeAnaDallar = [];
          
          // KBB işlemleri (Ana Başlık 6'dan)
          if (sutIslem.anaDalKodu === 6) {
            const kbbKeywords = ['burun', 'nazal', 'rinoplasti', 'septal', 'konka', 'larink', 'larinjek', 
                                 'aritenoid', 'krikotiroid', 'mandibula', 'maksilla', 'tme', 'temporomandib',
                                 'yanak', 'dudak', 'dil', 'ağız', 'agiz', 'kulak', 'otoplasti', 'tonsil', 
                                 'adenoid', 'farinks', 'sinus', 'sinüs'];
            const isKBB = kbbKeywords.some(k => islemAdiLower.includes(k));
            if (isKBB) {
              alternativeAnaDallar.push(16); // KULAK-BURUN-BOĞAZ
            }
          }
          
          // Plastik cerrahi kelimeleri
          if (islemAdiLower.includes('flep') || islemAdiLower.includes('greft') || 
              islemAdiLower.includes('graft') || islemAdiLower.includes('rekonstr') ||
              islemAdiLower.includes('yanik') || islemAdiLower.includes('yanık') || 
              islemAdiLower.includes('skar')) {
            alternativeAnaDallar.push(21); // PLASTİK CERRAHİ
          }
          
          // Radyoterapi kelimeleri (eğer daha önce eklenmemişse)
          if ((islemAdiLower.includes('radyo') || islemAdiLower.includes('braki') ||
              islemAdiLower.includes('imrt') || islemAdiLower.includes('stereotaktik')) &&
              targetAnaDalKodu !== 27) {
            alternativeAnaDallar.push(27); // RADYASYON ONKOLOJİSİ
          }
          
          // Laboratuvar kelimeleri (eğer daha önce eklenmemişse)
          if ((islemAdiLower.includes('test') || islemAdiLower.includes('kultur') ||
              islemAdiLower.includes('kültür') || islemAdiLower.includes('panel') ||
              islemAdiLower.includes('antikor') || islemAdiLower.includes('elisa')) &&
              targetAnaDalKodu !== 34) {
            alternativeAnaDallar.push(34); // LABORATUVAR
          }
          
          // Alternatif Ana Dallarda ara
          for (const altAnaDal of alternativeAnaDallar) {
            // Fetch HUV teminatlar for the target Ana Dal (cache'den)
            const altHuvList = huvByAnaDal[altAnaDal] || [];
            
            if (altHuvList.length > 0) {
              const altStrategy = this._selectStrategy(altAnaDal);
              const altMatchResult = await altStrategy.match(sutIslem, altHuvList);
              
              if (altMatchResult.matched) {
                await this.saveMatch(
                  sutIslem.sutId,
                  altMatchResult.altTeminatId,
                  altMatchResult.confidence,
                  altMatchResult.ruleType
                );
                
                matchedCount++;
                
                if (altMatchResult.confidence >= 85) {
                  highConfidenceCount++;
                } else if (altMatchResult.confidence >= 70) {
                  mediumConfidenceCount++;
                } else {
                  lowConfidenceCount++;
                }
                return;
              }
            }
          }
          
          // Hiçbir yerde eşleşme bulunamadı
          unmatchedCount++;
          
        } catch (error) {
          errors.push({
            sutId: sutIslem.sutId,
            error: error.message
          });
          unmatchedCount++;
        }
      };
      
      // Use BatchProcessor to process in chunks of 50
      // (batchSize now controls total records, not chunk size)
      const chunkSize = Math.min(50, batchSize);
      await BatchProcessor.processBatch(
        sutIslemler,
        chunkSize,
        processFn,
        progressCallback
      );
      
      const durationMs = Date.now() - startTime;
      
      return {
        totalProcessed: sutIslemler.length,
        matchedCount,
        unmatchedCount,
        highConfidenceCount,
        mediumConfidenceCount,
        lowConfidenceCount,
        errors,
        durationMs
      };
      
    } catch (error) {
      console.error('Error in runBatch:', error);
      throw error;
    }
  }
}

module.exports = MatchingEngine;
