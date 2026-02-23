// ============================================
// BATCH PROCESSOR UTILITY
// ============================================
// Utility for processing large datasets in chunks
// Provides progress reporting and error handling
// ============================================

/**
 * Batch Processor Utility
 * Processes items in batches with progress reporting
 */
class BatchProcessor {
  /**
   * Process items in batches
   * @param {Array} items - Array of items to process
   * @param {number} batchSize - Size of each batch
   * @param {Function} processFn - Function to process each item (async)
   * @param {Function} progressCallback - Callback for progress updates (optional)
   * @returns {Promise<Object>} Summary { totalProcessed, successCount, errorCount, errors }
   */
  static async processBatch(items, batchSize, processFn, progressCallback = null) {
    const totalItems = items.length;
    let processedCount = 0;
    let successCount = 0;
    let errorCount = 0;
    const errors = [];
    
    // Process in chunks
    for (let i = 0; i < totalItems; i += batchSize) {
      const chunk = items.slice(i, i + batchSize);
      
      // Process each item in the chunk
      for (const item of chunk) {
        try {
          await processFn(item);
          successCount++;
        } catch (error) {
          errorCount++;
          errors.push({
            item,
            error: error.message || 'Unknown error'
          });
          // Continue processing despite error
        }
        
        processedCount++;
        
        // Report progress
        if (progressCallback) {
          const percentage = Math.round((processedCount / totalItems) * 100);
          progressCallback(percentage, processedCount, totalItems);
        }
      }
    }
    
    return {
      totalProcessed: processedCount,
      successCount,
      errorCount,
      errors
    };
  }
}

module.exports = BatchProcessor;
