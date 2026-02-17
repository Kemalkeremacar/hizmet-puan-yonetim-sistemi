// ============================================
// BİRLEŞİK LİSTE SAYFASI
// ============================================
// HUV + SUT birleşik liste (HUV teminat yapısına göre kategorize)
// ============================================

import { useState, useEffect, useMemo, memo, useRef } from 'react';
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
  TextField,
  InputAdornment,
  Grid,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Divider,
  Stack,
  Tooltip,
  IconButton,
  Card,
  CardContent,
  Alert,
  LinearProgress
} from '@mui/material';
import {
  Search as SearchIcon,
  Refresh as RefreshIcon,
  ExpandMore as ExpandMoreIcon,
  Info as InfoIcon,
  FilterList as FilterListIcon,
  CheckCircle as CheckCircleIcon,
  CompareArrows as CompareArrowsIcon,
  TrendingUp as TrendingUpIcon
} from '@mui/icons-material';
import { externalService } from '../services/externalService';
import { showError } from '../utils/toast';
import { LoadingSpinner, ErrorAlert, EmptyState, PageHeader } from '../components/common';

// ============================================
// Birleşik Liste Component
// ============================================
function BirlesikListe() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedGroups, setExpandedGroups] = useState(new Set());
  const hasFetchedRef = useRef(false); // React Strict Mode için - 2 kez çağrılmayı önle

  // ============================================
  // Veriyi yükle
  // ============================================
  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('🔄 Birleşik liste yükleniyor...');
      const startTime = Date.now();
      
      // Timeout kontrolü için promise wrapper
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error('İstek zaman aşımına uğradı (5 dakika)'));
        }, 300000); // 5 dakika
      });
      
      const apiPromise = externalService.getBirlesikList();
      
      const response = await Promise.race([apiPromise, timeoutPromise]);
      const duration = Date.now() - startTime;
      console.log(`✅ API Response alındı (${duration}ms)`);
      console.log('📊 Response type:', typeof response);
      console.log('📊 Response:', response);
      
      // Axios interceptor response.data'yı direkt döndürüyor
      // Backend format: { success: true, data: {...}, message: '...' }
      // Interceptor sonrası: response = { success: true, data: {...}, message: '...' }
      // Yani response zaten backend'den gelen data objesi
      let responseData = response;
      
      // Eğer response.data varsa (nested structure - backend format)
      if (response && response.data && typeof response.data === 'object' && !Array.isArray(response.data)) {
        responseData = response.data;
        console.log('📊 Response.data kullanıldı (nested structure)');
      } else if (response && response.success === false) {
        throw new Error(response.message || 'API hatası');
      }
      
      console.log('📊 Final Response Data:', {
        hasData: !!responseData,
        hasDataArray: !!(responseData?.data && Array.isArray(responseData.data)),
        dataLength: responseData?.data?.length || 0,
        keys: responseData ? Object.keys(responseData) : [],
        toplamGrup: responseData?.toplamGrup,
        sample: responseData?.data ? responseData.data.slice(0, 1) : null
      });
      
      // Data kontrolü
      if (!responseData) {
        throw new Error('API yanıtı boş');
      }
      
      // Backend format: { success: true, data: { toplamGrup: ..., data: [...] }, message: '...' }
      // Interceptor sonrası: response = { success: true, data: { toplamGrup: ..., data: [...] }, message: '...' }
      // responseData = { toplamGrup: ..., data: [...] }
      setData(responseData);
      
      console.log('✅ Data set edildi, loading false yapılıyor...');
      
      // İlk 5 grubu otomatik aç
      if (responseData?.data && Array.isArray(responseData.data) && responseData.data.length > 0) {
        const initialExpanded = new Set();
        responseData.data.slice(0, 5).forEach((_, index) => {
          initialExpanded.add(index);
        });
        setExpandedGroups(initialExpanded);
        console.log(`✅ ${responseData.data.length} grup yüklendi, ilk 5 grup açıldı`);
      } else {
        console.warn('⚠️ Data array bulunamadı veya boş');
      }
      
      console.log('✅ Birleşik liste başarıyla yüklendi');
    } catch (err) {
      console.error('❌ Birleşik liste yüklenemedi:', err);
      console.error('❌ Error details:', {
        message: err.message,
        response: err.response,
        status: err.response?.status,
        data: err.response?.data,
        stack: err.stack
      });
      
      let errorMessage = 'Birleşik liste yüklenirken hata oluştu';
      
      if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
        errorMessage = 'İstek zaman aşımına uğradı. Lütfen tekrar deneyin.';
      } else if (err.response?.status === 401) {
        errorMessage = 'Oturum süreniz dolmuş. Lütfen tekrar giriş yapın.';
      } else if (err.response?.status === 403) {
        errorMessage = 'Bu işlem için yetkiniz yok.';
      } else if (err.response?.status >= 500) {
        errorMessage = 'Sunucu hatası. Lütfen daha sonra tekrar deneyin.';
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      setError(err);
      showError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // ============================================
  // İlk yükleme
  // ============================================
  useEffect(() => {
    // React Strict Mode'da 2 kez çağrılmayı önle
    if (hasFetchedRef.current) return;
    hasFetchedRef.current = true;
    
    fetchData();
  }, []);

  // ============================================
  // Grup aç/kapat
  // ============================================
  const handleAccordionChange = (index) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedGroups(newExpanded);
  };

  // ============================================
  // Filtreleme (Memoized - Performans için)
  // ============================================
  const filteredData = useMemo(() => {
    if (!data?.data) return [];
    if (!searchTerm) return data.data;
    
    const searchLower = searchTerm.toLowerCase();
    return data.data.filter((grup) => {
      const ustTeminat = grup.ustTeminat?.adi?.toLowerCase() || '';
      const altTeminat = grup.altTeminat?.adi?.toLowerCase() || '';
      
      // Üst veya alt teminatta ara
      if (ustTeminat.includes(searchLower) || altTeminat.includes(searchLower)) {
        return true;
      }
      
      // İşlem adlarında ara (sadece ilk 10 işlemde ara - performans için)
      const huvIslemler = (grup.huvIslemler || []).slice(0, 10);
      const sutIslemler = (grup.sutIslemler || []).slice(0, 10);
      
      const huvMatch = huvIslemler.some(islem => 
        islem.islemAdi?.toLowerCase().includes(searchLower) ||
        islem.huvKodu?.toLowerCase().includes(searchLower)
      );
      
      const sutMatch = sutIslemler.some(islem => 
        islem.islemAdi?.toLowerCase().includes(searchLower) ||
        islem.sutKodu?.toLowerCase().includes(searchLower)
      );
      
      return huvMatch || sutMatch;
    });
  }, [data, searchTerm]);

  // ============================================
  // Render
  // ============================================
  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <PageHeader 
        title="Birleşik Liste (HUV + SUT)" 
        subtitle="HUV teminat yapısına göre kategorize edilmiş birleşik liste"
        icon="🔗"
      />

      {/* İstatistikler */}
      {data && (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Paper sx={{ p: 2, bgcolor: 'primary.light', color: 'white' }}>
              <Typography variant="h4" fontWeight="bold">
                {data.toplamGrup || 0}
              </Typography>
              <Typography variant="body2">Toplam Grup</Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Paper sx={{ p: 2, bgcolor: 'success.light', color: 'white' }}>
              <Typography variant="h4" fontWeight="bold">
                {data.birlesikGrup || 0}
              </Typography>
              <Typography variant="body2">Birleşik Grup</Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Paper sx={{ p: 2, bgcolor: 'info.light', color: 'white' }}>
              <Typography variant="h4" fontWeight="bold">
                {data.toplamHuvIslem?.toLocaleString('tr-TR') || 0}
              </Typography>
              <Typography variant="body2">HUV İşlem</Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Paper sx={{ p: 2, bgcolor: 'warning.light', color: 'white' }}>
              <Typography variant="h4" fontWeight="bold">
                {data.toplamSutIslem?.toLocaleString('tr-TR') || 0}
              </Typography>
              <Typography variant="body2">SUT İşlem</Typography>
            </Paper>
          </Grid>
        </Grid>
      )}

      {/* Arama ve Kontroller */}
      <Paper elevation={2} sx={{ mb: 3, p: 2 }}>
        <Stack direction="row" spacing={2} alignItems="center">
          <TextField
            fullWidth
            size="small"
            placeholder="Üst teminat, alt teminat veya işlem adı ile ara..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
          />
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={fetchData}
            disabled={loading}
          >
            Yenile
          </Button>
        </Stack>
      </Paper>

      {/* Hata */}
      {error && <ErrorAlert message="Birleşik liste yüklenirken hata oluştu" error={error} />}

      {/* Yükleme */}
      {loading && (
        <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', py: 5 }}>
          <LoadingSpinner message="Birleşik liste yükleniyor..." />
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            Bu işlem biraz zaman alabilir. Lütfen bekleyin...
          </Typography>
        </Box>
      )}

      {/* Liste */}
      {!loading && !error && (
        <Box>
          {filteredData.length === 0 ? (
            <EmptyState message="Sonuç bulunamadı" />
          ) : (
            filteredData.map((grup, index) => (
              <Accordion
                key={index}
                expanded={expandedGroups.has(index)}
                onChange={() => handleAccordionChange(index)}
                sx={{ mb: 2 }}
              >
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Box sx={{ width: '100%', display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="h6" fontWeight="600">
                        {grup.ustTeminat?.adi || '-'}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Alt Teminat: {grup.altTeminat?.adi || '-'}
                      </Typography>
                    </Box>
                    <Stack direction="row" spacing={1}>
                      {grup.toplamHuvIslem > 0 && (
                        <Chip
                          label={`HUV: ${grup.toplamHuvIslem}`}
                          color="primary"
                          size="small"
                        />
                      )}
                      {grup.toplamSutIslem > 0 && (
                        <Chip
                          label={`SUT: ${grup.toplamSutIslem}`}
                          color="warning"
                          size="small"
                        />
                      )}
                      <Chip
                        label={`Toplam: ${grup.toplamIslem}`}
                        color="success"
                        size="small"
                      />
                    </Stack>
                  </Box>
                </AccordionSummary>
                <AccordionDetails>
                  {/* Sadece açık accordion'larda içeriği render et - Performans için */}
                  {expandedGroups.has(index) && (
                  <Box>
                    {/* HUV İşlemleri */}
                    {grup.huvIslemler && grup.huvIslemler.length > 0 && (
                      <Box sx={{ mb: 3 }}>
                        <Typography variant="subtitle1" fontWeight="600" gutterBottom sx={{ mb: 2 }}>
                          HUV İşlemleri ({grup.huvIslemler.length})
                        </Typography>
                        <TableContainer component={Paper} variant="outlined">
                          <Table size="small">
                            <TableHead>
                              <TableRow>
                                <TableCell sx={{ fontWeight: 600 }}>HUV Kodu</TableCell>
                                <TableCell sx={{ fontWeight: 600 }}>İşlem Adı</TableCell>
                                <TableCell align="right" sx={{ fontWeight: 600 }}>Birim (TL)</TableCell>
                                <TableCell sx={{ fontWeight: 600 }}>SUT Kodu</TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {grup.huvIslemler.map((islem) => (
                                <TableRow key={islem.islemId} hover>
                                  <TableCell>
                                    <Chip label={islem.huvKodu} size="small" color="primary" variant="outlined" />
                                  </TableCell>
                                  <TableCell>
                                    <Typography variant="body2" noWrap sx={{ maxWidth: 400 }}>
                                      {islem.islemAdi}
                                    </Typography>
                                  </TableCell>
                                  <TableCell align="right">
                                    <Typography variant="body2" fontWeight="600">
                                      {islem.birim?.toLocaleString('tr-TR', { 
                                        minimumFractionDigits: 2, 
                                        maximumFractionDigits: 2 
                                      }) || '-'}
                                    </Typography>
                                  </TableCell>
                                  <TableCell>
                                    {islem.sutKodu ? (
                                      <Chip label={islem.sutKodu} size="small" color="info" variant="outlined" />
                                    ) : (
                                      <Typography variant="body2" color="text.secondary">-</Typography>
                                    )}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </TableContainer>
                      </Box>
                    )}

                    {/* SUT İşlemleri */}
                    {grup.sutIslemler && grup.sutIslemler.length > 0 && (
                      <Box>
                        <Typography variant="subtitle1" fontWeight="600" gutterBottom sx={{ mb: 2 }}>
                          SUT İşlemleri ({grup.sutIslemler.length})
                        </Typography>
                        
                        <Grid container spacing={2}>
                          {grup.sutIslemler.map((islem) => {
                            const eslestirmeSkoru = islem.eslestirmeSkoru || 0;
                            const eslestirmeTipi = islem.eslestirmeTipi || 'benzerlik';
                            const skorYuzde = Math.round(eslestirmeSkoru * 100);
                            
                            // Skor rengi belirleme
                            const getSkorColor = () => {
                              if (eslestirmeTipi === 'sutKodu') return 'success';
                              if (eslestirmeSkoru >= 1.0) return 'success';
                              if (eslestirmeSkoru >= 0.7) return 'info';
                              if (eslestirmeSkoru >= 0.4) return 'warning';
                              return 'error';
                            };

                            return (
                              <Grid item xs={12} key={islem.sutId}>
                                <Card variant="outlined" sx={{ 
                                  borderLeft: 4, 
                                  borderLeftColor: eslestirmeTipi === 'sutKodu' ? 'success.main' : 'primary.main',
                                  '&:hover': { boxShadow: 3 }
                                }}>
                                  <CardContent>
                                    {/* Üst Kısım: İşlem Bilgileri */}
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                                      <Box sx={{ flex: 1 }}>
                                        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                                          <Chip 
                                            label={islem.sutKodu} 
                                            size="small" 
                                            color="warning" 
                                            sx={{ fontWeight: 600 }}
                                          />
                                          <Typography variant="body2" color="text.secondary">
                                            Puan: <strong>{islem.puan?.toLocaleString('tr-TR') || '-'}</strong>
                                          </Typography>
                                        </Stack>
                                        <Typography variant="body1" fontWeight="500" sx={{ mb: 1 }}>
                                          {islem.islemAdi}
                                        </Typography>
                                      </Box>
                                    </Box>

                                    <Divider sx={{ my: 2 }} />

                                    {/* Eşleştirme Detayları */}
                                    <Box>
                                      <Typography variant="subtitle2" fontWeight="600" gutterBottom sx={{ mb: 1.5 }}>
                                        <CompareArrowsIcon sx={{ fontSize: 18, verticalAlign: 'middle', mr: 0.5 }} />
                                        Eşleştirme Detayları
                                      </Typography>
                                      
                                      <Grid container spacing={2}>
                                        {/* SUT Orijinal Teminat */}
                                        <Grid item xs={12} md={5}>
                                          <Paper variant="outlined" sx={{ p: 1.5, bgcolor: 'grey.50' }}>
                                            <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                                              SUT Orijinal Teminat
                                            </Typography>
                                            <Typography variant="body2" fontWeight="600" color="warning.main">
                                              Üst: {islem.sutUstTeminat?.adi || '-'}
                                            </Typography>
                                            <Typography variant="body2" color="text.secondary">
                                              Alt: {islem.sutAltTeminat?.adi || '-'}
                                            </Typography>
                                          </Paper>
                                        </Grid>

                                        {/* Ok İkonu */}
                                        <Grid item xs={12} md={2} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                          <CompareArrowsIcon sx={{ fontSize: 32, color: 'primary.main' }} />
                                        </Grid>

                                        {/* HUV Eşleşen Teminat */}
                                        <Grid item xs={12} md={5}>
                                          <Paper variant="outlined" sx={{ p: 1.5, bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(25, 118, 210, 0.1)' : 'rgba(25, 118, 210, 0.08)', borderColor: 'primary.main', borderWidth: 2 }}>
                                            <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                                              HUV Eşleşen Teminat
                                            </Typography>
                                            <Typography variant="body2" fontWeight="600" color="primary.main">
                                              Üst: {grup.ustTeminat?.adi || '-'}
                                            </Typography>
                                            <Typography variant="body2" color="text.secondary">
                                              Alt: {grup.altTeminat?.adi || '-'}
                                            </Typography>
                                          </Paper>
                                        </Grid>
                                      </Grid>

                                      {/* Eşleştirme Skoru ve Tipi */}
                                      <Box sx={{ mt: 2 }}>
                                        <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 1 }}>
                                          <Chip
                                            icon={eslestirmeTipi === 'sutKodu' ? <CheckCircleIcon /> : <TrendingUpIcon />}
                                            label={eslestirmeTipi === 'sutKodu' ? 'SUT Kodu Eşleştirmesi' : 'Benzerlik Eşleştirmesi'}
                                            color={getSkorColor()}
                                            size="small"
                                            sx={{ fontWeight: 600 }}
                                          />
                                          <Box sx={{ flex: 1 }}>
                                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                                              <Typography variant="caption" color="text.secondary">
                                                Eşleştirme Skoru
                                              </Typography>
                                              <Typography 
                                                variant="body2" 
                                                fontWeight="600" 
                                                sx={{ 
                                                  color: getSkorColor() === 'success' ? 'success.main' :
                                                         getSkorColor() === 'info' ? 'info.main' :
                                                         getSkorColor() === 'warning' ? 'warning.main' :
                                                         'error.main'
                                                }}
                                              >
                                                {skorYuzde}% ({eslestirmeSkoru.toFixed(2)})
                                              </Typography>
                                            </Box>
                                            <LinearProgress
                                              variant="determinate"
                                              value={Math.min(skorYuzde, 100)}
                                              color={getSkorColor()}
                                              sx={{ 
                                                height: 8, 
                                                borderRadius: 1,
                                                bgcolor: 'grey.200'
                                              }}
                                            />
                                          </Box>
                                        </Stack>
                                        
                                        {/* Eşleştirme Açıklaması */}
                                        <Alert 
                                          severity={eslestirmeTipi === 'sutKodu' ? 'success' : 'info'} 
                                          icon={<InfoIcon />}
                                          sx={{ mt: 1 }}
                                        >
                                          {eslestirmeTipi === 'sutKodu' ? (
                                            <Typography variant="caption">
                                              Bu SUT işlemi, HUV işlemlerindeki SUT kodu ile direkt eşleştirildi. 
                                              <strong> Mükemmel eşleşme (100%)</strong>
                                            </Typography>
                                          ) : (
                                            <Typography variant="caption">
                                              Bu SUT işlemi, HUV teminat yapısı ile benzerlik algoritması kullanılarak eşleştirildi. 
                                              Skor: <strong>{eslestirmeSkoru.toFixed(2)}</strong> 
                                              {eslestirmeSkoru >= 0.7 ? ' (Yüksek güvenilirlik)' : 
                                               eslestirmeSkoru >= 0.4 ? ' (Orta güvenilirlik)' : 
                                               ' (Düşük güvenilirlik - kontrol önerilir)'}
                                            </Typography>
                                          )}
                                        </Alert>
                                      </Box>
                                    </Box>
                                  </CardContent>
                                </Card>
                              </Grid>
                            );
                          })}
                        </Grid>
                      </Box>
                    )}
                  </Box>
                  )}
                </AccordionDetails>
              </Accordion>
            ))
          )}
        </Box>
      )}
    </Container>
  );
}

export default BirlesikListe;
