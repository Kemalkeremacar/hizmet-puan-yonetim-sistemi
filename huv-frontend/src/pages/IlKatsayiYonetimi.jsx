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
  Tooltip,
  TextField,
  Accordion,
  AccordionSummary,
  AccordionDetails
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Info as InfoIcon,
  CloudUpload as CloudUploadIcon,
  Assessment as AssessmentIcon,
  Close as CloseIcon,
  List as ListIcon,
  ExpandMore as ExpandMoreIcon
} from '@mui/icons-material';
import { adminService } from '../services/adminService';
import { showError, showSuccess } from '../utils/toast';
import { LoadingSpinner, ErrorAlert, EmptyState, PageHeader, DateDisplay } from '../components/common';
import IlKatsayiExcelImportTab from '../components/admin/IlKatsayiExcelImportTab';
import { formatDateShort, formatDateTime } from '../utils/dateUtils';
import { ilKatsayiService } from '../services/ilKatsayiService';

// Tab Panel Component
function TabPanel({ children, value, index }) {
  return (
    <div hidden={value !== index}>
      {value === index && (
        <Box 
          sx={{ 
            pt: 3,
            pb: 3,
            px: 2,
            minHeight: '60vh',
            maxHeight: 'calc(100vh - 300px)',
            overflowY: 'auto',
            '&::-webkit-scrollbar': {
              width: '8px',
            },
            '&::-webkit-scrollbar-track': {
              background: 'rgba(0,0,0,0.05)',
              borderRadius: '4px',
            },
            '&::-webkit-scrollbar-thumb': {
              background: 'rgba(0,0,0,0.2)',
              borderRadius: '4px',
              '&:hover': {
                background: 'rgba(0,0,0,0.3)',
              },
            },
          }}
        >
          {children}
        </Box>
      )}
    </div>
  );
}

// ============================================
// İl Katsayıları Listesi Tab
// ============================================
function IlKatsayilariListesiTab() {
  const [ilKatsayilari, setIlKatsayilari] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  // ============================================
  // İl katsayılarını yükle
  // ============================================
  const fetchIlKatsayilari = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await ilKatsayiService.getAll();
      const data = response?.data?.data || [];
      setIlKatsayilari(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('İl katsayıları yüklenemedi:', {
        message: err.message,
        response: err.response?.data,
        timestamp: new Date().toISOString()
      });
      setError(err);
      setIlKatsayilari([]);
      showError('İl katsayıları yüklenirken hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  // ============================================
  // İlk yükleme
  // ============================================
  useEffect(() => {
    fetchIlKatsayilari();
  }, []);

  // ============================================
  // Filtreleme
  // ============================================
  const filteredData = ilKatsayilari.filter(item => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      (item.ilAdi && item.ilAdi.toLowerCase().includes(search)) ||
      (item.plakaKodu && item.plakaKodu.toString().includes(search)) ||
      (item.katsayi && item.katsayi.toString().includes(search))
    );
  });

  // ============================================
  // Render
  // ============================================
  return (
    <Box>
      {/* Hata */}
      {error && <ErrorAlert message="İl katsayıları yüklenirken hata oluştu" error={error} />}

      {/* Arama ve Yenile */}
      <Paper elevation={1} sx={{ mb: 2.5, borderRadius: 2 }}>
        <Box sx={{ p: 2, display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
          <TextField
            placeholder="İl adı, plaka kodu veya katsayı ile ara..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            size="small"
            sx={{ flex: 1, minWidth: 250 }}
            InputProps={{
              sx: { borderRadius: 2 }
            }}
          />
          <Button
            size="small"
            startIcon={<RefreshIcon />}
            onClick={fetchIlKatsayilari}
            variant="outlined"
            sx={{ borderRadius: 2 }}
          >
            Yenile
          </Button>
        </Box>
      </Paper>

      {/* Tablo */}
      <Paper elevation={2} sx={{ overflow: 'hidden' }}>
        <Box sx={{ 
          p: 2.5, 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          bgcolor: 'grey.50',
          borderBottom: 1,
          borderColor: 'divider'
        }}>
          <Typography variant="h6" fontWeight="600">
            İl Katsayıları
            {filteredData.length > 0 && (
              <Chip 
                label={`${filteredData.length} il`} 
                size="small" 
                color="primary" 
                sx={{ ml: 2 }}
              />
            )}
          </Typography>
        </Box>
        <TableContainer 
          sx={{ 
            maxHeight: 'calc(100vh - 400px)',
            '&::-webkit-scrollbar': {
              width: '8px',
              height: '8px',
            },
            '&::-webkit-scrollbar-track': {
              background: 'rgba(0,0,0,0.05)',
              borderRadius: '4px',
            },
            '&::-webkit-scrollbar-thumb': {
              background: 'rgba(0,0,0,0.2)',
              borderRadius: '4px',
              '&:hover': {
                background: 'rgba(0,0,0,0.3)',
              },
            },
          }}
        >
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell sx={{ bgcolor: 'background.paper', fontWeight: 600, position: 'sticky', top: 0, zIndex: 10 }}>İl Adı</TableCell>
                <TableCell align="center" sx={{ bgcolor: 'background.paper', fontWeight: 600, position: 'sticky', top: 0, zIndex: 10 }}>Plaka Kodu</TableCell>
                <TableCell align="right" sx={{ bgcolor: 'background.paper', fontWeight: 600, position: 'sticky', top: 0, zIndex: 10 }}>Katsayı</TableCell>
                <TableCell sx={{ bgcolor: 'background.paper', fontWeight: 600, position: 'sticky', top: 0, zIndex: 10 }}>Dönem Başlangıç</TableCell>
                <TableCell sx={{ bgcolor: 'background.paper', fontWeight: 600, position: 'sticky', top: 0, zIndex: 10 }}>Dönem Bitiş</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} align="center">
                    <LoadingSpinner message="İl katsayıları yükleniyor..." />
                  </TableCell>
                </TableRow>
              ) : filteredData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center">
                    <EmptyState message={searchTerm ? "Arama sonucu bulunamadı" : "Henüz il katsayısı yüklenmemiş"} />
                  </TableCell>
                </TableRow>
              ) : (
                filteredData.map((item, index) => (
                  <TableRow 
                    key={item.ilKatsayiId || index} 
                    hover
                    sx={{
                      '&:hover': {
                        bgcolor: 'action.hover',
                      },
                      transition: 'background-color 0.2s',
                    }}
                  >
                    <TableCell>
                      <Typography variant="body2" fontWeight="500">
                        {item.ilAdi}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Chip 
                        label={item.plakaKodu || '-'} 
                        size="small" 
                        variant="outlined"
                        color="default"
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" fontWeight="600" color="primary.main">
                        {item.katsayi?.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <DateDisplay date={item.donemBaslangic} />
                    </TableCell>
                    <TableCell>
                      <DateDisplay date={item.donemBitis} />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Box>
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
  const [expandedSections, setExpandedSections] = useState({
    eklenenler: false,
    guncellenenler: false,
    silinenler: false
  });

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
    setExpandedSections({
      eklenenler: false,
      guncellenenler: false,
      silinenler: false
    });

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
      <Paper elevation={2} sx={{ overflow: 'hidden' }}>
        <Box sx={{ 
          p: 2.5, 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          bgcolor: 'grey.50',
          borderBottom: 1,
          borderColor: 'divider'
        }}>
          <Typography variant="h6" fontWeight="600">
            Versiyon Geçmişi
          </Typography>
          <Button size="small" startIcon={<RefreshIcon />} onClick={fetchVersiyonlar} variant="outlined">
            Yenile
          </Button>
        </Box>
        <TableContainer 
          sx={{ 
            maxHeight: 'calc(100vh - 400px)',
            '&::-webkit-scrollbar': {
              width: '8px',
              height: '8px',
            },
            '&::-webkit-scrollbar-track': {
              background: 'rgba(0,0,0,0.05)',
              borderRadius: '4px',
            },
            '&::-webkit-scrollbar-thumb': {
              background: 'rgba(0,0,0,0.2)',
              borderRadius: '4px',
              '&:hover': {
                background: 'rgba(0,0,0,0.3)',
              },
            },
          }}
        >
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell sx={{ bgcolor: 'background.paper', fontWeight: 600, position: 'sticky', top: 0, zIndex: 10 }}>Liste Tipi</TableCell>
                <TableCell sx={{ bgcolor: 'background.paper', fontWeight: 600, position: 'sticky', top: 0, zIndex: 10 }}>Dosya Adı</TableCell>
                <TableCell align="right" sx={{ bgcolor: 'background.paper', fontWeight: 600, position: 'sticky', top: 0, zIndex: 10 }}>Kayıt Sayısı</TableCell>
                <TableCell sx={{ bgcolor: 'background.paper', fontWeight: 600, position: 'sticky', top: 0, zIndex: 10 }}>Yükleme Tarihi</TableCell>
                <TableCell align="center" sx={{ bgcolor: 'background.paper', fontWeight: 600, position: 'sticky', top: 0, zIndex: 10 }}>İşlemler</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} align="center">
                    <LoadingSpinner message="Versiyonlar yükleniyor..." />
                  </TableCell>
                </TableRow>
              ) : versiyonlar.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center">
                    <EmptyState message="Henüz import yapılmamış" />
                  </TableCell>
                </TableRow>
              ) : (
                versiyonlar.map((versiyon) => (
                  <TableRow 
                    key={versiyon.VersionID} 
                    hover
                    sx={{
                      '&:hover': {
                        bgcolor: 'action.hover',
                      },
                      transition: 'background-color 0.2s',
                    }}
                  >
                    <TableCell>
                      <Chip 
                        label={versiyon.ListeTipi || 'ILKATSAYI'} 
                        size="small" 
                        color="info"
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" noWrap sx={{ maxWidth: { xs: 150, sm: 250, md: 300 } }}>
                        {versiyon.DosyaAdi || '-'}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" fontWeight="500">
                        {versiyon.KayitSayisi || 0}
                      </Typography>
                      {versiyon.EklenenSayisi > 0 || versiyon.GuncellenenSayisi > 0 || versiyon.SilinenSayisi > 0 ? (
                        <Box sx={{ mt: 0.5, display: 'flex', flexWrap: 'wrap', gap: 0.5, justifyContent: 'flex-end' }}>
                          {versiyon.EklenenSayisi > 0 && (
                            <Chip label={`+${versiyon.EklenenSayisi}`} size="small" color="success" sx={{ height: 20, fontSize: '0.7rem' }} />
                          )}
                          {versiyon.GuncellenenSayisi > 0 && (
                            <Chip label={`~${versiyon.GuncellenenSayisi}`} size="small" color="warning" sx={{ height: 20, fontSize: '0.7rem' }} />
                          )}
                          {versiyon.SilinenSayisi > 0 && (
                            <Chip label={`-${versiyon.SilinenSayisi}`} size="small" color="error" sx={{ height: 20, fontSize: '0.7rem' }} />
                          )}
                        </Box>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <DateDisplay date={versiyon.YuklemeTarihi} />
                    </TableCell>
                    <TableCell align="center">
                      <Tooltip title="Detayları Görüntüle">
                        <IconButton
                          size="small"
                          color="primary"
                          onClick={() => handleDetayAc(versiyon)}
                          sx={{
                            '&:hover': {
                              bgcolor: 'primary.light',
                              color: 'primary.contrastText',
                            },
                          }}
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
              İşlem Detayları
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
        <DialogContent sx={{ 
          maxHeight: 'calc(100vh - 200px)',
          overflowY: 'auto',
          '&::-webkit-scrollbar': {
            width: '8px',
          },
          '&::-webkit-scrollbar-track': {
            background: 'rgba(0,0,0,0.05)',
            borderRadius: '4px',
          },
          '&::-webkit-scrollbar-thumb': {
            background: 'rgba(0,0,0,0.2)',
            borderRadius: '4px',
            '&:hover': {
              background: 'rgba(0,0,0,0.3)',
            },
          },
        }}>
          {detayLoading ? (
            <LoadingSpinner message="Detaylar yükleniyor..." />
          ) : versiyonDetay ? (
            <Box>
              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={12} sm={6}>
                  <Typography variant="caption" color="text.secondary">Dosya Adı</Typography>
                  <Typography variant="body1">
                    {versiyonDetay.version?.DosyaAdi || versiyonDetay.version?.dosyaAdi || '-'}
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="caption" color="text.secondary">Yükleme Tarihi</Typography>
                  <Typography variant="body1">
                    <DateDisplay date={versiyonDetay.version?.YuklemeTarihi || versiyonDetay.version?.yuklemeTarihi} />
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="caption" color="text.secondary">Kayıt Sayısı</Typography>
                  <Typography variant="body1">
                    {versiyonDetay.version?.KayitSayisi || versiyonDetay.version?.kayitSayisi || 0}
                  </Typography>
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

              {versiyonDetay.guncellenenler && versiyonDetay.guncellenenler.length > 0 && (
                <Box sx={{ mb: 3 }}>
                  <Accordion 
                    expanded={expandedSections.guncellenenler}
                    onChange={(e, isExpanded) => setExpandedSections(prev => ({ ...prev, guncellenenler: isExpanded }))}
                    sx={{ boxShadow: 2 }}
                  >
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                        Güncellenen İl Katsayıları ({versiyonDetay.guncellenenler.length})
                      </Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                      <TableContainer sx={{ maxHeight: 400 }}>
                        <Table size="small" stickyHeader>
                          <TableHead>
                            <TableRow>
                              <TableCell sx={{ fontWeight: 600 }}>İl Adı</TableCell>
                              <TableCell align="center" sx={{ fontWeight: 600 }}>Plaka</TableCell>
                              <TableCell align="right" sx={{ fontWeight: 600 }}>Eski Katsayı</TableCell>
                              <TableCell align="right" sx={{ fontWeight: 600 }}>Yeni Katsayı</TableCell>
                              <TableCell align="right" sx={{ fontWeight: 600 }}>Değişim</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {versiyonDetay.guncellenenler.map((item, idx) => (
                              <TableRow key={idx} hover>
                                <TableCell>{item.IlAdi || item.ilAdi}</TableCell>
                                <TableCell align="center">{item.PlakaKodu || item.plakaKodu || '-'}</TableCell>
                                <TableCell align="right">{item.EskiKatsayi || item.eskiKatsayi}</TableCell>
                                <TableCell align="right">
                                  <Typography variant="body2" fontWeight="600" color="primary">
                                    {item.YeniKatsayi || item.yeniKatsayi}
                                  </Typography>
                                </TableCell>
                                <TableCell align="right">
                                  <Typography 
                                    variant="body2" 
                                    fontWeight="600"
                                    color={((item.YeniKatsayi || item.yeniKatsayi) - (item.EskiKatsayi || item.eskiKatsayi)) >= 0 ? 'success.main' : 'error.main'}
                                  >
                                    {((item.YeniKatsayi || item.yeniKatsayi) - (item.EskiKatsayi || item.eskiKatsayi)) >= 0 ? '+' : ''}
                                    {((item.YeniKatsayi || item.yeniKatsayi) - (item.EskiKatsayi || item.eskiKatsayi)).toFixed(2)}
                                  </Typography>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </AccordionDetails>
                  </Accordion>
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
    <Container maxWidth="xl" sx={{ py: { xs: 2, sm: 3, md: 4 } }}>
      <PageHeader 
        title="İl Katsayıları Yönetimi" 
        subtitle="Excel import ve liste takibi"
        icon="📊"
      />

      <Paper elevation={2} sx={{ borderRadius: 2, overflow: 'hidden', mb: { xs: 2, sm: 3 } }}>
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          variant="scrollable"
          scrollButtons="auto"
          sx={{ 
            borderBottom: 1, 
            borderColor: 'divider',
            bgcolor: 'background.paper',
            '& .MuiTab-root': {
              minHeight: 64,
              textTransform: 'none',
              fontWeight: 500,
            },
            '& .Mui-selected': {
              fontWeight: 600,
            },
          }}
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
            label="İl Katsayıları Listesi" 
            icon={<ListIcon />} 
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
          <IlKatsayilariListesiTab />
        </TabPanel>
      </Paper>
    </Container>
  );
}

export default IlKatsayiYonetimi;
