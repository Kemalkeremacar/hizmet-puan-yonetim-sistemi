// ============================================
// SUT LİSTE - HUV TEMİNATLI SAYFASI
// ============================================
// SUT işlemleri listesi (HUV teminatına göre gruplandırılmış)
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
  LinearProgress,
  Grid
} from '@mui/material';
import {
  Search as SearchIcon,
  Refresh as RefreshIcon,
  ExpandMore as ExpandMoreIcon,
  Info as InfoIcon,
  CheckCircle as CheckCircleIcon,
  CompareArrows as CompareArrowsIcon,
  TrendingUp as TrendingUpIcon,
  Check as CheckIcon,
  Close as CloseIcon
} from '@mui/icons-material';
import { externalService } from '../services/externalService';
import { showError, showSuccess } from '../utils/toast';
import { LoadingSpinner, ErrorAlert, EmptyState, PageHeader } from '../components/common';

// ============================================
// Birleşik Liste Component
// ============================================
function BirlesikListe() {
  // SUT İşlemleri State'leri
  const [sutData, setSutData] = useState(null);
  const [sutLoading, setSutLoading] = useState(false);
  const [sutError, setSutError] = useState(null);
  
  // Ortak State'ler
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedGroups, setExpandedGroups] = useState(new Set());
  // kontrolKey: `${sutId}_${ustTeminatKod}_${altTeminatKod}` -> { kontrolId, durum, ... }
  // Not: Kontrol durumları grup-bazlıdır; sadece sutId ile tutmak yanlış eşleşmelere yol açar.
  const [kontrolDurumlari, setKontrolDurumlari] = useState(new Map());
  const [processingKontrol, setProcessingKontrol] = useState(new Set()); // İşlem yapılan kontrol ID'leri
  
  
  const hasFetchedRef = useRef(false); // React Strict Mode için - 2 kez çağrılmayı önle
  const isFetchingRef = useRef(false); // Çoklu çağrıları önle

  // ============================================
  // SUT İşlemlerini Yükle (Eşleştirme Bilgileriyle)
  // ============================================
  const fetchSutData = async (forceReload = false) => {
    if (isFetchingRef.current && !forceReload) {
      return;
    }
    
    try {
      isFetchingRef.current = true;
      setSutLoading(true);
      setSutError(null);
      
      console.log('🔄 SUT işlemleri yükleniyor...');
      const response = await externalService.getBirlesikList();
      
      if (!response || response.success === false) {
        throw new Error(response?.message || 'API hatası');
      }
      
      const responseData = response.data;
      console.log('📦 Backend\'den gelen veri:', responseData);
      
      if (!responseData || !responseData.data || !Array.isArray(responseData.data)) {
        console.error('❌ API yanıtında data array bulunamadı:', responseData);
        throw new Error('API yanıtında data array bulunamadı');
      }
      
      console.log(`✅ ${responseData.data.length} grup yüklendi`);
      console.log(`📊 Toplam SUT işlemi: ${responseData.toplamSutIslem || 0}`);
      
      setSutData(responseData);
      
      // Kontrol durumlarını yükle
      await fetchKontrolDurumlari(responseData);
      
      console.log('✅ SUT işlemleri yüklendi');
      
    } catch (err) {
      console.error('❌ SUT işlemleri yüklenemedi:', err);
      setSutError(err);
      showError('SUT işlemleri yüklenirken hata oluştu');
    } finally {
      setSutLoading(false);
      isFetchingRef.current = false;
    }
  };

  // ============================================
  // Kontrol durumlarını yükle (veritabanından)
  // ============================================
  const fetchKontrolDurumlari = async (sutData) => {
    if (!sutData?.data || !Array.isArray(sutData.data)) {
      return;
    }

    try {
      // Tüm SUT işlemlerinin ID'lerini topla
      const sutIdler = new Set();
      sutData.data.forEach(grup => {
        if (grup.sutIslemler && Array.isArray(grup.sutIslemler)) {
          grup.sutIslemler.forEach(islem => {
            if (islem.sutId) {
              sutIdler.add(islem.sutId);
            }
          });
        }
      });

      if (sutIdler.size === 0) {
        console.log('⚠️ Kontrol durumları için SUT işlemi bulunamadı');
        return;
      }

      console.log(`🔄 ${sutIdler.size} SUT işlemi için kontrol durumları yükleniyor...`);

      // Her SUT ID için kontrol durumunu çek
      const kontrolResponse = await externalService.getEslestirmeKontroller({
        limit: 10000, // Tüm kontrolleri çek
        offset: 0
      });

      if (kontrolResponse?.data?.kontroller && Array.isArray(kontrolResponse.data.kontroller)) {
        const kontrolMap = new Map();
        
        kontrolResponse.data.kontroller.forEach(kontrol => {
          // Sadece aktif ve bu listedeki SUT işlemleri için
          if (sutIdler.has(kontrol.SutID)) {
            const kontrolKey = `${kontrol.SutID}_${kontrol.HuvUstTeminatKod}_${kontrol.HuvAltTeminatKod}`;
            kontrolMap.set(kontrolKey, {
              kontrolId: kontrol.KontrolID,
              durum: kontrol.Durum, // 'onaylandi', 'reddedildi', 'beklemede'
              doktorNotu: kontrol.DoktorNotu,
              onayTarihi: kontrol.OnayTarihi
            });
          }
        });

        setKontrolDurumlari(kontrolMap);
        console.log(`✅ ${kontrolMap.size} kontrol durumu yüklendi`);
      }
    } catch (err) {
      console.error('❌ Kontrol durumları yüklenirken hata:', err);
      // Hata kritik değil, sadece log'la
    }
  };

  // ============================================
  // Doktor Kontrolü Fonksiyonları
  // ============================================
  const handleKontrolOnayla = async (islem, huvEslestirme) => {
    let kontrolKey = null;
    try {
      if (!huvEslestirme || !huvEslestirme.ustTeminat || !huvEslestirme.altTeminat) {
        showError('Eşleştirme teminat bilgileri eksik');
        return;
      }
      
      kontrolKey = `${islem.sutId}_${huvEslestirme.ustTeminat.kod}_${huvEslestirme.altTeminat.kod}`;
      setProcessingKontrol(prev => new Set(prev).add(kontrolKey));

      let kontrolId = kontrolDurumlari.get(kontrolKey)?.kontrolId;
      
      if (!kontrolId) {
        const createResponse = await externalService.createEslestirmeKontrol({
          sutId: islem.sutId,
          sutKodu: islem.sutKodu || '',
          huvUstTeminatKod: String(huvEslestirme.ustTeminat.kod || ''),
          huvAltTeminatKod: String(huvEslestirme.altTeminat.kod || ''),
          eslestirmeSkoru: huvEslestirme.eslestirmeSkoru || 0,
          eslestirmeTipi: huvEslestirme.eslestirmeTipi || 'benzerlik',
          lowConfidence: false
        });
        kontrolId = createResponse.data.kontrolId;
        
        if (!kontrolId) {
          throw new Error('Kontrol kaydı oluşturulamadı');
        }
      }

      await externalService.updateEslestirmeKontrol(kontrolId, {
        durum: 'onaylandi',
        doktorNotu: null
      });

      setKontrolDurumlari(prev => {
        const newMap = new Map(prev);
        newMap.set(kontrolKey, { 
          kontrolId, 
          durum: 'onaylandi',
          onayTarihi: new Date().toISOString()
        });
        return newMap;
      });

      showSuccess('Eşleştirme onaylandı');
    } catch (err) {
      console.error('Onaylama hatası:', err);
      showError(err.response?.data?.message || 'Onaylama sırasında hata oluştu');
    } finally {
      setProcessingKontrol(prev => {
        const newSet = new Set(prev);
        if (kontrolKey) newSet.delete(kontrolKey);
        return newSet;
      });
    }
  };

  const handleKontrolReddet = async (islem, huvEslestirme) => {
    let kontrolKey = null;
    try {
      if (!huvEslestirme || !huvEslestirme.ustTeminat || !huvEslestirme.altTeminat) {
        showError('Eşleştirme teminat bilgileri eksik');
        return;
      }
      
      kontrolKey = `${islem.sutId}_${huvEslestirme.ustTeminat.kod}_${huvEslestirme.altTeminat.kod}`;
      setProcessingKontrol(prev => new Set(prev).add(kontrolKey));

      let kontrolId = kontrolDurumlari.get(kontrolKey)?.kontrolId;
      
      if (!kontrolId) {
        const createResponse = await externalService.createEslestirmeKontrol({
          sutId: islem.sutId,
          sutKodu: islem.sutKodu || '',
          huvUstTeminatKod: String(huvEslestirme.ustTeminat.kod || ''),
          huvAltTeminatKod: String(huvEslestirme.altTeminat.kod || ''),
          eslestirmeSkoru: huvEslestirme.eslestirmeSkoru || 0,
          eslestirmeTipi: huvEslestirme.eslestirmeTipi || 'benzerlik',
          lowConfidence: false
        });
        kontrolId = createResponse.data.kontrolId;
        
        if (!kontrolId) {
          throw new Error('Kontrol kaydı oluşturulamadı');
        }
      }

      await externalService.updateEslestirmeKontrol(kontrolId, {
        durum: 'reddedildi',
        doktorNotu: 'Doktor tarafından reddedildi'
      });

      setKontrolDurumlari(prev => {
        const newMap = new Map(prev);
        newMap.set(kontrolKey, { 
          kontrolId, 
          durum: 'reddedildi',
          onayTarihi: new Date().toISOString()
        });
        return newMap;
      });

      showSuccess('Eşleştirme reddedildi');
    } catch (err) {
      console.error('Reddetme hatası:', err);
      showError(err.response?.data?.message || 'Reddetme sırasında hata oluştu');
    } finally {
      setProcessingKontrol(prev => {
        const newSet = new Set(prev);
        if (kontrolKey) newSet.delete(kontrolKey);
        return newSet;
      });
    }
  };


  // ============================================
  // İlk yükleme
  // ============================================
  useEffect(() => {
    if (!sutData && !sutLoading) {
      fetchSutData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ============================================
  // Render
  // ============================================
  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <PageHeader 
        title="SUT Liste - HUV Teminatlı" 
        subtitle="SUT işlemleri HUV teminat gruplarına göre kategorize edilmiş liste"
        icon="📋"
      />
      
      {/* SUT İşlemleri */}
      <Box>
          {sutLoading && <LoadingSpinner message="SUT işlemleri yükleniyor..." />}
          {sutError && <ErrorAlert error={sutError} />}
          {!sutLoading && !sutError && sutData && sutData.data && (
            <Box>
              {/* Debug Info */}
              {process.env.NODE_ENV === 'development' && (
                <Alert severity="info" sx={{ mb: 2 }}>
                  <Typography variant="caption">
                    Debug: {sutData.data?.length || 0} grup, {sutData.toplamSutIslem || 0} toplam SUT işlemi
                  </Typography>
                </Alert>
              )}
              
              {/* Arama */}
              <Paper elevation={2} sx={{ mb: 3, p: 2 }}>
                <TextField
                  fullWidth
                  size="small"
                  placeholder="SUT kodu, işlem adı veya teminat ile ara..."
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
              </Paper>

              {/* SUT İşlemleri Listesi */}
              {sutData.data && Array.isArray(sutData.data) && sutData.data.length > 0 ? (
                <Box>
                  {sutData.data
                    .filter(grup => {
                      if (!searchTerm) return true;
                      const searchLower = searchTerm.toLowerCase();
                      return (
                        grup.ustTeminat?.adi?.toLowerCase().includes(searchLower) ||
                        grup.altTeminat?.adi?.toLowerCase().includes(searchLower) ||
                        grup.sutIslemler?.some(islem => 
                          islem.sutKodu?.toLowerCase().includes(searchLower) ||
                          islem.islemAdi?.toLowerCase().includes(searchLower) ||
                          grup.ustTeminat?.adi?.toLowerCase().includes(searchLower) ||
                          grup.altTeminat?.adi?.toLowerCase().includes(searchLower)
                        )
                      );
                    })
                    .map((grup, index) => (
                      <Accordion
                        key={index}
                        expanded={expandedGroups.has(index)}
                        onChange={() => {
                          const newExpanded = new Set(expandedGroups);
                          if (newExpanded.has(index)) {
                            newExpanded.delete(index);
                          } else {
                            newExpanded.add(index);
                          }
                          setExpandedGroups(newExpanded);
                        }}
                        sx={{ mb: 2 }}
                      >
                        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                          <Box sx={{ width: '100%' }}>
                            <Typography variant="h6" fontWeight="600">
                              {grup.ustTeminat?.adi || '-'}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              Alt Teminat: {grup.altTeminat?.adi || '-'}
                            </Typography>
                            <Chip 
                              label={`${grup.sutIslemler?.length || 0} SUT İşlemi`} 
                              size="small" 
                              color="warning"
                              sx={{ mt: 1 }}
                            />
                          </Box>
                        </AccordionSummary>
                        <AccordionDetails>
                          {grup.sutIslemler && Array.isArray(grup.sutIslemler) && grup.sutIslemler.length > 0 ? (
                            <Grid container spacing={2}>
                              {grup.sutIslemler.map((islem) => {
                                // Backend'den gelen veri yapısı: islem zaten HUV grubuna eşleştirilmiş
                                // Eşleştirme bilgisi grup seviyesinde (ustTeminat, altTeminat)
                                const huvEslestirme = {
                                  ustTeminat: grup.ustTeminat,
                                  altTeminat: grup.altTeminat,
                                  eslestirmeSkoru: islem.eslestirmeSkoru || islem.uyumSkoru || 0,
                                  eslestirmeTipi: islem.eslestirmeTipi || 'benzerlik'
                                };
                                const kontrolKey = huvEslestirme 
                                  ? `${islem.sutId}_${huvEslestirme.ustTeminat?.kod || ''}_${huvEslestirme.altTeminat?.kod || ''}`
                                  : null;
                                const kontrolDurum = kontrolKey ? kontrolDurumlari.get(kontrolKey) : null;
                                const eslestirmeSkoru = huvEslestirme?.eslestirmeSkoru || 0;
                                const eslestirmeTipi = huvEslestirme?.eslestirmeTipi || 'benzerlik';
                                const kontrolOnerilir = eslestirmeTipi !== 'sutKodu' && eslestirmeTipi !== 'manuel' && eslestirmeSkoru < 0.6;

                                return (
                                  <Grid item xs={12} key={islem.sutId}>
                                    <Card variant="outlined" sx={{ 
                                      borderLeft: 4, 
                                      borderLeftColor: eslestirmeTipi === 'sutKodu' ? 'success.main' : (eslestirmeTipi === 'manuel' ? 'warning.main' : 'primary.main'),
                                      '&:hover': { boxShadow: 3 }
                                    }}>
                                      <CardContent>
                                        {/* İşlem Bilgileri */}
                                        <Box sx={{ mb: 2 }}>
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
                                          <Typography variant="body1" fontWeight="500">
                                            {islem.islemAdi}
                                          </Typography>
                                        </Box>

                                        <Divider sx={{ my: 2 }} />

                                        {/* Eşleştirme Bilgisi */}
                                        {huvEslestirme ? (
                                          <Box>
                                            <Typography variant="subtitle2" fontWeight="600" gutterBottom sx={{ mb: 1.5 }}>
                                              <CompareArrowsIcon sx={{ fontSize: 18, verticalAlign: 'middle', mr: 0.5 }} />
                                              Eşleştirme Bilgisi
                                            </Typography>
                                            
                                            <Grid container spacing={2}>
                                              <Grid item xs={12} md={6}>
                                                <Paper variant="outlined" sx={{ p: 1.5, bgcolor: 'primary.light', borderColor: 'primary.main' }}>
                                                  <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                                                    Üst Teminat
                                                  </Typography>
                                                  <Typography variant="body2" fontWeight="600" color="primary.main">
                                                    {huvEslestirme.ustTeminat?.adi || '-'}
                                                  </Typography>
                                                </Paper>
                                              </Grid>
                                              <Grid item xs={12} md={6}>
                                                <Paper variant="outlined" sx={{ p: 1.5, bgcolor: 'primary.light', borderColor: 'primary.main' }}>
                                                  <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                                                    Alt Teminat
                                                  </Typography>
                                                  <Typography variant="body2" fontWeight="600" color="primary.main">
                                                    {huvEslestirme.altTeminat?.adi || '-'}
                                                  </Typography>
                                                </Paper>
                                              </Grid>
                                            </Grid>

                                            {/* Uyum Skoru */}
                                            <Box sx={{ mt: 2 }}>
                                              <Stack direction="row" spacing={2} alignItems="center">
                                                <Chip
                                                  icon={
                                                    eslestirmeTipi === 'sutKodu'
                                                      ? <CheckCircleIcon />
                                                      : <TrendingUpIcon />
                                                  }
                                                  label={
                                                    eslestirmeTipi === 'sutKodu'
                                                      ? 'Direkt Eşleştirme'
                                                      : (eslestirmeTipi === 'manuel' ? 'Manuel Yerleştirme' : 'Benzerlik Bazlı')
                                                  }
                                                  color={eslestirmeSkoru >= 0.7 ? 'success' : (eslestirmeSkoru >= 0.4 ? 'warning' : 'error')}
                                                  size="small"
                                                />
                                                <Typography variant="body2" fontWeight="600">
                                                  Uyum Skoru: {Math.round(eslestirmeSkoru * 100)}%
                                                </Typography>
                                              </Stack>
                                            </Box>

                                            {/* Doktor Kontrolü */}
                                            <Box sx={{ mt: 2, pt: 2, borderTop: 1, borderColor: 'divider' }}>
                                              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                                                {kontrolDurum?.durum === 'onaylandi' && (
                                                  <Chip icon={<CheckIcon />} label="Onaylandı" color="success" size="small" />
                                                )}
                                                {kontrolDurum?.durum === 'reddedildi' && (
                                                  <Chip icon={<CloseIcon />} label="Reddedildi" color="error" size="small" />
                                                )}
                                                
                                                {(!kontrolDurum?.durum || kontrolDurum?.durum === 'beklemede') && kontrolOnerilir && (
                                                  <>
                                                    <Button
                                                      size="small"
                                                      variant="contained"
                                                      color="success"
                                                      startIcon={<CheckIcon />}
                                                      onClick={() => handleKontrolOnayla(islem, huvEslestirme)}
                                                      disabled={processingKontrol.has(kontrolKey || '') || !huvEslestirme?.ustTeminat?.kod || !huvEslestirme?.altTeminat?.kod}
                                                    >
                                                      Onayla
                                                    </Button>
                                                    <Button
                                                      size="small"
                                                      variant="outlined"
                                                      color="error"
                                                      startIcon={<CloseIcon />}
                                                      onClick={() => handleKontrolReddet(islem, huvEslestirme)}
                                                      disabled={processingKontrol.has(kontrolKey || '') || !huvEslestirme?.ustTeminat?.kod || !huvEslestirme?.altTeminat?.kod}
                                                    >
                                                      Reddet
                                                    </Button>
                                                  </>
                                                )}
                                                
                                              </Stack>
                                            </Box>
                                          </Box>
                                        ) : (
                                          <Alert severity="warning">
                                            Bu SUT işlemi için eşleştirme bulunamadı.
                                          </Alert>
                                        )}
                                      </CardContent>
                                    </Card>
                                  </Grid>
                                );
                              })}
                            </Grid>
                          ) : (
                            <Typography variant="body2" color="text.secondary">
                              Bu grupta SUT işlemi bulunmuyor.
                            </Typography>
                          )}
                        </AccordionDetails>
                      </Accordion>
                    ))}
                </Box>
              ) : (
                <EmptyState 
                  message={sutData?.data ? "SUT işlemi bulunamadı" : "Veri yükleniyor veya hata oluştu"} 
                />
              )}
            </Box>
          )}
        </Box>

    </Container>
  );
}

export default BirlesikListe;
