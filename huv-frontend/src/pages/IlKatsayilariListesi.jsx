// ============================================
// İL KATSAYILARI LİSTESİ SAYFASI
// ============================================
// İl Katsayıları listesi görüntüleme sayfası
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
  TextField
} from '@mui/material';
import {
  Refresh as RefreshIcon
} from '@mui/icons-material';
import { ilKatsayiService } from '../services/ilKatsayiService';
import { showError } from '../utils/toast';
import { LoadingSpinner, ErrorAlert, EmptyState, PageHeader, DateDisplay } from '../components/common';

// ============================================
// İL KATSAYILARI LİSTESİ COMPONENT
// ============================================
function IlKatsayilariListesi() {
  const [ilKatsayilari, setIlKatsayilari] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  // ============================================
  // İl katsayılarını yükle
  // ============================================
  const fetchIlKatsayilari = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await ilKatsayiService.getAll();
      const data = response?.data?.data || [];
      setIlKatsayilari(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('İl katsayıları yüklenemedi:', {
        message: err.message,
        response: err.response?.data,
        timestamp: new Date().toISOString()
      });
      setError(err);
      setIlKatsayilari([]);
      showError('İl katsayıları yüklenirken hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  // ============================================
  // İlk yükleme
  // ============================================
  useEffect(() => {
    fetchIlKatsayilari();
  }, []);

  // ============================================
  // Filtreleme
  // ============================================
  const filteredData = ilKatsayilari.filter(item => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      (item.ilAdi && item.ilAdi.toLowerCase().includes(search)) ||
      (item.plakaKodu && item.plakaKodu.toString().includes(search)) ||
      (item.katsayi && item.katsayi.toString().includes(search))
    );
  });

  // ============================================
  // Render
  // ============================================
  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <PageHeader 
        title="İl Katsayıları Listesi" 
        subtitle="Güncel il katsayıları listesi"
        icon="📊"
      />

      {/* Hata */}
      {error && <ErrorAlert message="İl katsayıları yüklenirken hata oluştu" error={error} />}

      {/* Arama ve Yenile */}
      <Paper elevation={2} sx={{ mb: 2 }}>
        <Box sx={{ p: 2, display: 'flex', gap: 2, alignItems: 'center' }}>
          <TextField
            placeholder="İl adı, plaka kodu veya katsayı ile ara..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            size="small"
            fullWidth
            sx={{ maxWidth: 400 }}
          />
          <Button
            size="small"
            startIcon={<RefreshIcon />}
            onClick={fetchIlKatsayilari}
            variant="outlined"
          >
            Yenile
          </Button>
        </Box>
      </Paper>

      {/* Tablo */}
      <Paper elevation={2}>
        <Box sx={{ p: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center', bgcolor: 'grey.100' }}>
          <Typography variant="h6" fontWeight="600">
            İl Katsayıları
            {filteredData.length > 0 && (
              <Chip 
                label={`${filteredData.length} il`} 
                size="small" 
                color="primary" 
                sx={{ ml: 2 }}
              />
            )}
          </Typography>
        </Box>
        <TableContainer sx={{ maxHeight: 700 }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell sx={{ bgcolor: 'background.paper', fontWeight: 600 }}>İl Adı</TableCell>
                <TableCell align="center" sx={{ bgcolor: 'background.paper', fontWeight: 600 }}>Plaka Kodu</TableCell>
                <TableCell align="right" sx={{ bgcolor: 'background.paper', fontWeight: 600 }}>Katsayı</TableCell>
                <TableCell sx={{ bgcolor: 'background.paper', fontWeight: 600 }}>Dönem Başlangıç</TableCell>
                <TableCell sx={{ bgcolor: 'background.paper', fontWeight: 600 }}>Dönem Bitiş</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} align="center">
                    <LoadingSpinner message="İl katsayıları yükleniyor..." />
                  </TableCell>
                </TableRow>
              ) : filteredData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center">
                    <EmptyState message={searchTerm ? "Arama sonucu bulunamadı" : "Henüz il katsayısı yüklenmemiş"} />
                  </TableCell>
                </TableRow>
              ) : (
                filteredData.map((item, index) => (
                  <TableRow key={item.ilKatsayiId || index} hover>
                    <TableCell>
                      <Typography variant="body2" fontWeight="500">
                        {item.ilAdi}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Typography variant="body2" color="text.secondary">
                        {item.plakaKodu || '-'}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" fontWeight="600" color="primary">
                        {item.katsayi?.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <DateDisplay date={item.donemBaslangic} />
                    </TableCell>
                    <TableCell>
                      <DateDisplay date={item.donemBitis} />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Container>
  );
}

export default IlKatsayilariListesi;
