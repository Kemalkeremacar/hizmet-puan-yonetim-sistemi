// ============================================
// AI MATCHING SERVICE
// ============================================
// AI-powered SUT-HUV matching using Ollama
// ============================================

const OllamaService = require('./OllamaService');
const PromptBuilder = require('./PromptBuilder');
const { getPool, sql } = require('../../config/database');

/**
 * AI Matching Service
 * Uses local LLM (Ollama) for intelligent SUT-HUV matching
 */
class AIMatchingService {
  constructor() {
    this.ollamaService = new OllamaService();
    this.dbPool = null;
  }
  
  /**
   * Initialize database pool
   */
  async initialize() {
    if (!this.dbPool) {
      this.dbPool = await getPool();
    }
  }
  
  /**
   * Check if AI service is ready
   * @returns {Promise<Object>} Status object
   */
  async checkStatus() {
    const isAvailable = await this.ollamaService.isAvailable();
    
    if (!isAvailable) {
      return {
        available: false,
        message: 'Ollama servisi çalışmıyor',
        models: []
      };
    }
    
    const models = await this.ollamaService.listModels();
    
    return {
      available: true,
      message: 'AI servisi hazır',
      models: models.map(m => m.name),
      activeModel: this.ollamaService.model
    };
  }
  
  /**
   * Match a single SUT işlem with HUV teminatlar using AI
   * @param {number} sutId - SUT işlem ID
   * @param {Object} options - Matching options
   * @returns {Promise<Object>} Match result
   */
  async matchSingle(sutId, options = {}) {
    await this.initialize();
    
    try {
      // Fetch SUT işlem
      const sutResult = await this.dbPool.request()
        .input('sutId', sql.Int, sutId)
        .query(`
          SELECT 
            s.SutID as sutId,
            s.SutKodu as sutKodu,
            s.IslemAdi as islemAdi,
            s.Aciklama as aciklama,
            s.AnaBaslikNo as anaDalKodu,
            s.HiyerarsiID as hiyerarsiId,
            ab.AnaBaslikAdi as anaDalAdi,
            sh.Baslik as hiyerarsiBaslik
          FROM SutIslemler s
          LEFT JOIN SutAnaBasliklar ab ON s.AnaBaslikNo = ab.AnaBaslikNo
          LEFT JOIN SutHiyerarsi sh ON s.HiyerarsiID = sh.HiyerarsiID
          WHERE s.SutID = @sutId AND s.AktifMi = 1
        `);
      
      if (sutResult.recordset.length === 0) {
        throw new Error(`SUT işlem bulunamadı: ${sutId}`);
      }
      
      const sutIslem = sutResult.recordset[0];
      
      // Fetch HUV teminatlar
      // Eğer anaDalKodu belirtilmişse sadece o Ana Dal'ı getir
      let huvQuery = `
        SELECT 
          h.AltTeminatID as altTeminatId,
          h.AltTeminatAdi as altTeminatAdi,
          h.AnaDalKodu as anaDalKodu,
          h.Sira as sira,
          a.BolumAdi as anaDalAdi
        FROM HuvAltTeminatlar h
        LEFT JOIN AnaDallar a ON h.AnaDalKodu = a.AnaDalKodu
        WHERE h.AktifMi = 1
      `;
      
      // Eğer limitHuvByAnaDal true ise, sadece aynı Ana Dal'daki HUV'ları getir
      if (options.limitHuvByAnaDal && sutIslem.anaDalKodu) {
        huvQuery += ` AND h.AnaDalKodu = ${sutIslem.anaDalKodu}`;
      }
      
      huvQuery += ` ORDER BY h.AnaDalKodu, h.Sira, h.AltTeminatAdi`;
      
      const huvResult = await this.dbPool.request().query(huvQuery);
      const huvTeminatlar = huvResult.recordset;
      
      if (huvTeminatlar.length === 0) {
        return {
          success: false,
          error: 'HUV teminatları bulunamadı'
        };
      }
      
      // Build prompt
      const prompt = PromptBuilder.buildMatchingPrompt(sutIslem, huvTeminatlar);
      
      // Get AI response
      const aiResponse = await this.ollamaService.generateJSON(prompt, {
        temperature: options.temperature || 0.3,
        max_tokens: options.max_tokens || 1000
      });
      
      // Validate response
      if (!aiResponse.matchedId && aiResponse.matchedId !== null) {
        throw new Error('AI geçersiz yanıt döndürdü');
      }
      
      // Find matched HUV teminat details
      let matchedTeminat = null;
      if (aiResponse.matchedId) {
        matchedTeminat = huvTeminatlar.find(h => h.altTeminatId === aiResponse.matchedId);
      }
      
      return {
        success: true,
        sutIslem: {
          sutId: sutIslem.sutId,
          sutKodu: sutIslem.sutKodu,
          islemAdi: sutIslem.islemAdi,
          anaBaslik: sutIslem.anaDalAdi
        },
        match: {
          altTeminatId: aiResponse.matchedId,
          altTeminatAdi: matchedTeminat ? matchedTeminat.altTeminatAdi : null,
          confidence: aiResponse.confidence,
          reasoning: aiResponse.reasoning,
          alternatives: aiResponse.alternativeIds || []
        },
        metadata: {
          model: this.ollamaService.model,
          timestamp: new Date().toISOString()
        }
      };
      
    } catch (error) {
      console.error('AI matching error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  /**
   * Match multiple SUT işlemler in batch
   * @param {Array<number>} sutIds - Array of SUT IDs
   * @param {Object} options - Matching options
   * @returns {Promise<Object>} Batch match results
   */
  async matchBatch(sutIds, options = {}) {
    await this.initialize();
    
    const results = [];
    const errors = [];
    
    // Process each SUT işlem individually
    // (Batch prompting can be unreliable with large lists)
    for (const sutId of sutIds) {
      try {
        const result = await this.matchSingle(sutId, options);
        results.push(result);
      } catch (error) {
        errors.push({
          sutId,
          error: error.message
        });
      }
    }
    
    return {
      success: true,
      totalProcessed: sutIds.length,
      successCount: results.filter(r => r.success).length,
      failureCount: errors.length,
      results,
      errors
    };
  }
  
  /**
   * Save AI match to database (AYRI TABLO - TEST AMAÇLI)
   * @param {number} sutId - SUT işlem ID
   * @param {number} altTeminatId - HUV alt teminat ID
   * @param {number} confidence - Confidence score
   * @param {string} reasoning - AI reasoning
   * @param {Object} metadata - Additional metadata
   * @param {number} userId - User ID (optional)
   * @returns {Promise<Object>} Saved record
   */
  async saveMatch(sutId, altTeminatId, confidence, reasoning, metadata = {}, userId = null) {
    await this.initialize();
    
    try {
      // SUT bilgilerini al
      const sutResult = await this.dbPool.request()
        .input('sutId', sql.Int, sutId)
        .query(`
          SELECT SutKodu, IslemAdi
          FROM SutIslemler
          WHERE SutID = @sutId
        `);
      
      if (sutResult.recordset.length === 0) {
        throw new Error('SUT işlem bulunamadı');
      }
      
      const sut = sutResult.recordset[0];
      
      // HUV bilgilerini al
      const huvResult = await this.dbPool.request()
        .input('altTeminatId', sql.Int, altTeminatId)
        .query(`
          SELECT AltTeminatAdi
          FROM HuvAltTeminatlar
          WHERE AltTeminatID = @altTeminatId
        `);
      
      if (huvResult.recordset.length === 0) {
        throw new Error('HUV teminat bulunamadı');
      }
      
      const huv = huvResult.recordset[0];
      
      // Check if AI match already exists
      const existingResult = await this.dbPool.request()
        .input('sutId', sql.Int, sutId)
        .query(`
          SELECT ID FROM AIMatchingResults WHERE SutID = @sutId
        `);
      
      if (existingResult.recordset.length > 0) {
        // Update existing AI match
        const updateResult = await this.dbPool.request()
          .input('sutId', sql.Int, sutId)
          .input('altTeminatId', sql.Int, altTeminatId)
          .input('altTeminatAdi', sql.NVarChar(500), huv.AltTeminatAdi)
          .input('confidence', sql.Decimal(5, 2), confidence)
          .input('reasoning', sql.NVarChar(sql.MAX), reasoning)
          .input('modelName', sql.NVarChar(100), metadata.model || this.ollamaService.model)
          .input('temperature', sql.Decimal(3, 2), metadata.temperature || 0.3)
          .input('alternatives', sql.NVarChar(500), JSON.stringify(metadata.alternatives || []))
          .input('userId', sql.Int, userId)
          .query(`
            UPDATE AIMatchingResults
            SET 
              AltTeminatID = @altTeminatId,
              AltTeminatAdi = @altTeminatAdi,
              ConfidenceScore = @confidence,
              AIReasoning = @reasoning,
              ModelName = @modelName,
              Temperature = @temperature,
              AlternativeIds = @alternatives,
              CreatedAt = GETDATE(),
              CreatedBy = @userId
            WHERE SutID = @sutId;
            
            SELECT * FROM AIMatchingResults WHERE SutID = @sutId;
          `);
        
        return updateResult.recordset[0];
      } else {
        // Insert new AI match
        const insertResult = await this.dbPool.request()
          .input('sutId', sql.Int, sutId)
          .input('sutKodu', sql.NVarChar(50), sut.SutKodu)
          .input('islemAdi', sql.NVarChar(500), sut.IslemAdi)
          .input('altTeminatId', sql.Int, altTeminatId)
          .input('altTeminatAdi', sql.NVarChar(500), huv.AltTeminatAdi)
          .input('confidence', sql.Decimal(5, 2), confidence)
          .input('reasoning', sql.NVarChar(sql.MAX), reasoning)
          .input('modelName', sql.NVarChar(100), metadata.model || this.ollamaService.model)
          .input('temperature', sql.Decimal(3, 2), metadata.temperature || 0.3)
          .input('alternatives', sql.NVarChar(500), JSON.stringify(metadata.alternatives || []))
          .input('userId', sql.Int, userId)
          .query(`
            INSERT INTO AIMatchingResults (
              SutID, SutKodu, IslemAdi,
              AltTeminatID, AltTeminatAdi,
              ConfidenceScore, AIReasoning,
              ModelName, Temperature, AlternativeIds,
              IsApproved, CreatedAt, CreatedBy
            )
            VALUES (
              @sutId, @sutKodu, @islemAdi,
              @altTeminatId, @altTeminatAdi,
              @confidence, @reasoning,
              @modelName, @temperature, @alternatives,
              0, GETDATE(), @userId
            );
            
            SELECT * FROM AIMatchingResults WHERE SutID = @sutId;
          `);
        
        return insertResult.recordset[0];
      }
      
    } catch (error) {
      console.error('Error saving AI match:', error);
      throw error;
    }
  }
  
  /**
   * Get all AI matching results
   * @param {Object} filters - Filter options
   * @param {number} page - Page number
   * @param {number} limit - Page size
   * @returns {Promise<Object>} Results with pagination
   */
  async getAIResults(filters = {}, page = 1, limit = 50) {
    await this.initialize();
    
    try {
      const offset = (page - 1) * limit;
      
      // Build WHERE clause
      let whereClause = 'WHERE 1=1';
      const params = {};
      
      if (filters.isApproved !== undefined) {
        whereClause += ' AND IsApproved = @isApproved';
        params.isApproved = filters.isApproved;
      }
      
      if (filters.isMigrated !== undefined) {
        whereClause += ' AND IsMigratedToMain = @isMigrated';
        params.isMigrated = filters.isMigrated;
      }
      
      // Count total
      const countRequest = this.dbPool.request();
      Object.keys(params).forEach(key => {
        countRequest.input(key, params[key]);
      });
      
      const countResult = await countRequest.query(`
        SELECT COUNT(*) as total
        FROM AIMatchingResults
        ${whereClause}
      `);
      
      const total = countResult.recordset[0].total;
      
      // Get paginated results
      const dataRequest = this.dbPool.request();
      Object.keys(params).forEach(key => {
        dataRequest.input(key, params[key]);
      });
      dataRequest.input('offset', sql.Int, offset);
      dataRequest.input('limit', sql.Int, limit);
      
      const dataResult = await dataRequest.query(`
        SELECT *
        FROM vw_AIMatchingDetails
        ${whereClause}
        ORDER BY CreatedAt DESC
        OFFSET @offset ROWS
        FETCH NEXT @limit ROWS ONLY
      `);
      
      return {
        data: dataResult.recordset,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      };
      
    } catch (error) {
      console.error('Error getting AI results:', error);
      throw error;
    }
  }
  
  /**
   * Approve AI match
   * @param {number} aiMatchingId - AI matching result ID
   * @param {number} userId - User ID
   * @returns {Promise<Object>} Updated record
   */
  async approveAIMatch(aiMatchingId, userId) {
    await this.initialize();
    
    try {
      const result = await this.dbPool.request()
        .input('id', sql.Int, aiMatchingId)
        .input('userId', sql.Int, userId)
        .query(`
          UPDATE AIMatchingResults
          SET 
            IsApproved = 1,
            ApprovedAt = GETDATE(),
            ApprovedBy = @userId
          WHERE ID = @id;
          
          SELECT * FROM AIMatchingResults WHERE ID = @id;
        `);
      
      return result.recordset[0];
    } catch (error) {
      console.error('Error approving AI match:', error);
      throw error;
    }
  }
  
  /**
   * Migrate AI match to main table
   * @param {number} aiMatchingId - AI matching result ID
   * @param {number} userId - User ID
   * @returns {Promise<Object>} Result
   */
  async migrateToMain(aiMatchingId, userId) {
    await this.initialize();
    
    try {
      await this.dbPool.request()
        .input('aiMatchingId', sql.Int, aiMatchingId)
        .input('userId', sql.Int, userId)
        .execute('sp_MigrateAIMatchToMain');
      
      return { success: true, message: 'Ana tabloya taşındı' };
    } catch (error) {
      console.error('Error migrating AI match:', error);
      throw error;
    }
  }
  
  /**
   * Validate an existing match using AI
   * @param {number} sutId - SUT işlem ID
   * @returns {Promise<Object>} Validation result
   */
  async validateMatch(sutId) {
    await this.initialize();
    
    try {
      // Fetch existing match
      const matchResult = await this.dbPool.request()
        .input('sutId', sql.Int, sutId)
        .query(`
          SELECT 
            s.SutID as sutId,
            s.SutKodu as sutKodu,
            s.IslemAdi as islemAdi,
            h.AltTeminatID as altTeminatId,
            h.AltTeminatAdi as altTeminatAdi,
            a.ConfidenceScore as currentConfidence,
            a.MatchingRuleType as matchingRuleType
          FROM AltTeminatIslemler a
          INNER JOIN SutIslemler s ON a.SutID = s.SutID
          INNER JOIN HuvAltTeminatlar h ON a.AltTeminatID = h.AltTeminatID
          WHERE s.SutID = @sutId
        `);
      
      if (matchResult.recordset.length === 0) {
        throw new Error('Eşleştirme bulunamadı');
      }
      
      const match = matchResult.recordset[0];
      
      // Build validation prompt
      const prompt = PromptBuilder.buildValidationPrompt(
        { sutKodu: match.sutKodu, islemAdi: match.islemAdi },
        { altTeminatAdi: match.altTeminatAdi }
      );
      
      // Get AI validation
      const aiResponse = await this.ollamaService.generateJSON(prompt);
      
      return {
        success: true,
        validation: {
          isValid: aiResponse.isValid,
          confidence: aiResponse.confidence,
          reasoning: aiResponse.reasoning,
          suggestions: aiResponse.suggestions
        },
        currentMatch: {
          sutId: match.sutId,
          sutKodu: match.sutKodu,
          islemAdi: match.islemAdi,
          altTeminatAdi: match.altTeminatAdi,
          currentConfidence: match.currentConfidence,
          matchingRuleType: match.matchingRuleType
        }
      };
      
    } catch (error) {
      console.error('Validation error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = AIMatchingService;
