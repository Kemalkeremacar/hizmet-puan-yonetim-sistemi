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
  Assessment as AssessmentIcon
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

              {/* Değişiklik Yoksa */}
              {versiyonDetay?.summary?.eklenen === 0 &&
               versiyonDetay?.summary?.guncellenen === 0 &&
               versiyonDetay?.summary?.silinen === 0 && (
                <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1, textAlign: 'center' }}>
                  <Typography variant="body2" color="textSecondary">
                    Bu versiyon ilk versiyon veya önceki versiyonla karşılaştırılamıyor.
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




