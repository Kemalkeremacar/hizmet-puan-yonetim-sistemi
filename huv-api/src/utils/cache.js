// ============================================
// SIMPLE MEMORY CACHE
// ============================================
// Redis olmadan basit memory cache
// Production'da Redis kullanılabilir
// ============================================

class SimpleCache {
  constructor() {
    this.cache = new Map();
    this.timers = new Map();
  }

  // Cache'e kaydet
  set(key, value, ttl = 300000) { // Default: 5 dakika
    // Eğer zaten timer varsa temizle
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key));
    }

    // Cache'e kaydet
    this.cache.set(key, {
      value,
      timestamp: Date.now(),
      ttl
    });

    // TTL sonrası otomatik sil
    const timer = setTimeout(() => {
      this.delete(key);
    }, ttl);

    this.timers.set(key, timer);
  }

  // Cache'den oku
  get(key) {
    const item = this.cache.get(key);
    
    if (!item) {
      return null;
    }

    // TTL kontrolü
    const age = Date.now() - item.timestamp;
    if (age > item.ttl) {
      this.delete(key);
      return null;
    }

    return item.value;
  }

  // Cache'den sil
  delete(key) {
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key));
      this.timers.delete(key);
    }
    this.cache.delete(key);
  }

  // Tüm cache'i temizle
  clear() {
    // Tüm timer'ları temizle
    this.timers.forEach(timer => clearTimeout(timer));
    this.timers.clear();
    this.cache.clear();
  }

  // Cache istatistikleri
  getStats() {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }
}

// Singleton instance
const cache = new SimpleCache();

module.exports = cache;
