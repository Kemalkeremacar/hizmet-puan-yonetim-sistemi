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
  Tooltip,
  Collapse,
  Stack
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Info as InfoIcon,
  CloudUpload as CloudUploadIcon,
  Assessment as AssessmentIcon,
  Close as CloseIcon,
  KeyboardArrowDown as ExpandIcon,
  KeyboardArrowUp as CollapseIcon,
  SwapHoriz as SwapIcon
} from '@mui/icons-material';
import { adminService } from '../services/adminService';
import { showError } from '../utils/toastManager';
import { LoadingSpinner, ErrorAlert, EmptyState, PageHeader, DateDisplay } from '../components/common';
import SutExcelImportTab from '../components/admin/SutExcelImportTab';
import { TabPanel } from '../components/common';

// ============================================
// Güncellenen Satır Bileşeni (Expandable) - SUT
// ============================================
function SutVersiyonGuncellenenRow({ item }) {
  const [expanded, setExpanded] = useState(false);

  const degisiklikler = [];
  if (item.PuanDegisti) degisiklikler.push({ field: 'Puan', color: 'warning' });
  if (item.IslemAdiDegisti) degisiklikler.push({ field: 'İşlem Adı', color: 'info' });
  if (item.AciklamaDegisti) degisiklikler.push({ field: 'Açıklama', color: 'default' });

  const hasNonPuanChanges = item.IslemAdiDegisti || item.AciklamaDegisti;
  const fark = item.YeniPuan != null && item.EskiPuan != null ? item.YeniPuan - item.EskiPuan : null;

  const formatPuan = (v) => v != null ? parseFloat(v).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-';
  const truncate = (s, n) => s && s.length > n ? s.substring(0, n) + '...' : s;

  return (
    <>
      <TableRow
        hover
        onClick={() => hasNonPuanChanges && setExpanded(!expanded)}
        sx={{ cursor: hasNonPuanChanges ? 'pointer' : 'default' }}
      >
        <TableCell sx={{ pr: 0 }}>
          {hasNonPuanChanges && (
            <IconButton size="small" sx={{ p: 0.25 }}>
              {expanded ? <CollapseIcon fontSize="small" /> : <ExpandIcon fontSize="small" />}
            </IconButton>
          )}
        </TableCell>
        <TableCell>
          <Chip label={item.SutKodu} size="small" color="warning" variant="outlined" />
        </TableCell>
        <TableCell>
          <Typography variant="body2" noWrap sx={{ maxWidth: 300 }}>{item.IslemAdi}</Typography>
        </TableCell>
        <TableCell align="center">
          <Stack direction="row" spacing={0.5} justifyContent="center" flexWrap="wrap" useFlexGap>
            {degisiklikler.map((d, i) => (
              <Chip key={i} label={d.field} size="small" color={d.color} variant="outlined" sx={{ fontSize: '0.7rem', height: 22 }} />
            ))}
          </Stack>
        </TableCell>
        <TableCell align="right">
          {item.PuanDegisti ? (
            <Stack direction="row" spacing={0.5} alignItems="center" justifyContent="flex-end">
              <Typography variant="body2" color="text.secondary" sx={{ textDecoration: 'line-through' }}>
                {formatPuan(item.EskiPuan)}
              </Typography>
              <SwapIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
              <Typography variant="body2" fontWeight="600">
                {formatPuan(item.YeniPuan)}
              </Typography>
            </Stack>
          ) : (
            <Typography variant="body2" color="text.secondary">{formatPuan(item.EskiPuan || item.YeniPuan)}</Typography>
          )}
        </TableCell>
        <TableCell align="center">
          {fark !== null && item.PuanDegisti ? (
            <Chip
              label={fark > 0 ? `+${fark.toFixed(2)}` : fark.toFixed(2)}
              size="small"
              color={fark > 0 ? 'error' : 'success'}
              variant="outlined"
              sx={{ fontSize: '0.75rem' }}
            />
          ) : (
            !item.PuanDegisti && <Chip label="—" size="small" variant="outlined" sx={{ fontSize: '0.7rem' }} />
          )}
        </TableCell>
      </TableRow>
      {hasNonPuanChanges && (
        <TableRow>
          <TableCell colSpan={6} sx={{ py: 0, borderBottom: expanded ? undefined : 'none' }}>
            <Collapse in={expanded} timeout="auto" unmountOnExit>
              <Box sx={{ py: 1.5, px: 2, my: 1, bgcolor: '#f8f9fa', borderRadius: 1, borderLeft: '3px solid', borderLeftColor: 'info.main' }}>
                <Typography variant="caption" fontWeight="600" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                  Detaylı Değişiklikler
                </Typography>
                <Stack spacing={1}>
                  {item.IslemAdiDegisti && (
                    <Box>
                      <Typography variant="caption" fontWeight="600" color="text.secondary">İşlem Adı:</Typography>
                      <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.25 }}>
                        <Typography variant="caption" sx={{ color: 'error.main', textDecoration: 'line-through' }}>
                          {truncate(item.EskiIslemAdi, 80) || '(boş)'}
                        </Typography>
                        <SwapIcon sx={{ fontSize: 12, color: 'text.disabled' }} />
                        <Typography variant="caption" fontWeight="600" color="success.dark">
                          {truncate(item.IslemAdi, 80) || '(boş)'}
                        </Typography>
                      </Stack>
                    </Box>
                  )}
                  {item.AciklamaDegisti && (
                    <Box>
                      <Typography variant="caption" fontWeight="600" color="text.secondary">Açıklama:</Typography>
                      <Stack spacing={0.5} sx={{ mt: 0.5 }}>
                        <Box sx={{ p: 1, bgcolor: '#fff3f3', borderRadius: 0.5 }}>
                          <Typography variant="caption" color="error.dark" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                            {truncate(item.EskiAciklama, 200) || '(boş)'}
                          </Typography>
                        </Box>
                        <Box sx={{ p: 1, bgcolor: '#f0fff0', borderRadius: 0.5 }}>
                          <Typography variant="caption" color="success.dark" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                            {truncate(item.YeniAciklama, 200) || '(boş)'}
                          </Typography>
                        </Box>
                      </Stack>
                    </Box>
                  )}
                </Stack>
              </Box>
            </Collapse>
          </TableCell>
        </TableRow>
      )}
    </>
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
      setVersiyonDetay(response?.data || null);
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
                  <TableCell colSpan={5} align="center" sx={{ py: 5 }}>
                    <LoadingSpinner size={40} />
                  </TableCell>
                </TableRow>
              ) : versiyonlar.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 5 }}>
                    <EmptyState message="Versiyon bulunamadı" />
                  </TableCell>
                </TableRow>
              ) : (
                versiyonlar.filter(v => v && v.VersionID).map((versiyon) => (
                  <TableRow key={versiyon.VersionID} hover>
                    <TableCell>
                      <Typography variant="body2" fontSize="0.85rem">
                        {versiyon.DosyaAdi}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" display="block">
                        {versiyon.Aciklama || (versiyonlar[versiyonlar.length - 1]?.VersionID === versiyon.VersionID ? 'İlk yükleme' : '')}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" fontWeight="700">
                        {versiyon.KayitSayisi?.toLocaleString('tr-TR')}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontSize="0.85rem">
                        <DateDisplay date={versiyon.YuklemeTarihi} format="short" />
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
            </Box>
            <IconButton
              onClick={() => setDetayDialog(false)}
              size="small"
              aria-label="Kapat"
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
                      {versiyonDetay?.version.YuklemeTarihi ? new Date(versiyonDetay.version.YuklemeTarihi).toLocaleDateString('tr-TR') : '-'}
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
                  <Grid item xs={6} md={3}>
                    <Paper variant="outlined" sx={{ p: 2, borderLeft: 3, borderColor: 'success.main', borderRadius: 1 }}>
                      <Typography variant="h4" fontWeight="700" color="success.main">
                        {versiyonDetay?.summary?.eklenen || 0}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">Eklenen</Typography>
                    </Paper>
                  </Grid>
                  <Grid item xs={6} md={3}>
                    <Paper variant="outlined" sx={{ p: 2, borderLeft: 3, borderColor: 'warning.main', borderRadius: 1 }}>
                      <Typography variant="h4" fontWeight="700" color="warning.main">
                        {versiyonDetay?.summary?.guncellenen || 0}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">Güncellenen</Typography>
                    </Paper>
                  </Grid>
                  <Grid item xs={6} md={3}>
                    <Paper variant="outlined" sx={{ p: 2, borderLeft: 3, borderColor: 'error.main', borderRadius: 1 }}>
                      <Typography variant="h4" fontWeight="700" color="error.main">
                        {versiyonDetay?.summary?.silinen || 0}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">Silinen</Typography>
                    </Paper>
                  </Grid>
                  <Grid item xs={6} md={3}>
                    <Paper variant="outlined" sx={{ p: 2, borderLeft: 3, borderColor: 'grey.400', borderRadius: 1 }}>
                      <Typography variant="h4" fontWeight="700" color="text.secondary">
                        {versiyonDetay?.summary?.degismeyen || 0}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">Değişmeyen</Typography>
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
              {versiyonDetay?.isFirstVersion ? (
                <Box sx={{ mt: 2, p: 3, bgcolor: (theme) => theme.palette.success.light + '22', borderRadius: 2, textAlign: 'center' }}>
                  <InfoIcon sx={{ fontSize: 48, color: 'success.main', mb: 1 }} />
                  <Typography variant="body1" fontWeight="medium" gutterBottom>
                    İlk Versiyon
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Bu, sisteme yüklenen ilk versiyondur. 
                    Toplam {versiyonDetay?.summary?.toplam?.toLocaleString('tr-TR') || 0} kayıt ile başlatıldı. 
                    Karşılaştırma yapılacak önceki versiyon bulunmamaktadır.
                  </Typography>
                </Box>
              ) : versiyonDetay?.summary?.eklenen === 0 &&
                 versiyonDetay.summary.guncellenen === 0 &&
                 versiyonDetay.summary.silinen === 0 &&
                 versiyonDetay.summary.degismeyen > 0 ? (
                <Box sx={{ mt: 2, p: 3, bgcolor: (theme) => theme.palette.info.light + '22', borderRadius: 2, textAlign: 'center' }}>
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
                      <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 400 }}>
                        <Table size="small" stickyHeader>
                          <TableHead>
                            <TableRow>
                              <TableCell sx={{ width: 40 }} />
                              <TableCell sx={{ fontWeight: 600 }}>SUT Kodu</TableCell>
                              <TableCell sx={{ fontWeight: 600 }}>İşlem Adı</TableCell>
                              <TableCell align="center" sx={{ fontWeight: 600 }}>Değişen Alanlar</TableCell>
                              <TableCell align="right" sx={{ fontWeight: 600 }}>Puan</TableCell>
                              <TableCell align="center" sx={{ fontWeight: 600, width: 90 }}>Fark</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {versiyonDetay.guncellenenler.map((item, idx) => (
                              <SutVersiyonGuncellenenRow key={idx} item={item} />
                            ))}
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




