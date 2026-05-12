// ============================================
// MATCHING ENGINE SERVICE
// ============================================
// Core service for SUT-HUV automatic matching
// Coordinates matching operations and strategy selection
// ============================================

const sql = require('mssql');
const DirectSutCodeStrategy = require('./DirectSutCodeStrategy');
const HierarchyMatchingStrategy = require('./HierarchyMatchingStrategy');
const BatchProcessor = require('../../utils/BatchProcessor');

/**
 * Matching Engine Service
 * Coordinates SUT-HUV matching operations
 */
class MatchingEngine {
  constructor(dbPool) {
      this.dbPool = dbPool;

      this.strategies = {
        directSutCode: new DirectSutCodeStrategy(dbPool),
        hierarchy: new HierarchyMatchingStrategy(dbPool)
      };
    }

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
    const sutKoduMapping = {
      '617451': 11,
      'G101070': 34, 'G101080': 34, 'G101630': 34,
      '912510': 34, '912540': 34, '912570': 34, '912580': 34,
      '912590': 34, '912600': 34, '912610': 34,
      '704760': 12,
      '704210': 26, '704230': 26, '704231': 26, '704232': 26,
      '704233': 26, '704240': 26, '704250': 26, '704260': 26,
      '704280': 26, '704330': 26, '704340': 26,
      '704370': 12,
      '704400': 26, '704410': 26, '704420': 26,
      '704450': 26, '704460': 26, '704491': 26,
      '700170': 6, '700180': 6, '700190': 6, '700201': 6,
      '700240': 6, '700260': 6, '700270': 6, '700280': 6,
      '701280': 12, '701430': 12, '701440': 12, '701470': 12,
      '701500': 12, '701540': 12, '701545': 12,
      '703660': 11, '703670': 11, '703790': 11, '703820': 11,
      '703860': 11, '703890': 11, '703910': 11,
      '703970': 16, '704020': 16, '704060': 16, '704140': 16, '704160': 16,
      '800235': 24, '800320': 24,
      '614351': 8, '614353': 8, '603160': 8,
    };
    
    if (sutKoduMapping[sutIslem.sutKodu]) {
      return sutKoduMapping[sutIslem.sutKodu];
    }
    
    const altTeminatMapping = {
      'İRİS VE LENS İLE İLGİLİ İŞLEMLER': 11,
      'ŞAŞILIK VE PEDİYATRİK OFTALMOLOJİ': 11,
      'GÖZ VE ADNEKSLERİ': 11,
      'ÜRİNER SİSTEM-NEFROLOJİ-DİYALİZ': 26,
      'SİNDİRİM SİSTEMİ': 12,
      'DERMİS VE EPİDERMİS': 6,
      'HEMATOLOJİ-ONKOLOJİ-KEMOTERAPİ': 12,
      'SES VE İŞİTME İLE İLGİLİ ÇALIŞMALAR': 16,
      'MOLEKÜLER GENETİK TETKİKLER': 34,
      'BİYOKİMYA LABORATUVAR İŞLEMLERİ': 34,
      'ZOONOTIK HASTALIKLARA YÖNELİK ANALİZLER': 34,
      'Brakiterapi doz hesapları': 24,
      'Portal görüntüleme': 24,
      'Örnekleme Yöntemi': 8,
      'Salgı Bezlerine Yönelik Cerrahi': 8
    };
    
    if (sutIslem.sutAltTeminat && altTeminatMapping[sutIslem.sutAltTeminat]) {
      return altTeminatMapping[sutIslem.sutAltTeminat];
    }
    
    const islemAdiLower = sutIslem.islemAdi.toLowerCase();
    
    if (sutIslem.anaDalKodu === 9) {
      return 34;
    }
    
    if (sutIslem.anaDalKodu === 8) {
      const radyoKeywords = ['radyo', 'braki', 'imrt', 'stereotaktik', 'konformal', 'volumetrik', 'tedavi'];
      const isRadyoterapi = radyoKeywords.some(k => islemAdiLower.includes(k));
      
      const nukleerKeywords = ['sintigraf', 'perfüzyon', 'ventilasyon', 'miyokard', 'böbrek', 'tümör görüntüleme', 'pet', 'spect'];
      const isNukleer = nukleerKeywords.some(k => islemAdiLower.includes(k));
      
      const goruntuKeywords = ['mammografi', 'floroskopi', 'grafi', 'röntgen', 'survey', 'schuller', 'sella', 'sinüs', 'temporamandibular'];
      const isGoruntu = goruntuKeywords.some(k => islemAdiLower.includes(k));
      
      if (isRadyoterapi) return 27;
      if (isNukleer) return 19;
      if (isGoruntu) return 24;
    }
    
    if (sutIslem.anaDalKodu === 10) {
      const labKeywords = ['test', 'antikor', 'elisa', 'kültür', 'kultur', 'panel', 'identifikasyon'];
      if (labKeywords.some(k => islemAdiLower.includes(k))) {
        return 34;
      }
    }
    
    return sutIslem.anaDalKodu;
  }

  /**
   * Get alternative Ana Dal codes based on işlem adı keywords.
   * Used as fallback when primary Ana Dal matching fails.
   * @param {Object} sutIslem - SUT işlem object
   * @param {number} primaryAnaDalKodu - Already-tried primary Ana Dal
   * @returns {Array<number>} Alternative Ana Dal codes to try
   */
  _getAlternativeAnaDallar(sutIslem, primaryAnaDalKodu) {
    const islemAdiLower = sutIslem.islemAdi.toLowerCase();
    const alternatives = [];

    if (sutIslem.anaDalKodu === 6) {
      const kbbKeywords = ['burun', 'nazal', 'rinoplasti', 'septal', 'konka', 'larink', 'larinjek',
                           'aritenoid', 'krikotiroid', 'mandibula', 'maksilla', 'tme', 'temporomandib',
                           'yanak', 'dudak', 'dil', 'ağız', 'agiz', 'kulak', 'otoplasti', 'tonsil',
                           'adenoid', 'farinks', 'sinus', 'sinüs'];
      if (kbbKeywords.some(k => islemAdiLower.includes(k))) {
        alternatives.push(16);
      }
    }

    if (['flep', 'greft', 'graft', 'rekonstr', 'yanik', 'yanık', 'skar']
        .some(k => islemAdiLower.includes(k))) {
      alternatives.push(21);
    }

    if (['radyo', 'braki', 'imrt', 'stereotaktik'].some(k => islemAdiLower.includes(k))) {
      alternatives.push(27);
    }

    if (['test', 'kultur', 'kültür', 'panel', 'antikor', 'elisa']
        .some(k => islemAdiLower.includes(k))) {
      alternatives.push(34);
    }

    return alternatives.filter(ad => ad !== primaryAnaDalKodu);
  }

  /**
   * Core matching logic for a single SUT işlem.
   * Used by both matchSingle() and runBatch() to ensure consistent behavior.
   * @param {Object} sutIslem - SUT işlem object
   * @param {Array|null} allHuvTeminatlar - Pre-loaded all HUV alt teminatlar (null = load from DB)
   * @param {Object|null} hierarchyCache - Pre-loaded hierarchy titles cache (null = load from DB)
   * @returns {Promise<Object>} Match result
   */
  async _matchSutIslem(sutIslem, allHuvTeminatlar = null, hierarchyCache = null) {
    // ÖNCELİK 1: Direct SUT Code — DB'den direkt eşleşme, %100 güven
    const directMatch = await this.strategies.directSutCode.match(sutIslem, null);
    if (directMatch.matched) {
      return directMatch;
    }

    // ÖNCELİK 2: SUT hiyerarşi başlıklarını tüm HUV alt teminatlarıyla karşılaştır
    const huvList = allHuvTeminatlar || await this._getHuvAltTeminatlar();

    if (huvList.length > 0) {
      const hierarchyMatch = await this.strategies.hierarchy.match(sutIslem, huvList, hierarchyCache);
      if (hierarchyMatch.matched) {
        return hierarchyMatch;
      }
    }

    return { matched: false, ruleType: 'no_match' };
  }

  /**
   * Track confidence level bucket for statistics
   */
  _getConfidenceBucket(confidence) {
    if (confidence >= 85) return 'high';
    if (confidence >= 70) return 'medium';
    return 'low';
  }

  async _deleteExistingMatch(sutId) {
    try {
      await this.dbPool.request()
        .input('sutId', sql.Int, sutId)
        .query(`
          DELETE FROM AltTeminatIslemler
          WHERE SutID = @sutId
            AND (IsOverridden = 0 OR IsOverridden IS NULL)
            AND (IsApproved = 0 OR IsApproved IS NULL)
        `);
    } catch (error) {
      console.error(`Failed to delete stale match for SutID=${sutId}:`, error.message);
    }
  }

  /**
   * Match a single SUT işlem with HUV teminatlar
   * @param {number} sutId - SUT işlem ID
   * @returns {Promise<Object>} Match result
   */
  async matchSingle(sutId) {
    try {
      const sutResult = await this.dbPool.request()
        .input('sutId', sql.Int, sutId)
        .query(`
          SELECT 
            s.SutID as sutId,
            s.SutKodu as sutKodu,
            s.IslemAdi as islemAdi,
            s.AnaBaslikNo as anaDalKodu,
            s.HiyerarsiID as hiyerarsiId,
            sh.Baslik as sutAltTeminat
          FROM SutIslemler s
          LEFT JOIN SutHiyerarsi sh ON s.HiyerarsiID = sh.HiyerarsiID
          WHERE s.SutID = @sutId AND s.AktifMi = 1
        `);
      
      if (sutResult.recordset.length === 0) {
        throw new Error(`SUT işlem not found: ${sutId}`);
      }
      
      const sutIslem = sutResult.recordset[0];
      const matchResult = await this._matchSutIslem(sutIslem);
      
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
   * Save match result to database (upsert logic).
   * Returns { saved: true/false, record } — saved=false means the record was
   * protected (approved/overridden) and not updated.
   */
  async saveMatch(sutId, altTeminatId, confidence, ruleType, userId = null) {
    const transaction = new sql.Transaction(this.dbPool);
    
    try {
      await transaction.begin();
      
      const existingResult = await transaction.request()
        .input('sutId', sql.Int, sutId)
        .query(`
          SELECT ID, SutID, AltTeminatID, IsOverridden, IsApproved
          FROM AltTeminatIslemler WITH (UPDLOCK, HOLDLOCK)
          WHERE SutID = @sutId
        `);
      
      if (existingResult.recordset.length > 0) {
        const existing = existingResult.recordset[0];
        
        if (existing.IsOverridden === 1 || existing.IsOverridden === true || 
            existing.IsApproved === 1 || existing.IsApproved === true) {
          await transaction.commit();
          return { saved: false, record: existing };
        }
        
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
        return { saved: true, record: updateResult.recordset[0] };
      } else {
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
        return { saved: true, record: insertResult.recordset[0] };
      }
      
    } catch (error) {
      console.error('Error in saveMatch:', error);
      if (transaction) {
        await transaction.rollback();
      }
      throw error;
    }
  }
  
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
  
  async changeMatch(sutId, newAltTeminatId, userId) {
    try {
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
   * Pre-load all hierarchy titles for batch operations.
   * Returns a Map: hiyerarsiId → [title1, title2, ...]
   */
  async _preloadHierarchyTitles() {
    try {
      const result = await this.dbPool.request().query(`
        SELECT HiyerarsiID, ParentID, SeviyeNo, Baslik
        FROM SutHiyerarsi
      `);

      const allRows = result.recordset;
      const byId = new Map();
      allRows.forEach(row => byId.set(row.HiyerarsiID, row));

      const cache = new Map();

      for (const row of allRows) {
        const titles = [];
        let current = row;
        let depth = 0;
        while (current && depth < 4) {
          if (current.SeviyeNo >= 2 && current.Baslik) {
            titles.push(current.Baslik);
          }
          current = current.ParentID ? byId.get(current.ParentID) : null;
          depth++;
        }
        if (titles.length > 0) {
          titles.sort();
          cache.set(row.HiyerarsiID, titles);
        }
      }

      return cache;
    } catch (error) {
      console.error('Error in _preloadHierarchyTitles:', error);
      return new Map();
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
      } else {
        // forceRematch: skip protected records at query level
        query += `
          AND NOT EXISTS (
            SELECT 1 FROM AltTeminatIslemler a
            WHERE a.SutID = s.SutID AND (a.IsOverridden = 1 OR a.IsApproved = 1)
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
      
      // Pre-load all data once before processing
      const allHuvTeminatlar = await this._getHuvAltTeminatlar();
      const hierarchyCache = await this._preloadHierarchyTitles();
      
      let matchedCount = 0;
      let unmatchedCount = 0;
      let skippedCount = 0;
      let highConfidenceCount = 0;
      let mediumConfidenceCount = 0;
      let lowConfidenceCount = 0;
      const errors = [];
      
      const processFn = async (sutIslem) => {
        try {
          const matchResult = await this._matchSutIslem(sutIslem, allHuvTeminatlar, hierarchyCache);
          
          if (!matchResult.matched) {
            if (forceRematch) {
              await this._deleteExistingMatch(sutIslem.sutId);
            }
            unmatchedCount++;
            return;
          }

          const saveResult = await this.saveMatch(
            sutIslem.sutId,
            matchResult.altTeminatId,
            matchResult.confidence,
            matchResult.ruleType
          );

          if (!saveResult.saved) {
            skippedCount++;
            return;
          }

          matchedCount++;
          const bucket = this._getConfidenceBucket(matchResult.confidence);
          if (bucket === 'high') highConfidenceCount++;
          else if (bucket === 'medium') mediumConfidenceCount++;
          else lowConfidenceCount++;
          
        } catch (error) {
          errors.push({ sutId: sutIslem.sutId, error: error.message });
          unmatchedCount++;
        }
      };
      
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
        skippedCount,
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
