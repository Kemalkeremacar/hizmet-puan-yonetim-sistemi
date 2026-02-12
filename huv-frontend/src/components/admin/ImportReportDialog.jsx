// ============================================
// IMPORT REPORT DIALOG
// ============================================
// Import detay raporu görüntüleme
// ============================================

import { useState, useEffect } from 'react';
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
  Stack,
  Divider,
  Paper,
  CircularProgress
} from '@mui/material';
import {
  Close as CloseIcon,
  Assessment as AssessmentIcon,
  Add as AddIcon,
  Edit as EditIcon,
  History as HistoryIcon
} from '@mui/icons-material';
import { adminService } from '../../services/adminService';
import { showError } from '../../utils/toast';

function TabPanel({ children, value, index }) {
  return (
    <div hidden={value !== index}>
      {value === index && <Box sx={{ pt: 2 }}>{children}</Box>}
    </div>
  );
}

export default function ImportReportDialog({ open, onClose, versionId }) {
  const [activeTab, setActiveTab] = useState(0);
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && versionId) {
      fetchReport();
    }
  }, [open, versionId]);

  const fetchReport = async () => {
    try {
      setLoading(true);
      const response = await adminService.getImportReport(versionId);
      setReportData(response.data);
    } catch (err) {
      console.error('Rapor yüklenemedi:', err);
      showError('Rapor yüklenirken hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return '-';
    try {
      const date = new Date(dateString);
      return date.toLocaleString('tr-TR');
    } catch {
      return '-';
    }
  };

  const formatBirim = (value) => {
    if (!value) return '-';
    return `₺${parseFloat(value).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  if (!reportData && !loading) return null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>
        <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
          <Stack direction="row" spacing={2} alignItems="center">
            <AssessmentIcon color="primary" />
            <Box>
              <Typography variant="h6" fontWeight="600">
                Import Detay Raporu
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Versiyon #{versionId}
              </Typography>
            </Box>
          </Stack>
          <Button onClick={onClose} size="small" startIcon={<CloseIcon />}>
            Kapat
          </Button>
        </Stack>
      </DialogTitle>

      <DialogContent dividers>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            {/* Versiyon Bilgisi */}
            <Paper elevation={0} sx={{ p: 2, bgcolor: 'grey.50', mb: 3 }}>
              <Typography variant="subtitle2" gutterBottom fontWeight="600">
                📋 Versiyon Bilgileri
              </Typography>
              <Stack direction="row" spacing={3} sx={{ mt: 2 }}>
                <Box>
                  <Typography variant="caption" color="text.secondary">Dosya Adı</Typography>
                  <Typography variant="body2" fontWeight="600">{reportData?.version?.DosyaAdi || '-'}</Typography>
                </Box>
                <Divider orientation="vertical" flexItem />
                <Box>
                  <Typography variant="caption" color="text.secondary">Yükleyen</Typography>
                  <Typography variant="body2" fontWeight="600">{reportData?.version?.YukleyenKullanici || '-'}</Typography>
                </Box>
                <Divider orientation="vertical" flexItem />
                <Box>
                  <Typography variant="caption" color="text.secondary">Tarih</Typography>
                  <Typography variant="body2" fontWeight="600">{formatDateTime(reportData?.version?.YuklemeTarihi)}</Typography>
                </Box>
                <Divider orientation="vertical" flexItem />
                <Box>
                  <Typography variant="caption" color="text.secondary">Kayıt Sayısı</Typography>
                  <Typography variant="body2" fontWeight="600">{reportData?.version?.KayitSayisi || 0}</Typography>
                </Box>
              </Stack>
            </Paper>

            {/* Özet */}
            <Paper elevation={0} sx={{ p: 2, bgcolor: 'info.lighter', mb: 3 }}>
              <Typography variant="subtitle2" gutterBottom fontWeight="600">
                📊 İşlem Özeti
              </Typography>
              <Stack direction="row" spacing={3} sx={{ mt: 2 }}>
                <Box>
                  <Typography variant="caption" color="text.secondary">Eklenen</Typography>
                  <Typography variant="h6" fontWeight="700" color="info.main">{reportData?.summary?.eklenen || 0}</Typography>
                </Box>
                <Divider orientation="vertical" flexItem />
                <Box>
                  <Typography variant="caption" color="text.secondary">Güncellenen</Typography>
                  <Typography variant="h6" fontWeight="700" color="warning.main">{reportData?.summary?.guncellenen || 0}</Typography>
                </Box>
                <Divider orientation="vertical" flexItem />
                <Box>
                  <Typography variant="caption" color="text.secondary">Toplam Audit</Typography>
                  <Typography variant="h6" fontWeight="700" color="text.secondary">{reportData?.summary?.toplamAudit || 0}</Typography>
                </Box>
              </Stack>
            </Paper>

            {/* Tabs */}
            <Tabs value={activeTab} onChange={handleTabChange} sx={{ borderBottom: 1, borderColor: 'divider' }}>
              <Tab 
                label={
                  <Stack direction="row" spacing={1} alignItems="center">
                    <AddIcon fontSize="small" />
                    <span>Eklenenler</span>
                    <Chip label={reportData?.summary?.eklenen || 0} size="small" color="info" />
                  </Stack>
                } 
              />
              <Tab 
                label={
                  <Stack direction="row" spacing={1} alignItems="center">
                    <EditIcon fontSize="small" />
                    <span>Güncellenenler</span>
                    <Chip label={reportData?.summary?.guncellenen || 0} size="small" color="warning" />
                  </Stack>
                } 
              />
              <Tab 
                label={
                  <Stack direction="row" spacing={1} alignItems="center">
                    <HistoryIcon fontSize="small" />
                    <span>Audit Kayıtları</span>
                    <Chip label={reportData?.summary?.toplamAudit || 0} size="small" />
                  </Stack>
                } 
              />
            </Tabs>

            {/* Eklenenler */}
            <TabPanel value={activeTab} index={0}>
              <TableContainer sx={{ maxHeight: 400 }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 600 }}>HUV Kodu</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>İşlem Adı</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600 }}>Birim</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Bölüm</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {reportData?.eklenenler?.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} align="center" sx={{ py: 3 }}>
                          <Typography variant="body2" color="text.secondary">
                            Eklenen kayıt yok
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ) : (
                      reportData?.eklenenler?.map((item) => (
                        <TableRow key={item.IslemID} hover>
                          <TableCell>
                            <Chip label={item.HuvKodu} size="small" variant="outlined" />
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" fontSize="0.85rem">
                              {item.IslemAdi}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            <Typography variant="body2" fontWeight="600">
                              {formatBirim(item.Birim)}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="caption" color="text.secondary">
                              {item.BolumAdi || '-'}
                            </Typography>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </TabPanel>

            {/* Güncellenenler */}
            <TabPanel value={activeTab} index={1}>
              <TableContainer sx={{ maxHeight: 400 }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 600 }}>HUV Kodu</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>İşlem Adı</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600 }}>Eski Birim</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600 }}>Yeni Birim</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Bölüm</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {reportData?.guncellenenler?.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} align="center" sx={{ py: 3 }}>
                          <Typography variant="body2" color="text.secondary">
                            Güncellenen kayıt yok
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ) : (
                      reportData?.guncellenenler?.map((item) => (
                        <TableRow key={item.IslemID} hover>
                          <TableCell>
                            <Chip label={item.HuvKodu} size="small" variant="outlined" />
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" fontSize="0.85rem">
                              {item.IslemAdi}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            <Typography variant="body2" color="text.secondary">
                              {formatBirim(item.EskiBirim)}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            <Typography variant="body2" fontWeight="600">
                              {formatBirim(item.Birim)}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="caption" color="text.secondary">
                              {item.BolumAdi || '-'}
                            </Typography>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </TabPanel>

            {/* Audit Kayıtları */}
            <TabPanel value={activeTab} index={2}>
              <TableContainer sx={{ maxHeight: 400 }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 600 }}>İşlem Tipi</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>HUV Kodu</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>İşlem Adı</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Kullanıcı</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Tarih</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {reportData?.auditKayitlari?.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} align="center" sx={{ py: 3 }}>
                          <Typography variant="body2" color="text.secondary">
                            Audit kaydı yok
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ) : (
                      reportData?.auditKayitlari?.map((item) => (
                        <TableRow key={item.AuditID} hover>
                          <TableCell>
                            <Chip 
                              label={item.IslemTipi} 
                              size="small" 
                              color={
                                item.IslemTipi === 'INSERT' ? 'info' :
                                item.IslemTipi === 'UPDATE' ? 'warning' :
                                'default'
                              }
                            />
                          </TableCell>
                          <TableCell>
                            <Chip label={item.HuvKodu} size="small" variant="outlined" />
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" fontSize="0.85rem">
                              {item.IslemAdi}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="caption">
                              {item.DegistirenKullanici || 'Sistem'}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="caption">
                              {formatDateTime(item.DegisiklikTarihi)}
                            </Typography>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </TabPanel>
          </>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} variant="outlined">
          Kapat
        </Button>
      </DialogActions>
    </Dialog>
  );
}
