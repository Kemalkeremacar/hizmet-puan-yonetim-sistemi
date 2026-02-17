// ============================================
// AUTHENTICATION MIDDLEWARE
// ============================================
// JWT token doğrulama ve yetkilendirme
// ============================================

const jwt = require('jsonwebtoken');
const { getPool, sql } = require('../config/database');
const { error } = require('../utils/response');

// JWT secret key (environment variable'dan al)
const JWT_SECRET = process.env.JWT_SECRET || 'huv-secret-key-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

// ============================================
// Token oluştur
// ============================================
const generateToken = (user) => {
  const payload = {
    kullaniciId: user.KullaniciID,
    kullaniciAdi: user.KullaniciAdi,
    rol: user.Rol
  };
  
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
};

// ============================================
// Token doğrula (Authenticate)
// ============================================
// Herhangi bir authenticated kullanıcı erişebilir
const authenticate = async (req, res, next) => {
  try {
    // Token'ı header'dan al
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return error(res, 'Token bulunamadı', 401, {
        tip: 'TOKEN_EKSIK',
        cozum: 'Lütfen giriş yapın'
      });
    }
    
    const token = authHeader.substring(7); // "Bearer " kısmını çıkar
    
    // Token'ı doğrula
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return error(res, 'Token süresi dolmuş', 401, {
          tip: 'TOKEN_SURESI_DOLMUS',
          cozum: 'Lütfen tekrar giriş yapın'
        });
      }
      return error(res, 'Geçersiz token', 401, {
        tip: 'TOKEN_GECERSIZ',
        cozum: 'Lütfen tekrar giriş yapın'
      });
    }
    
    // Kullanıcıyı veritabanından kontrol et
    const pool = await getPool();
    const userResult = await pool.request()
      .input('kullaniciId', sql.Int, decoded.kullaniciId)
      .query(`
        SELECT KullaniciID, KullaniciAdi, Rol, AktifMi
        FROM Kullanicilar
        WHERE KullaniciID = @kullaniciId AND AktifMi = 1
      `);
    
    if (userResult.recordset.length === 0) {
      return error(res, 'Kullanıcı bulunamadı veya aktif değil', 401, {
        tip: 'KULLANICI_BULUNAMADI',
        cozum: 'Lütfen tekrar giriş yapın'
      });
    }
    
    // Kullanıcı bilgisini request'e ekle
    req.user = {
      kullaniciId: userResult.recordset[0].KullaniciID,
      kullaniciAdi: userResult.recordset[0].KullaniciAdi,
      rol: userResult.recordset[0].Rol
    };
    
    next();
  } catch (err) {
    console.error('Authentication hatası:', err);
    return error(res, 'Authentication hatası', 500);
  }
};

// ============================================
// Admin yetkisi kontrolü (Authorize)
// ============================================
// Sadece ADMIN rolü erişebilir
const authorizeAdmin = (req, res, next) => {
  if (!req.user) {
    return error(res, 'Kullanıcı bilgisi bulunamadı', 401);
  }
  
  if (req.user.rol !== 'ADMIN') {
    return error(res, 'Bu işlem için admin yetkisi gereklidir', 403, {
      tip: 'YETKI_YETERSIZ',
      cozum: 'Bu işlem için admin yetkisi gereklidir'
    });
  }
  
  next();
};

// ============================================
// Rol kontrolü (genel)
// ============================================
const authorizeRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return error(res, 'Kullanıcı bilgisi bulunamadı', 401);
    }
    
    if (!allowedRoles.includes(req.user.rol)) {
      return error(res, 'Bu işlem için yetkiniz yok', 403, {
        tip: 'YETKI_YETERSIZ',
        cozum: `Bu işlem için şu rollerden biri gereklidir: ${allowedRoles.join(', ')}`
      });
    }
    
    next();
  };
};

module.exports = {
  generateToken,
  authenticate,
  authorizeAdmin,
  authorizeRole,
  JWT_SECRET,
  JWT_EXPIRES_IN
};
