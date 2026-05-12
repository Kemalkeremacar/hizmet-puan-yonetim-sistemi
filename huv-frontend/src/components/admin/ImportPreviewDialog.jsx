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
  LinearProgress,
  Tooltip,
  Collapse,
  IconButton
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Add as AddIcon,
  Remove as RemoveIcon,
  KeyboardArrowDown as ExpandIcon,
  KeyboardArrowUp as CollapseIcon,
  Edit as EditIcon,
  SwapHoriz as SwapIcon
} from '@mui/icons-material';
import { TabPanel } from '../common';

const FIELD_LABELS = {
  Birim: 'Birim',
  Puan: 'Puan',
  IslemAdi: 'İşlem Adı',
  SutKodu: 'SUT Kodu',
  Not: 'Not',
  Aciklama: 'Açıklama',
  AnaBaslikNo: 'Ana Başlık',
};

function ChangeBadge({ changes, isSUT }) {
  if (!changes || changes.length === 0) return null;

  const birimField = isSUT ? 'Puan' : 'Birim';

  return (
    <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
      {changes.map((c, i) => {
        const label = FIELD_LABELS[c.field] || c.field;
        let color = 'default';
        if (c.field === 'Birim' || c.field === 'Puan') color = 'warning';
        else if (c.field === 'IslemAdi') color = 'info';
        else if (c.field === 'SutKodu') color = 'secondary';
        else if (c.field === 'Not' || c.field === 'Aciklama') color = 'default';
        else if (c.field === 'AnaBaslikNo') color = 'primary';

        return (
          <Chip
            key={i}
            label={label}
            size="small"
            color={color}
            variant="outlined"
            sx={{ fontSize: '0.7rem', height: 22 }}
          />
        );
      })}
    </Stack>
  );
}

function UpdatedRow({ item, isSUT, kodField, formatBirim }) {
  const [expanded, setExpanded] = useState(false);
  const changes = item.changes || [];

  const birimChange = changes.find(c => c.field === 'Birim' || c.field === 'Puan');
  const otherChanges = changes.filter(c => c.field !== 'Birim' && c.field !== 'Puan');
  const hasBirimChange = !!birimChange;

  const changePercent = birimChange?.changePercent;
  const isIncrease = changePercent > 0;

  return (
    <>
      <TableRow
        hover
        onClick={() => otherChanges.length > 0 && setExpanded(!expanded)}
        sx={{
          cursor: otherChanges.length > 0 ? 'pointer' : 'default',
          '&:hover': { bgcolor: 'action.hover' }
        }}
      >
        <TableCell sx={{ width: 32, pr: 0, pl: 1 }}>
          {otherChanges.length > 0 && (
            <IconButton size="small" sx={{ p: 0.25 }}>
              {expanded ? <CollapseIcon fontSize="small" /> : <ExpandIcon fontSize="small" />}
            </IconButton>
          )}
        </TableCell>
        <TableCell sx={{ whiteSpace: 'nowrap', width: 100 }}>
          <Chip label={item[kodField]} size="small" variant="outlined" sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }} />
        </TableCell>
        <TableCell sx={{ minWidth: 200, maxWidth: 320 }}>
          <Typography variant="body2" fontSize="0.82rem" sx={{ lineHeight: 1.3 }}>
            {item.IslemAdi}
          </Typography>
        </TableCell>
        <TableCell sx={{ whiteSpace: 'nowrap', width: 140 }}>
          <ChangeBadge changes={changes} isSUT={isSUT} />
        </TableCell>
        <TableCell align="right" sx={{ whiteSpace: 'nowrap', width: 170 }}>
          {hasBirimChange ? (
            <Stack direction="row" spacing={0.5} alignItems="center" justifyContent="flex-end">
              <Typography variant="body2" color="text.secondary" sx={{ textDecoration: 'line-through', fontSize: '0.8rem' }}>
                {formatBirim(birimChange.oldValue)}
              </Typography>
              <SwapIcon sx={{ fontSize: 13, color: 'text.disabled' }} />
              <Typography variant="body2" fontWeight="600" fontSize="0.8rem">
                {formatBirim(birimChange.newValue)}
              </Typography>
            </Stack>
          ) : (
            <Typography variant="body2" color="text.secondary" fontSize="0.8rem">
              {formatBirim(item.EskiBirim || item.EskiPuan)}
            </Typography>
          )}
        </TableCell>
        <TableCell align="center" sx={{ width: 85 }}>
          {hasBirimChange && changePercent ? (
            <Chip
              label={`${isIncrease ? '+' : ''}${changePercent}%`}
              size="small"
              color={isIncrease ? 'error' : 'success'}
              icon={isIncrease ? <TrendingUpIcon /> : <TrendingDownIcon />}
              sx={{ fontSize: '0.72rem' }}
            />
          ) : (
            !hasBirimChange && (
              <Typography variant="caption" color="text.disabled">—</Typography>
            )
          )}
        </TableCell>
      </TableRow>

      {otherChanges.length > 0 && (
        <TableRow>
          <TableCell colSpan={6} sx={{ py: 0, borderBottom: expanded ? undefined : 'none' }}>
            <Collapse in={expanded} timeout="auto" unmountOnExit>
              <Box sx={{ py: 1.5, px: 2, my: 1, bgcolor: 'grey.50', borderRadius: 1, borderLeft: '3px solid', borderLeftColor: 'info.main' }}>
                <Typography variant="caption" fontWeight="600" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                  Detaylı Değişiklikler
                </Typography>
                <Stack spacing={1}>
                  {otherChanges.map((c, i) => (
                    <Box key={i}>
                      <Typography variant="caption" fontWeight="600" color="text.secondary">
                        {FIELD_LABELS[c.field] || c.field}:
                      </Typography>
                      {(c.field === 'Not' || c.field === 'Aciklama') ? (
                        <Stack spacing={0.5} sx={{ mt: 0.5 }}>
                          <Box sx={{ p: 1, bgcolor: '#fff3f3', borderRadius: 0.5 }}>
                            <Typography variant="caption" color="error.dark" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                              {c.oldValue ? (c.oldValue.length > 200 ? c.oldValue.substring(0, 200) + '...' : c.oldValue) : '(boş)'}
                            </Typography>
                          </Box>
                          <Box sx={{ p: 1, bgcolor: '#f0fff0', borderRadius: 0.5 }}>
                            <Typography variant="caption" color="success.dark" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                              {c.newValue ? (c.newValue.length > 200 ? c.newValue.substring(0, 200) + '...' : c.newValue) : '(boş)'}
                            </Typography>
                          </Box>
                        </Stack>
                      ) : (
                        <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.25 }}>
                          <Typography variant="caption" sx={{ color: 'error.main', textDecoration: 'line-through' }}>
                            {c.oldValue || '(boş)'}
                          </Typography>
                          <SwapIcon sx={{ fontSize: 12, color: 'text.disabled' }} />
                          <Typography variant="caption" fontWeight="600" color="success.dark">
                            {c.newValue || '(boş)'}
                          </Typography>
                        </Stack>
                      )}
                    </Box>
                  ))}
                </Stack>
              </Box>
            </Collapse>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

export default function ImportPreviewDialog({ open, onClose, previewData, onConfirm, loading }) {
  const [activeTab, setActiveTab] = useState(0);

  if (!previewData) return null;

  const { summary, uyarilar, onizleme, listeTipi } = previewData;

  const isSUT = listeTipi === 'SUT';
  const kodLabel = isSUT ? 'SUT Kodu' : 'HUV Kodu';
  const kodField = isSUT ? 'SutKodu' : 'HuvKodu';
  const birimLabel = isSUT ? 'Puan' : 'Birim';
  const eskiBirimField = isSUT ? 'EskiPuan' : 'EskiBirim';
  const birimField = isSUT ? 'Puan' : 'Birim';

  const formatBirim = (value) => {
    if (!value && value !== 0) return '-';
    if (isSUT) {
      return parseFloat(value).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    return `₺${parseFloat(value).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const updatedItems = onizleme?.guncellenenler || [];
  
  // Backend'den gelen tam dağılımı kullan (tüm güncellenenler üzerinden hesaplanmış)
  const dist = summary?.degisiklikDagilimi || {};
  const birimCount = dist.Birim || dist.Puan || 0;
  const nameCount = dist.IslemAdi || 0;
  const sutCodeCount = dist.SutKodu || 0;
  const notCount = dist.Not || dist.Aciklama || 0;
  const anaBaslikCount = dist.AnaBaslikNo || 0;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle sx={{ pb: 1 }}>
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
        {/* Özet */}
        <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
          <Stack direction="row" spacing={3} flexWrap="wrap" useFlexGap>
            <Box sx={{ textAlign: 'center', minWidth: 70 }}>
              <Typography variant="caption" color="text.secondary">Toplam Okunan</Typography>
              <Typography variant="h6" fontWeight="700">{summary?.toplamOkunan || 0}</Typography>
            </Box>
            <Divider orientation="vertical" flexItem />
            <Box sx={{ textAlign: 'center', minWidth: 70 }}>
              <Typography variant="caption" color="text.secondary">Geçerli</Typography>
              <Typography variant="h6" fontWeight="700" color="success.main">{summary?.gecerli || 0}</Typography>
            </Box>
            <Divider orientation="vertical" flexItem />
            <Box sx={{ textAlign: 'center', minWidth: 70 }}>
              <Typography variant="caption" color="text.secondary">Eklenecek</Typography>
              <Typography variant="h6" fontWeight="700" color="info.main">{summary?.eklenen || 0}</Typography>
            </Box>
            <Divider orientation="vertical" flexItem />
            <Box sx={{ textAlign: 'center', minWidth: 70 }}>
              <Typography variant="caption" color="text.secondary">Güncellenecek</Typography>
              <Typography variant="h6" fontWeight="700" color="warning.main">{summary?.guncellenen || 0}</Typography>
            </Box>
            <Divider orientation="vertical" flexItem />
            <Box sx={{ textAlign: 'center', minWidth: 70 }}>
              <Typography variant="caption" color="text.secondary">Silinecek</Typography>
              <Typography variant="h6" fontWeight="700" color="error.main">{summary?.silinecek || 0}</Typography>
            </Box>
            <Divider orientation="vertical" flexItem />
            <Box sx={{ textAlign: 'center', minWidth: 70 }}>
              <Typography variant="caption" color="text.secondary">Değişmeyen</Typography>
              <Typography variant="h6" fontWeight="700" color="text.secondary">{summary?.degismeyen || 0}</Typography>
            </Box>
          </Stack>
          {/* Hiyerarşi/atlanan bilgisi backend'de tutuluyor, özette gösterilmiyor */}
        </Paper>

        {/* Güncelleme Detay Özeti */}
        {(summary?.guncellenen > 0) && (
          <Paper variant="outlined" sx={{ p: 1.5, mb: 2, borderColor: 'warning.light' }}>
            <Typography variant="caption" fontWeight="600" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
              Değişiklik Dağılımı (tüm {summary.guncellenen} güncelleme)
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {birimCount > 0 && (
                <Chip label={`${birimLabel}: ${birimCount}`} size="small" color="warning" variant="outlined" />
              )}
              {nameCount > 0 && (
                <Chip label={`İşlem Adı: ${nameCount}`} size="small" color="info" variant="outlined" />
              )}
              {sutCodeCount > 0 && (
                <Chip label={`SUT Kodu: ${sutCodeCount}`} size="small" color="secondary" variant="outlined" />
              )}
              {notCount > 0 && (
                <Chip label={`${isSUT ? 'Açıklama' : 'Not'}: ${notCount}`} size="small" variant="outlined" />
              )}
              {anaBaslikCount > 0 && (
                <Chip label={`Ana Başlık: ${anaBaslikCount}`} size="small" color="primary" variant="outlined" />
              )}
            </Stack>
          </Paper>
        )}

        {/* Hiyerarşi ve uyarı bilgileri kaldırıldı — önizleme sade tutuldu */}

        {/* Tabs */}
        <Tabs value={activeTab} onChange={(e, v) => setActiveTab(v)} sx={{ borderBottom: 1, borderColor: 'divider' }}>
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
                <EditIcon fontSize="small" />
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
                      <Typography variant="body2" color="text.secondary">Eklenecek kayıt yok</Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  onizleme?.eklenenler?.map((item, index) => (
                    <TableRow key={index} hover>
                      <TableCell>
                        <Chip label={item[kodField]} size="small" variant="outlined" />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontSize="0.85rem">{item.IslemAdi}</Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Chip label={formatBirim(item[birimField] || item.YeniBirim)} size="small" color="info" />
                      </TableCell>
                      {!isSUT && (
                        <TableCell>
                          <Typography variant="caption" color="text.secondary">{item.BolumAdi || '-'}</Typography>
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
            <Table size="small" stickyHeader sx={{ tableLayout: 'fixed', minWidth: 700 }}>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ width: 32, pl: 1, pr: 0 }} />
                  <TableCell sx={{ fontWeight: 600, width: 100 }}>{kodLabel}</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>İşlem Adı</TableCell>
                  <TableCell sx={{ fontWeight: 600, width: 140 }}>Değişen Alanlar</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600, width: 170 }}>{birimLabel}</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 600, width: 85 }}>Değişim</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {updatedItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center" sx={{ py: 3 }}>
                      <Typography variant="body2" color="text.secondary">Güncellenecek kayıt yok</Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  updatedItems.map((item, index) => (
                    <UpdatedRow
                      key={index}
                      item={item}
                      isSUT={isSUT}
                      kodField={kodField}
                      formatBirim={formatBirim}
                    />
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
          {updatedItems.length > 0 && (
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
                      <Typography variant="body2" color="text.secondary">Silinecek kayıt yok</Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  onizleme?.silinecekler?.map((item, index) => (
                    <TableRow key={index} hover>
                      <TableCell>
                        <Chip label={item[kodField]} size="small" variant="outlined" color="error" />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontSize="0.85rem" color="error.main">{item.IslemAdi}</Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" color="error.main">
                          {formatBirim(item[eskiBirimField] || item[birimField])}
                        </Typography>
                      </TableCell>
                      {!isSUT && (
                        <TableCell>
                          <Typography variant="caption" color="text.secondary">{item.BolumAdi || '-'}</Typography>
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
        <Button onClick={onClose} disabled={loading}>İptal</Button>
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
