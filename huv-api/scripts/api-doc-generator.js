// ============================================
// API DOCUMENTATION GENERATOR
// ============================================
// API endpoint'lerini analiz eder ve dokümantasyon oluşturur
// ============================================

const fs = require('fs').promises;
const path = require('path');

class APIDocGenerator {
  constructor() {
    this.routes = [];
    this.routesDir = path.join(__dirname, '../src/routes');
    this.controllersDir = path.join(__dirname, '../src/controllers');
  }

  // Route dosyalarını analiz et
  async analyzeRoutes() {
    console.log('\n📋 API Route\'ları Analiz Ediliyor...');
    
    const routeFiles = await fs.readdir(this.routesDir);
    
    for (const file of routeFiles) {
      if (file.endsWith('.js')) {
        const filePath = path.join(this.routesDir, file);
        const content = await fs.readFile(filePath, 'utf8');
        
        const routeInfo = {
          file: file,
          name: file.replace('.js', ''),
          endpoints: this.extractEndpoints(content, file)
        };
        
        this.routes.push(routeInfo);
        console.log(`  ✓ ${file} (${routeInfo.endpoints.length} endpoint)`);
      }
    }
  }

  // Endpoint'leri extract et
  extractEndpoints(content, filename) {
    const endpoints = [];
    
    // Router method patterns: router.get, router.post, router.put, router.delete, router.patch
    const routePattern = /router\.(get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]+)['"`]\s*,?\s*([^)]*)\)/g;
    
    let match;
    while ((match = routePattern.exec(content)) !== null) {
      const method = match[1].toUpperCase();
      const path = match[2];
      const middlewareAndHandler = match[3];
      
      // Middleware ve handler'ı ayır
      const parts = middlewareAndHandler.split(',').map(p => p.trim());
      const handler = parts[parts.length - 1];
      const middlewares = parts.slice(0, -1);
      
      // Auth middleware kontrolü
      const requiresAuth = middlewares.some(m => 
        m.includes('authenticate') || m.includes('auth')
      );
      
      const requiresAdmin = middlewares.some(m => 
        m.includes('authorizeAdmin') || m.includes('admin')
      );
      
      // Upload middleware kontrolü
      const hasUpload = middlewares.some(m => 
        m.includes('upload') || m.includes('multer')
      );
      
      endpoints.push({
        method,
        path,
        handler,
        middlewares,
        requiresAuth,
        requiresAdmin,
        hasUpload,
        description: this.extractDescription(content, path, method)
      });
    }
    
    return endpoints;
  }

  // Endpoint açıklamasını extract et (comment'lerden)
  extractDescription(content, path, method) {
    // Path'in üstündeki comment'i bul
    const lines = content.split('\n');
    const routeLine = lines.findIndex(line => 
      line.includes(`router.${method.toLowerCase()}`) && line.includes(path)
    );
    
    if (routeLine > 0) {
      // Üstteki satırlarda comment ara
      for (let i = routeLine - 1; i >= Math.max(0, routeLine - 5); i--) {
        const line = lines[i].trim();
        if (line.startsWith('//')) {
          return line.replace(/^\/\/\s*/, '').trim();
        }
      }
    }
    
    return '';
  }

  // Markdown dokümantasyon oluştur
  async generateMarkdown() {
    console.log('\n📝 API Dokümantasyonu Oluşturuluyor...');
    
    let md = `# HUV API - Endpoint Dokümantasyonu\n\n`;
    md += `**Oluşturulma Tarihi:** ${new Date().toLocaleString('tr-TR')}\n\n`;
    md += `---\n\n`;
    
    // Genel Bilgiler
    md += `## 📊 Genel Bilgiler\n\n`;
    md += `**Base URL:** \`http://localhost:3000/api\`\n\n`;
    md += `**Authentication:** JWT Bearer Token\n\n`;
    md += `**Content-Type:** \`application/json\`\n\n`;
    
    // İstatistikler
    const totalEndpoints = this.routes.reduce((sum, r) => sum + r.endpoints.length, 0);
    const authEndpoints = this.routes.reduce((sum, r) => 
      sum + r.endpoints.filter(e => e.requiresAuth).length, 0
    );
    const adminEndpoints = this.routes.reduce((sum, r) => 
      sum + r.endpoints.filter(e => e.requiresAdmin).length, 0
    );
    const publicEndpoints = totalEndpoints - authEndpoints;
    
    md += `### İstatistikler\n\n`;
    md += `| Metrik | Değer |\n`;
    md += `|--------|-------|\n`;
    md += `| Toplam Endpoint | ${totalEndpoints} |\n`;
    md += `| Public Endpoint | ${publicEndpoints} |\n`;
    md += `| Auth Required | ${authEndpoints} |\n`;
    md += `| Admin Only | ${adminEndpoints} |\n\n`;
    
    // HTTP Method dağılımı
    const methodCounts = {};
    this.routes.forEach(route => {
      route.endpoints.forEach(endpoint => {
        methodCounts[endpoint.method] = (methodCounts[endpoint.method] || 0) + 1;
      });
    });
    
    md += `### HTTP Method Dağılımı\n\n`;
    md += `| Method | Sayı |\n`;
    md += `|--------|------|\n`;
    Object.entries(methodCounts).sort().forEach(([method, count]) => {
      md += `| ${method} | ${count} |\n`;
    });
    md += `\n`;
    
    // İçindekiler
    md += `## 📑 İçindekiler\n\n`;
    this.routes.forEach(route => {
      md += `- [${this.formatRouteName(route.name)}](#${route.name.toLowerCase()})\n`;
    });
    md += `\n---\n\n`;
    
    // Her route için detaylı dokümantasyon
    for (const route of this.routes) {
      md += `## ${this.formatRouteName(route.name)}\n\n`;
      md += `**Dosya:** \`${route.file}\`\n\n`;
      
      if (route.endpoints.length === 0) {
        md += `*Bu route'da endpoint bulunamadı.*\n\n`;
        continue;
      }
      
      // Endpoint'leri method'a göre grupla
      const groupedByMethod = {};
      route.endpoints.forEach(endpoint => {
        if (!groupedByMethod[endpoint.method]) {
          groupedByMethod[endpoint.method] = [];
        }
        groupedByMethod[endpoint.method].push(endpoint);
      });
      
      // Her method grubu için
      Object.entries(groupedByMethod).sort().forEach(([method, endpoints]) => {
        endpoints.forEach(endpoint => {
          const methodBadge = this.getMethodBadge(method);
          const authBadge = endpoint.requiresAdmin ? '🔐 Admin' : 
                           endpoint.requiresAuth ? '🔒 Auth' : '🌐 Public';
          
          md += `### ${methodBadge} \`${endpoint.path}\`\n\n`;
          md += `**Yetkilendirme:** ${authBadge}\n\n`;
          
          if (endpoint.description) {
            md += `**Açıklama:** ${endpoint.description}\n\n`;
          }
          
          if (endpoint.hasUpload) {
            md += `**File Upload:** ✓ (multipart/form-data)\n\n`;
          }
          
          md += `**Handler:** \`${endpoint.handler}\`\n\n`;
          
          if (endpoint.middlewares.length > 0) {
            md += `**Middleware:** ${endpoint.middlewares.join(', ')}\n\n`;
          }
          
          // Request/Response örnekleri (path parametrelerine göre)
          if (endpoint.path.includes(':')) {
            md += `**Path Parameters:**\n\n`;
            const params = endpoint.path.match(/:(\w+)/g);
            if (params) {
              params.forEach(param => {
                md += `- \`${param.substring(1)}\`: ${this.getParamDescription(param.substring(1))}\n`;
              });
              md += `\n`;
            }
          }
          
          md += `---\n\n`;
        });
      });
    }
    
    // Authentication Bölümü
    md += `## 🔐 Authentication\n\n`;
    md += `### Login\n\n`;
    md += `**Endpoint:** \`POST /api/auth/login\`\n\n`;
    md += `**Request Body:**\n\n`;
    md += `\`\`\`json\n`;
    md += `{\n`;
    md += `  "kullaniciAdi": "admin",\n`;
    md += `  "sifre": "password123"\n`;
    md += `}\n`;
    md += `\`\`\`\n\n`;
    md += `**Response:**\n\n`;
    md += `\`\`\`json\n`;
    md += `{\n`;
    md += `  "success": true,\n`;
    md += `  "data": {\n`;
    md += `    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",\n`;
    md += `    "kullanici": {\n`;
    md += `      "kullaniciID": 1,\n`;
    md += `      "kullaniciAdi": "admin",\n`;
    md += `      "rol": "admin"\n`;
    md += `    }\n`;
    md += `  },\n`;
    md += `  "message": "Giriş başarılı"\n`;
    md += `}\n`;
    md += `\`\`\`\n\n`;
    
    md += `### Token Kullanımı\n\n`;
    md += `Tüm korumalı endpoint'ler için Authorization header'ı gereklidir:\n\n`;
    md += `\`\`\`\n`;
    md += `Authorization: Bearer <token>\n`;
    md += `\`\`\`\n\n`;
    
    // Error Responses
    md += `## ❌ Error Responses\n\n`;
    md += `### Standart Error Format\n\n`;
    md += `\`\`\`json\n`;
    md += `{\n`;
    md += `  "success": false,\n`;
    md += `  "message": "Hata mesajı",\n`;
    md += `  "error": "Detaylı hata açıklaması"\n`;
    md += `}\n`;
    md += `\`\`\`\n\n`;
    
    md += `### HTTP Status Codes\n\n`;
    md += `| Code | Açıklama |\n`;
    md += `|------|----------|\n`;
    md += `| 200 | Başarılı istek |\n`;
    md += `| 201 | Kaynak oluşturuldu |\n`;
    md += `| 400 | Geçersiz istek |\n`;
    md += `| 401 | Yetkilendirme gerekli |\n`;
    md += `| 403 | Erişim yasak |\n`;
    md += `| 404 | Kaynak bulunamadı |\n`;
    md += `| 409 | Çakışma (duplicate) |\n`;
    md += `| 500 | Sunucu hatası |\n\n`;
    
    return md;
  }

  // Helper methods
  formatRouteName(name) {
    const nameMap = {
      'auth': 'Authentication',
      'anadal': 'Ana Dallar',
      'sut': 'SUT İşlemleri',
      'sutTarihsel': 'SUT Tarihsel',
      'islemler': 'HUV İşlemleri',
      'tarihsel': 'HUV Tarihsel',
      'import': 'Import (Admin)',
      'versiyonlar': 'Versiyonlar (Admin)',
      'altTeminatlar': 'Alt Teminatlar',
      'matching': 'Matching',
      'external': 'External API'
    };
    
    return nameMap[name] || name;
  }

  getMethodBadge(method) {
    const badges = {
      'GET': '🔵 GET',
      'POST': '🟢 POST',
      'PUT': '🟡 PUT',
      'DELETE': '🔴 DELETE',
      'PATCH': '🟠 PATCH'
    };
    return badges[method] || method;
  }

  getParamDescription(param) {
    const descriptions = {
      'id': 'Kayıt ID',
      'islemID': 'İşlem ID',
      'sutID': 'SUT ID',
      'versionID': 'Versiyon ID',
      'anaDalKodu': 'Ana Dal Kodu',
      'hiyerarsiID': 'Hiyerarsi ID',
      'altTeminatID': 'Alt Teminat ID'
    };
    return descriptions[param] || 'ID parametresi';
  }

  // Ana çalıştırma fonksiyonu
  async generate() {
    try {
      await this.analyzeRoutes();
      
      const markdown = await this.generateMarkdown();
      
      const docsDir = path.join(__dirname, '../../docs');
      await fs.writeFile(path.join(docsDir, 'API-DOCUMENTATION.md'), markdown, 'utf8');
      
      console.log('✅ API Dokümantasyonu oluşturuldu!');
      console.log('📄 Dosya: docs/API-DOCUMENTATION.md');
      
      // Özet
      const totalEndpoints = this.routes.reduce((sum, r) => sum + r.endpoints.length, 0);
      console.log(`\n📊 Toplam ${this.routes.length} route, ${totalEndpoints} endpoint dokümante edildi.`);
      
    } catch (error) {
      console.error('❌ Dokümantasyon oluşturma hatası:', error);
      throw error;
    }
  }
}

// Script'i çalıştır
(async () => {
  const generator = new APIDocGenerator();
  await generator.generate();
  process.exit(0);
})();
