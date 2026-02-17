// ============================================
// SUT YÖNETİMİ SAYFASI
// ============================================
// SUT Liste Yönetimi - Import, Versiyon Takibi
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
  Tooltip
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Info as InfoIcon,
  CloudUpload as CloudUploadIcon,
  Assessment as AssessmentIcon,
  Close as CloseIcon
} from '@mui/icons-material';
import { adminService } from '../services/adminService';
import { showError, showSuccess } from '../utils/toast';
import { LoadingSpinner, ErrorAlert, EmptyState, PageHeader, DateDisplay } from '../components/common';
import SutExcelImportTab from '../components/admin/SutExcelImportTab';
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
      const response = await adminService.getVersiyonlar('SUT');
      const data = response?.data || [];
      setVersiyonlar(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Versiyonlar yüklenemedi:', {
        message: err.message,
        response: err.response?.data,
        timestamp: new Date().toISOString()
      });
      setError(err);
      setVersiyonlar([]); // Hata durumunda boş array
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
      setVersiyonDetay(response.data);
    } catch (err) {
      console.error('Versiyon detayı yüklenemedi:', {
        message: err.message,
        versionId: id,
        timestamp: new Date().toISOString()
      });
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
        maxWidth="xl"
        fullWidth
        PaperProps={{
          sx: {
            maxHeight: '90vh'
          }
        }}
      >
        <DialogTitle sx={{ pb: 2, borderBottom: 1, borderColor: 'divider' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box>
              <Typography variant="h5" fontWeight="600">
                Versiyon Karşılaştırma
              </Typography>
              <Chip 
                label={`V${secilenVersiyon?.VersionID}`} 
                color="primary" 
                size="small"
                sx={{ mt: 1 }}
              />
            </Box>
            <IconButton
              onClick={() => setDetayDialog(false)}
              size="small"
            >
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          {detayLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
              <LoadingSpinner size={40} />
            </Box>
          ) : versiyonDetay ? (
            <Box>
              {/* Versiyon Bilgileri */}
              <Paper variant="outlined" sx={{ p: 2, mb: 3, bgcolor: 'grey.50' }}>
                <Typography variant="subtitle1" fontWeight="600" gutterBottom>
                  Versiyon Bilgileri
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={4}>
                    <Typography variant="caption" color="textSecondary" display="block">
                      Liste Tipi
                    </Typography>
                    <Chip 
                      label={versiyonDetay?.version.ListeTipi || '-'} 
                      size="small" 
                      color="secondary"
                      sx={{ mt: 0.5 }}
                    />
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <Typography variant="caption" color="textSecondary" display="block">
                      Toplam Kayıt
                    </Typography>
                    <Typography variant="body1" fontWeight="600" sx={{ mt: 0.5 }}>
                      {versiyonDetay?.version.KayitSayisi?.toLocaleString('tr-TR') || 0} işlem
                    </Typography>
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <Typography variant="caption" color="textSecondary" display="block">
                      Yükleme Tarihi
                    </Typography>
                    <Typography variant="body2" fontWeight="500" sx={{ mt: 0.5 }}>
                      {formatDateTime(versiyonDetay?.version.YuklemeTarihi)}
                    </Typography>
                  </Grid>
                  <Grid item xs={12}>
                    <Typography variant="caption" color="textSecondary" display="block">
                      Dosya Adı
                    </Typography>
                    <Typography variant="body2" sx={{ mt: 0.5, wordBreak: 'break-word' }}>
                      {versiyonDetay?.version.DosyaAdi || '-'}
                    </Typography>
                  </Grid>
                  {versiyonDetay?.version.YukleyenKullanici && (
                    <Grid item xs={12} md={6}>
                      <Typography variant="caption" color="textSecondary" display="block">
                        Yükleyen Kullanıcı
                      </Typography>
                      <Typography variant="body2" fontWeight="500" sx={{ mt: 0.5 }}>
                        {versiyonDetay.version.YukleyenKullanici}
                      </Typography>
                    </Grid>
                  )}
                  {versiyonDetay?.version.Aciklama && (
                    <Grid item xs={12}>
                      <Typography variant="caption" color="textSecondary" display="block">
                        Özet
                      </Typography>
                      <Typography variant="body2" sx={{ mt: 0.5 }}>
                        {versiyonDetay.version.Aciklama}
                      </Typography>
                    </Grid>
                  )}
                </Grid>
              </Paper>

              {/* Değişiklik Özeti */}
              <Box sx={{ mb: 3 }}>
                <Typography variant="h6" gutterBottom fontWeight="600">
                  Değişiklik Özeti
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={3}>
                    <Paper 
                      sx={{ 
                        p: 2.5, 
                        bgcolor: 'success.main', 
                        color: 'white',
                        borderRadius: 2,
                        boxShadow: 2,
                        transition: 'transform 0.2s',
                        '&:hover': { transform: 'translateY(-2px)' }
                      }}
                    >
                      <Typography variant="h3" fontWeight="bold" gutterBottom>
                        {versiyonDetay?.summary?.eklenen || 0}
                      </Typography>
                      <Typography variant="body2" sx={{ opacity: 0.9 }}>
                        Eklenen İşlem
                      </Typography>
                    </Paper>
                  </Grid>
                  <Grid item xs={12} md={3}>
                    <Paper 
                      sx={{ 
                        p: 2.5, 
                        bgcolor: 'warning.main', 
                        color: 'white',
                        borderRadius: 2,
                        boxShadow: 2,
                        transition: 'transform 0.2s',
                        '&:hover': { transform: 'translateY(-2px)' }
                      }}
                    >
                      <Typography variant="h3" fontWeight="bold" gutterBottom>
                        {versiyonDetay?.summary?.guncellenen || 0}
                      </Typography>
                      <Typography variant="body2" sx={{ opacity: 0.9 }}>
                        Güncellenen İşlem
                      </Typography>
                    </Paper>
                  </Grid>
                  <Grid item xs={12} md={3}>
                    <Paper 
                      sx={{ 
                        p: 2.5, 
                        bgcolor: 'error.main', 
                        color: 'white',
                        borderRadius: 2,
                        boxShadow: 2,
                        transition: 'transform 0.2s',
                        '&:hover': { transform: 'translateY(-2px)' }
                      }}
                    >
                      <Typography variant="h3" fontWeight="bold" gutterBottom>
                        {versiyonDetay?.summary?.silinen || 0}
                      </Typography>
                      <Typography variant="body2" sx={{ opacity: 0.9 }}>
                        Silinen İşlem
                      </Typography>
                    </Paper>
                  </Grid>
                  <Grid item xs={12} md={3}>
                    <Paper 
                      sx={{ 
                        p: 2.5, 
                        bgcolor: 'info.main', 
                        color: 'white',
                        borderRadius: 2,
                        boxShadow: 2,
                        transition: 'transform 0.2s',
                        '&:hover': { transform: 'translateY(-2px)' }
                      }}
                    >
                      <Typography variant="h3" fontWeight="bold" gutterBottom>
                        {versiyonDetay?.summary?.degismeyen || 0}
                      </Typography>
                      <Typography variant="body2" sx={{ opacity: 0.9 }}>
                        Değişmeyen İşlem
                      </Typography>
                    </Paper>
                  </Grid>
                </Grid>
                
                {/* Toplam */}
                {versiyonDetay?.summary?.toplam && (
                  <Box sx={{ mt: 2, textAlign: 'center' }}>
                    <Typography variant="body2" color="textSecondary">
                      Toplam: <strong>{versiyonDetay.summary.toplam.toLocaleString('tr-TR')}</strong> işlem
                    </Typography>
                  </Box>
                )}
              </Box>

              {/* İlk Versiyon Kontrolü */}
              {(!versiyonDetay?.summary || 
                (versiyonDetay.summary.eklenen > 0 &&
                 versiyonDetay.summary.guncellenen === 0 &&
                 versiyonDetay.summary.silinen === 0 &&
                 versiyonDetay.summary.degismeyen === 0 &&
                 versiyonDetay.summary.eklenen === versiyonDetay.summary.toplam)) ? (
                <Box sx={{ mt: 2, p: 3, bgcolor: 'success.lighter', borderRadius: 2, textAlign: 'center' }}>
                  <InfoIcon sx={{ fontSize: 48, color: 'success.main', mb: 1 }} />
                  <Typography variant="body1" fontWeight="medium" gutterBottom>
                    Bu versiyon ilk versiyon
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Tüm {versiyonDetay?.summary?.eklenen || 0} işlem yeni kayıt olarak eklendi. 
                    Karşılaştırma yapmak için en az iki versiyon olmalıdır.
                  </Typography>
                </Box>
              ) : versiyonDetay?.summary?.eklenen === 0 &&
                 versiyonDetay.summary.guncellenen === 0 &&
                 versiyonDetay.summary.silinen === 0 &&
                 versiyonDetay.summary.degismeyen > 0 ? (
                <Box sx={{ mt: 2, p: 3, bgcolor: 'info.lighter', borderRadius: 2, textAlign: 'center' }}>
                  <InfoIcon sx={{ fontSize: 48, color: 'info.main', mb: 1 }} />
                  <Typography variant="body1" fontWeight="medium" gutterBottom>
                    Değişiklik yok
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Bu versiyonda hiçbir değişiklik yapılmadı. Tüm {versiyonDetay.summary.degismeyen} işlem aynı kaldı.
                  </Typography>
                </Box>
              ) : (
                <>
                  {/* Detaylı Değişiklikler */}
                  <Divider sx={{ my: 3 }} />
                  
                  {/* Eklenen İşlemler */}
                  {versiyonDetay?.eklenenler && versiyonDetay.eklenenler.length > 0 && (
                    <Box sx={{ mb: 3 }}>
                      <Typography variant="h6" gutterBottom fontWeight="600" color="success.main">
                        Eklenen İşlemler ({versiyonDetay.eklenenler.length})
                      </Typography>
                      <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 300 }}>
                        <Table size="small" stickyHeader>
                          <TableHead>
                            <TableRow>
                              <TableCell sx={{ fontWeight: 600 }}>SUT Kodu</TableCell>
                              <TableCell sx={{ fontWeight: 600 }}>İşlem Adı</TableCell>
                              <TableCell align="right" sx={{ fontWeight: 600 }}>Puan</TableCell>
                              <TableCell sx={{ fontWeight: 600 }}>Ana Başlık</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {versiyonDetay.eklenenler.map((item, idx) => (
                              <TableRow key={idx} hover>
                                <TableCell>
                                  <Chip label={item.SutKodu} size="small" color="success" variant="outlined" />
                                </TableCell>
                                <TableCell>
                                  <Typography variant="body2" noWrap sx={{ maxWidth: 300 }}>
                                    {item.IslemAdi}
                                  </Typography>
                                </TableCell>
                                <TableCell align="right">
                                  <Typography variant="body2" fontWeight="600">
                                    {item.Puan?.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '-'}
                                  </Typography>
                                </TableCell>
                                <TableCell>
                                  <Typography variant="body2" color="textSecondary">
                                    {item.AnaBaslikAdi || '-'}
                                  </Typography>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </Box>
                  )}

                  {/* Güncellenen İşlemler */}
                  {versiyonDetay?.guncellenenler && versiyonDetay.guncellenenler.length > 0 && (
                    <Box sx={{ mb: 3 }}>
                      <Typography variant="h6" gutterBottom fontWeight="600" color="warning.main">
                        Güncellenen İşlemler ({versiyonDetay.guncellenenler.length})
                      </Typography>
                      <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 300 }}>
                        <Table size="small" stickyHeader>
                          <TableHead>
                            <TableRow>
                              <TableCell sx={{ fontWeight: 600 }}>SUT Kodu</TableCell>
                              <TableCell sx={{ fontWeight: 600 }}>İşlem Adı</TableCell>
                              <TableCell align="right" sx={{ fontWeight: 600 }}>Eski Puan</TableCell>
                              <TableCell align="right" sx={{ fontWeight: 600 }}>Yeni Puan</TableCell>
                              <TableCell align="right" sx={{ fontWeight: 600 }}>Fark</TableCell>
                              <TableCell sx={{ fontWeight: 600 }}>Değişen Alanlar</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {versiyonDetay.guncellenenler.map((item, idx) => {
                              const fark = item.YeniPuan && item.EskiPuan 
                                ? item.YeniPuan - item.EskiPuan 
                                : null;
                              
                              // Değişen alanları tespit et
                              const degisiklikler = [];
                              if (item.PuanDegisti) degisiklikler.push('Puan');
                              if (item.IslemAdiDegisti) degisiklikler.push('İşlem Adı');
                              if (item.AciklamaDegisti) degisiklikler.push('Açıklama');
                              
                              return (
                                <TableRow key={idx} hover>
                                  <TableCell>
                                    <Chip label={item.SutKodu} size="small" color="warning" variant="outlined" />
                                  </TableCell>
                                  <TableCell>
                                    <Typography variant="body2" noWrap sx={{ maxWidth: 300 }}>
                                      {item.IslemAdi}
                                    </Typography>
                                    {item.IslemAdiDegisti && item.EskiIslemAdi && (
                                      <Typography variant="caption" color="text.secondary" display="block" sx={{ textDecoration: 'line-through' }}>
                                        {item.EskiIslemAdi}
                                      </Typography>
                                    )}
                                  </TableCell>
                                  <TableCell align="right">
                                    <Typography variant="body2" color="textSecondary">
                                      {item.EskiPuan?.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '-'}
                                    </Typography>
                                  </TableCell>
                                  <TableCell align="right">
                                    <Typography variant="body2" fontWeight="600">
                                      {item.YeniPuan?.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '-'}
                                    </Typography>
                                  </TableCell>
                                  <TableCell align="right">
                                    {fark !== null && (
                                      <Chip 
                                        label={fark > 0 ? `+${fark.toFixed(2)}` : fark.toFixed(2)}
                                        size="small"
                                        color={fark > 0 ? 'error' : 'success'}
                                        variant="outlined"
                                      />
                                    )}
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
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </Box>
                  )}

                  {/* Silinen İşlemler */}
                  {versiyonDetay?.silinenler && versiyonDetay.silinenler.length > 0 && (
                    <Box sx={{ mb: 3 }}>
                      <Typography variant="h6" gutterBottom fontWeight="600" color="error.main">
                        Silinen İşlemler ({versiyonDetay.silinenler.length})
                      </Typography>
                      <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 300 }}>
                        <Table size="small" stickyHeader>
                          <TableHead>
                            <TableRow>
                              <TableCell sx={{ fontWeight: 600 }}>SUT Kodu</TableCell>
                              <TableCell sx={{ fontWeight: 600 }}>İşlem Adı</TableCell>
                              <TableCell align="right" sx={{ fontWeight: 600 }}>Puan</TableCell>
                              <TableCell sx={{ fontWeight: 600 }}>Ana Başlık</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {versiyonDetay.silinenler.map((item, idx) => (
                              <TableRow key={idx} hover>
                                <TableCell>
                                  <Chip label={item.SutKodu} size="small" color="error" variant="outlined" />
                                </TableCell>
                                <TableCell>
                                  <Typography variant="body2" noWrap sx={{ maxWidth: 300 }}>
                                    {item.IslemAdi}
                                  </Typography>
                                </TableCell>
                                <TableCell align="right">
                                  <Typography variant="body2" color="textSecondary">
                                    {item.Puan?.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '-'}
                                  </Typography>
                                </TableCell>
                                <TableCell>
                                  <Typography variant="body2" color="textSecondary">
                                    {item.AnaBaslikAdi || '-'}
                                  </Typography>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </Box>
                  )}
                </>
              )}
            </Box>
          ) : null}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2, borderTop: 1, borderColor: 'divider' }}>
          <Button 
            onClick={() => setDetayDialog(false)} 
            variant="contained"
            color="primary"
          >
            Kapat
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

// ============================================
// MAIN SUT YÖNETİMİ COMPONENT
// ============================================
function SutYonetimi() {
  const [activeTab, setActiveTab] = useState(0);

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <PageHeader 
        title="SUT Liste Yönetimi" 
        subtitle="Excel import ve liste takibi"
        icon="📋"
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
          <SutExcelImportTab />
        </TabPanel>

        <TabPanel value={activeTab} index={1}>
          <VersiyonListesiTab />
        </TabPanel>
      </Paper>
    </Container>
  );
}

export default SutYonetimi;




