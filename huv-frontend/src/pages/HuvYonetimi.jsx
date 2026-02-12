// ============================================
// HUV YÖNETİMİ SAYFASI
// ============================================
// HUV Liste Yönetimi - Import, Karşılaştırma, Versiyon Takibi
// ============================================

import { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
  Divider,
  Tabs,
  Tab,
  IconButton,
  Tooltip,
  Stack
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Info as InfoIcon,
  CloudUpload as CloudUploadIcon,
  Assessment as AssessmentIcon
} from '@mui/icons-material';
import { adminService } from '../services/adminService';
import { showError, showSuccess } from '../utils/toast';
import { LoadingSpinner, ErrorAlert, EmptyState, PageHeader, DateDisplay } from '../components/common';
import ExcelImportTab from '../components/admin/ExcelImportTab';
import { formatDateShort, formatDateTime } from '../utils/dateUtils';

// Tab Panel Component
function TabPanel({ children, value, index }) {
  return (
    <div hidden={value !== index}>
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  );
}

// ============================================
// Versiyon Listesi Tab
// ============================================
function VersiyonListesiTab() {
  const [versiyonlar, setVersiyonlar] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Detay dialog
  const [detayDialog, setDetayDialog] = useState(false);
  const [secilenVersiyon, setSecilenVersiyon] = useState(null);
  const [versiyonDetay, setVersiyonDetay] = useState(null);
  const [detayLoading, setDetayLoading] = useState(false);

  // ============================================
  // Versiyonları yükle
  // ============================================
  const fetchVersiyonlar = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await adminService.getVersiyonlar('HUV');
      
      console.log('🔍 Full Response:', response);
      console.log('🔍 Response keys:', Object.keys(response || {}));
      console.log('🔍 Response.data:', response?.data);
      console.log('🔍 Response.data type:', typeof response?.data);
      console.log('🔍 Is response.data array?', Array.isArray(response?.data));
      
      // Backend'den gelen response yapısı: { success, data, message }
      // Axios interceptor bu objeyi döndürüyor
      // Yani response = { success, data, message }
      // response.data = array olmalı
      
      let versiyonlarData = [];
      
      if (response && response.data) {
        versiyonlarData = response.data;
      }
      
      console.log('🔍 Final data:', versiyonlarData);
      console.log('🔍 Final data length:', versiyonlarData.length);
      
      if (versiyonlarData.length > 0) {
        console.log('🔍 First item:', versiyonlarData[0]);
      }
      
      setVersiyonlar(Array.isArray(versiyonlarData) ? versiyonlarData : []);
    } catch (err) {
      console.error('❌ Versiyonlar yüklenemedi:', err);
      console.error('❌ Error response:', err.response);
      setError(err);
      setVersiyonlar([]);
      showError('Versiyonlar yüklenirken hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  // ============================================
  // Versiyon detayını aç
  // ============================================
  const handleDetayAc = async (versiyon) => {
    setSecilenVersiyon(versiyon);
    setDetayDialog(true);
    setDetayLoading(true);

    try {
      const response = await adminService.getVersiyonDetay(versiyon.VersionID);
      console.log('🔍 Versiyon Detay Response:', response);
      console.log('🔍 Versiyon Detay Response.data:', response?.data);
      setVersiyonDetay(response?.data || null);
    } catch (err) {
      console.error('Versiyon detayı yüklenemedi:', err);
      showError('Versiyon detayı yüklenirken hata oluştu');
    } finally {
      setDetayLoading(false);
    }
  };

  // ============================================
  // İlk yükleme
  // ============================================
  useEffect(() => {
    fetchVersiyonlar();
  }, []);

  // ============================================
  // Render
  // ============================================
  return (
    <Box>
      {/* Hata */}
      {error && <ErrorAlert message="Versiyonlar yüklenirken hata oluştu" error={error} />}

      {/* Tablo */}
      <Paper elevation={2}>
        <Box sx={{ p: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center', bgcolor: 'grey.100' }}>
          <Typography variant="h6" fontWeight="600">
            Versiyon Geçmişi
          </Typography>
          <Button size="small" startIcon={<RefreshIcon />} onClick={fetchVersiyonlar} variant="outlined">
            Yenile
          </Button>
        </Box>
        <Divider />
        <TableContainer sx={{ maxHeight: 600 }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell sx={{ bgcolor: 'background.paper', fontWeight: 600 }}>Versiyon</TableCell>
                <TableCell sx={{ bgcolor: 'background.paper', fontWeight: 600 }}>Liste Tipi</TableCell>
                <TableCell sx={{ bgcolor: 'background.paper', fontWeight: 600 }}>Dosya Adı</TableCell>
                <TableCell align="right" sx={{ bgcolor: 'background.paper', fontWeight: 600 }}>Kayıt Sayısı</TableCell>
                <TableCell sx={{ bgcolor: 'background.paper', fontWeight: 600 }}>Yükleme Tarihi</TableCell>
                <TableCell sx={{ bgcolor: 'background.paper', fontWeight: 600 }}>Yükleyen</TableCell>
                <TableCell align="center" sx={{ bgcolor: 'background.paper', fontWeight: 600 }}>İşlemler</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 5 }}>
                    <LoadingSpinner size={40} />
                  </TableCell>
                </TableRow>
              ) : versiyonlar.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 5 }}>
                    <EmptyState message="Versiyon bulunamadı" />
                  </TableCell>
                </TableRow>
              ) : (
                versiyonlar.filter(v => v && v.VersionID).map((versiyon) => (
                  <TableRow key={versiyon.VersionID} hover>
                    <TableCell>
                      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                        <Chip 
                          label={`V${versiyon.VersionID}`} 
                          color="primary" 
                          size="small" 
                        />
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip 
                        label={versiyon.ListeTipi} 
                        color="secondary" 
                        size="small" 
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontSize="0.85rem">
                        {versiyon.DosyaAdi}
                      </Typography>
                      {versiyon.Aciklama && (
                        <Typography variant="caption" color="text.secondary" display="block">
                          {versiyon.Aciklama}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" fontWeight="700">
                        {versiyon.KayitSayisi?.toLocaleString('tr-TR')}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontSize="0.85rem">
                        <DateDisplay date={versiyon.YuklemeTarihi} format="datetime" />
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontSize="0.85rem">
                        {versiyon.YukleyenKullanici || '-'}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Tooltip title="Detaylı Karşılaştırma">
                        <IconButton
                          size="small"
                          color="info"
                          onClick={() => handleDetayAc(versiyon)}
                        >
                          <InfoIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Detay Dialog */}
      <Dialog 
        open={detayDialog} 
        onClose={() => setDetayDialog(false)}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>
          Versiyon Karşılaştırma - V{secilenVersiyon?.VersionID}
        </DialogTitle>
        <DialogContent>
          {detayLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
              <LoadingSpinner size={40} />
            </Box>
          ) : versiyonDetay ? (
            <Box>
              {/* Versiyon Bilgileri */}
              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={12} md={6}>
                  <Typography variant="body2" color="textSecondary">
                    Liste Tipi
                  </Typography>
                  <Typography variant="body1" fontWeight="medium">
                    {versiyonDetay?.version.ListeTipi}
                  </Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="body2" color="textSecondary">
                    Dosya Adı
                  </Typography>
                  <Typography variant="body1" fontWeight="medium">
                    {versiyonDetay?.version.DosyaAdi}
                  </Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="body2" color="textSecondary">
                    Toplam Kayıt Sayısı
                  </Typography>
                  <Typography variant="body1" fontWeight="medium">
                    {versiyonDetay?.version.KayitSayisi?.toLocaleString('tr-TR')} işlem
                  </Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="body2" color="textSecondary">
                    Yükleme Tarihi
                  </Typography>
                  <Typography variant="body1" fontWeight="medium">
                    {formatDateTime(versiyonDetay?.version.YuklemeTarihi)}
                  </Typography>
                </Grid>
                {versiyonDetay?.version.YukleyenKullanici && (
                  <Grid item xs={12} md={6}>
                    <Typography variant="body2" color="textSecondary">
                      Yükleyen Kullanıcı
                    </Typography>
                    <Typography variant="body1" fontWeight="medium">
                      {versiyonDetay?.version.YukleyenKullanici}
                    </Typography>
                  </Grid>
                )}
                {versiyonDetay?.version.Aciklama && (
                  <Grid item xs={12}>
                    <Typography variant="body2" color="textSecondary">
                      Özet
                    </Typography>
                    <Typography variant="body1" fontWeight="medium">
                      {versiyonDetay?.version.Aciklama}
                    </Typography>
                  </Grid>
                )}
              </Grid>

              <Divider sx={{ my: 2 }} />

              {/* Değişiklik Özeti */}
              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Değişiklik Özeti
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={4}>
                    <Paper sx={{ p: 2, bgcolor: 'success.light', color: 'success.contrastText' }}>
                      <Typography variant="h4" fontWeight="bold">
                        {versiyonDetay?.summary?.eklenen || 0}
                      </Typography>
                      <Typography variant="body2">Eklenen İşlem</Typography>
                    </Paper>
                  </Grid>
                  <Grid item xs={4}>
                    <Paper sx={{ p: 2, bgcolor: 'warning.light', color: 'warning.contrastText' }}>
                      <Typography variant="h4" fontWeight="bold">
                        {versiyonDetay?.summary?.guncellenen || 0}
                      </Typography>
                      <Typography variant="body2">Güncellenen İşlem</Typography>
                    </Paper>
                  </Grid>
                  <Grid item xs={4}>
                    <Paper sx={{ p: 2, bgcolor: 'error.light', color: 'error.contrastText' }}>
                      <Typography variant="h4" fontWeight="bold">
                        {versiyonDetay?.summary?.silinen || 0}
                      </Typography>
                      <Typography variant="body2">Silinen İşlem</Typography>
                    </Paper>
                  </Grid>
                </Grid>
              </Box>

              {/* Eklenen İşlemler */}
              {versiyonDetay?.eklenenler?.length > 0 && (
                <Box sx={{ mb: 3 }}>
                  <Typography variant="subtitle2" gutterBottom color="success.main">
                    ✅ Eklenen İşlemler ({versiyonDetay.eklenenler.length})
                  </Typography>
                  <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 300 }}>
                    <Table size="small" stickyHeader>
                      <TableHead>
                        <TableRow>
                          <TableCell>HUV Kodu</TableCell>
                          <TableCell>İşlem Adı</TableCell>
                          <TableCell>Birim</TableCell>
                          <TableCell>Ana Dal</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {versiyonDetay.eklenenler.map((islem, index) => (
                          <TableRow key={index} hover>
                            <TableCell>{islem.HuvKodu}</TableCell>
                            <TableCell>{islem.IslemAdi}</TableCell>
                            <TableCell>
                              {islem.Birim ? `${islem.Birim.toFixed(2)} TL` : '-'}
                            </TableCell>
                            <TableCell>{islem.BolumAdi || '-'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Box>
              )}

              {/* Güncellenen İşlemler */}
              {versiyonDetay?.guncellenenler?.length > 0 && (
                <Box sx={{ mb: 3 }}>
                  <Typography variant="subtitle2" gutterBottom color="warning.main">
                    🔄 Güncellenen İşlemler ({versiyonDetay.guncellenenler.length})
                  </Typography>
                  <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 300 }}>
                    <Table size="small" stickyHeader>
                      <TableHead>
                        <TableRow>
                          <TableCell>HUV Kodu</TableCell>
                          <TableCell>İşlem Adı</TableCell>
                          <TableCell>Eski Birim</TableCell>
                          <TableCell>Yeni Birim</TableCell>
                          <TableCell>Değişen Alanlar</TableCell>
                          <TableCell>Ana Dal</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {versiyonDetay.guncellenenler.map((islem, index) => {
                          const degisiklikler = [];
                          if (islem.BirimDegisti) degisiklikler.push('Birim');
                          if (islem.IslemAdiDegisti) degisiklikler.push('İşlem Adı');
                          if (islem.SutKoduDegisti) degisiklikler.push('SUT Kodu');
                          if (islem.NotDegisti) degisiklikler.push('Not');
                          
                          return (
                            <TableRow key={index} hover>
                              <TableCell>{islem.HuvKodu}</TableCell>
                              <TableCell>
                                {islem.IslemAdiDegisti ? (
                                  <Box>
                                    <Typography variant="caption" color="text.secondary" sx={{ textDecoration: 'line-through' }}>
                                      {islem.EskiIslemAdi}
                                    </Typography>
                                    <Typography variant="body2">{islem.IslemAdi}</Typography>
                                  </Box>
                                ) : (
                                  islem.IslemAdi
                                )}
                              </TableCell>
                              <TableCell>
                                {islem.EskiBirim ? `${islem.EskiBirim.toFixed(2)} TL` : '-'}
                              </TableCell>
                              <TableCell>
                                {islem.Birim ? `${islem.Birim.toFixed(2)} TL` : '-'}
                              </TableCell>
                              <TableCell>
                                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                                  {degisiklikler.map((deg, i) => (
                                    <Chip 
                                      key={i}
                                      label={deg} 
                                      size="small" 
                                      color="warning"
                                      variant="outlined"
                                    />
                                  ))}
                                </Box>
                              </TableCell>
                              <TableCell>{islem.BolumAdi || '-'}</TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Box>
              )}

              {/* Silinen İşlemler */}
              {versiyonDetay?.silinenler?.length > 0 && (
                <Box sx={{ mb: 3 }}>
                  <Typography variant="subtitle2" gutterBottom color="error.main">
                    ❌ Silinen İşlemler ({versiyonDetay.silinenler.length})
                  </Typography>
                  <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 300 }}>
                    <Table size="small" stickyHeader>
                      <TableHead>
                        <TableRow>
                          <TableCell>HUV Kodu</TableCell>
                          <TableCell>İşlem Adı</TableCell>
                          <TableCell>Birim</TableCell>
                          <TableCell>Ana Dal</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {versiyonDetay.silinenler.map((islem, index) => (
                          <TableRow key={index} hover>
                            <TableCell>{islem.HuvKodu}</TableCell>
                            <TableCell>{islem.IslemAdi}</TableCell>
                            <TableCell>
                              {islem.Birim ? `${islem.Birim.toFixed(2)} TL` : '-'}
                            </TableCell>
                            <TableCell>{islem.BolumAdi || '-'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Box>
              )}

              {/* Değişiklik Yoksa */}
              {(versiyonDetay?.summary?.eklenen || 0) === 0 &&
               (versiyonDetay?.summary?.guncellenen || 0) === 0 && (
                <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1, textAlign: 'center' }}>
                  <Typography variant="body2" color="textSecondary">
                    Bu versiyonda henüz değişiklik tespit edilemedi. SQL sorguları kontrol ediliyor.
                  </Typography>
                </Box>
              )}
            </Box>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetayDialog(false)}>Kapat</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

// ============================================
// MAIN VERSİYONLAR COMPONENT
// ============================================
function Versiyonlar() {
  const [activeTab, setActiveTab] = useState(0);

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <PageHeader 
        title="HUV Liste Yönetimi" 
        subtitle="Excel import, versiyon karşılaştırma ve liste takibi"
        icon="📚"
      />

      <Paper elevation={2}>
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          variant="scrollable"
          scrollButtons="auto"
          sx={{ borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab 
            label="Yeni Liste Yükle" 
            icon={<CloudUploadIcon />} 
            iconPosition="start"
          />
          <Tab 
            label="Versiyon Geçmişi" 
            icon={<AssessmentIcon />} 
            iconPosition="start"
          />
        </Tabs>

        <TabPanel value={activeTab} index={0}>
          <ExcelImportTab />
        </TabPanel>

        <TabPanel value={activeTab} index={1}>
          <VersiyonListesiTab />
        </TabPanel>
      </Paper>
    </Container>
  );
}

export default Versiyonlar;




