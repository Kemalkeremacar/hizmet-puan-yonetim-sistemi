// ============================================
// UNMATCHED RECORDS PAGE
// ============================================
// Eşleşmemiş SUT işlemlerini göster ve manuel eşleştir
// ============================================

import { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  CircularProgress,
  Alert,
  Container,
  Chip,
  IconButton,
  Button,
  Pagination,
  Grid,
  Card,
  CardContent,
} from '@mui/material';
import {
  Link as LinkIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { PageHeader } from '../components/common';
import { toast } from 'react-toastify';
import { useAuth } from '../app/context/AuthContext';
import HuvTeminatSelectionDialog from '../components/matching/HuvTeminatSelectionDialog';
import axios from '../api/axios';

// ============================================
// UnmatchedRecords Component
// ============================================
function UnmatchedRecords() {
  const { user } = useAuth();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const limit = 50;
  
  // Dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);

  // ============================================
  // Verileri yükle
  // ============================================
  useEffect(() => {
    fetchUnmatchedRecords();
  }, [page]);

  const fetchUnmatchedRecords = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/sut/unmatched', {
        params: { page, limit }
      });
      
      // Axios interceptor response.data döndürüyor
      setRecords(response.data || []);
      setTotalPages(response.pagination?.totalPages || 1);
    } catch (err) {
      console.error('Eşleşmemiş kayıtlar yüklenemedi:', err);
      setError(err);
      setRecords([]);
      toast.error('Eşleşmemiş kayıtlar yüklenirken hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  // ============================================
  // Manuel eşleştirme dialog aç
  // ============================================
  const handleMatchClick = (record) => {
    // Convert to match format for dialog
    const matchFormat = {
      sutId: record.SutID,
      sutKodu: record.SutKodu,
      islemAdi: record.IslemAdi,
      altTeminatId: null,
      altTeminatAdi: null,
    };
    setSelectedRecord(matchFormat);
    setDialogOpen(true);
  };

  // ============================================
  // Eşleşme oluşturuldu
  // ============================================
  const handleMatchCreated = () => {
    setDialogOpen(false);
    setSelectedRecord(null);
    fetchUnmatchedRecords();
    toast.success('Eşleşme oluşturuldu');
  };

  // ============================================
  // Render
  // ============================================
  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      <PageHeader 
        title="Eşleşmemiş Kayıtlar" 
        subtitle="Manuel Eşleştirme Gereken SUT İşlemleri"
        icon={LinkIcon}
      />

      {/* İstatistik */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={4}>
          <Card>
            <CardContent>
              <Typography color="text.secondary" gutterBottom variant="body2">
                Eşleşmemiş Kayıt
              </Typography>
              <Typography variant="h4" color="error.main">
                {records.length > 0 ? `${(page - 1) * limit + records.length}+` : '0'}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Manuel eşleştirme gerekiyor
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Paper sx={{ p: 3 }}>
        <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6">
            Eşleşmemiş SUT İşlemleri
          </Typography>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={fetchUnmatchedRecords}
          >
            Yenile
          </Button>
        </Box>

        {/* Tablo */}
        {loading ? (
          <Box display="flex" justifyContent="center" alignItems="center" py={8}>
            <CircularProgress size={50} />
          </Box>
        ) : error ? (
          <Alert severity="error">
            Veriler yüklenirken bir hata oluştu: {error.message}
          </Alert>
        ) : records.length === 0 ? (
          <Alert severity="info" sx={{ mb: 2 }}>
            <Typography variant="body1" gutterBottom>
              Henüz eşleştirme işlemi çalıştırılmamış veya tüm kayıtlar eşleştirilmiş.
            </Typography>
            <Typography variant="body2">
              Eşleştirme işlemini başlatmak için <strong>Eşleştirme Dashboard</strong> sayfasına gidin ve "Eşleştirmeyi Başlat" butonuna tıklayın.
            </Typography>
          </Alert>
        ) : (
          <>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>SUT Kodu</TableCell>
                  <TableCell>İşlem Adı</TableCell>
                  <TableCell>SUT Üst Teminat</TableCell>
                  <TableCell>SUT Alt Teminat</TableCell>
                  <TableCell align="right">İşlemler</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {records.map((record) => (
                  <TableRow key={record.SutID} hover>
                    <TableCell>
                      <Chip label={record.SutKodu} size="small" variant="outlined" />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {record.IslemAdi}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption" color="text.secondary">
                        {record.UstTeminatAdi || '-'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption" color="text.secondary">
                        {record.AltTeminatAdi || '-'}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Button
                        size="small"
                        variant="contained"
                        color="primary"
                        startIcon={<LinkIcon />}
                        onClick={() => handleMatchClick(record)}
                      >
                        Eşleştir
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {/* Pagination */}
            <Box display="flex" justifyContent="center" mt={3}>
              <Pagination
                count={totalPages}
                page={page}
                onChange={(_, value) => setPage(value)}
                color="primary"
              />
            </Box>
          </>
        )}
      </Paper>

      {/* HUV Teminat Seçim Dialog */}
      {selectedRecord && (
        <HuvTeminatSelectionDialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          match={selectedRecord}
          onMatchChanged={handleMatchCreated}
          showSimilarity={true}
        />
      )}
    </Container>
  );
}

export default UnmatchedRecords;
