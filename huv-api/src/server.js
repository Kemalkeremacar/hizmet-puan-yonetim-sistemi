// ============================================
// SERVER
// ============================================
// Express server başlatma ve yönetimi
// ============================================

const app = require('./app');
const { getPool, closePool } = require('./config/database');
const { checkDatabaseCollation } = require('./utils/turkishCharFix');

const PORT = process.env.PORT || 3000;

// ============================================
// Start server
// ============================================
const startServer = async () => {
  try {
    // Test database connection
    const pool = await getPool();
    
    // Check database collation (Türkçe karakter desteği)
    const collation = await checkDatabaseCollation(pool);
    
    // Start listening
    const server = app.listen(PORT, () => {
      console.log('╔════════════════════════════════════════════════════════════╗');
      console.log('║                    HUV API SERVER                         ║');
      console.log('╚════════════════════════════════════════════════════════════╝');
      console.log('');
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📍 http://localhost:${PORT}`);
      console.log(`🏥 Health check: http://localhost:${PORT}/health`);
      console.log(`📚 API prefix: ${process.env.API_PREFIX || '/api'}`);
      console.log('');
      console.log('📊 Database Info:');
      console.log(`   Database Collation: ${collation.database}`);
      console.log(`   Server Collation: ${collation.server}`);
      console.log(`   Turkish Support: ${collation.isTurkish ? '✅' : '⚠️'}`);
      
      if (collation.needsFix) {
        console.log('');
        console.log('⚠️  WARNING: Database collation is not Turkish!');
        console.log('   Türkçe karakterler düzeltme aktif (performans etkisi olabilir)');
        console.log('   Önerilen collation: Turkish_CI_AS');
      }
      
      console.log('');
      console.log('Press CTRL+C to stop');
      console.log('═══════════════════════════════════════════════════════════');
    });
    
    return server;
  } catch (err) {
    console.error('❌ Failed to start server:', err.message);
    process.exit(1);
  }
};

// ============================================
// Graceful shutdown
// ============================================
process.on('SIGINT', async () => {
  console.log('\n\n🛑 Shutting down gracefully...');
  await closePool();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n\n🛑 Shutting down gracefully...');
  await closePool();
  process.exit(0);
});

// ============================================
// Start
// ============================================
startServer();
