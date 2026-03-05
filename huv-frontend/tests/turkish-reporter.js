/**
 * Türkçe Test Reporter
 * Playwright test sonuçlarını Türkçe olarak gösterir
 */

class TurkishReporter {
  constructor() {
    this.testler = [];
    this.baslamaZamani = null;
  }

  onBegin(config, suite) {
    this.baslamaZamani = Date.now();
    const toplamTest = suite.allTests().length;
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║              🎭 PLAYWRIGHT TEST BAŞLIYOR                  ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');
    console.log(`📊 Toplam ${toplamTest} test çalıştırılacak...\n`);
  }

  onTestBegin(test) {
    const testAdi = this.testAdiniTemizle(test.title);
    process.stdout.write(`⏳ ${testAdi}...`);
  }

  onTestEnd(test, result) {
    const testAdi = this.testAdiniTemizle(test.title);
    const sure = (result.duration / 1000).toFixed(1);
    
    // Önceki satırı temizle
    process.stdout.clearLine(0);
    process.stdout.cursorTo(0);
    
    if (result.status === 'passed') {
      console.log(`✅ ${testAdi} (${sure}s)`);
      this.testler.push({ durum: 'başarılı', ad: testAdi, sure });
    } else if (result.status === 'failed') {
      console.log(`❌ ${testAdi} (${sure}s)`);
      console.log(`   💥 Hata: ${result.error?.message?.split('\n')[0] || 'Bilinmeyen hata'}`);
      this.testler.push({ durum: 'başarısız', ad: testAdi, sure, hata: result.error?.message });
    } else if (result.status === 'skipped') {
      console.log(`⏭️  ${testAdi} (atlandı)`);
      this.testler.push({ durum: 'atlandı', ad: testAdi });
    } else if (result.status === 'timedOut') {
      console.log(`⏱️  ${testAdi} (zaman aşımı)`);
      this.testler.push({ durum: 'zaman-aşımı', ad: testAdi, sure });
    }
  }

  onEnd(result) {
    const toplamSure = ((Date.now() - this.baslamaZamani) / 1000).toFixed(1);
    
    const basarili = this.testler.filter(t => t.durum === 'başarılı').length;
    const basarisiz = this.testler.filter(t => t.durum === 'başarısız').length;
    const atlanan = this.testler.filter(t => t.durum === 'atlandı').length;
    const zamanAsimi = this.testler.filter(t => t.durum === 'zaman-aşımı').length;
    const toplam = this.testler.length;

    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║                    📊 TEST SONUÇLARI                      ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    // Özet
    console.log('📈 ÖZET:');
    console.log(`   Toplam Test: ${toplam}`);
    console.log(`   ✅ Başarılı: ${basarili} (${this.yuzdeHesapla(basarili, toplam)}%)`);
    if (basarisiz > 0) {
      console.log(`   ❌ Başarısız: ${basarisiz} (${this.yuzdeHesapla(basarisiz, toplam)}%)`);
    }
    if (atlanan > 0) {
      console.log(`   ⏭️  Atlanan: ${atlanan}`);
    }
    if (zamanAsimi > 0) {
      console.log(`   ⏱️  Zaman Aşımı: ${zamanAsimi}`);
    }
    console.log(`   ⏱️  Toplam Süre: ${toplamSure}s\n`);

    // Başarısız testler detayı
    if (basarisiz > 0) {
      console.log('❌ BAŞARISIZ TESTLER:\n');
      this.testler
        .filter(t => t.durum === 'başarısız')
        .forEach((test, index) => {
          console.log(`   ${index + 1}. ${test.ad}`);
          if (test.hata) {
            const hataMesaji = test.hata.split('\n')[0];
            console.log(`      💥 ${hataMesaji}`);
          }
          console.log('');
        });
    }

    // Başarı durumu
    if (basarisiz === 0 && zamanAsimi === 0) {
      console.log('🎉 TÜM TESTLER BAŞARILI! 🎉\n');
    } else {
      console.log('⚠️  BAZI TESTLER BAŞARISIZ OLDU\n');
    }

    // HTML rapor linki
    console.log('📄 Detaylı rapor için:');
    console.log('   npm run test:report\n');
  }

  testAdiniTemizle(title) {
    // Test adını kısalt ve temizle
    return title
      .replace('Authentication Flow › ', '')
      .replace('should ', '')
      .substring(0, 60);
  }

  yuzdeHesapla(sayi, toplam) {
    return toplam > 0 ? Math.round((sayi / toplam) * 100) : 0;
  }
}

export default TurkishReporter;
