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
const SurgicalSimilarityStrategy = require('./SurgicalSimilarityStrategy');
const RadiologyKeywordStrategy = require('./RadiologyKeywordStrategy');
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
      surgical: new SurgicalSimilarityStrategy(),
      radiology: new RadiologyKeywordStrategy(),
      general: new GeneralSimilarityStrategy()
    };
  }
  
  /**
   * Select appropriate matching strategy based on Ana Dal code
   * @param {number} anaDalKodu - Ana Dal code
   * @returns {MatchingStrategy} Selected strategy
   */
  _selectStrategy(anaDalKodu) {
    // Ana Dal 9 (GÖĞÜS CERRAHİSİ) → FirstLetterStrategy (Laboratory Tests ONLY)
    // Improved: Now filters out surgical procedures
    if (anaDalKodu === 9) {
      return this.strategies.firstLetter;
    }
    
    // Ana Dal 34 (LABORATUVAR İNCELEMELERİ) → FirstLetterStrategy
    if (anaDalKodu === 34) {
      return this.strategies.firstLetter;
    }
    
    // DISABLED: RadiologyKeywordStrategy - too aggressive with fallback
    // Ana Dal 2 için de GeneralSimilarityStrategy kullan
    
    // Ana Dal 20 (ORTOPEDİ VE TRAVMATOLOJİ) → GeneralSimilarityStrategy
    // Fraktür, çıkık, alçı kuralları var
    if (anaDalKodu === 20) {
      return this.strategies.general;
    }
    
    // Ana Dal 21 (PLASTİK, REKONSTRÜKTİF VE ESTETİK CERRAHİ) → GeneralSimilarityStrategy
    // Deri grefti, flep kuralları var
    if (anaDalKodu === 21) {
      return this.strategies.general;
    }
    
    // Ana Dal 14 (KALP VE DAMAR CERRAHİSİ) → GeneralSimilarityStrategy
    // Cerrahi, ameliyat kuralları var
    if (anaDalKodu === 14) {
      return this.strategies.general;
    }
    
    // Cerrahi Uygulamalar → SurgicalSimilarityStrategy
    // Note: Need to determine Ana Dal code for surgical procedures
    // For now, using a placeholder check
    if (anaDalKodu === 1) { // Placeholder - adjust based on actual Ana Dal codes
      return this.strategies.surgical;
    }
    
    // All others → GeneralSimilarityStrategy (including radiology)
    return this.strategies.general;
  }
  
  /**
   * Match a single SUT işlem with HUV teminatlar
   * @param {number} sutId - SUT işlem ID
   * @returns {Promise<Object>} Match result
   */
  async matchSingle(sutId) {
    try {
      // Fetch SUT işlem from database
      const sutResult = await this.dbPool.request()
        .input('sutId', sql.Int, sutId)
        .query(`
          SELECT 
            s.SutID as sutId,
            s.SutKodu as sutKodu,
            s.IslemAdi as islemAdi,
            s.AnaBaslikNo as anaDalKodu
          FROM SutIslemler s
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
      
      // ÖNCELİK 2: Normal matching stratejileri
      // Fetch HUV teminatlar for the same Ana Dal
      const huvResult = await this.dbPool.request()
        .input('anaDalKodu', sql.Int, sutIslem.anaDalKodu)
        .query(`
          SELECT 
            AltTeminatID as altTeminatId,
            AltTeminatAdi as altTeminatAdi,
            AnaDalKodu as anaDalKodu
          FROM HuvAltTeminatlar
          WHERE AnaDalKodu = @anaDalKodu AND AktifMi = 1
        `);
      
      const huvList = huvResult.recordset;
      
      if (huvList.length === 0) {
        return {
          matched: false,
          sutId: sutIslem.sutId,
          error: 'No HUV teminatlar found for Ana Dal'
        };
      }
      
      // Select and execute appropriate matching strategy
      const strategy = this._selectStrategy(sutIslem.anaDalKodu);
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
    try {
      // Check if match already exists for SutID
      const existingResult = await this.dbPool.request()
        .input('sutId', sql.Int, sutId)
        .query(`
          SELECT ID, SutID, AltTeminatID, IsOverridden
          FROM AltTeminatIslemler
          WHERE SutID = @sutId
        `);
      
      if (existingResult.recordset.length > 0) {
        const existing = existingResult.recordset[0];
        
        // KORUMA: Manuel değiştirilmiş kayıtları (IsOverridden = 1) güncelleme!
        if (existing.IsOverridden === 1 || existing.IsOverridden === true) {
          console.log(`⚠️  Skipping SutID ${sutId} - manually overridden`);
          return existing; // Mevcut kaydı döndür, değiştirme
        }
        
        // Update existing record (only if not manually overridden)
        const updateResult = await this.dbPool.request()
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
        
        return updateResult.recordset[0];
      } else {
        // Insert new record
        const insertResult = await this.dbPool.request()
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
        
        return insertResult.recordset[0];
      }
      
    } catch (error) {
      console.error('Error in saveMatch:', error);
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
          s.HiyerarsiID as hiyerarsiId
        FROM SutIslemler s
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
          // Önce tüm Ana Dallar için HUV teminatları çek (hiyerarşi Ana Dal'a bağlı değil)
          const allHuvResult = await this.dbPool.request()
            .query(`
              SELECT 
                AltTeminatID as altTeminatId,
                AltTeminatAdi as altTeminatAdi,
                AnaDalKodu as anaDalKodu
              FROM HuvAltTeminatlar
              WHERE AktifMi = 1
            `);
          
          const allHuvList = allHuvResult.recordset;
          
          if (allHuvList.length > 0) {
            const hierarchyMatch = await this.strategies.hierarchy.match(sutIslem, allHuvList);
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
          let targetAnaDalKodu = sutIslem.anaDalKodu;
          let shouldTryOriginalAnaDal = true;
          
          // Ana Başlık 9 (GÖĞÜS CERRAHİSİ) → Laboratuvar testleri Ana Dal 34'te
          // Direkt Ana Dal 34'e bak, Ana Dal 9'a bakma
          if (sutIslem.anaDalKodu === 9) {
            targetAnaDalKodu = 34; // LABORATUVAR İNCELEMELERİ
            shouldTryOriginalAnaDal = false;
          }
          
          // Ana Dal 8 (GENEL CERRAHİ) → Radyoterapi işlemleri Ana Dal 27'de
          if (sutIslem.anaDalKodu === 8) {
            const islemAdiLower = sutIslem.islemAdi.toLowerCase();
            
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
              targetAnaDalKodu = 27; // RADYASYON ONKOLOJİSİ
              shouldTryOriginalAnaDal = false;
            } else if (isNukleer) {
              targetAnaDalKodu = 19; // NÜKLEER TIP
              shouldTryOriginalAnaDal = false;
            } else if (isGoruntu) {
              targetAnaDalKodu = 24; // RADYOLOJİ
              shouldTryOriginalAnaDal = false;
            }
          }
          
          // Ana Dal 10 (GÖĞÜS HASTALIKLARI) → Laboratuvar testleri Ana Dal 34'te
          if (sutIslem.anaDalKodu === 10) {
            const islemAdiLower = sutIslem.islemAdi.toLowerCase();
            const labKeywords = ['test', 'antikor', 'elisa', 'kültür', 'kultur', 'panel', 'identifikasyon'];
            const isLabTest = labKeywords.some(k => islemAdiLower.includes(k));
            
            if (isLabTest) {
              targetAnaDalKodu = 34; // LABORATUVAR İNCELEMELERİ
              shouldTryOriginalAnaDal = false;
            }
          }
          
          // Fetch HUV teminatlar for the target Ana Dal
          const huvResult = await this.dbPool.request()
            .input('anaDalKodu', sql.Int, targetAnaDalKodu)
            .query(`
              SELECT 
                AltTeminatID as altTeminatId,
                AltTeminatAdi as altTeminatAdi,
                AnaDalKodu as anaDalKodu
              FROM HuvAltTeminatlar
              WHERE AnaDalKodu = @anaDalKodu AND AktifMi = 1
            `);
          
          const huvList = huvResult.recordset;
          
          if (huvList.length === 0) {
            unmatchedCount++;
            return;
          }
          
          // Select and execute appropriate matching strategy
          // Strategy seçimini TARGET Ana Dal'a göre yap
          const strategy = this._selectStrategy(targetAnaDalKodu);
          const matchResult = strategy.match(sutIslem, huvList);
          
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
            const altHuvResult = await this.dbPool.request()
              .input('anaDalKodu', sql.Int, altAnaDal)
              .query(`
                SELECT 
                  AltTeminatID as altTeminatId,
                  AltTeminatAdi as altTeminatAdi,
                  AnaDalKodu as anaDalKodu
                FROM HuvAltTeminatlar
                WHERE AnaDalKodu = @anaDalKodu AND AktifMi = 1
              `);
            
            const altHuvList = altHuvResult.recordset;
            
            if (altHuvList.length > 0) {
              const altStrategy = this._selectStrategy(altAnaDal);
              const altMatchResult = altStrategy.match(sutIslem, altHuvList);
              
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
