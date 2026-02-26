// ============================================
// OLLAMA SERVICE
// ============================================
// Ollama API client for local LLM inference
// Supports Llama 3.1, Mistral, and other models
// ============================================

const axios = require('axios');

/**
 * Ollama Service
 * Handles communication with local Ollama instance
 */
class OllamaService {
  constructor() {
    // Ollama default endpoint (local)
    this.baseURL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
    this.model = process.env.OLLAMA_MODEL || 'llama3.1:8b';
    this.timeout = parseInt(process.env.OLLAMA_TIMEOUT || '120000'); // 2 minutes
  }
  
  /**
   * Check if Ollama is running and accessible
   * @returns {Promise<boolean>} True if Ollama is available
   */
  async isAvailable() {
    try {
      const response = await axios.get(`${this.baseURL}/api/tags`, {
        timeout: 5000
      });
      return response.status === 200;
    } catch (error) {
      console.error('Ollama is not available:', error.message);
      return false;
    }
  }
  
  /**
   * List available models in Ollama
   * @returns {Promise<Array>} List of model names
   */
  async listModels() {
    try {
      const response = await axios.get(`${this.baseURL}/api/tags`, {
        timeout: 5000
      });
      return response.data.models || [];
    } catch (error) {
      console.error('Error listing Ollama models:', error.message);
      throw new Error('Ollama servisi erişilebilir değil');
    }
  }
  
  /**
   * Generate completion using Ollama
   * @param {string} prompt - The prompt to send to the model
   * @param {Object} options - Additional options
   * @returns {Promise<string>} Generated text
   */
  async generate(prompt, options = {}) {
    try {
      const response = await axios.post(
        `${this.baseURL}/api/generate`,
        {
          model: options.model || this.model,
          prompt: prompt,
          stream: false,
          options: {
            temperature: options.temperature || 0.3, // Düşük temperature = daha tutarlı
            top_p: options.top_p || 0.9,
            top_k: options.top_k || 40,
            num_predict: options.max_tokens || 1000
          }
        },
        {
          timeout: this.timeout,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
      
      return response.data.response;
    } catch (error) {
      console.error('Ollama generation error:', error.message);
      if (error.code === 'ECONNREFUSED') {
        throw new Error('Ollama servisi çalışmıyor. Lütfen Ollama\'yı başlatın.');
      }
      throw new Error(`AI model hatası: ${error.message}`);
    }
  }
  
  /**
   * Generate structured JSON response
   * @param {string} prompt - The prompt to send
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Parsed JSON response
   */
  async generateJSON(prompt, options = {}) {
    try {
      // Add JSON formatting instruction to prompt
      const jsonPrompt = `${prompt}\n\nÖNEMLİ: Yanıtını SADECE geçerli JSON formatında ver. Başka açıklama ekleme. KISA ve ÖZ yaz.`;
      
      const response = await this.generate(jsonPrompt, {
        ...options,
        temperature: options.temperature || 0.1, // Daha deterministik JSON için
        max_tokens: options.max_tokens || 500 // Daha kısa yanıt
      });
      
      // Extract JSON from response (sometimes model adds extra text)
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Model geçerli JSON döndürmedi');
      }
      
      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      console.error('JSON generation error:', error.message);
      if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
        throw new Error('AI yanıt verme süresi aşıldı. Lütfen tekrar deneyin.');
      }
      throw error;
    }
  }
  
  /**
   * Pull/download a model from Ollama library
   * @param {string} modelName - Model name to pull
   * @returns {Promise<void>}
   */
  async pullModel(modelName) {
    try {
      console.log(`Pulling model: ${modelName}...`);
      await axios.post(
        `${this.baseURL}/api/pull`,
        { name: modelName },
        { timeout: 600000 } // 10 minutes for download
      );
      console.log(`Model ${modelName} pulled successfully`);
    } catch (error) {
      console.error('Error pulling model:', error.message);
      throw new Error(`Model indirilemedi: ${error.message}`);
    }
  }
}

module.exports = OllamaService;
