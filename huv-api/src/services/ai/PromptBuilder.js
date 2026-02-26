// ============================================
// PROMPT BUILDER
// ============================================
// Builds optimized prompts for medical matching
// ============================================

/**
 * Prompt Builder for AI Matching
 * Creates structured prompts for SUT-HUV matching
 */
class PromptBuilder {
  /**
   * Build matching prompt for a single SUT işlem
   * @param {Object} sutIslem - SUT işlem object
   * @param {Array} huvTeminatlar - Array of HUV teminat objects
   * @returns {string} Formatted prompt
   */
  static buildMatchingPrompt(sutIslem, huvTeminatlar) {
    // Format HUV list for prompt - Daha detaylı
    const huvListText = huvTeminatlar
      .map((huv, index) => {
        let line = `${index + 1}. [ID: ${huv.altTeminatId}] ${huv.altTeminatAdi}`;
        if (huv.anaDalAdi) line += ` (Ana Dal: ${huv.anaDalAdi})`;
        if (huv.sira) line += ` [Sıra: ${huv.sira}]`;
        return line;
      })
      .join('\n');
    
    const prompt = `Sen Türkiye'de SUT ve özel sağlık sigortası uzmanısın.

SUT İŞLEM:
Kod: ${sutIslem.sutKodu}
İşlem: ${sutIslem.islemAdi}
${sutIslem.anaDalAdi ? `Ana Başlık: ${sutIslem.anaDalAdi}` : ''}

HUV TEMİNATLARI:
${huvListText}

GÖREV: En uygun HUV teminatını seç.

KRİTERLER:
1. Tıbbi terim benzerliği
2. İşlem türü uyumu (cerrahi→ameliyat, görüntüleme→radyoloji, tahlil→laboratuvar, yatak→yatarak tedavi)
3. Ana dal uyumu

ÖRNEKLER:
✓ "Yatak tarifesi" → "Yatarak Tedavi"
✓ "Tomografi" → "Radyoloji"
✓ "Kan tahlili" → "Laboratuvar"
✗ "Yatak" → "Ameliyat" (YANLIŞ!)

YANIT (Sadece JSON):
{
  "matchedId": <ID veya null>,
  "confidence": <0-100>,
  "reasoning": "<Kısa açıklama (max 100 karakter)>",
  "alternativeIds": []
}`;

    return prompt;
  }
  
  /**
   * Build batch matching prompt for multiple SUT işlemler
   * @param {Array} sutIslemler - Array of SUT işlem objects
   * @param {Array} huvTeminatlar - Array of HUV teminat objects
   * @returns {string} Formatted prompt
   */
  static buildBatchMatchingPrompt(sutIslemler, huvTeminatlar) {
    const huvListText = huvTeminatlar
      .map((huv, index) => `${index + 1}. [ID: ${huv.altTeminatId}] ${huv.altTeminatAdi}`)
      .join('\n');
    
    const sutListText = sutIslemler
      .map((sut, index) => `${index + 1}. [SutID: ${sut.sutId}] ${sut.sutKodu} - ${sut.islemAdi}`)
      .join('\n');
    
    const prompt = `Sen tıbbi kodlama uzmanısın. Aşağıdaki SUT işlemlerini HUV teminatları ile eşleştir.

SUT İŞLEMLER:
${sutListText}

HUV TEMİNATLARI:
${huvListText}

Her SUT işlem için en uygun HUV teminatını bul.

YANIT FORMATI (JSON):
{
  "matches": [
    {
      "sutId": <SUT ID>,
      "matchedId": <HUV ID veya null>,
      "confidence": <0-100>,
      "reasoning": "<kısa açıklama>"
    }
  ]
}`;

    return prompt;
  }
  
  /**
   * Build validation prompt to verify a match
   * @param {Object} sutIslem - SUT işlem object
   * @param {Object} huvTeminat - HUV teminat object
   * @returns {string} Formatted prompt
   */
  static buildValidationPrompt(sutIslem, huvTeminat) {
    const prompt = `Sen tıbbi kodlama uzmanısın. Aşağıdaki eşleştirmenin doğruluğunu değerlendir.

SUT İŞLEM:
${sutIslem.sutKodu} - ${sutIslem.islemAdi}

HUV TEMİNAT:
${huvTeminat.altTeminatAdi}

Bu eşleştirme tıbbi açıdan doğru mu? Neden?

YANIT FORMATI (JSON):
{
  "isValid": <true/false>,
  "confidence": <0-100>,
  "reasoning": "<açıklama>",
  "suggestions": "<varsa öneriler>"
}`;

    return prompt;
  }
}

module.exports = PromptBuilder;
