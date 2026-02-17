// ============================================
// SUT TARİHSEL SORGULAR SAYFASI
// ============================================
// SUT kodları için geçmiş puan sorgulamaları ve değişiklik takibi
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
import { showSuccess, showError, showInfo } from '../utils/toast';
import { exportToExcel } from '../utils/export';
import { LoadingSpinner, ErrorAlert, EmptyState, PageHeader } from '../components/common';
import { 
  getTodayString, 
  getDaysAgo, 
  isFutureDate, 
  validateDateRange,
  formatDateShort,
  formatDateTime
} from '../utils/dateUtils';

function TabPanel({ children, value, index }) {
  return (
    <div hidden={value !== index}>
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  );
}

function SutTarihsel() {
  const [tabValue, setTabValue] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Tab 1: Tarihteki Puan
  const [puanForm, setPuanForm] = useState({
    sutKodu: '',
    tarih: getTodayString()
  });
  const [puanResult, setPuanResult] = useState(null);

  // Tab 2: Değişenler
  const [degişenlerForm, setDegişenlerForm] = useState({
    baslangic: getDaysAgo(30),
    bitis: getTodayString()
  });
  const [degişenlerResult, setDegişenlerResult] = useState([]);

  // Tab 3: Puan Geçmişi
  const [gecmisForm, setGecmisForm] = useState({
    sutKodu: ''
  });
  const [gecmisResult, setGecmisResult] = useState(null);

  const handleTabChange = (_event, newValue) => {
    setTabValue(newValue);
    setError(null);
  };

  // ============================================
  // TAB 1: Tarihteki Puan Sorgula
  // ============================================
  const handlePuanSorgula = async () => {
    if (!puanForm.sutKodu || !puanForm.tarih) {
      showError('SUT kodu ve tarih zorunludur');
      return;
    }

    if (isFutureDate(puanForm.tarih)) {
      showError('Gelecek tarih için sorgu yapılamaz');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const response = await tarihselService.getSutPuanByTarih({
        sutKodu: puanForm.sutKodu,
        tarih: puanForm.tarih
      });
      
      // API response formatı: { success: true, data: {...}, message: "..." }
      const result = response.data?.data || response.data;
      if (result) {
        setPuanResult(result);
        showSuccess('Puan bilgisi başarıyla getirildi');
      } else {
        setPuanResult(null);
        // Backend'den gelen detaylı hata mesajını göster
        const errorDetail = response.data?.detay || response.data?.message;
        if (errorDetail) {
          showError(errorDetail);
        } else {
          showError('Bu tarihte puan bulunamadı');
        }
      }
    } catch (err) {
      console.error('Puan sorgu hatası:', err);
      setError(err);
      setPuanResult(null);
      
      // Detaylı hata mesajı
      const errorMessage = err.response?.data?.message || 
                          err.response?.data?.detay || 
                          err.message || 
                          'Puan sorgulanamadı';
      
      // En eski tarih bilgisi varsa göster
      if (err.response?.data?.enEskiTarih) {
        showError(`${errorMessage} (En eski kayıt: ${err.response.data.enEskiTarih})`);
      } else {
        showError(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePuanExport = () => {
    if (!puanResult) {
      showError('Export edilecek veri yok');
      return;
    }

    try {
      const data = [{
        'SUT Kodu': puanResult.SutKodu || '-',
        'İşlem Adı': puanResult.IslemAdi || '-',
        'Puan': puanResult.Puan || '-',
        'Tarih': formatDateShort(puanForm.tarih),
        'Geçerlilik Başlangıç': puanResult.GecerlilikBaslangic ? formatDateShort(puanResult.GecerlilikBaslangic) : '-',
        'Geçerlilik Bitiş': puanResult.GecerlilikBitis ? formatDateShort(puanResult.GecerlilikBitis) : 'Devam Ediyor',
        'Değişiklik Sebebi': puanResult.DegisiklikSebebi || '-'
      }];

      exportToExcel(data, 'tarihteki_sut_puan');
      showSuccess('Excel dosyası başarıyla indirildi');
    } catch (err) {
      console.error('Export hatası:', err);
      showError('Excel dosyası oluşturulamadı');
    }
  };

  // ============================================
  // TAB 2: Değişenleri Sorgula
  // ============================================
  const handleDegişenlerSorgula = async () => {
    const validation = validateDateRange(degişenlerForm.baslangic, degişenlerForm.bitis);
    if (!validation.valid) {
      showError(validation.error);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const response = await tarihselService.getSutDegişenler({
        baslangic: degişenlerForm.baslangic,
        bitis: degişenlerForm.bitis
      });

      // API response formatı: { success: true, data: [...], message: "..." }
      const data = response.data?.data || response.data || [];
      setDegişenlerResult(data);
      
      if (data.length === 0) {
        // Backend'den gelen uyarı mesajını göster
        const uyari = response.data?.uyari || 'Bu tarih aralığında değişiklik bulunamadı';
        showInfo(uyari);
      } else {
        showSuccess(`${data.length} değişiklik bulundu`);
      }
    } catch (err) {
      console.error('Değişenler sorgu hatası:', err);
      setError(err);
      setDegişenlerResult([]);
      // Backend'den gelen detaylı hata mesajı
      const errorData = err.response?.data;
      const errorMessage = errorData?.message || 
                          errorData?.errors?.cozum || 
                          errorData?.detay || 
                          err.message || 
                          'Değişiklikler sorgulanamadı';
      
      // Başlangıç tarihi hatası için özel mesaj
      if (errorData?.errors?.tip === 'TARIH_BASLANGIC_ONDEN' || errorData?.errors?.tip === 'GECERSIZ_TARIH_ARALIGI') {
        const cozum = errorData.errors.cozum || '';
        const baslangicTarihi = errorData.errors.baslangicTarihi || '2026-01-01';
        showError(`${errorMessage}\n${cozum}\nBaşlangıç tarihi: ${baslangicTarihi}`);
      } else {
        showError(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDegişenlerExport = () => {
    if (!degişenlerResult || degişenlerResult.length === 0) {
      showError('Export edilecek veri yok');
      return;
    }

    try {
      const data = degişenlerResult.map(item => ({
        'SUT Kodu': item.SutKodu || '-',
        'İşlem Adı': item.IslemAdi || '-',
        'Eski Puan': item.EskiPuan || item.IlkPuan || '-',
        'Yeni Puan': item.YeniPuan || item.SonPuan || '-',
        'Fark': item.Fark || item.PuanDegisimi || '-',
        'Değişim %': item.DegisimYuzdesi ? `${parseFloat(item.DegisimYuzdesi).toFixed(2)}%` : '-',
        'İlk Değişiklik': item.IlkDegisiklik ? formatDateShort(item.IlkDegisiklik) : '-',
        'Son Değişiklik': item.SonDegisiklik ? formatDateShort(item.SonDegisiklik) : item.DegisiklikTarihi ? formatDateShort(item.DegisiklikTarihi) : '-',
        'Değişiklik Sayısı': item.DegisiklikSayisi || 1
      }));

      exportToExcel(data, 'degisen_sut_kodlari');
      showSuccess('Excel dosyası başarıyla indirildi');
    } catch (err) {
      console.error('Export hatası:', err);
      showError('Excel dosyası oluşturulamadı');
    }
  };

  // ============================================
  // TAB 3: Puan Geçmişi Sorgula
  // ============================================
  const handleGecmisSorgula = async () => {
    if (!gecmisForm.sutKodu) {
      showError('SUT kodu zorunludur');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const response = await tarihselService.getSutPuanGecmisi(gecmisForm.sutKodu);

      // API response formatı: { success: true, data: {...}, message: "..." }
      const result = response.data?.data || response.data;
      if (result) {
        // API'den gelen 'islem' field'ını 'sut' olarak map et
        setGecmisResult({
          ...result,
          sut: result.islem || result.sut // islem varsa sut'a map et
        });
        showSuccess('Puan geçmişi başarıyla getirildi');
      } else {
        setGecmisResult(null);
        // Backend'den gelen detaylı hata mesajını göster
        const errorDetail = response.data?.detay || response.data?.message;
        if (errorDetail) {
          showError(errorDetail);
        } else {
          showError('Puan geçmişi bulunamadı');
        }
      }
    } catch (err) {
      console.error('Geçmiş sorgu hatası:', err);
      setError(err);
      setGecmisResult(null);
      showError(err.response?.data?.message || 'Puan geçmişi sorgulanamadı');
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
      const versiyonData = gecmisResult.versiyonlar.map((versiyon, index) => {
        const oncekiVersiyon = gecmisResult.versiyonlar[index + 1];
        // PuanDegisimi varsa onu kullan, yoksa hesapla
        const fark = versiyon.PuanDegisimi !== null && versiyon.PuanDegisimi !== undefined
          ? versiyon.PuanDegisimi
          : (oncekiVersiyon && versiyon.Puan && oncekiVersiyon.Puan 
            ? versiyon.Puan - oncekiVersiyon.Puan 
            : null);
        
        return {
          'Versiyon ID': versiyon.SutVersionID || versiyon.VersionID || '-',
          'SUT Kodu': gecmisResult.sut?.SutKodu || '-',
          'İşlem Adı': gecmisResult.sut?.IslemAdi || '-',
          'Puan': versiyon.Puan || '-',
          'Fark': fark !== null ? (fark > 0 ? '+' : '') + fark.toFixed(2) : '-',
          'Değişim %': versiyon.PuanDegisimYuzdesi ? `${parseFloat(versiyon.PuanDegisimYuzdesi).toFixed(2)}%` : '-',
          'Geçerlilik Başlangıç': versiyon.GecerlilikBaslangic ? formatDateShort(versiyon.GecerlilikBaslangic) : '-',
          'Geçerlilik Bitiş': versiyon.GecerlilikBitis ? formatDateShort(versiyon.GecerlilikBitis) : 'Devam Ediyor',
          'Durum': versiyon.AktifMi && !versiyon.GecerlilikBitis ? 'Aktif' : 'Geçmiş',
          'Değişiklik Sebebi': versiyon.DegisiklikSebebi || '-'
        };
      });

      exportToExcel(versiyonData, `sut_puan_gecmisi_${gecmisResult.sut?.SutKodu || 'bilinmeyen'}`);
      showSuccess('Excel dosyası başarıyla indirildi');
    } catch (err) {
      console.error('Export hatası:', err);
      showError('Excel dosyası oluşturulamadı');
    }
  };

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      <PageHeader 
        title="SUT Tarihsel Sorgular" 
        subtitle="SUT kodları için geçmiş puan sorgulamaları ve değişiklik takibi"
        icon={HistoryIcon}
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
            label="Tarihteki Puan" 
            icon={<SearchIcon />} 
            iconPosition="start"
          />
          <Tab 
            label="Değişen Kodlar" 
            icon={<DateRangeIcon />} 
            iconPosition="start"
          />
          <Tab 
            label="Puan Geçmişi" 
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

      {/* TAB 1: Tarihteki Puan */}
      <TabPanel value={tabValue} index={0}>
        <Paper sx={{ p: 4 }}>
          <Stack spacing={3}>
            <Box>
              <Typography variant="h5" gutterBottom fontWeight="600">
                Belirli Tarihteki Puan Sorgulama
              </Typography>
              <Alert severity="info" icon={<InfoIcon />} sx={{ mt: 2, mb: 2 }}>
                Bir SUT kodunun geçmişteki belirli bir tarihteki puanını sorgulayın
              </Alert>
              <Alert severity="warning" sx={{ mb: 2 }}>
                <Typography variant="body2" fontWeight="600">Başlangıç Tarihi: 01.01.2026</Typography>
                <Typography variant="body2">
                  SUT listesi için sorgu yapılabilecek en eski tarih <strong>01.01.2026</strong> tarihidir. 
                  Bu tarih, sistemdeki ilk import tarihidir.
                </Typography>
              </Alert>
            </Box>

            <Grid container spacing={3}>
              <Grid item xs={12} md={5}>
                <TextField
                  fullWidth
                  label="SUT Kodu"
                  value={puanForm.sutKodu}
                  onChange={(e) => setPuanForm({ ...puanForm, sutKodu: e.target.value })}
                  placeholder="Örn: 510010"
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
                  value={puanForm.tarih}
                  onChange={(e) => setPuanForm({ ...puanForm, tarih: e.target.value })}
                  slotProps={{ 
                    inputLabel: { shrink: true },
                    htmlInput: { max: getTodayString() }
                  }}
                />
              </Grid>
              <Grid item xs={12} md={3}>
                <Button
                  fullWidth
                  variant="contained"
                  size="large"
                  onClick={handlePuanSorgula}
                  disabled={loading}
                  sx={{ height: '56px' }}
                >
                  {loading ? <LoadingSpinner size={24} inline /> : 'Sorgula'}
                </Button>
              </Grid>
            </Grid>

            {puanResult && (
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
                        onClick={handlePuanExport}
                        size="small"
                      >
                        Excel'e Aktar
                      </Button>
                    </Box>

                    <Grid container spacing={3}>
                      <Grid item xs={12} md={6}>
                        <Paper sx={{ p: 2, bgcolor: 'background.paper' }}>
                          <Typography variant="caption" color="textSecondary" gutterBottom display="block">
                            SUT Kodu
                          </Typography>
                          <Typography variant="h6" fontWeight="600">
                            {puanResult.SutKodu}
                          </Typography>
                        </Paper>
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <Paper sx={{ p: 2, bgcolor: 'background.paper' }}>
                          <Typography variant="caption" color="textSecondary" gutterBottom display="block">
                            İşlem Adı
                          </Typography>
                          <Typography variant="h6" fontWeight="600">
                            {puanResult.IslemAdi}
                          </Typography>
                        </Paper>
                      </Grid>
                      <Grid item xs={12} md={4}>
                        <Paper sx={{ p: 2, bgcolor: 'primary.light' }}>
                          <Typography variant="caption" color="textSecondary" gutterBottom display="block">
                            Puan
                          </Typography>
                          <Typography variant="h4" color="primary.main" fontWeight="700">
                            {puanResult.Puan || 'Belirtilmemiş'}
                          </Typography>
                        </Paper>
                      </Grid>
                      <Grid item xs={12} md={4}>
                        <Paper sx={{ p: 2, bgcolor: 'background.paper' }}>
                          <Typography variant="caption" color="textSecondary" gutterBottom display="block">
                            Tarih
                          </Typography>
                          <Typography variant="h6" fontWeight="600">
                            {new Date(puanForm.tarih).toLocaleDateString('tr-TR', { 
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
                            Hiyerarşi Seviyesi
                          </Typography>
                          <Typography variant="h6" fontWeight="600">
                            {puanResult.HiyerarsiSeviyesi || '-'}
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

      {/* TAB 2: Değişen Kodlar */}
      <TabPanel value={tabValue} index={1}>
        <Paper sx={{ p: 4 }}>
          <Stack spacing={3}>
            <Box>
              <Typography variant="h5" gutterBottom fontWeight="600">
                Tarih Aralığında Değişen SUT Kodları
              </Typography>
              <Alert severity="info" icon={<InfoIcon />} sx={{ mt: 2 }}>
                Belirli bir tarih aralığında puanı değişen SUT kodlarını listeleyin
              </Alert>
            </Box>

            <Grid container spacing={3}>
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  label="Başlangıç Tarihi"
                  type="date"
                  value={degişenlerForm.baslangic}
                  onChange={(e) => setDegişenlerForm({ ...degişenlerForm, baslangic: e.target.value })}
                  slotProps={{
                    inputLabel: { shrink: true },
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
                  value={degişenlerForm.bitis}
                  onChange={(e) => setDegişenlerForm({ ...degişenlerForm, bitis: e.target.value })}
                  slotProps={{ inputLabel: { shrink: true } }}
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <Button
                  fullWidth
                  variant="contained"
                  size="large"
                  onClick={handleDegişenlerSorgula}
                  disabled={loading}
                  sx={{ height: '56px' }}
                >
                  {loading ? <LoadingSpinner size={24} inline /> : 'Sorgula'}
                </Button>
              </Grid>
            </Grid>

            {degişenlerResult && degişenlerResult.length > 0 && (
              <Box>
                <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
                  <Alert severity="success" sx={{ flexGrow: 1 }}>
                    <strong>{degişenlerResult.length}</strong> SUT kodunda değişiklik bulundu
                  </Alert>
                  <Button
                    variant="contained"
                    startIcon={<FileDownloadIcon />}
                    onClick={handleDegişenlerExport}
                  >
                    Excel'e Aktar
                  </Button>
                </Stack>

                <TableContainer component={Paper} variant="outlined">
                  <Table>
                    <TableHead>
                      <TableRow sx={{ bgcolor: 'primary.light' }}>
                        <TableCell><strong>SUT Kodu</strong></TableCell>
                        <TableCell><strong>İşlem Adı</strong></TableCell>
                        <TableCell align="right"><strong>Eski Puan</strong></TableCell>
                        <TableCell align="right"><strong>Yeni Puan</strong></TableCell>
                        <TableCell align="right"><strong>Fark</strong></TableCell>
                        <TableCell align="center"><strong>Değişim</strong></TableCell>
                        <TableCell align="center"><strong>Tarih</strong></TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {degişenlerResult.map((item, index) => {
                        const fark = (item.YeniPuan || 0) - (item.EskiPuan || 0);
                        const yuzde = item.EskiPuan ? ((fark / item.EskiPuan) * 100) : 0;
                        const artis = fark > 0;
                        
                        return (
                          <TableRow 
                            key={index} 
                            hover
                            sx={{ '&:nth-of-type(odd)': { bgcolor: 'action.hover' } }}
                          >
                            <TableCell>
                              <Chip label={item.SutKodu} size="small" variant="outlined" />
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2" sx={{ maxWidth: 300 }}>
                                {item.IslemAdi}
                              </Typography>
                            </TableCell>
                            <TableCell align="right">
                              <Typography variant="body2" color="textSecondary">
                                {item.EskiPuan || '-'}
                              </Typography>
                            </TableCell>
                            <TableCell align="right">
                              <Typography variant="body2" fontWeight="600">
                                {item.YeniPuan || '-'}
                              </Typography>
                            </TableCell>
                            <TableCell align="right">
                              <Typography 
                                variant="body2" 
                                color={artis ? 'error.main' : 'success.main'}
                                fontWeight="700"
                              >
                                {artis ? '+' : ''}{fark.toFixed(2)}
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

            {degişenlerResult && degişenlerResult.length === 0 && !loading && (
              <Paper sx={{ p: 6, textAlign: 'center', bgcolor: 'background.default' }}>
                <EmptyState message="Bu tarih aralığında değişiklik bulunamadı" />
              </Paper>
            )}
          </Stack>
        </Paper>
      </TabPanel>

      {/* TAB 3: Puan Geçmişi */}
      <TabPanel value={tabValue} index={2}>
        <Paper sx={{ p: 4 }}>
          <Stack spacing={3}>
            <Box>
              <Typography variant="h5" gutterBottom fontWeight="600">
                SUT Kodu Puan Geçmişi
              </Typography>
              <Alert severity="info" icon={<InfoIcon />} sx={{ mt: 2 }}>
                Bir SUT kodunu girerek tüm puan değişiklik geçmişini görüntüleyin
              </Alert>
            </Box>

            <Grid container spacing={3}>
              <Grid item xs={12} md={9}>
                <TextField
                  fullWidth
                  label="SUT Kodu"
                  value={gecmisForm.sutKodu}
                  onChange={(e) => setGecmisForm({ ...gecmisForm, sutKodu: e.target.value })}
                  placeholder="Örn: 510010"
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

            {gecmisResult && gecmisResult.sut && (
              <Stack spacing={3}>
                {/* Başlangıç Tarihi Bilgisi */}
                {gecmisResult.baslangicTarihi && (
                  <Alert severity="info" icon={<InfoIcon />}>
                    <Typography variant="body2" fontWeight="600">Başlangıç Tarihi: {gecmisResult.baslangicTarihi}</Typography>
                    <Typography variant="body2">
                      SUT listesi için sorgu yapılabilecek en eski tarih <strong>{gecmisResult.baslangicTarihi}</strong> tarihidir.
                    </Typography>
                    {gecmisResult.uyari && (
                      <Typography variant="body2" sx={{ mt: 1, fontStyle: 'italic' }}>
                        {gecmisResult.uyari}
                      </Typography>
                    )}
                  </Alert>
                )}
                
                {!gecmisResult.mevcutMu && (
                  <Alert severity="warning" icon={<InfoIcon />}>
                    <strong>Bu SUT kodu şu anda sistemde mevcut değil.</strong> Kod daha önce silinmiş olabilir. Aşağıda geçmiş kayıtlarını görüntüleyebilirsiniz.
                  </Alert>
                )}

                <Card variant="outlined" sx={{ bgcolor: 'background.default' }}>
                  <CardContent sx={{ p: 3 }}>
                    <Stack spacing={3}>
                      <Box display="flex" justifyContent="space-between" alignItems="center">
                        <Typography variant="h6" fontWeight="600">
                          SUT Bilgisi
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
                              SUT Kodu
                            </Typography>
                            <Typography variant="h6" fontWeight="600">
                              {gecmisResult.sut?.SutKodu}
                            </Typography>
                          </Paper>
                        </Grid>
                        <Grid item xs={12} md={gecmisResult.mevcutMu ? 5 : 6}>
                          <Paper sx={{ p: 2, bgcolor: 'background.paper' }}>
                            <Typography variant="caption" color="textSecondary" gutterBottom display="block">
                              İşlem Adı
                            </Typography>
                            <Typography variant="h6" fontWeight="600">
                              {gecmisResult.sut?.IslemAdi}
                            </Typography>
                          </Paper>
                        </Grid>
                        {gecmisResult.mevcutMu && (
                          <Grid item xs={12} md={3}>
                            <Paper sx={{ p: 2, bgcolor: 'primary.light' }}>
                              <Typography variant="caption" color="textSecondary" gutterBottom display="block">
                                Güncel Puan
                              </Typography>
                              <Typography variant="h5" color="primary.main" fontWeight="700">
                                {gecmisResult.sut?.GuncelPuan || '-'}
                              </Typography>
                            </Paper>
                          </Grid>
                        )}
                      </Grid>
                    </Stack>
                  </CardContent>
                </Card>

                <Box>
                  <Typography variant="h6" gutterBottom fontWeight="600" sx={{ mb: 2 }}>
                    Puan Değişim Geçmişi
                  </Typography>
                  
                  {gecmisResult.versiyonlar && gecmisResult.versiyonlar.length > 0 ? (
                    <TableContainer component={Paper} variant="outlined">
                      <Table size="small">
                        <TableHead>
                          <TableRow sx={{ bgcolor: 'primary.light' }}>
                            <TableCell width="100"><strong>Versiyon</strong></TableCell>
                            <TableCell align="right" width="120"><strong>Puan</strong></TableCell>
                            <TableCell width="150"><strong>Başlangıç</strong></TableCell>
                            <TableCell width="150"><strong>Bitiş</strong></TableCell>
                            <TableCell width="100" align="center"><strong>Durum</strong></TableCell>
                            <TableCell><strong>Açıklama</strong></TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {gecmisResult.versiyonlar.map((versiyon, index) => {
                            const aktif = versiyon.AktifMi && !versiyon.GecerlilikBitis;
                            const oncekiVersiyon = gecmisResult.versiyonlar[index + 1];
                            const farkVar = oncekiVersiyon && versiyon.Puan !== oncekiVersiyon.Puan;
                            const fark = farkVar ? versiyon.Puan - oncekiVersiyon.Puan : 0;
                            
                            return (
                              <TableRow 
                                key={index} 
                                hover
                                sx={{ 
                                  '&:nth-of-type(odd)': { bgcolor: 'action.hover' },
                                  bgcolor: aktif ? 'success.lighter' : undefined
                                }}
                              >
                                <TableCell>
                                  <Chip 
                                    label={`V${versiyon.SutVersionID || versiyon.VersionID}`} 
                                    size="small" 
                                    color={aktif ? 'success' : 'default'}
                                    variant={aktif ? 'filled' : 'outlined'}
                                  />
                                </TableCell>
                                <TableCell align="right">
                                  <Stack direction="column" spacing={0.5} alignItems="flex-end">
                                    <Typography variant="body2" fontWeight="700">
                                      {versiyon.Puan || '-'}
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
                          })}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  ) : (
                    <Paper sx={{ p: 6, textAlign: 'center', bgcolor: 'background.default' }}>
                      <EmptyState message="Versiyon geçmişi bulunamadı" />
                    </Paper>
                  )}
                </Box>

                <Box>
                  <Typography variant="h6" gutterBottom fontWeight="600" sx={{ mb: 2 }}>
                    SUT Kodu Yaşam Döngüsü
                  </Typography>
                  <TableContainer component={Paper} variant="outlined">
                    <Table size="small">
                      <TableHead>
                        <TableRow sx={{ bgcolor: 'info.light' }}>
                          <TableCell width="200"><strong>Tarih</strong></TableCell>
                          <TableCell width="150"><strong>Durum</strong></TableCell>
                          <TableCell><strong>Açıklama</strong></TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {(() => {
                          const timeline = [];
                          
                          const sortedAudit = gecmisResult.auditGecmisi 
                            ? [...gecmisResult.auditGecmisi].sort((a, b) => 
                                new Date(a.DegisiklikTarihi) - new Date(b.DegisiklikTarihi)
                              )
                            : [];
                          
                          const seenKeys = new Set();
                          const filteredAudit = sortedAudit.filter(audit => {
                            const key = `${audit.IslemTipi}_${new Date(audit.DegisiklikTarihi).getTime()}`;
                            if (seenKeys.has(key)) return false;
                            seenKeys.add(key);
                            return true;
                          });
                          
                          const mergedAudit = [];
                          for (let i = 0; i < filteredAudit.length; i++) {
                            const current = filteredAudit[i];
                            const next = filteredAudit[i + 1];
                            
                            if (current.IslemTipi === 'DELETE' && next && next.IslemTipi === 'INSERT') {
                              const currentDate = new Date(current.DegisiklikTarihi).toDateString();
                              const nextDate = new Date(next.DegisiklikTarihi).toDateString();
                              
                              if (currentDate === nextDate) {
                                mergedAudit.push({
                                  ...current,
                                  IslemTipi: 'UPDATE',
                                  Aciklama: 'Yeni versiyon import edildi (değişiklik yok)'
                                });
                                i++;
                                continue;
                              }
                            }
                            
                            mergedAudit.push(current);
                          }
                          
                          mergedAudit.forEach((audit, index) => {
                            if (audit.IslemTipi === 'INSERT') {
                              const isIlkEkleme = index === 0 || 
                                mergedAudit.slice(0, index).every(a => a.IslemTipi !== 'INSERT');
                              
                              timeline.push({
                                tarih: audit.DegisiklikTarihi,
                                tip: 'INSERT',
                                aciklama: audit.Aciklama || (isIlkEkleme ? 'İlk kayıt oluşturuldu' : 'SUT kodu tekrar eklendi'),
                                kesin: true
                              });
                            } else if (audit.IslemTipi === 'DELETE') {
                              timeline.push({
                                tarih: audit.DegisiklikTarihi,
                                tip: 'DELETE',
                                aciklama: audit.Aciklama || 'SUT kodu silindi',
                                kesin: true
                              });
                            } else if (audit.IslemTipi === 'UPDATE') {
                              timeline.push({
                                tarih: audit.DegisiklikTarihi,
                                tip: 'UPDATE',
                                aciklama: audit.Aciklama || 'Versiyon güncellendi',
                                kesin: true
                              });
                            }
                          });
                          
                          if (timeline.length === 0 && gecmisResult.versiyonlar && gecmisResult.versiyonlar.length > 0) {
                            const ilkVersiyon = gecmisResult.versiyonlar[gecmisResult.versiyonlar.length - 1];
                            timeline.push({
                              tarih: ilkVersiyon.GecerlilikBaslangic,
                              tip: 'INSERT',
                              aciklama: 'İlk kayıt oluşturuldu (tahmini)',
                              kesin: false
                            });
                          }
                          
                          if (!gecmisResult.mevcutMu && timeline.length > 0) {
                            const sonIslem = timeline[timeline.length - 1];
                            if (sonIslem.tip !== 'DELETE') {
                              timeline.push({
                                tarih: null,
                                tip: 'DELETE',
                                aciklama: 'SUT kodu sistemden kaldırılmış (silme tarihi bilinmiyor)',
                                kesin: false
                              });
                            }
                          }
                          
                          timeline.sort((a, b) => {
                            if (!a.tarih) return -1;
                            if (!b.tarih) return 1;
                            return new Date(b.tarih) - new Date(a.tarih);
                          });
                          
                          return timeline.length > 0 ? timeline.map((item, index) => (
                            <TableRow 
                              key={index} 
                              hover
                              sx={{ 
                                '&:nth-of-type(odd)': { bgcolor: 'action.hover' },
                                opacity: item.kesin ? 1 : 0.7
                              }}
                            >
                              <TableCell>
                                <Typography variant="body2" fontWeight={item.kesin ? 600 : 400}>
                                  {item.tarih 
                                    ? formatDateTime(item.tarih)
                                    : 'Tarih bilinmiyor'}
                                </Typography>
                              </TableCell>
                              <TableCell>
                                <Chip 
                                  label={item.tip === 'INSERT' ? 'Eklendi' : item.tip === 'DELETE' ? 'Silindi' : 'Güncellendi'} 
                                  size="small" 
                                  color={item.tip === 'INSERT' ? 'success' : item.tip === 'DELETE' ? 'error' : 'info'}
                                  variant={item.kesin ? 'filled' : 'outlined'}
                                />
                              </TableCell>
                              <TableCell>
                                <Typography variant="body2">
                                  {item.aciklama}
                                  {!item.kesin && (
                                    <Typography component="span" variant="caption" color="textSecondary" sx={{ ml: 1 }}>
                                      (tahmini)
                                    </Typography>
                                  )}
                                </Typography>
                              </TableCell>
                            </TableRow>
                          )) : (
                            <TableRow>
                              <TableCell colSpan={3} align="center" sx={{ py: 4 }}>
                                <EmptyState message="Yaşam döngüsü bilgisi bulunamadı" />
                              </TableCell>
                            </TableRow>
                          );
                        })()}
                      </TableBody>
                    </Table>
                  </TableContainer>
                  
                  <Box sx={{ mt: 2, p: 2, bgcolor: gecmisResult.mevcutMu ? 'success.lighter' : 'error.lighter', borderRadius: 1 }}>
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
                          ? 'SUT kodu sistemde aktif olarak bulunuyor'
                          : 'SUT kodu sistemde bulunmuyor (silinmiş)'}
                      </Typography>
                    </Stack>
                  </Box>
                </Box>
              </Stack>
            )}

            {gecmisResult && !gecmisResult.sut && (
              <Paper sx={{ p: 6, textAlign: 'center', bgcolor: 'background.default' }}>
                <EmptyState message="Bu SUT koduna ait kayıt bulunamadı" />
              </Paper>
            )}
          </Stack>
        </Paper>
      </TabPanel>

    </Container>
  );
}

export default SutTarihsel;
