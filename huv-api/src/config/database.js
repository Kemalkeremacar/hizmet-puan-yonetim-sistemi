// ============================================
// DATABASE CONFIGURATION
// ============================================
// SQL Server bağlantı ayarları
// ============================================

const sql = require('mssql');
require('dotenv').config({ override: true });

// ============================================
// Database configuration
// ============================================
const config = {
  server: process.env.DB_SERVER,
  database: process.env.DB_DATABASE,
  options: {
    encrypt: process.env.DB_ENCRYPT === 'true',
    trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE === 'true',
    enableArithAbort: true,
    useUTC: false // Türkiye saat dilimi için
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000
  },
  // Türkçe karakter desteği için
  requestTimeout: 30000,
  connectionTimeout: 30000,
  parseJSON: true
};

// ============================================
// Windows Authentication or SQL Authentication
// ============================================
if (process.env.DB_WINDOWS_AUTH === 'true') {
  config.options.trustedConnection = true;
  config.authentication = {
    type: 'ntlm',
    options: {
      domain: '',
      userName: '',
      password: ''
    }
  };
} else {
  config.user = process.env.DB_USER;
  config.password = process.env.DB_PASSWORD;
}

// Connection pool
let pool = null;

// ============================================
// Get database connection pool
// ============================================
const getPool = async () => {
  if (!pool) {
    try {
      // Debug: Config'i yazdır (ŞİFRE GÖSTERİLMEZ!)
      console.log('🔍 DB Config:', {
        server: config.server,
        database: config.database,
        user: config.user,
        windowsAuth: process.env.DB_WINDOWS_AUTH
      });
      
      pool = await sql.connect(config);
      console.log('✅ Database connected successfully');
    } catch (err) {
      console.error('❌ Database connection failed:', err.message);
      throw err;
    }
  }
  return pool;
};

// ============================================
// Close database connection
// ============================================
const closePool = async () => {
  if (pool) {
    await pool.close();
    pool = null;
    console.log('Database connection closed');
  }
};

module.exports = {
  sql,
  getPool,
  closePool
};
