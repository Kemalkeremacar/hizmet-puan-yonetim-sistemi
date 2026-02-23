// ============================================
// MATCHING DASHBOARD PAGE
// ============================================
// SUT-HUV eşleştirme istatistikleri ve toplu işlem
// ============================================

import { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Grid,
  Paper,
  Typography,
  Card,
  CardContent,
  CircularProgress,
  Alert,
} from '@mui/material';
import {
  Assessment as AssessmentIcon,
} from '@mui/icons-material';
import { PageHeader } from '../components/common';
import { matchingService } from '../services/matchingService';
import { toast } from 'react-toastify';
import BatchMatchingPanel from '../components/matching/BatchMatchingPanel';
import MatchingStatsCharts from '../components/matching/MatchingStatsCharts';

// ============================================
// MatchingDashboard Component
// ============================================
function MatchingDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // ============================================
  // İstatistikleri yükle
  // ============================================
  useEffect(() => {
    fetchStats();
  }, []);

  // ============================================
  // Otomatik yenileme (30 saniyede bir)
  // ============================================
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      fetchStats();
    }, 30000); // 30 saniye

    return () => clearInterval(interval);
  }, [autoRefresh]);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const response = await matchingService.getStats();
      setStats(response.data.data);
      setError(null);
    } catch (err) {
      console.error('İstatistikler yüklenemedi:', err);
      setError(err);
      toast.error('İstatistikler yüklenirken hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  // ============================================
  // Batch tamamlandığında
  // ============================================
  const handleBatchComplete = () => {
    fetchStats();
  };

  // ============================================
  // Render
  // ============================================
  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      <PageHeader 
        title="Eşleştirme Dashboard" 
        subtitle="SUT-HUV Otomatik Eşleştirme İstatistikleri"
        icon={AssessmentIcon}
      />

      {loading && !stats ? (
        <Box display="flex" justifyContent="center" alignItems="center" py={8}>
          <CircularProgress size={50} />
        </Box>
      ) : error && !stats ? (
        <Alert severity="error">
          İstatistikler yüklenirken bir hata oluştu: {error.message}
        </Alert>
      ) : (
        <Grid container spacing={3}>
          {/* Toplu Eşleştirme Paneli */}
          <Grid item xs={12}>
            <BatchMatchingPanel onBatchComplete={handleBatchComplete} stats={stats} />
          </Grid>

          {/* Özet Kartlar */}
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" gutterBottom variant="body2">
                  Toplam İşlem
                </Typography>
                <Typography variant="h3">
                  {stats?.totalIslemler || 0}
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" gutterBottom variant="body2">
                  Eşleşen
                </Typography>
                <Typography variant="h3" color="success.main">
                  {stats?.matchedCount || 0}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  %{stats?.matchedPercentage?.toFixed(1) || 0}
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" gutterBottom variant="body2">
                  Onay Bekleyen
                </Typography>
                <Typography variant="h3" color="warning.main">
                  {stats?.needsReviewCount || 0}
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" gutterBottom variant="body2">
                  Manuel Değişiklik
                </Typography>
                <Typography variant="h3" color="info.main">
                  {stats?.manualOverridesCount || 0}
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          {/* Grafikler */}
          {stats && (
            <Grid item xs={12}>
              <MatchingStatsCharts stats={stats} />
            </Grid>
          )}
        </Grid>
      )}
    </Container>
  );
}

export default MatchingDashboard;
