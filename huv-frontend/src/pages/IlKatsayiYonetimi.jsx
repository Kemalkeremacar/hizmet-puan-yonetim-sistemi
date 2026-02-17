// ============================================
// İL KATSAYILARI YÖNETİMİ SAYFASI
// ============================================
// İl Katsayıları Yönetimi - Import, Versiyon Takibi
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
  Close as CloseIcon,
  Link as LinkIcon
} from '@mui/icons-material';
import { adminService } from '../services/adminService';
import { showError, showSuccess } from '../utils/toast';
import { LoadingSpinner, ErrorAlert, EmptyState, PageHeader, DateDisplay } from '../components/common';
import IlKatsayiExcelImportTab from '../components/admin/IlKatsayiExcelImportTab';
import BirlesikListe from './BirlesikListe';
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
      const response = await adminService.getVersiyonlar('ILKATSAYI');
      const data = response?.data || [];
      setVersiyonlar(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Versiyonlar yüklenemedi:', {
        message: err.message,
        response: err.response?.data,
        timestamp: new Date().toISOString()
      });
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
      setVersiyonDetay(response.data);
    } catch (err) {
      console.error('Versiyon detayı yüklenemedi:', {
        message: err.message,
        versionId: versiyon.VersionID,
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
                  <TableCell colSpan={7} align="center">
                    <LoadingSpinner message="Versiyonlar yükleniyor..." />
                  </TableCell>
                </TableRow>
              ) : versiyonlar.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center">
                    <EmptyState message="Henüz import yapılmamış" />
                  </TableCell>
                </TableRow>
              ) : (
                versiyonlar.map((versiyon) => (
                  <TableRow key={versiyon.VersionID} hover>
                    <TableCell>
                      <Typography variant="body2" fontWeight="500">
                        #{versiyon.VersionID}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip 
                        label={versiyon.ListeTipi || 'ILKATSAYI'} 
                        size="small" 
                        color="info"
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" noWrap sx={{ maxWidth: 300 }}>
                        {versiyon.DosyaAdi || '-'}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2">
                        {versiyon.KayitSayisi || 0}
                      </Typography>
                      {versiyon.EklenenSayisi > 0 || versiyon.GuncellenenSayisi > 0 || versiyon.SilinenSayisi > 0 ? (
                        <Box sx={{ mt: 0.5 }}>
                          {versiyon.EklenenSayisi > 0 && (
                            <Chip label={`+${versiyon.EklenenSayisi}`} size="small" color="success" sx={{ mr: 0.5, height: 18 }} />
                          )}
                          {versiyon.GuncellenenSayisi > 0 && (
                            <Chip label={`~${versiyon.GuncellenenSayisi}`} size="small" color="warning" sx={{ mr: 0.5, height: 18 }} />
                          )}
                          {versiyon.SilinenSayisi > 0 && (
                            <Chip label={`-${versiyon.SilinenSayisi}`} size="small" color="error" sx={{ height: 18 }} />
                          )}
                        </Box>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <DateDisplay date={versiyon.YuklemeTarihi} />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {versiyon.YukleyenKullanici || '-'}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Tooltip title="Detayları Görüntüle">
                        <IconButton
                          size="small"
                          color="primary"
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
        onClose={() => {
          setDetayDialog(false);
          setSecilenVersiyon(null);
          setVersiyonDetay(null);
        }}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6">
              Versiyon Detayları - #{secilenVersiyon?.VersionID}
            </Typography>
            <IconButton
              size="small"
              onClick={() => {
                setDetayDialog(false);
                setSecilenVersiyon(null);
                setVersiyonDetay(null);
              }}
            >
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          {detayLoading ? (
            <LoadingSpinner message="Detaylar yükleniyor..." />
          ) : versiyonDetay ? (
            <Box>
              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={12} sm={6}>
                  <Typography variant="caption" color="text.secondary">Dosya Adı</Typography>
                  <Typography variant="body1">{versiyonDetay.version?.dosyaAdi || '-'}</Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="caption" color="text.secondary">Yükleme Tarihi</Typography>
                  <Typography variant="body1">
                    <DateDisplay date={versiyonDetay.version?.yuklemeTarihi} />
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="caption" color="text.secondary">Kayıt Sayısı</Typography>
                  <Typography variant="body1">{versiyonDetay.version?.kayitSayisi || 0}</Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="caption" color="text.secondary">Yükleyen</Typography>
                  <Typography variant="body1">{versiyonDetay.version?.yukleyenKullanici || '-'}</Typography>
                </Grid>
              </Grid>

              <Divider sx={{ my: 2 }} />

              <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600 }}>
                Özet
              </Typography>
              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={6} sm={3}>
                  <Paper sx={{ p: 2, bgcolor: 'success.light', textAlign: 'center' }}>
                    <Typography variant="h4" color="success.dark">
                      {versiyonDetay.summary?.eklenen || 0}
                    </Typography>
                    <Typography variant="caption">Eklenen</Typography>
                  </Paper>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Paper sx={{ p: 2, bgcolor: 'warning.light', textAlign: 'center' }}>
                    <Typography variant="h4" color="warning.dark">
                      {versiyonDetay.summary?.guncellenen || 0}
                    </Typography>
                    <Typography variant="caption">Güncellenen</Typography>
                  </Paper>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Paper sx={{ p: 2, bgcolor: 'error.light', textAlign: 'center' }}>
                    <Typography variant="h4" color="error.dark">
                      {versiyonDetay.summary?.silinen || 0}
                    </Typography>
                    <Typography variant="caption">Silinen</Typography>
                  </Paper>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Paper sx={{ p: 2, bgcolor: 'info.light', textAlign: 'center' }}>
                    <Typography variant="h4" color="info.dark">
                      {versiyonDetay.summary?.eklenen + versiyonDetay.summary?.guncellenen + versiyonDetay.summary?.silinen || 0}
                    </Typography>
                    <Typography variant="caption">Toplam Değişiklik</Typography>
                  </Paper>
                </Grid>
              </Grid>

              {versiyonDetay.eklenenler && versiyonDetay.eklenenler.length > 0 && (
                <Box sx={{ mb: 3 }}>
                  <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                    Eklenen İl Katsayıları ({versiyonDetay.eklenenler.length})
                  </Typography>
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>İl Adı</TableCell>
                          <TableCell align="center">Plaka</TableCell>
                          <TableCell align="right">Katsayı</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {versiyonDetay.eklenenler.slice(0, 10).map((item, idx) => (
                          <TableRow key={idx}>
                            <TableCell>{item.IlAdi || item.ilAdi}</TableCell>
                            <TableCell align="center">{item.PlakaKodu || item.plakaKodu || '-'}</TableCell>
                            <TableCell align="right">{item.Katsayi || item.katsayi}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                  {versiyonDetay.eklenenler.length > 10 && (
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                      ... ve {versiyonDetay.eklenenler.length - 10} kayıt daha
                    </Typography>
                  )}
                </Box>
              )}

              {versiyonDetay.guncellenenler && versiyonDetay.guncellenenler.length > 0 && (
                <Box sx={{ mb: 3 }}>
                  <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                    Güncellenen İl Katsayıları ({versiyonDetay.guncellenenler.length})
                  </Typography>
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>İl Adı</TableCell>
                          <TableCell align="center">Plaka</TableCell>
                          <TableCell align="right">Eski Katsayı</TableCell>
                          <TableCell align="right">Yeni Katsayı</TableCell>
                          <TableCell align="right">Değişim</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {versiyonDetay.guncellenenler.slice(0, 10).map((item, idx) => (
                          <TableRow key={idx}>
                            <TableCell>{item.IlAdi || item.ilAdi}</TableCell>
                            <TableCell align="center">{item.PlakaKodu || item.plakaKodu || '-'}</TableCell>
                            <TableCell align="right">{item.EskiKatsayi || item.eskiKatsayi}</TableCell>
                            <TableCell align="right">{item.YeniKatsayi || item.yeniKatsayi}</TableCell>
                            <TableCell align="right">
                              {((item.YeniKatsayi || item.yeniKatsayi) - (item.EskiKatsayi || item.eskiKatsayi)).toFixed(2)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                  {versiyonDetay.guncellenenler.length > 10 && (
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                      ... ve {versiyonDetay.guncellenenler.length - 10} kayıt daha
                    </Typography>
                  )}
                </Box>
              )}

              {versiyonDetay.silinenler && versiyonDetay.silinenler.length > 0 && (
                <Box>
                  <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                    Silinen İl Katsayıları ({versiyonDetay.silinenler.length})
                  </Typography>
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>İl Adı</TableCell>
                          <TableCell align="center">Plaka</TableCell>
                          <TableCell align="right">Katsayı</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {versiyonDetay.silinenler.slice(0, 10).map((item, idx) => (
                          <TableRow key={idx}>
                            <TableCell>{item.IlAdi || item.ilAdi}</TableCell>
                            <TableCell align="center">{item.PlakaKodu || item.plakaKodu || '-'}</TableCell>
                            <TableCell align="right">{item.Katsayi || item.katsayi}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                  {versiyonDetay.silinenler.length > 10 && (
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                      ... ve {versiyonDetay.silinenler.length - 10} kayıt daha
                    </Typography>
                  )}
                </Box>
              )}
            </Box>
          ) : (
            <EmptyState message="Detay bilgisi bulunamadı" />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setDetayDialog(false);
            setSecilenVersiyon(null);
            setVersiyonDetay(null);
          }}>
            Kapat
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}


// ============================================
// MAIN İL KATSAYILARI YÖNETİMİ COMPONENT
// ============================================
function IlKatsayiYonetimi() {
  const [activeTab, setActiveTab] = useState(0);

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <PageHeader 
        title="İl Katsayıları Yönetimi" 
        subtitle="Excel import ve liste takibi"
        icon="📊"
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
          <Tab 
            label="Birleşik Liste" 
            icon={<LinkIcon />} 
            iconPosition="start"
          />
        </Tabs>

        <TabPanel value={activeTab} index={0}>
          <IlKatsayiExcelImportTab />
        </TabPanel>

        <TabPanel value={activeTab} index={1}>
          <VersiyonListesiTab />
        </TabPanel>

        <TabPanel value={activeTab} index={2}>
          <Box sx={{ p: 0 }}>
            <BirlesikListe />
          </Box>
        </TabPanel>
      </Paper>
    </Container>
  );
}

export default IlKatsayiYonetimi;
