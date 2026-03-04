// ============================================
// MATCHING REVIEW PAGE
// ============================================
// SUT-HUV eşleşmelerini gözden geçirme sayfası
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
  TextField,
  MenuItem,
  Pagination,
  Grid,
  Card,
  CardContent,
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Edit as EditIcon,
  Refresh as RefreshIcon,
  LinkOff as LinkOffIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../components/common';
import { matchingService } from '../services/matchingService';
import { toast } from 'react-toastify';
import { useAuth } from '../app/context/AuthContext';
import HuvTeminatSelectionDialog from '../components/matching/HuvTeminatSelectionDialog';
import BatchMatchingPanel from '../components/matching/BatchMatchingPanel';

// ============================================
// MatchingReview Component
// ============================================
function MatchingReview() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState(null);
  
  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const limit = 50;
  
  // Filters
  const [filters, setFilters] = useState({
    sutKodu: '',
    islemAdi: '',
    sutUstTeminat: '',
    sutAltTeminat: '',
    huvUstTeminat: '',
    huvAltTeminat: '',
    confidenceMin: '',
    confidenceMax: '',
  });
  
  // Dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState(null);

  // ============================================
  // Verileri yükle
  // ============================================
  useEffect(() => {
    fetchResults();
    fetchStats();
  }, [page, filters]);

  const fetchResults = async () => {
    try {
      setLoading(true);
      const response = await matchingService.getResults(filters, page, limit);
      console.log('📊 Matching Results Response:', response);
      // Axios interceptor response.data döndürüyor, o zaten backend'in response'u
      setResults(response.data || []);
      setTotalPages(response.pagination?.totalPages || 1);
    } catch (err) {
      console.error('Eşleşmeler yüklenemedi:', err);
      setError(err);
      setResults([]); // Hata durumunda boş array
      toast.error('Eşleşmeler yüklenirken hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await matchingService.getStats();
      setStats(response.data || response);
    } catch (err) {
      console.error('İstatistikler yüklenemedi:', err);
    }
  };

  // ============================================
  // Batch tamamlandığında
  // ============================================
  const handleBatchComplete = () => {
    fetchResults();
    fetchStats();
  };

  // ============================================
  // Eşleşmeyi onayla
  // ============================================
  const handleApprove = async (sutId) => {
    try {
      await matchingService.approveMatch(sutId, user.id);
      toast.success('Eşleşme onaylandı');
      fetchResults();
      fetchStats();
    } catch (err) {
      console.error('Onaylama hatası:', err);
      toast.error('Eşleşme onaylanırken hata oluştu');
    }
  };

  // ============================================
  // Eşleşmeyi değiştir dialog aç
  // ============================================
  const handleChangeClick = (match) => {
    setSelectedMatch(match);
    setDialogOpen(true);
  };

  // ============================================
  // Eşleşme değiştirildi
  // ============================================
  const handleMatchChanged = () => {
    setDialogOpen(false);
    setSelectedMatch(null);
    fetchResults();
    fetchStats();
  };

  // ============================================
  // Filtre değiştir
  // ============================================
  const handleFilterChange = (field, value) => {
    setFilters(prev => ({ ...prev, [field]: value }));
    setPage(1); // Reset to first page
  };

  // ============================================
  // Filtreleri temizle
  // ============================================
  const handleClearFilters = () => {
    setFilters({
      sutKodu: '',
      islemAdi: '',
      sutUstTeminat: '',
      sutAltTeminat: '',
      huvUstTeminat: '',
      huvAltTeminat: '',
      confidenceMin: '',
      confidenceMax: '',
    });
    setPage(1);
  };

  // ============================================
  // Confidence score renk
  // ============================================
  const getConfidenceColor = (score) => {
    if (score >= 85) return 'success';
    if (score >= 70) return 'warning';
    return 'error';
  };

  // ============================================
  // Rule type label
  // ============================================
  const getRuleTypeLabel = (ruleType) => {
    const labels = {
      'direct_sut_code': 'Direkt SUT Kodu',
      'hierarchy_matching': 'Hiyerarşi',
      'first_letter': 'İlk Harf',
      'surgical_similarity': 'Cerrahi Benzerlik',
      'radiology_keyword': 'Radyoloji Anahtar Kelime',
      'general_similarity': 'Genel Benzerlik'
    };
    return labels[ruleType] || ruleType;
  };

  // ============================================
  // Render
  // ============================================
  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      <PageHeader 
        title="Eşleşme Yönetimi" 
        subtitle="SUT-HUV Eşleşmelerini Gözden Geçir, Düzenle ve Yeniden Eşleştir"
        icon={CheckCircleIcon}
      />

      {/* Toplu Eşleştirme Paneli */}
      <Box sx={{ mb: 3 }}>
        <BatchMatchingPanel onBatchComplete={handleBatchComplete} stats={stats} />
      </Box>

      {/* Eşleşmemiş Kayıtlar Butonu */}
      <Box sx={{ mb: 3 }}>
        <Button
          variant="contained"
          color="warning"
          size="large"
          fullWidth
          startIcon={<LinkOffIcon />}
          onClick={() => navigate('/matching/unmatched')}
          sx={{
            py: 2,
            fontSize: '1.1rem',
            fontWeight: 600,
            boxShadow: 3,
            '&:hover': {
              boxShadow: 6,
            },
          }}
        >
          Eşleşmemiş Kayıtlar {stats && `(${stats.unmatchedCount})`}
        </Button>
      </Box>

      {/* İstatistikler */}
      {stats && (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} md={2.4}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" gutterBottom variant="body2">
                  Toplam İşlem
                </Typography>
                <Typography variant="h4">
                  {stats.totalIslemler}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={2.4}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" gutterBottom variant="body2">
                  Eşleşen
                </Typography>
                <Typography variant="h4" color="success.main">
                  {stats.matchedCount}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  %{stats.matchedPercentage?.toFixed(1)}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={2.4}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" gutterBottom variant="body2">
                  Eşleşmemiş
                </Typography>
                <Typography variant="h4" color="error.main">
                  {stats.unmatchedCount}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={2.4}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" gutterBottom variant="body2">
                  Onay Bekleyen
                </Typography>
                <Typography variant="h4" color="warning.main">
                  {stats.needsReviewCount}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={2.4}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" gutterBottom variant="body2">
                  Manuel Değişiklik
                </Typography>
                <Typography variant="h4" color="info.main">
                  {stats.manualOverridesCount}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      <Paper sx={{ p: 3 }}>
        {/* Filtreler */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" gutterBottom sx={{ mb: 2 }}>
            Arama Filtreleri
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={2}>
              <TextField
                fullWidth
                size="small"
                label="SUT Kodu"
                placeholder="Ara..."
                value={filters.sutKodu}
                onChange={(e) => handleFilterChange('sutKodu', e.target.value)}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <TextField
                fullWidth
                size="small"
                label="İşlem Adı"
                placeholder="Ara..."
                value={filters.islemAdi}
                onChange={(e) => handleFilterChange('islemAdi', e.target.value)}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={1.5}>
              <TextField
                fullWidth
                size="small"
                label="SUT Üst"
                placeholder="Ara..."
                value={filters.sutUstTeminat}
                onChange={(e) => handleFilterChange('sutUstTeminat', e.target.value)}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={1.5}>
              <TextField
                fullWidth
                size="small"
                label="SUT Alt"
                placeholder="Ara..."
                value={filters.sutAltTeminat}
                onChange={(e) => handleFilterChange('sutAltTeminat', e.target.value)}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={1.5}>
              <TextField
                fullWidth
                size="small"
                label="HUV Üst"
                placeholder="Ara..."
                value={filters.huvUstTeminat}
                onChange={(e) => handleFilterChange('huvUstTeminat', e.target.value)}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={1.5}>
              <TextField
                fullWidth
                size="small"
                label="HUV Alt"
                placeholder="Ara..."
                value={filters.huvAltTeminat}
                onChange={(e) => handleFilterChange('huvAltTeminat', e.target.value)}
              />
            </Grid>
            <Grid item xs={6} sm={3} md={1}>
              <TextField
                fullWidth
                size="small"
                label="Skor Min"
                type="number"
                placeholder="0"
                value={filters.confidenceMin}
                onChange={(e) => handleFilterChange('confidenceMin', e.target.value)}
                inputProps={{ min: 0, max: 100, step: 1 }}
              />
            </Grid>
            <Grid item xs={6} sm={3} md={1}>
              <TextField
                fullWidth
                size="small"
                label="Skor Max"
                type="number"
                placeholder="100"
                value={filters.confidenceMax}
                onChange={(e) => handleFilterChange('confidenceMax', e.target.value)}
                inputProps={{ min: 0, max: 100, step: 1 }}
              />
            </Grid>
          </Grid>

          <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
            <Button
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={handleClearFilters}
              size="small"
            >
              Filtreleri Temizle
            </Button>
          </Box>
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
        ) : results.length === 0 ? (
          <Alert severity="info">Eşleşme bulunamadı</Alert>
        ) : (
          <>
            <Box sx={{ overflowX: 'auto' }}>
              <Table size="small" sx={{ '& .MuiTableCell-root': { py: 1, fontSize: '0.75rem' } }}>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ minWidth: 80 }}>SUT Kodu</TableCell>
                  <TableCell sx={{ minWidth: 200 }}>İşlem Adı</TableCell>
                  <TableCell sx={{ minWidth: 120 }}>SUT Üst</TableCell>
                  <TableCell sx={{ minWidth: 120 }}>SUT Alt</TableCell>
                  <TableCell sx={{ minWidth: 120 }}>HUV Üst</TableCell>
                  <TableCell sx={{ minWidth: 120 }}>HUV Alt</TableCell>
                  <TableCell align="center" sx={{ minWidth: 70 }}>Skor</TableCell>
                  <TableCell align="center" sx={{ minWidth: 100 }}>Kural</TableCell>
                  <TableCell align="center" sx={{ minWidth: 80 }}>Durum</TableCell>
                  <TableCell align="right" sx={{ minWidth: 100 }}>İşlem</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {results.map((match) => (
                  <TableRow key={match.ID} hover>
                    <TableCell>
                      <Chip label={match.sutKodu} size="small" variant="outlined" sx={{ fontSize: '0.7rem', height: 20 }} />
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption" sx={{ fontSize: '0.75rem' }}>
                        {match.islemAdi}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                        {match.sutUstTeminatAdi || '-'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                        {match.sutAltTeminatAdi || '-'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                        {match.huvUstTeminatAdi || '-'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption" sx={{ fontSize: '0.75rem' }}>
                        {match.altTeminatAdi}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Chip
                        label={`${match.confidenceScore.toFixed(0)}%`}
                        size="small"
                        color={getConfidenceColor(match.confidenceScore)}
                        sx={{ fontSize: '0.7rem', height: 20 }}
                      />
                    </TableCell>
                    <TableCell align="center">
                      <Typography variant="caption" sx={{ fontSize: '0.7rem' }}>
                        {getRuleTypeLabel(match.matchingRuleType)}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      {match.isApproved ? (
                        <Chip label="Onay" size="small" color="success" sx={{ fontSize: '0.7rem', height: 20 }} />
                      ) : (
                        <Chip label="Bekl." size="small" color="warning" sx={{ fontSize: '0.7rem', height: 20 }} />
                      )}
                    </TableCell>
                    <TableCell align="right">
                      <Box display="flex" gap={0.5} justifyContent="flex-end">
                        {!match.isApproved && (
                          <IconButton
                            size="small"
                            color="success"
                            onClick={() => handleApprove(match.sutId)}
                            title="Onayla"
                            sx={{ p: 0.5 }}
                          >
                            <CheckCircleIcon fontSize="small" />
                          </IconButton>
                        )}
                        <IconButton
                          size="small"
                          color="primary"
                          onClick={() => handleChangeClick(match)}
                          title="Değiştir"
                          sx={{ p: 0.5 }}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </Box>

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
      {selectedMatch && (
        <HuvTeminatSelectionDialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          match={selectedMatch}
          onMatchChanged={handleMatchChanged}
        />
      )}
    </Container>
  );
}

export default MatchingReview;
