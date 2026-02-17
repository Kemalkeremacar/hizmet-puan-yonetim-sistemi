// ============================================
// AUTHENTICATION CONTROLLER
// ============================================
// Login, Logout, Me (current user)
// ============================================

const bcrypt = require('bcrypt');
const { getPool, sql } = require('../config/database');
const { success, error } = require('../utils/response');
const { generateToken, authenticate } = require('../middleware/auth');

// ============================================
// POST /api/auth/login
// Kullanıcı girişi
// ============================================
const login = async (req, res, next) => {
  try {
    const { kullaniciAdi, sifre } = req.body;
    
    // Validasyon
    if (!kullaniciAdi || !sifre) {
      return error(res, 'Kullanıcı adı ve şifre gereklidir', 400, {
        tip: 'EKSIK_BILGI',
        cozum: 'Lütfen kullanıcı adı ve şifrenizi girin'
      });
    }
    
    const pool = await getPool();
    
    // Kullanıcıyı bul
    const userResult = await pool.request()
      .input('kullaniciAdi', sql.NVarChar, kullaniciAdi)
      .query(`
        SELECT KullaniciID, KullaniciAdi, Sifre, Rol, AktifMi
        FROM Kullanicilar
        WHERE KullaniciAdi = @kullaniciAdi
      `);
    
    if (userResult.recordset.length === 0) {
      return error(res, 'Kullanıcı adı veya şifre hatalı', 401, {
        tip: 'GIRIS_HATASI',
        cozum: 'Kullanıcı adı veya şifrenizi kontrol edin'
      });
    }
    
    const user = userResult.recordset[0];
    
    // Aktif kontrolü
    if (!user.AktifMi) {
      return error(res, 'Hesabınız aktif değil', 401, {
        tip: 'HESAP_PASIF',
        cozum: 'Hesabınızı aktifleştirmek için yönetici ile iletişime geçin'
      });
    }
    
    // Şifre kontrolü
    // Eğer şifre bcrypt hash değilse (eski plain text), bcrypt ile karşılaştır
    let passwordMatch = false;
    
    if (user.Sifre.startsWith('$2b$') || user.Sifre.startsWith('$2a$')) {
      // bcrypt hash
      passwordMatch = await bcrypt.compare(sifre, user.Sifre);
    } else {
      // Plain text (geçici - migration için)
      passwordMatch = sifre === user.Sifre;
      
      // Eğer eşleşirse, şifreyi bcrypt ile hash'le ve güncelle
      if (passwordMatch) {
        const hashedPassword = await bcrypt.hash(sifre, 10);
        await pool.request()
          .input('kullaniciId', sql.Int, user.KullaniciID)
          .input('hashedSifre', sql.NVarChar, hashedPassword)
          .query(`
            UPDATE Kullanicilar
            SET Sifre = @hashedSifre
            WHERE KullaniciID = @kullaniciId
          `);
      }
    }
    
    if (!passwordMatch) {
      return error(res, 'Kullanıcı adı veya şifre hatalı', 401, {
        tip: 'GIRIS_HATASI',
        cozum: 'Kullanıcı adı veya şifrenizi kontrol edin'
      });
    }
    
    // Son giriş bilgilerini güncelle
    const clientIP = req.ip || req.connection.remoteAddress || 'unknown';
    await pool.request()
      .input('kullaniciId', sql.Int, user.KullaniciID)
      .input('ip', sql.NVarChar, clientIP)
      .query(`
        UPDATE Kullanicilar
        SET SonGirisTarihi = GETDATE(),
            SonGirisIP = @ip
        WHERE KullaniciID = @kullaniciId
      `);
    
    // Token oluştur
    const token = generateToken(user);
    
    return success(res, {
      token,
      user: {
        kullaniciId: user.KullaniciID,
        kullaniciAdi: user.KullaniciAdi,
        rol: user.Rol
      }
    }, 'Giriş başarılı');
  } catch (err) {
    console.error('Login hatası:', err);
    next(err);
  }
};

// ============================================
// POST /api/auth/logout
// Kullanıcı çıkışı (client-side token silinir)
// ============================================
const logout = async (req, res, next) => {
  try {
    // JWT stateless olduğu için server-side'da bir şey yapmaya gerek yok
    // Client-side'da token silinir
    return success(res, null, 'Çıkış başarılı');
  } catch (err) {
    next(err);
  }
};

// ============================================
// GET /api/auth/me
// Mevcut kullanıcı bilgisi
// ============================================
const getMe = async (req, res, next) => {
  try {
    // authenticate middleware'den gelen user bilgisi
    if (!req.user) {
      return error(res, 'Kullanıcı bilgisi bulunamadı', 401);
    }
    
    const pool = await getPool();
    const userResult = await pool.request()
      .input('kullaniciId', sql.Int, req.user.kullaniciId)
      .query(`
        SELECT KullaniciID, KullaniciAdi, Rol, AktifMi, OlusturmaTarihi, SonGirisTarihi
        FROM Kullanicilar
        WHERE KullaniciID = @kullaniciId
      `);
    
    if (userResult.recordset.length === 0) {
      return error(res, 'Kullanıcı bulunamadı', 404);
    }
    
    const user = userResult.recordset[0];
    
    return success(res, {
      kullaniciId: user.KullaniciID,
      kullaniciAdi: user.KullaniciAdi,
      rol: user.Rol,
      aktifMi: user.AktifMi,
      olusturmaTarihi: user.OlusturmaTarihi,
      sonGirisTarihi: user.SonGirisTarihi
    }, 'Kullanıcı bilgisi');
  } catch (err) {
    next(err);
  }
};

module.exports = {
  login,
  logout,
  getMe
};
