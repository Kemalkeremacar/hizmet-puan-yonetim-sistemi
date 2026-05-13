// ============================================
// TARİHSEL SORGULAR SAYFASI
// ============================================
// Geçmiş fiyat sorgulamaları ve değişiklik takibi
// ============================================

import { useState } from 'react';
import {
  Box,
  Container,
  Paper,
  Typography,
  TextField,
  Button,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  Tab,
  InputAdornment,
  Chip,
  Alert,
  Card,
  CardContent,
  Stack
} from '@mui/material';
import {
  Search as SearchIcon,
  DateRange as DateRangeIcon,
  FileDownload as FileDownloadIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  History as HistoryIcon,
  Info as InfoIcon
} from '@mui/icons-material';
import { tarihselService } from '../services/tarihselService';
import { showError, showSuccess, showInfo } from '../utils/toastManager';
import { exportToExcel } from '../utils/export';
import * as XLSX from 'xlsx';
import { LoadingSpinner, ErrorAlert, EmptyState, PageHeader } from '../components/common';
import { 
  getTodayString, 
  isFutureDate, 
  isBeforeMinDate,
  validateDateRange,
  formatDateShort
} from '../utils/dateUtils';
import { MIN_QUERY_DATE, MIN_QUERY_DATE_DISPLAY } from '../app/config/constants';
import { TabPanel } from '../components/common';

function Tarihsel() {
  const [tabValue, setTabValue] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Tab 1: Tarihteki Fiyat
  const [fiyatForm, setFiyatForm] = useState({
    huvKodu: '',
    tarih: getTodayString()
  });
  const [fiyatResult, setFiyatResult] = useState(null);

  // Tab 2: Değişenler
  const [degisiklikForm, setDegisiklikForm] = useState({
    baslangic: MIN_QUERY_DATE,
    bitis: getTodayString()
  });
  const [degisiklikResult, setDegisiklikResult] = useState([]);

  // Tab 3: Fiyat Geçmişi
  const [gecmisForm, setGecmisForm] = useState({
    huvKodu: ''
  });
  const [gecmisResult, setGecmisResult] = useState(null);

  const handleTabChange = (_event, newValue) => {
    setTabValue(newValue);
    setError(null);
  };

  // ============================================
  // TAB 1: Tarihteki Fiyat Sorgula
  // ============================================
  const handleFiyatSorgula = async () => {
    if (!fiyatForm.huvKodu || !fiyatForm.tarih) {
      showError('HUV kodu ve tarih zorunludur');
      return;
    }

    if (isFutureDate(fiyatForm.tarih)) {
      showError('Gelecek tarih için sorgu yapılamaz');
      return;
    }

    if (isBeforeMinDate(fiyatForm.tarih, MIN_QUERY_DATE)) {
      showError(`${MIN_QUERY_DATE_DISPLAY} tarihinden önce sorgu yapılamaz`);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const response = await tarihselService.getFiyatByTarih({
        huvKodu: parseFloat(fiyatForm.huvKodu),
        tarih: fiyatForm.tarih
      });
      
      // API response formatı: { success: true, data: {...}, message: "..." }
      const result = response.data?.data || response.data;
      if (result) {
        setFiyatResult(result);
        showSuccess('Fiyat bilgisi başarıyla getirildi');
      } else {
        setFiyatResult(null);
        // Backend'den gelen detaylı hata mesajını göster
        const errorDetail = response.data?.detay || response.data?.message;
        if (errorDetail) {
          showError(errorDetail);
        } else {
          showError('Bu tarihte fiyat bulunamadı');
        }
      }
    } catch (err) {
      console.error('Fiyat sorgu hatası:', err);
      setError(err);
      setFiyatResult(null);
      
      // Backend'den gelen detaylı hata mesajı
      const errorData = err.response?.data;
      const errorMessage = errorData?.message || 
                          errorData?.errors?.cozum || 
                          errorData?.detay || 
                          err.message || 
                          'Fiyat sorgulanamadı';
      
      // Tek bir toast mesajı göster - duplicate önlemek için
      if (errorData?.errors?.tip === 'TARIH_BASLANGIC_ONDEN') {
        const cozum = errorData.errors.cozum || '';
        const baslangicTarihi = errorData.errors.baslangicTarihi || MIN_QUERY_DATE_DISPLAY;
        showError(`${errorMessage}\n${cozum}\nBaşlangıç tarihi: ${baslangicTarihi}`);
      } else if (errorData?.errors?.tip === 'GECERSIZ_TARIH_FORMATI') {
        showError(`${errorMessage}\n${errorData.errors.cozum || ''}`);
      } else if (errorData?.errors?.tip === 'GELECEK_TARIH') {
        showError(`${errorMessage}\n${errorData.errors.cozum || ''}`);
      } else if (errorData?.enEskiTarih) {
        showError(`${errorMessage} (En eski kayıt: ${errorData.enEskiTarih})`);
      } else {
        showError(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleFiyatExport = () => {
    if (!fiyatResult) {
      showError('Export edilecek veri yok');
      return;
    }

    try {
      const data = [{
        'HUV Kodu': fiyatResult.HuvKodu || '-',
        'İşlem Adı': fiyatResult.IslemAdi || '-',
        'Birim (TL)': fiyatResult.Birim != null ? fiyatResult.Birim : '-',
        'Tarih': formatDateShort(fiyatForm.tarih),
        'Geçerlilik Başlangıç': fiyatResult.GecerlilikBaslangic ? formatDateShort(fiyatResult.GecerlilikBaslangic) : '-',
        'Geçerlilik Bitiş': fiyatResult.GecerlilikBitis ? formatDateShort(fiyatResult.GecerlilikBitis) : 'Devam Ediyor',
        'Ana Dal': fiyatResult.BolumAdi || '-',
        'Hiyerarşi Seviyesi': fiyatResult.HiyerarsiSeviyesi || '-',
        'Değişiklik Sebebi': fiyatResult.DegisiklikSebebi || '-'
      }];

      exportToExcel(data, 'tarihteki_fiyat');
      showSuccess('Excel dosyası başarıyla indirildi');
    } catch (err) {
      console.error('Export hatası:', err);
      showError('Excel dosyası oluşturulamadı');
    }
  };

  // ============================================
  // TAB 2: Değişenleri Sorgula
  // ============================================
  const handleDegisiklikSorgula = async () => {
    const validation = validateDateRange(degisiklikForm.baslangic, degisiklikForm.bitis, MIN_QUERY_DATE);
    if (!validation.valid) {
      showError(validation.error);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const response = await tarihselService.getDegişenler({
        baslangic: degisiklikForm.baslangic,
        bitis: degisiklikForm.bitis
      });

      const body = response?.success !== undefined ? response : response?.data;
      const raw = body?.data;
      const data = Array.isArray(raw)
        ? raw
        : raw && typeof raw === 'object'
          ? [raw]
          : [];
      setDegisiklikResult(data);
      
      if (data.length === 0) {
        const uyari = body?.uyari || 'Bu tarih aralığında değişiklik bulunamadı';
        showInfo(uyari);
      } else {
        showSuccess(`${data.length} değişiklik bulundu`);
      }
    } catch (err) {
      console.error('Değişenler sorgu hatası:', err);
      setError(err);
      setDegisiklikResult([]);
      const errorData = err.response?.data;
      const errorMessage = errorData?.message || 
                          errorData?.errors?.cozum || 
                          errorData?.detay || 
                          err.message || 
                          'Değişiklikler sorgulanamadı';
      
      if (errorData?.errors?.tip === 'TARIH_BASLANGIC_ONDEN' || errorData?.errors?.tip === 'GECERSIZ_TARIH_ARALIGI') {
        const cozum = errorData.errors.cozum || '';
        const baslangicTarihi = errorData.errors.baslangicTarihi || MIN_QUERY_DATE_DISPLAY;
        showError(`${errorMessage}\n${cozum}\nBaşlangıç tarihi: ${baslangicTarihi}`);
      } else {
        showError(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDegisiklikExport = () => {
    if (!degisiklikResult || degisiklikResult.length === 0) {
      showError('Export edilecek veri yok');
      return;
    }

    try {
      const data = degisiklikResult.map(item => ({
        'HUV Kodu': item.HuvKodu || '-',
        'İşlem Adı': item.IslemAdi || '-',
        'Eski Birim (TL)': (item.EskiBirim ?? item.IlkBirim) != null ? (item.EskiBirim ?? item.IlkBirim).toFixed(2) : '-',
        'Yeni Birim (TL)': (item.YeniBirim ?? item.SonBirim) != null ? (item.YeniBirim ?? item.SonBirim).toFixed(2) : '-',
        'Fark (TL)': (item.Fark ?? item.BirimDegisimi) != null ? (item.Fark ?? item.BirimDegisimi).toFixed(2) : '-',
        'Değişim %': item.DegisimYuzdesi ? `${parseFloat(item.DegisimYuzdesi).toFixed(2)}%` : '-',
        'İlk Değişiklik': item.IlkDegisiklik ? formatDateShort(item.IlkDegisiklik) : '-',
        'Son Değişiklik': item.SonDegisiklik ? formatDateShort(item.SonDegisiklik) : item.DegisiklikTarihi ? formatDateShort(item.DegisiklikTarihi) : '-',
        'Değişiklik Sayısı': item.DegisiklikSayisi || 1,
        'Ana Dal': item.BolumAdi || '-'
      }));

      exportToExcel(data, 'degisen_islemler');
      showSuccess('Excel dosyası başarıyla indirildi');
    } catch (err) {
      console.error('Export hatası:', err);
      showError('Excel dosyası oluşturulamadı');
    }
  };

  // ============================================
  // TAB 3: Fiyat Geçmişi Sorgula
  // ============================================
  const handleGecmisSorgula = async () => {
    if (!gecmisForm.huvKodu) {
      showError('HUV kodu zorunludur');
      return;
    }

    const huvKodu = parseFloat(gecmisForm.huvKodu);
    if (isNaN(huvKodu) || huvKodu <= 0) {
      showError('Geçerli bir HUV kodu giriniz');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const response = await tarihselService.getFiyatGecmisi(gecmisForm.huvKodu);

      // API response formatı: { success: true, data: {...}, message: "..." }
      const result = response.data?.data || response.data;
      if (result) {
        setGecmisResult(result);
        showSuccess('Fiyat geçmişi başarıyla getirildi');
      } else {
        setGecmisResult(null);
        // Backend'den gelen detaylı hata mesajını göster
        const errorDetail = response.data?.detay || response.data?.message;
        if (errorDetail) {
          showError(errorDetail);
        } else {
          showError('Fiyat geçmişi bulunamadı');
        }
      }
    } catch (err) {
      console.error('Geçmiş sorgu hatası:', err);
      setError(err);
      setGecmisResult(null);
      
      // Detaylı hata mesajı
      const errorMessage = err.response?.data?.message || 
                          err.response?.data?.detay || 
                          err.message || 
                          'Fiyat geçmişi sorgulanamadı';
      showError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleGecmisExport = () => {
    if (!gecmisResult || !gecmisResult.versiyonlar || gecmisResult.versiyonlar.length === 0) {
      showError('Export edilecek veri yok');
      return;
    }

    try {
      // Versiyon geçmişi
      const isSilmeKaydi = (v) => {
        if (v.DegisiklikSebebi && v.DegisiklikSebebi.toLowerCase().includes('kaldırıldı')) return true;
        if (v.GecerlilikBaslangic && v.GecerlilikBitis && new Date(v.GecerlilikBaslangic) > new Date(v.GecerlilikBitis)) return true;
        return false;
      };

      const versiyonData = gecmisResult.versiyonlar.map((versiyon, index) => {
        const silmeKaydi = isSilmeKaydi(versiyon);
        const oncekiVersiyon = gecmisResult.versiyonlar[index + 1];
        const fark = versiyon.BirimDegisimi !== null && versiyon.BirimDegisimi !== undefined
          ? versiyon.BirimDegisimi
          : (oncekiVersiyon && versiyon.Birim && oncekiVersiyon.Birim 
            ? versiyon.Birim - oncekiVersiyon.Birim 
            : null);
        
        return {
          'Versiyon ID': versiyon.VersionID || versiyon.IslemVersionID || '-',
          'HUV Kodu': gecmisResult.islem?.HuvKodu || '-',
          'İşlem Adı': gecmisResult.islem?.IslemAdi || '-',
          'Birim (TL)': versiyon.Birim != null ? versiyon.Birim : '-',
          'Fark (TL)': fark !== null ? (fark > 0 ? '+' : '') + fark.toFixed(2) : '-',
          'Değişim %': versiyon.BirimDegisimYuzdesi ? `${parseFloat(versiyon.BirimDegisimYuzdesi).toFixed(2)}%` : '-',
          'Geçerlilik Başlangıç': silmeKaydi
            ? (versiyon.GecerlilikBaslangic ? formatDateShort(versiyon.GecerlilikBaslangic) + ' (Silme)' : '-')
            : (versiyon.GecerlilikBaslangic ? formatDateShort(versiyon.GecerlilikBaslangic) : '-'),
          'Geçerlilik Bitiş': silmeKaydi
            ? '-'
            : (versiyon.GecerlilikBitis ? formatDateShort(versiyon.GecerlilikBitis) : 'Devam Ediyor'),
          'Durum': silmeKaydi ? 'Silindi' : (!versiyon.GecerlilikBitis ? 'Aktif' : 'Geçmiş'),
          'Değişiklik Sebebi': versiyon.DegisiklikSebebi || '-'
        };
      });

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(versiyonData), 'Fiyat Geçmişi');
      XLSX.writeFile(workbook, `fiyat_gecmisi_${gecmisResult.islem?.HuvKodu || 'bilinmeyen'}.xlsx`);
      
      showSuccess('Excel dosyası başarıyla indirildi');
    } catch (err) {
      console.error('Export hatası:', err);
      showError('Excel dosyası oluşturulamadı');
    }
  };

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      <PageHeader 
        title="HUV Tarihsel Sorgular" 
        subtitle="HUV kodları için geçmiş fiyat sorgulamaları ve değişiklik takibi"
      />

      {/* Tabs */}
      <Paper sx={{ mb: 3 }}>
        <Tabs 
          value={tabValue} 
          onChange={handleTabChange}
          variant="fullWidth"
          sx={{
            '& .MuiTab-root': {
              minHeight: 72,
              textTransform: 'none',
              fontSize: '1rem'
            }
          }}
        >
          <Tab 
            label="Tarihteki Fiyat" 
            icon={<SearchIcon />} 
            iconPosition="start"
          />
          <Tab 
            label="Değişen İşlemler" 
            icon={<DateRangeIcon />} 
            iconPosition="start"
          />
          <Tab 
            label="Fiyat Geçmişi" 
            icon={<HistoryIcon />} 
            iconPosition="start"
          />
        </Tabs>
      </Paper>

      {/* Global Error */}
      {error && (
        <ErrorAlert 
          message="Sorgu sırasında hata oluştu" 
          error={error} 
          sx={{ mb: 3 }} 
        />
      )}

      {/* TAB 1: Tarihteki Fiyat */}
      <TabPanel value={tabValue} index={0}>
        <Paper sx={{ p: 4 }}>
          <Stack spacing={3}>
            {/* Başlık */}
            <Box>
              <Typography variant="h5" gutterBottom fontWeight="600">
                Belirli Tarihteki Fiyat Sorgulama
              </Typography>
              <Alert severity="info" icon={<InfoIcon />} sx={{ mt: 2, mb: 2 }}>
                Bir işlemin geçmişteki belirli bir tarihteki fiyatını sorgulayın
              </Alert>
              <Alert severity="warning" sx={{ mb: 2 }}>
                <Typography variant="body2" fontWeight="600">Başlangıç Tarihi: {MIN_QUERY_DATE_DISPLAY}</Typography>
                <Typography variant="body2">
                  HUV listesi için sorgu yapılabilecek en eski tarih <strong>{MIN_QUERY_DATE_DISPLAY}</strong> tarihidir. 
                  Bu tarih, sistemdeki ilk import tarihidir.
                </Typography>
              </Alert>
            </Box>

            {/* Form */}
            <Grid container spacing={3}>
              <Grid item xs={12} md={5}>
                <TextField
                  fullWidth
                  label="HUV Kodu"
                  value={fiyatForm.huvKodu}
                  onChange={(e) => setFiyatForm({ ...fiyatForm, huvKodu: e.target.value })}
                  placeholder="Örn: 20.00057"
                  slotProps={{
                    input: {
                      startAdornment: (
                        <InputAdornment position="start">
                          <SearchIcon />
                        </InputAdornment>
                      )
                    }
                  }}
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  label="Tarih"
                  type="date"
                  value={fiyatForm.tarih}
                  onChange={(e) => setFiyatForm({ ...fiyatForm, tarih: e.target.value })}
                  slotProps={{ 
                    inputLabel: { shrink: true },
                    htmlInput: { min: MIN_QUERY_DATE, max: getTodayString() }
                  }}
                />
              </Grid>
              <Grid item xs={12} md={3}>
                <Button
                  fullWidth
                  variant="contained"
                  size="large"
                  onClick={handleFiyatSorgula}
                  disabled={loading}
                  sx={{ height: '56px' }}
                >
                  {loading ? <LoadingSpinner size={24} inline /> : 'Sorgula'}
                </Button>
              </Grid>
            </Grid>

            {/* Sonuç */}
            {!fiyatResult && !loading && (
              <EmptyState message="Sorgu yapmak için HUV kodu ve tarih girin" />
            )}

            {fiyatResult && (
              <Card variant="outlined" sx={{ bgcolor: 'background.default' }}>
                <CardContent sx={{ p: 3 }}>
                  <Stack spacing={3}>
                    <Box display="flex" justifyContent="space-between" alignItems="center">
                      <Typography variant="h6" fontWeight="600">
                        Sorgu Sonucu
                      </Typography>
                      <Button
                        variant="outlined"
                        startIcon={<FileDownloadIcon />}
                        onClick={handleFiyatExport}
                        size="small"
                      >
                        Excel'e Aktar
                      </Button>
                    </Box>

                    <Grid container spacing={3}>
                      <Grid item xs={12} md={6}>
                        <Paper sx={{ p: 2, bgcolor: 'background.paper' }}>
                          <Typography variant="caption" color="textSecondary" gutterBottom display="block">
                            HUV Kodu
                          </Typography>
                          <Typography variant="h6" fontWeight="600">
                            {fiyatResult.HuvKodu}
                          </Typography>
                        </Paper>
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <Paper sx={{ p: 2, bgcolor: 'background.paper' }}>
                          <Typography variant="caption" color="textSecondary" gutterBottom display="block">
                            İşlem Adı
                          </Typography>
                          <Typography variant="h6" fontWeight="600">
                            {fiyatResult.IslemAdi}
                          </Typography>
                        </Paper>
                      </Grid>
                      <Grid item xs={12} md={4}>
                        <Paper sx={{ p: 2, bgcolor: '#f8f9fa' }}>
                          <Typography variant="caption" color="textSecondary" gutterBottom display="block">
                            Birim (Fiyat)
                          </Typography>
                          <Typography variant="h4" color="primary.main" fontWeight="700">
                            {fiyatResult.Birim != null ? `${fiyatResult.Birim.toFixed(2)} TL` : 'Belirtilmemiş'}
                          </Typography>
                        </Paper>
                      </Grid>
                      <Grid item xs={12} md={4}>
                        <Paper sx={{ p: 2, bgcolor: 'background.paper' }}>
                          <Typography variant="caption" color="textSecondary" gutterBottom display="block">
                            Tarih
                          </Typography>
                          <Typography variant="h6" fontWeight="600">
                            {new Date(fiyatForm.tarih).toLocaleDateString('tr-TR', { 
                              day: 'numeric', 
                              month: 'long', 
                              year: 'numeric' 
                            })}
                          </Typography>
                        </Paper>
                      </Grid>
                      <Grid item xs={12} md={4}>
                        <Paper sx={{ p: 2, bgcolor: 'background.paper' }}>
                          <Typography variant="caption" color="textSecondary" gutterBottom display="block">
                            Ana Dal
                          </Typography>
                          <Typography variant="h6" fontWeight="600">
                            {fiyatResult.BolumAdi || '-'}
                          </Typography>
                        </Paper>
                      </Grid>
                    </Grid>
                  </Stack>
                </CardContent>
              </Card>
            )}
          </Stack>
        </Paper>
      </TabPanel>

      {/* TAB 2: Değişen İşlemler */}
      <TabPanel value={tabValue} index={1}>
        <Paper sx={{ p: 4 }}>
          <Stack spacing={3}>
            {/* Başlık */}
            <Box>
              <Typography variant="h5" gutterBottom fontWeight="600">
                Tarih Aralığında Değişen İşlemler
              </Typography>
              <Alert severity="info" icon={<InfoIcon />} sx={{ mt: 2 }}>
                Belirli bir tarih aralığında fiyatı değişen işlemleri listeleyin
              </Alert>
            </Box>

            {/* Form */}
            <Grid container spacing={3}>
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  label="Başlangıç Tarihi"
                  type="date"
                  value={degisiklikForm.baslangic}
                  onChange={(e) => setDegisiklikForm({ ...degisiklikForm, baslangic: e.target.value })}
                  slotProps={{
                    inputLabel: { shrink: true },
                    htmlInput: { min: MIN_QUERY_DATE, max: getTodayString() },
                    input: {
                      startAdornment: (
                        <InputAdornment position="start">
                          <DateRangeIcon />
                        </InputAdornment>
                      )
                    }
                  }}
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  label="Bitiş Tarihi"
                  type="date"
                  value={degisiklikForm.bitis}
                  onChange={(e) => setDegisiklikForm({ ...degisiklikForm, bitis: e.target.value })}
                  slotProps={{ 
                    inputLabel: { shrink: true },
                    htmlInput: { min: MIN_QUERY_DATE, max: getTodayString() }
                  }}
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <Button
                  fullWidth
                  variant="contained"
                  size="large"
                  onClick={handleDegisiklikSorgula}
                  disabled={loading}
                  sx={{ height: '56px' }}
                >
                  {loading ? <LoadingSpinner size={24} inline /> : 'Sorgula'}
                </Button>
              </Grid>
            </Grid>

            {/* Sonuç */}
            {degisiklikResult && degisiklikResult.length > 0 && (
              <Box>
                <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
                  <Alert severity="success" sx={{ flexGrow: 1 }}>
                    <strong>{degisiklikResult.length}</strong> işlemde değişiklik bulundu
                  </Alert>
                  <Button
                    variant="contained"
                    startIcon={<FileDownloadIcon />}
                    onClick={handleDegisiklikExport}
                  >
                    Excel'e Aktar
                  </Button>
                </Stack>

                <TableContainer component={Paper} variant="outlined">
                  <Table>
                    <TableHead>
                      <TableRow sx={{ bgcolor: '#f8f9fa' }}>
                        <TableCell><strong>HUV Kodu</strong></TableCell>
                        <TableCell><strong>İşlem Adı</strong></TableCell>
                        <TableCell align="right"><strong>Eski Birim</strong></TableCell>
                        <TableCell align="right"><strong>Yeni Birim</strong></TableCell>
                        <TableCell align="right"><strong>Fark</strong></TableCell>
                        <TableCell align="center"><strong>Değişim</strong></TableCell>
                        <TableCell align="center"><strong>Tarih</strong></TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {degisiklikResult.map((item, index) => {
                        const fark = (item.YeniBirim ?? 0) - (item.EskiBirim ?? 0);
                        const yuzde = item.EskiBirim ? ((fark / item.EskiBirim) * 100) : 0;
                        const artis = fark > 0;
                        
                        return (
                          <TableRow 
                            key={index} 
                            hover
                            sx={{ '&:nth-of-type(odd)': { bgcolor: 'action.hover' } }}
                          >
                            <TableCell>
                              <Chip label={item.HuvKodu} size="small" variant="outlined" />
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2" sx={{ maxWidth: 300 }}>
                                {item.IslemAdi}
                              </Typography>
                            </TableCell>
                            <TableCell align="right">
                              <Typography variant="body2" color="textSecondary">
                                {item.EskiBirim != null ? `${item.EskiBirim.toFixed(2)} TL` : '-'}
                              </Typography>
                            </TableCell>
                            <TableCell align="right">
                              <Typography variant="body2" fontWeight="600">
                                {item.YeniBirim != null ? `${item.YeniBirim.toFixed(2)} TL` : '-'}
                              </Typography>
                            </TableCell>
                            <TableCell align="right">
                              <Typography 
                                variant="body2" 
                                color={artis ? 'error.main' : 'success.main'}
                                fontWeight="700"
                              >
                                {artis ? '+' : ''}{fark.toFixed(2)} TL
                              </Typography>
                            </TableCell>
                            <TableCell align="center">
                              <Chip
                                icon={artis ? <TrendingUpIcon /> : <TrendingDownIcon />}
                                label={`${artis ? '+' : ''}${yuzde.toFixed(1)}%`}
                                size="small"
                                color={artis ? 'error' : 'success'}
                              />
                            </TableCell>
                            <TableCell align="center">
                              <Typography variant="body2">
                                {item.DegisiklikTarihi 
                                  ? formatDateShort(item.DegisiklikTarihi)
                                  : '-'}
                              </Typography>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>
            )}

            {degisiklikResult && degisiklikResult.length === 0 && !loading && (
              <Paper sx={{ p: 4, bgcolor: 'background.default' }}>
                <EmptyState message="Bu tarih aralığında değişiklik bulunamadı" />
                <Alert severity="info" sx={{ mt: 2 }}>
                  <Typography variant="body2">
                    <strong>Not:</strong> Değişiklik sorgusu en az 2 farklı liste versiyonu gerektirir. Sisteme henüz tek bir HUV listesi yüklenmiş ise bu sekme doğal olarak boş döner. Yeni bir liste import edildiğinde fark raporları burada görünecektir.
                  </Typography>
                </Alert>
              </Paper>
            )}
          </Stack>
        </Paper>
      </TabPanel>

      {/* TAB 3: Fiyat Geçmişi */}
      <TabPanel value={tabValue} index={2}>
        <Paper sx={{ p: 4 }}>
          <Stack spacing={3}>
            {/* Başlık */}
            <Box>
              <Typography variant="h5" gutterBottom fontWeight="600">
                İşlem Fiyat Geçmişi
              </Typography>
              <Alert severity="info" icon={<InfoIcon />} sx={{ mt: 2 }}>
                Bir işlemin HUV kodunu girerek tüm fiyat değişiklik geçmişini görüntüleyin
              </Alert>
            </Box>

            {/* Form */}
            <Grid container spacing={3}>
              <Grid item xs={12} md={9}>
                <TextField
                  fullWidth
                  label="HUV Kodu"
                  value={gecmisForm.huvKodu}
                  onChange={(e) => setGecmisForm({ ...gecmisForm, huvKodu: e.target.value })}
                  placeholder="Örn: 20.00057"
                  slotProps={{
                    input: {
                      startAdornment: (
                        <InputAdornment position="start">
                          <SearchIcon />
                        </InputAdornment>
                      )
                    }
                  }}
                />
              </Grid>
              <Grid item xs={12} md={3}>
                <Button
                  fullWidth
                  variant="contained"
                  size="large"
                  onClick={handleGecmisSorgula}
                  disabled={loading}
                  sx={{ height: '56px' }}
                >
                  {loading ? <LoadingSpinner size={24} inline /> : 'Sorgula'}
                </Button>
              </Grid>
            </Grid>

            {/* Sonuç */}
            {gecmisResult && gecmisResult.islem && (
              <Stack spacing={3}>
                {/* Silindi Uyarısı */}
                {!gecmisResult.mevcutMu && (
                  <Alert severity="warning" icon={<InfoIcon />}>
                    <strong>Bu işlem şu anda sistemde mevcut değil.</strong> İşlem daha önce silinmiş olabilir. Aşağıda geçmiş kayıtlarını görüntüleyebilirsiniz.
                  </Alert>
                )}

                {/* İşlem Bilgisi */}
                <Card variant="outlined" sx={{ bgcolor: 'background.default' }}>
                  <CardContent sx={{ p: 3 }}>
                    <Stack spacing={3}>
                      <Box display="flex" justifyContent="space-between" alignItems="center">
                        <Typography variant="h6" fontWeight="600">
                          İşlem Bilgisi
                        </Typography>
                        <Button
                          variant="outlined"
                          startIcon={<FileDownloadIcon />}
                          onClick={handleGecmisExport}
                          size="small"
                        >
                          Excel'e Aktar
                        </Button>
                      </Box>

                      <Grid container spacing={2}>
                        <Grid item xs={12} md={gecmisResult.mevcutMu ? 4 : 6}>
                          <Paper sx={{ p: 2, bgcolor: 'background.paper' }}>
                            <Typography variant="caption" color="textSecondary" gutterBottom display="block">
                              HUV Kodu
                            </Typography>
                            <Typography variant="h6" fontWeight="600">
                              {gecmisResult.islem?.HuvKodu}
                            </Typography>
                          </Paper>
                        </Grid>
                        <Grid item xs={12} md={gecmisResult.mevcutMu ? 5 : 6}>
                          <Paper sx={{ p: 2, bgcolor: 'background.paper' }}>
                            <Typography variant="caption" color="textSecondary" gutterBottom display="block">
                              İşlem Adı
                            </Typography>
                            <Typography variant="h6" fontWeight="600">
                              {gecmisResult.islem?.IslemAdi}
                            </Typography>
                          </Paper>
                        </Grid>
                        {gecmisResult.mevcutMu && (
                          <Grid item xs={12} md={3}>
                            <Paper sx={{ p: 2, bgcolor: '#f8f9fa' }}>
                              <Typography variant="caption" color="textSecondary" gutterBottom display="block">
                                Güncel Birim
                              </Typography>
                              <Typography variant="h5" color="primary.main" fontWeight="700">
                                {gecmisResult.islem?.GuncelBirim != null ? `${gecmisResult.islem.GuncelBirim.toFixed(2)} TL` : '-'}
                              </Typography>
                            </Paper>
                          </Grid>
                        )}
                      </Grid>
                    </Stack>
                  </CardContent>
                </Card>

                {/* Versiyon Geçmişi */}
                <Box>
                  <Typography variant="h6" gutterBottom fontWeight="600" sx={{ mb: 2 }}>
                    Fiyat Değişim Geçmişi
                  </Typography>

                  {gecmisResult.versiyonlar && (() => {
                    const normalCount = gecmisResult.versiyonlar.filter(v => 
                      !(v.DegisiklikSebebi && v.DegisiklikSebebi.toLowerCase().includes('kaldırıldı')) &&
                      !(v.GecerlilikBaslangic && v.GecerlilikBitis && new Date(v.GecerlilikBaslangic) > new Date(v.GecerlilikBitis))
                    ).length;
                    return normalCount === 1;
                  })() && (
                    <Alert severity="info" sx={{ mb: 2 }}>
                      Bu işlem için henüz tek bir versiyon kaydı bulunmaktadır. Fiyat karşılaştırması yapabilmek için sisteme en az iki farklı liste yüklenmiş olmalıdır.
                    </Alert>
                  )}
                  
                  {gecmisResult.versiyonlar && gecmisResult.versiyonlar.length > 0 ? (
                    <TableContainer component={Paper} variant="outlined">
                      <Table size="small">
                        <TableHead>
                          <TableRow sx={{ bgcolor: '#f8f9fa' }}>
                            <TableCell width="100"><strong>Versiyon</strong></TableCell>
                            <TableCell align="right" width="120"><strong>Birim (TL)</strong></TableCell>
                            <TableCell width="150"><strong>Başlangıç</strong></TableCell>
                            <TableCell width="150"><strong>Bitiş</strong></TableCell>
                            <TableCell width="100" align="center"><strong>Durum</strong></TableCell>
                            <TableCell><strong>Açıklama</strong></TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {(() => {
                            const rows = [];
                            const versiyonlar = gecmisResult.versiyonlar;

                            const isSilmeKaydi = (v) => {
                              if (v.DegisiklikSebebi && v.DegisiklikSebebi.toLowerCase().includes('kaldırıldı')) return true;
                              if (v.GecerlilikBaslangic && v.GecerlilikBitis && new Date(v.GecerlilikBaslangic) > new Date(v.GecerlilikBitis)) return true;
                              return false;
                            };

                            const findNextNormal = (startIdx) => {
                              for (let j = startIdx + 1; j < versiyonlar.length; j++) {
                                if (!isSilmeKaydi(versiyonlar[j])) return versiyonlar[j];
                              }
                              return null;
                            };

                            let i = 0;
                            while (i < versiyonlar.length) {
                              const versiyon = versiyonlar[i];

                              if (isSilmeKaydi(versiyon)) {
                                rows.push(
                                  <TableRow 
                                    key={i} 
                                    hover
                                    sx={{ bgcolor: 'rgba(244, 67, 54, 0.06)' }}
                                  >
                                    <TableCell>
                                      <Chip 
                                        label={`V${versiyon.VersionID}`} 
                                        size="small" 
                                        color="error"
                                        variant="outlined"
                                      />
                                    </TableCell>
                                    <TableCell align="right">
                                      <Typography variant="body2" fontWeight="700" color="text.secondary">
                                        {versiyon.Birim != null ? versiyon.Birim.toFixed(2) : '-'}
                                      </Typography>
                                    </TableCell>
                                    <TableCell colSpan={2}>
                                      <Typography variant="body2" color="error.main" fontWeight="600">
                                        {versiyon.GecerlilikBaslangic
                                          ? formatDateShort(versiyon.GecerlilikBaslangic)
                                          : '-'}
                                        {' — Silindi'}
                                      </Typography>
                                    </TableCell>
                                    <TableCell align="center">
                                      <Chip 
                                        label="Silindi" 
                                        size="small" 
                                        color="error"
                                        variant="filled"
                                      />
                                    </TableCell>
                                    <TableCell>
                                      <Typography variant="body2">
                                        {versiyon.DegisiklikSebebi || 'İşlem listeden kaldırıldı'}
                                      </Typography>
                                    </TableCell>
                                  </TableRow>
                                );
                                i++;
                                continue;
                              }

                              const aktif = !versiyon.GecerlilikBitis;
                              const oncekiNormal = findNextNormal(i);
                              const farkVar = oncekiNormal && versiyon.Birim != null && oncekiNormal.Birim != null && versiyon.Birim !== oncekiNormal.Birim;
                              const fark = farkVar ? versiyon.Birim - oncekiNormal.Birim : 0;
                              const isDegisiklikYok = !farkVar && oncekiNormal && !aktif;

                              if (isDegisiklikYok) {
                                let groupEnd = i;
                                while (
                                  groupEnd + 1 < versiyonlar.length &&
                                  !isSilmeKaydi(versiyonlar[groupEnd + 1])
                                ) {
                                  const nextV = versiyonlar[groupEnd + 1];
                                  const nextNormal = findNextNormal(groupEnd + 1);
                                  if (!nextNormal) break;
                                  if (nextV.Birim !== nextNormal.Birim) break;
                                  if (!nextV.GecerlilikBitis) break;
                                  groupEnd++;
                                }
                                const groupCount = groupEnd - i + 1;
                                if (groupCount >= 2) {
                                  const firstV = versiyonlar[i];
                                  const lastV = versiyonlar[groupEnd];
                                  rows.push(
                                    <TableRow key={`group-${i}`} sx={{ bgcolor: 'action.hover' }}>
                                      <TableCell>
                                        <Chip label={`V${firstV.VersionID}–V${lastV.VersionID}`} size="small" variant="outlined" />
                                      </TableCell>
                                      <TableCell align="right">
                                        <Typography variant="body2" fontWeight="700">
                                          {firstV.Birim != null ? firstV.Birim.toFixed(2) : '-'}
                                        </Typography>
                                      </TableCell>
                                      <TableCell>
                                        <Typography variant="body2">
                                          {lastV.GecerlilikBaslangic ? formatDateShort(lastV.GecerlilikBaslangic) : '-'}
                                        </Typography>
                                      </TableCell>
                                      <TableCell>
                                        <Typography variant="body2">
                                          {firstV.GecerlilikBitis ? formatDateShort(firstV.GecerlilikBitis) : '-'}
                                        </Typography>
                                      </TableCell>
                                      <TableCell align="center">
                                        <Chip label="Geçmiş" size="small" variant="outlined" />
                                      </TableCell>
                                      <TableCell>
                                        <Typography variant="body2" color="text.secondary" fontStyle="italic">
                                          {groupCount} versiyon boyunca değişiklik yok
                                        </Typography>
                                      </TableCell>
                                    </TableRow>
                                  );
                                  i = groupEnd + 1;
                                  continue;
                                }
                              }

                              rows.push(
                                <TableRow 
                                  key={i} 
                                  hover
                                  sx={{ 
                                    '&:nth-of-type(odd)': { bgcolor: 'action.hover' },
                                    bgcolor: aktif ? 'rgba(76, 175, 80, 0.08)' : undefined
                                  }}
                                >
                                  <TableCell>
                                    <Chip 
                                      label={`V${versiyon.VersionID}`} 
                                      size="small" 
                                      color={aktif ? 'success' : 'default'}
                                      variant={aktif ? 'filled' : 'outlined'}
                                    />
                                  </TableCell>
                                  <TableCell align="right">
                                    <Stack direction="column" spacing={0.5} alignItems="flex-end">
                                      <Typography variant="body2" fontWeight="700">
                                        {versiyon.Birim != null ? versiyon.Birim.toFixed(2) : '-'}
                                      </Typography>
                                      {farkVar && (
                                        <Typography 
                                          variant="caption" 
                                          color={fark > 0 ? 'error.main' : 'success.main'}
                                          fontWeight="600"
                                        >
                                          {fark > 0 ? '+' : ''}{fark.toFixed(2)}
                                        </Typography>
                                      )}
                                    </Stack>
                                  </TableCell>
                                  <TableCell>
                                    <Typography variant="body2">
                                      {versiyon.GecerlilikBaslangic
                                        ? formatDateShort(versiyon.GecerlilikBaslangic)
                                        : '-'}
                                    </Typography>
                                  </TableCell>
                                  <TableCell>
                                    {versiyon.GecerlilikBitis ? (
                                      <Typography variant="body2">
                                        {formatDateShort(versiyon.GecerlilikBitis)}
                                      </Typography>
                                    ) : (
                                      <Chip label="Devam Ediyor" size="small" color="success" />
                                    )}
                                  </TableCell>
                                  <TableCell align="center">
                                    <Chip 
                                      label={aktif ? 'Aktif' : 'Geçmiş'} 
                                      size="small" 
                                      color={aktif ? 'success' : 'default'}
                                      variant="outlined"
                                    />
                                  </TableCell>
                                  <TableCell>
                                    <Typography variant="body2">
                                      {versiyon.DegisiklikSebebi || '-'}
                                    </Typography>
                                  </TableCell>
                                </TableRow>
                              );
                              i++;
                            }
                            return rows;
                          })()}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  ) : (
                    <Paper sx={{ p: 6, textAlign: 'center', bgcolor: 'background.default' }}>
                      <EmptyState message="Versiyon geçmişi bulunamadı" />
                    </Paper>
                  )}
                </Box>

                {/* Şu anki durum özeti */}
                <Box sx={{ mt: 2, p: 2, bgcolor: gecmisResult.mevcutMu ? 'rgba(76, 175, 80, 0.08)' : 'rgba(244, 67, 54, 0.08)', borderRadius: 1 }}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Chip 
                      label={gecmisResult.mevcutMu ? 'AKTİF' : 'SİLİNMİŞ'} 
                      size="small" 
                      color={gecmisResult.mevcutMu ? 'success' : 'error'}
                    />
                    <Typography variant="body2" fontWeight="600">
                      Şu Anki Durum:
                    </Typography>
                    <Typography variant="body2">
                      {gecmisResult.mevcutMu 
                        ? 'İşlem sistemde aktif olarak bulunuyor'
                        : 'İşlem sistemde bulunmuyor (silinmiş)'}
                    </Typography>
                  </Stack>
                </Box>


              </Stack>
            )}

            {/* Empty State */}
            {gecmisResult && !gecmisResult.islem && (
              <Paper sx={{ p: 6, textAlign: 'center', bgcolor: 'background.default' }}>
                <EmptyState message="Bu HUV koduna ait işlem bulunamadı" />
              </Paper>
            )}
          </Stack>
        </Paper>
      </TabPanel>
    </Container>
  );
}

export default Tarihsel;
