// ============================================
// IMPORT PREVIEW DIALOG
// ============================================
// Excel import önizleme ve onaylama
// ============================================

import { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Alert,
  Stack,
  Divider,
  Paper,
  LinearProgress
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Add as AddIcon,
  Remove as RemoveIcon
} from '@mui/icons-material';
import { TabPanel } from '../common';

export default function ImportPreviewDialog({ open, onClose, previewData, onConfirm, loading }) {
  const [activeTab, setActiveTab] = useState(0);

  if (!previewData) return null;

  const { summary, comparison, uyarilar, onizleme, listeTipi } = previewData;
  
  // Liste tipi backend'den geliyor (HUV veya SUT)
  const isSUT = listeTipi === 'SUT';
  const isHUV = listeTipi === 'HUV';
  
  const kodLabel = isSUT ? 'SUT Kodu' : 'HUV Kodu';
  const kodField = isSUT ? 'SutKodu' : 'HuvKodu';
  const birimLabel = isSUT ? 'Puan' : 'Birim';
  const eskiBirimField = isSUT ? 'EskiPuan' : 'EskiBirim';
  const yeniBirimField = isSUT ? 'YeniPuan' : 'YeniBirim';
  const birimField = isSUT ? 'Puan' : 'Birim';

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  const formatBirim = (value) => {
    if (!value && value !== 0) return '-';
    if (isSUT) {
      // SUT için puan formatı
      return parseFloat(value).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    } else {
      // HUV için birim formatı (TL)
      return `₺${parseFloat(value).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
  };

  const calculateChange = (oldVal, newVal) => {
    if (!oldVal || !newVal) return null;
    const change = ((newVal - oldVal) / oldVal) * 100;
    return change.toFixed(2);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>
        <Stack direction="row" spacing={2} alignItems="center">
          <WarningIcon color="warning" />
          <Box>
            <Typography variant="h6" fontWeight="600">
              Import Önizleme
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Değişiklikleri kontrol edin ve onaylayın
            </Typography>
          </Box>
        </Stack>
      </DialogTitle>

      <DialogContent dividers>
        {/* Özet İstatistikler */}
        <Paper elevation={0} sx={{ p: 2, bgcolor: 'grey.50', mb: 3 }}>
          <Typography variant="subtitle2" gutterBottom fontWeight="600">
            📊 Özet İstatistikler
          </Typography>
          <Stack direction="row" spacing={3} sx={{ mt: 2 }}>
            <Box>
              <Typography variant="caption" color="text.secondary">Toplam Okunan</Typography>
              <Typography variant="h6" fontWeight="700">{summary?.toplamOkunan || 0}</Typography>
            </Box>
            <Divider orientation="vertical" flexItem />
            <Box>
              <Typography variant="caption" color="text.secondary">Geçerli</Typography>
              <Typography variant="h6" fontWeight="700" color="success.main">{summary?.gecerli || 0}</Typography>
            </Box>
            <Divider orientation="vertical" flexItem />
            <Box>
              <Typography variant="caption" color="text.secondary">Eklenecek</Typography>
              <Typography variant="h6" fontWeight="700" color="info.main">{summary?.eklenen || 0}</Typography>
            </Box>
            <Divider orientation="vertical" flexItem />
            <Box>
              <Typography variant="caption" color="text.secondary">Güncellenecek</Typography>
              <Typography variant="h6" fontWeight="700" color="warning.main">{summary?.guncellenen || 0}</Typography>
            </Box>
            <Divider orientation="vertical" flexItem />
            <Box>
              <Typography variant="caption" color="text.secondary">Silinecek</Typography>
              <Typography variant="h6" fontWeight="700" color="error.main">{summary?.silinecek || 0}</Typography>
            </Box>
            <Divider orientation="vertical" flexItem />
            <Box>
              <Typography variant="caption" color="text.secondary">Değişmeyen</Typography>
              <Typography variant="h6" fontWeight="700" color="text.secondary">{summary?.degismeyen || 0}</Typography>
            </Box>
            {summary?.hiyerarsi > 0 && (
              <>
                <Divider orientation="vertical" flexItem />
                <Box>
                  <Typography variant="caption" color="text.secondary">Hiyerarşi</Typography>
                  <Typography variant="h6" fontWeight="700" color="grey.500">{summary?.hiyerarsi || 0}</Typography>
                </Box>
              </>
            )}
          </Stack>
          {summary?.hiyerarsi > 0 && previewData.hiyerarsiSatirlari && (
            <Alert severity="info" sx={{ mt: 2 }}>
              <Typography variant="body2" fontWeight="600" gutterBottom>
                📂 {previewData.hiyerarsiSatirlari.toplam} adet hiyerarşi satırı tespit edildi
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {previewData.hiyerarsiSatirlari.aciklama}
              </Typography>
            </Alert>
          )}
        </Paper>

        {/* Uyarılar */}
        {uyarilar && uyarilar.length > 0 && (
          <Alert severity="warning" sx={{ mb: 3 }}>
            <Typography variant="subtitle2" fontWeight="600" gutterBottom>
              ⚠️ {uyarilar.length} Uyarı Bulundu
            </Typography>
            <Box component="ul" sx={{ mt: 1, pl: 2 }}>
              {uyarilar.slice(0, 5).map((uyari, index) => (
                <li key={index}>
                  <Typography variant="caption">
                    Satır {uyari.row}: {uyari.message}
                  </Typography>
                </li>
              ))}
            </Box>
            {uyarilar.length > 5 && (
              <Typography variant="caption" color="text.secondary">
                ... ve {uyarilar.length - 5} uyarı daha
              </Typography>
            )}
          </Alert>
        )}

        {/* Tabs */}
        <Tabs value={activeTab} onChange={handleTabChange} sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tab 
            label={
              <Stack direction="row" spacing={1} alignItems="center">
                <AddIcon fontSize="small" />
                <span>Eklenecekler</span>
                <Chip label={summary?.eklenen || 0} size="small" color="info" />
              </Stack>
            } 
          />
          <Tab 
            label={
              <Stack direction="row" spacing={1} alignItems="center">
                <WarningIcon fontSize="small" />
                <span>Güncellenecekler</span>
                <Chip label={summary?.guncellenen || 0} size="small" color="warning" />
              </Stack>
            } 
          />
          <Tab 
            label={
              <Stack direction="row" spacing={1} alignItems="center">
                <RemoveIcon fontSize="small" />
                <span>Silinecekler</span>
                <Chip label={summary?.silinecek || 0} size="small" color="error" />
              </Stack>
            } 
          />
        </Tabs>

        {/* Eklenecekler */}
        <TabPanel value={activeTab} index={0}>
          <TableContainer sx={{ maxHeight: 400 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600 }}>{kodLabel}</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>İşlem Adı</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600 }}>{birimLabel}</TableCell>
                  {!isSUT && <TableCell sx={{ fontWeight: 600 }}>Bölüm</TableCell>}
                </TableRow>
              </TableHead>
              <TableBody>
                {onizleme?.eklenenler?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={isSUT ? 3 : 4} align="center" sx={{ py: 3 }}>
                      <Typography variant="body2" color="text.secondary">
                        Eklenecek kayıt yok
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  onizleme?.eklenenler?.map((item, index) => (
                    <TableRow key={index} hover>
                      <TableCell>
                        <Chip label={item[kodField]} size="small" variant="outlined" />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontSize="0.85rem">
                          {item.IslemAdi}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Chip 
                          label={formatBirim(item[birimField])} 
                          size="small" 
                          color="info"
                          icon={<AddIcon />}
                        />
                      </TableCell>
                      {!isSUT && (
                        <TableCell>
                          <Typography variant="caption" color="text.secondary">
                            {item.BolumAdi || '-'}
                          </Typography>
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
          {onizleme?.eklenenler?.length > 0 && (
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
              İlk 10 kayıt gösteriliyor. Toplam: {summary?.eklenen || 0}
            </Typography>
          )}
        </TabPanel>

        {/* Güncellenecekler */}
        <TabPanel value={activeTab} index={1}>
          <TableContainer sx={{ maxHeight: 400 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600 }}>{kodLabel}</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>İşlem Adı</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600 }}>Eski {birimLabel}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600 }}>Yeni {birimLabel}</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 600 }}>Değişim</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {onizleme?.guncellenenler?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} align="center" sx={{ py: 3 }}>
                      <Typography variant="body2" color="text.secondary">
                        Güncellenecek kayıt yok
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  onizleme?.guncellenenler?.map((item, index) => {
                    const oldVal = item[eskiBirimField];
                    const newVal = item[yeniBirimField];
                    const change = calculateChange(oldVal, newVal);
                    const isIncrease = change > 0;
                    
                    return (
                      <TableRow key={index} hover>
                        <TableCell>
                          <Chip label={item[kodField]} size="small" variant="outlined" />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" fontSize="0.85rem">
                            {item.IslemAdi}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="body2" color="text.secondary">
                            {formatBirim(oldVal)}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="body2" fontWeight="600">
                            {formatBirim(newVal)}
                          </Typography>
                        </TableCell>
                        <TableCell align="center">
                          {change && (
                            <Chip
                              label={`${isIncrease ? '+' : ''}${change}%`}
                              size="small"
                              color={isIncrease ? 'error' : 'success'}
                              icon={isIncrease ? <TrendingUpIcon /> : <TrendingDownIcon />}
                            />
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </TableContainer>
          {onizleme?.guncellenenler?.length > 0 && (
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
              İlk 10 kayıt gösteriliyor. Toplam: {summary?.guncellenen || 0}
            </Typography>
          )}
        </TabPanel>

        {/* Silinecekler */}
        <TabPanel value={activeTab} index={2}>
          <TableContainer sx={{ maxHeight: 400 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600 }}>{kodLabel}</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>İşlem Adı</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600 }}>{birimLabel}</TableCell>
                  {!isSUT && <TableCell sx={{ fontWeight: 600 }}>Bölüm</TableCell>}
                </TableRow>
              </TableHead>
              <TableBody>
                {onizleme?.silinecekler?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={isSUT ? 3 : 4} align="center" sx={{ py: 3 }}>
                      <Typography variant="body2" color="text.secondary">
                        Silinecek kayıt yok
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  onizleme?.silinecekler?.map((item, index) => (
                    <TableRow key={index} hover sx={{ bgcolor: 'error.lighter' }}>
                      <TableCell>
                        <Chip label={item[kodField]} size="small" variant="outlined" color="error" />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontSize="0.85rem" color="error.main">
                          {item.IslemAdi}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" color="error.main">
                          {formatBirim(item[eskiBirimField] || item[birimField])}
                        </Typography>
                      </TableCell>
                      {!isSUT && (
                        <TableCell>
                          <Typography variant="caption" color="text.secondary">
                            {item.BolumAdi || '-'}
                          </Typography>
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
          {onizleme?.silinecekler?.length > 0 && (
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
              İlk 10 kayıt gösteriliyor. Toplam: {summary?.silinecek || 0}
            </Typography>
          )}
        </TabPanel>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} disabled={loading}>
          İptal
        </Button>
        <Button 
          variant="contained" 
          color="success" 
          onClick={onConfirm}
          disabled={loading}
          startIcon={loading ? null : <CheckCircleIcon />}
        >
          {loading ? 'İşleniyor...' : 'Onayla ve İçe Aktar'}
        </Button>
      </DialogActions>

      {loading && <LinearProgress />}
    </Dialog>
  );
}
