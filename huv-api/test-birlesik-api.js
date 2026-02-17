// ============================================
// BİRLEŞİK LİSTE API TEST
// ============================================
// API endpoint'ini test eder
// ============================================

require('dotenv').config({ override: true });
const axios = require('axios');

async function testBirlesikApi() {
  try {
    const baseURL = process.env.API_URL || 'http://localhost:3000/api';
    const token = process.argv[2]; // Token'ı command line'dan al
    
    if (!token) {
      console.error('❌ Token gerekli! Kullanım: node test-birlesik-api.js <token>');
      process.exit(1);
    }
    
    console.log('🔄 Birleşik liste API testi başlatılıyor...');
    console.log(`📡 Base URL: ${baseURL}`);
    
    const startTime = Date.now();
    
    const response = await axios.get(`${baseURL}/external/birlesik`, {
      headers: {
        'Authorization': `Bearer ${token}`
      },
      timeout: 120000 // 2 dakika
    });
    
    const duration = Date.now() - startTime;
    
    console.log(`\n✅ API yanıt alındı (${duration}ms)`);
    console.log('📊 Response Status:', response.status);
    console.log('📊 Response Data Keys:', Object.keys(response.data || {}));
    
    if (response.data) {
      console.log('\n📋 İstatistikler:');
      console.log('  - Toplam Grup:', response.data.toplamGrup || 0);
      console.log('  - Birleşik Grup:', response.data.birlesikGrup || 0);
      console.log('  - Toplam HUV İşlem:', response.data.toplamHuvIslem || 0);
      console.log('  - Toplam SUT İşlem:', response.data.toplamSutIslem || 0);
      console.log('  - SUT Kodu Eşleştirme:', response.data.sutKoduEslestirme || 0);
      
      if (response.data.data && Array.isArray(response.data.data)) {
        console.log('\n📋 İlk 3 Grup:');
        response.data.data.slice(0, 3).forEach((grup, index) => {
          console.log(`  ${index + 1}. ${grup.ustTeminat?.adi || '-'} / ${grup.altTeminat?.adi || '-'}`);
          console.log(`     HUV: ${grup.toplamHuvIslem}, SUT: ${grup.toplamSutIslem}`);
        });
      }
    }
    
    console.log('\n✅ Test başarılı!');
    
  } catch (err) {
    console.error('\n❌ Test başarısız!');
    console.error('Hata:', err.message);
    if (err.response) {
      console.error('Status:', err.response.status);
      console.error('Data:', err.response.data);
    }
    if (err.code === 'ECONNABORTED') {
      console.error('⚠️  İstek zaman aşımına uğradı (2 dakika)');
    }
    process.exit(1);
  }
}

testBirlesikApi();
