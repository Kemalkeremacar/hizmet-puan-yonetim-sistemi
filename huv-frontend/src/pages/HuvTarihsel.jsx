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
import { showSuccess, showError, showInfo } from '../utils/toast';
import { exportToExcel } from '../utils/export';
import { LoadingSpinner, ErrorAlert, EmptyState, PageHeader, DateDisplay } from '../components/common';
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
  const [degişenlerForm, setDegişenlerForm] = useState({
    baslangic: getDaysAgo(30),
    bitis: getTodayString()
  });
  const [degişenlerResult, setDegişenlerResult] = useState([]);

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

    // Gelecek tarih kontrolü
    if (isFutureDate(fiyatForm.tarih)) {
      showError('Gelecek tarih için sorgu yapılamaz');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const response = await tarihselService.getFiyatByTarih({
        huvKodu: parseFloat(fiyatForm.huvKodu),
        tarih: fiyatForm.tarih
      });
      
      if (response.data) {
        setFiyatResult(response.data);
        showSuccess('Fiyat bilgisi başarıyla getirildi');
      } else {
        setFiyatResult(null);
        showError('Bu tarihte fiyat bulunamadı');
      }
    } catch (err) {
      console.error('Fiyat sorgu hatası:', err);
      setError(err);
      setFiyatResult(null);
      showError(err.response?.data?.message || 'Fiyat sorgulanamadı');
    } finally {
      setLoading(false);
    }
  };

  const handleFiyatExport = () => {
    if (!fiyatResult) {
      showError('Export edilecek veri yok');
      return;
    }

    const data = [{
      'HUV Kodu': fiyatResult.HuvKodu,
      'İşlem Adı': fiyatResult.IslemAdi,
      'Birim (TL)': fiyatResult.Birim || '-',
      'Tarih': formatDateShort(fiyatForm.tarih),
      'Ana Dal': fiyatResult.BolumAdi || '-',
      'Hiyerarşi Seviyesi': fiyatResult.HiyerarsiSeviyesi || '-'
    }];

    exportToExcel(data, 'tarihteki_fiyat');
    showSuccess('Excel dosyası başarıyla indirildi');
  };

  // ============================================
  // TAB 2: Değişenleri Sorgula
  // ============================================
  const handleDegişenlerSorgula = async () => {
    // Tarih aralığı validasyonu
    const validation = validateDateRange(degişenlerForm.baslangic, degişenlerForm.bitis);
    if (!validation.valid) {
      showError(validation.error);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const response = await tarihselService.getDegişenler({
        baslangic: degişenlerForm.baslangic,
        bitis: degişenlerForm.bitis
      });

      const data = response.data || [];
      setDegişenlerResult(data);
      
      if (data.length === 0) {
        showInfo('Bu tarih aralığında değişiklik bulunamadı');
      } else {
        showSuccess(`${data.length} değişiklik bulundu`);
      }
    } catch (err) {
      console.error('Değişenler sorgu hatası:', err);
      setError(err);
      setDegişenlerResult([]);
      showError(err.response?.data?.message || 'Değişiklikler sorgulanamadı');
    } finally {
      setLoading(false);
    }
  };

  const handleDegişenlerExport = () => {
    if (!degişenlerResult || degişenlerResult.length === 0) {
      showError('Export edilecek veri yok');
      return;
    }

    const data = degişenlerResult.map(item => ({
      'HUV Kodu': item.HuvKodu,
      'İşlem Adı': item.IslemAdi,
      'Eski Birim (TL)': item.EskiBirim?.toFixed(2) || '-',
      'Yeni Birim (TL)': item.YeniBirim?.toFixed(2) || '-',
      'Fark (TL)': item.Fark?.toFixed(2) || '-',
      'Değişim %': item.DegisimYuzdesi ? `${item.DegisimYuzdesi.toFixed(2)}%` : '-',
      'Değişiklik Tarihi': item.DegisiklikTarihi ? formatDateShort(item.DegisiklikTarihi) : '-',
      'Ana Dal': item.BolumAdi || '-'
    }));

    exportToExcel(data, 'degisen_islemler');
    showSuccess('Excel dosyası başarıyla indirildi');
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

      if (response.data) {
        setGecmisResult(response.data);
        showSuccess('Fiyat geçmişi başarıyla getirildi');
      } else {
        setGecmisResult(null);
        showError('Fiyat geçmişi bulunamadı');
      }
    } catch (err) {
      console.error('Geçmiş sorgu hatası:', err);
      setError(err);
      setGecmisResult(null);
      showError(err.response?.data?.message || 'Fiyat geçmişi sorgulanamadı');
    } finally {
      setLoading(false);
    }
  };

  const handleGecmisExport = () => {
    if (!gecmisResult || !gecmisResult.versiyonlar || gecmisResult.versiyonlar.length === 0) {
      showError('Export edilecek veri yok');
      return;
    }

    // Versiyon geçmişi
    const versiyonData = gecmisResult.versiyonlar.map((versiyon, index) => {
      const oncekiVersiyon = gecmisResult.versiyonlar[index + 1];
      const fark = oncekiVersiyon && versiyon.Birim && oncekiVersiyon.Birim 
        ? versiyon.Birim - oncekiVersiyon.Birim 
        : null;
      
      return {
        'Versiyon ID': versiyon.VersionID,
        'HUV Kodu': gecmisResult.islem?.HuvKodu || '-',
        'İşlem Adı': gecmisResult.islem?.IslemAdi || '-',
        'Birim (TL)': versiyon.Birim?.toFixed(2) || '-',
        'Fark (TL)': fark ? fark.toFixed(2) : '-',
        'Geçerlilik Başlangıç': versiyon.GecerlilikBaslangic ? formatDateShort(versiyon.GecerlilikBaslangic) : '-',
        'Geçerlilik Bitiş': versiyon.GecerlilikBitis ? formatDateShort(versiyon.GecerlilikBitis) : 'Devam Ediyor',
        'Durum': versiyon.AktifMi && !versiyon.GecerlilikBitis ? 'Aktif' : 'Geçmiş',
        'Değişiklik Sebebi': versiyon.DegisiklikSebebi || '-'
      };
    });

    // Yaşam döngüsü
    const yasamData = [];
    
    // İlk ekleme
    if (gecmisResult.versiyonlar.length > 0) {
      const ilkVersiyon = gecmisResult.versiyonlar[gecmisResult.versiyonlar.length - 1];
      const ilkEklemeAudit = gecmisResult.auditGecmisi?.find(a => a.IslemTipi === 'INSERT');
      
      yasamData.push({
        'Tarih': ilkEklemeAudit?.DegisiklikTarihi 
          ? formatDateTime(ilkEklemeAudit.DegisiklikTarihi)
          : formatDateTime(ilkVersiyon.GecerlilikBaslangic),
        'İşlem': 'Eklendi',
        'Açıklama': ilkEklemeAudit?.Aciklama || 'İlk kayıt oluşturuldu'
      });
    }
    
    // Silme ve tekrar ekleme işlemleri
    gecmisResult.auditGecmisi?.forEach(audit => {
      if (audit.IslemTipi === 'DELETE' || (audit.IslemTipi === 'INSERT' && yasamData.length > 0)) {
        yasamData.push({
          'Tarih': formatDateTime(audit.DegisiklikTarihi),
          'İşlem': audit.IslemTipi === 'INSERT' ? 'Eklendi' : 'Silindi',
          'Açıklama': audit.Aciklama || '-'
        });
      }
    });
    
    // Şu anki durum
    yasamData.push({
      'Tarih': formatDateTime(new Date()),
      'İşlem': 'Şu Anki Durum',
      'Açıklama': gecmisResult.mevcutMu ? 'Aktif' : 'Silinmiş'
    });

    // İki sheet'li Excel oluştur
    const workbook = {
      SheetNames: ['Versiyon Geçmişi', 'Yaşam Döngüsü'],
      Sheets: {
        'Versiyon Geçmişi': window.XLSX?.utils.json_to_sheet(versiyonData),
        'Yaşam Döngüsü': window.XLSX?.utils.json_to_sheet(yasamData)
      }
    };

    // XLSX kütüphanesi varsa kullan, yoksa basit export
    if (window.XLSX) {
      window.XLSX.writeFile(workbook, `fiyat_gecmisi_${gecmisResult.islem?.HuvKodu}.xlsx`);
    } else {
      // Fallback: sadece versiyon geçmişi
      exportToExcel(versiyonData, `fiyat_gecmisi_${gecmisResult.islem?.HuvKodu}`);
    }
    
    showSuccess('Excel dosyası başarıyla indirildi');
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
              <Alert severity="info" icon={<InfoIcon />} sx={{ mt: 2 }}>
                Bir işlemin geçmişteki belirli bir tarihteki fiyatını sorgulayın
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
                    htmlInput: { max: getTodayString() }
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
                        <Paper sx={{ p: 2, bgcolor: 'primary.light' }}>
                          <Typography variant="caption" color="textSecondary" gutterBottom display="block">
                            Birim (Fiyat)
                          </Typography>
                          <Typography variant="h4" color="primary.main" fontWeight="700">
                            {fiyatResult.Birim ? `${fiyatResult.Birim.toFixed(2)} TL` : 'Belirtilmemiş'}
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

            {/* Sonuç */}
            {degişenlerResult && degişenlerResult.length > 0 && (
              <Box>
                <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
                  <Alert severity="success" sx={{ flexGrow: 1 }}>
                    <strong>{degişenlerResult.length}</strong> işlemde değişiklik bulundu
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
                      {degişenlerResult.map((item, index) => {
                        const fark = (item.YeniBirim || 0) - (item.EskiBirim || 0);
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
                                {item.EskiBirim ? `${item.EskiBirim.toFixed(2)} TL` : '-'}
                              </Typography>
                            </TableCell>
                            <TableCell align="right">
                              <Typography variant="body2" fontWeight="600">
                                {item.YeniBirim ? `${item.YeniBirim.toFixed(2)} TL` : '-'}
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

            {degişenlerResult && degişenlerResult.length === 0 && !loading && (
              <Paper sx={{ p: 6, textAlign: 'center', bgcolor: 'background.default' }}>
                <EmptyState message="Bu tarih aralığında değişiklik bulunamadı" />
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
                            <Paper sx={{ p: 2, bgcolor: 'primary.light' }}>
                              <Typography variant="caption" color="textSecondary" gutterBottom display="block">
                                Güncel Birim
                              </Typography>
                              <Typography variant="h5" color="primary.main" fontWeight="700">
                                {gecmisResult.islem?.GuncelBirim ? `${gecmisResult.islem.GuncelBirim.toFixed(2)} TL` : '-'}
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
                  
                  {gecmisResult.versiyonlar && gecmisResult.versiyonlar.length > 0 ? (
                    <TableContainer component={Paper} variant="outlined">
                      <Table size="small">
                        <TableHead>
                          <TableRow sx={{ bgcolor: 'primary.light' }}>
                            <TableCell width="100"><strong>Versiyon</strong></TableCell>
                            <TableCell align="right" width="120"><strong>Birim (TL)</strong></TableCell>
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
                            const farkVar = oncekiVersiyon && versiyon.Birim !== oncekiVersiyon.Birim;
                            const fark = farkVar ? versiyon.Birim - oncekiVersiyon.Birim : 0;
                            
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
                                    label={`V${versiyon.VersionID}`} 
                                    size="small" 
                                    color={aktif ? 'success' : 'default'}
                                    variant={aktif ? 'filled' : 'outlined'}
                                  />
                                </TableCell>
                                <TableCell align="right">
                                  <Stack direction="column" spacing={0.5} alignItems="flex-end">
                                    <Typography variant="body2" fontWeight="700">
                                      {versiyon.Birim ? versiyon.Birim.toFixed(2) : '-'}
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

                {/* Yaşam Döngüsü (Silme/Ekleme Kayıtları) */}
                <Box>
                  <Typography variant="h6" gutterBottom fontWeight="600" sx={{ mb: 2 }}>
                    İşlem Yaşam Döngüsü
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
                          
                          // Audit kayıtlarını tarihe göre sırala (en eski önce)
                          const sortedAudit = gecmisResult.auditGecmisi 
                            ? [...gecmisResult.auditGecmisi].sort((a, b) => 
                                new Date(a.DegisiklikTarihi) - new Date(b.DegisiklikTarihi)
                              )
                            : [];
                          
                          // Duplicate kayıtları filtrele (aynı saniyede aynı tip)
                          const seenKeys = new Set();
                          const filteredAudit = sortedAudit.filter(audit => {
                            const key = `${audit.IslemTipi}_${new Date(audit.DegisiklikTarihi).getTime()}`;
                            if (seenKeys.has(key)) {
                              return false; // Duplicate, atla
                            }
                            seenKeys.add(key);
                            return true;
                          });
                          
                          // Aynı gün içinde DELETE + INSERT varsa birleştir
                          const mergedAudit = [];
                          for (let i = 0; i < filteredAudit.length; i++) {
                            const current = filteredAudit[i];
                            const next = filteredAudit[i + 1];
                            
                            // Aynı gün içinde DELETE sonra INSERT varsa, "Güncellendi" olarak birleştir
                            if (current.IslemTipi === 'DELETE' && next && next.IslemTipi === 'INSERT') {
                              const currentDate = new Date(current.DegisiklikTarihi).toDateString();
                              const nextDate = new Date(next.DegisiklikTarihi).toDateString();
                              
                              if (currentDate === nextDate) {
                                // Aynı gün içinde silme + ekleme = Güncelleme (import)
                                mergedAudit.push({
                                  ...current,
                                  IslemTipi: 'UPDATE',
                                  Aciklama: 'Yeni versiyon import edildi (değişiklik yok)'
                                });
                                i++; // Bir sonraki kaydı atla
                                continue;
                              }
                            }
                            
                            mergedAudit.push(current);
                          }
                          
                          // Timeline oluştur
                          mergedAudit.forEach((audit, index) => {
                            if (audit.IslemTipi === 'INSERT') {
                              const isIlkEkleme = index === 0 || 
                                mergedAudit.slice(0, index).every(a => a.IslemTipi !== 'INSERT');
                              
                              timeline.push({
                                tarih: audit.DegisiklikTarihi,
                                tip: 'INSERT',
                                aciklama: audit.Aciklama || (isIlkEkleme ? 'İlk kayıt oluşturuldu' : 'İşlem tekrar eklendi'),
                                kesin: true
                              });
                            } else if (audit.IslemTipi === 'DELETE') {
                              timeline.push({
                                tarih: audit.DegisiklikTarihi,
                                tip: 'DELETE',
                                aciklama: audit.Aciklama || 'İşlem silindi',
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
                          
                          // Eğer audit kaydı yoksa ama versiyon varsa, ilk eklemeyi tahmin et
                          if (timeline.length === 0 && gecmisResult.versiyonlar && gecmisResult.versiyonlar.length > 0) {
                            const ilkVersiyon = gecmisResult.versiyonlar[gecmisResult.versiyonlar.length - 1];
                            timeline.push({
                              tarih: ilkVersiyon.GecerlilikBaslangic,
                              tip: 'INSERT',
                              aciklama: 'İlk kayıt oluşturuldu (tahmini)',
                              kesin: false
                            });
                          }
                          
                          // Eğer şu anda silinmişse ama son işlem DELETE değilse, bilinmeyen silme ekle
                          if (!gecmisResult.mevcutMu && timeline.length > 0) {
                            const sonIslem = timeline[timeline.length - 1];
                            if (sonIslem.tip !== 'DELETE') {
                              timeline.push({
                                tarih: null,
                                tip: 'DELETE',
                                aciklama: 'İşlem sistemden kaldırılmış (silme tarihi bilinmiyor)',
                                kesin: false
                              });
                            }
                          }
                          
                          // Tarihe göre sırala (en yeni üstte - gösterim için)
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
                  
                  {/* Şu anki durum özeti */}
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
                          ? 'İşlem sistemde aktif olarak bulunuyor'
                          : 'İşlem sistemde bulunmuyor (silinmiş)'}
                      </Typography>
                    </Stack>
                  </Box>
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
