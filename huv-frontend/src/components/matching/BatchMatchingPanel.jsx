// ============================================
// BATCH MATCHING PANEL
// ============================================
// Toplu eşleştirme işlemi paneli
// ============================================

import { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  TextField,
  FormControlLabel,
  Checkbox,
  LinearProgress,
  Alert,
  Grid,
  Chip,
} from '@mui/material';
import {
  PlayArrow as PlayArrowIcon,
} from '@mui/icons-material';
import { matchingService } from '../../services/matchingService';
import { toast } from 'react-toastify';

// ============================================
// BatchMatchingPanel Component
// ============================================
function BatchMatchingPanel({ onBatchComplete, stats }) {
  const [batchSize, setBatchSize] = useState(100);
  const [anaDalKodu, setAnaDalKodu] = useState('');
  const [forceRematch, setForceRematch] = useState(false);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState(null);
  
  // Toplam kayıt sayısı
  // Stats yüklenmemişse veya totalIslemler 0 ise default 7129 kullan
  const defaultTotal = 7129;
  const actualTotal = stats?.totalIslemler || defaultTotal;
  const actualUnmatched = stats?.unmatchedCount || 0;
  
  // - Eğer hiç eşleşme yoksa: tüm kayıtlar
  // - forceRematch true ise: tüm kayıtlar
  // - Değilse: sadece eşleşmemiş kayıtlar
  const totalRecords = (!stats?.matchedCount || forceRematch)
    ? actualTotal
    : actualUnmatched;

  // ============================================
  // Toplu eşleştirme başlat
  // ============================================
  const handleStartBatch = async () => {
    // Validasyon
    if (batchSize < 1 || batchSize > 10000) {
      toast.error('Batch boyutu 1-10000 arasında olmalıdır');
      return;
    }

    try {
      setRunning(true);
      setProgress(0);
      setSummary(null);
      setError(null);

      const options = {
        batchSize: parseInt(batchSize),
        anaDalKodu: anaDalKodu || null,
        forceRematch
      };

      const response = await matchingService.runBatch(options, (percent) => {
        setProgress(percent);
      });

      setSummary(response.data.data);
      toast.success('Toplu eşleştirme tamamlandı');
      
      if (onBatchComplete) {
        onBatchComplete();
      }
    } catch (err) {
      console.error('Toplu eşleştirme hatası:', err);
      setError(err.response?.data?.message || 'Toplu eşleştirme sırasında hata oluştu');
      toast.error('Toplu eşleştirme başarısız oldu');
    } finally {
      setRunning(false);
      setProgress(0);
    }
  };

  // ============================================
  // Render
  // ============================================
  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>
        Toplu Eşleştirme
      </Typography>
      <Typography variant="body2" color="text.secondary" paragraph>
        SUT işlemlerini HUV alt teminatlarıyla otomatik olarak eşleştirin. 
        Batch boyutu, toplam kaç kayıt işleneceğini belirler.
      </Typography>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={4}>
          <TextField
            fullWidth
            size="small"
            label="Batch Boyutu"
            type="number"
            value={batchSize}
            onChange={(e) => setBatchSize(e.target.value)}
            inputProps={{ min: 1, max: 10000 }}
            disabled={running}
            helperText={`Toplam işlenecek kayıt sayısı (Mevcut: ${totalRecords})`}
          />
          <Box sx={{ mt: 1, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Chip 
              label="100" 
              size="small" 
              onClick={() => !running && setBatchSize(100)}
              color={batchSize === 100 ? 'primary' : 'default'}
              clickable={!running}
            />
            <Chip 
              label="500" 
              size="small" 
              onClick={() => !running && setBatchSize(500)}
              color={batchSize === 500 ? 'primary' : 'default'}
              clickable={!running}
            />
            <Chip 
              label="1000" 
              size="small" 
              onClick={() => !running && setBatchSize(1000)}
              color={batchSize === 1000 ? 'primary' : 'default'}
              clickable={!running}
            />
            <Chip 
              label={`Tümü (${totalRecords})`}
              size="small" 
              onClick={() => !running && setBatchSize(totalRecords)}
              color={batchSize === totalRecords ? 'primary' : 'default'}
              clickable={!running}
            />
          </Box>
        </Grid>
        <Grid item xs={12} sm={4}>
          <TextField
            fullWidth
            size="small"
            label="Ana Dal Kodu (Opsiyonel)"
            type="number"
            value={anaDalKodu}
            onChange={(e) => setAnaDalKodu(e.target.value)}
            disabled={running}
            helperText="Boş bırakılırsa tümü"
          />
        </Grid>
        <Grid item xs={12} sm={4}>
          <FormControlLabel
            control={
              <Checkbox
                checked={forceRematch}
                onChange={(e) => setForceRematch(e.target.checked)}
                disabled={running}
              />
            }
            label="Mevcut eşleşmeleri yeniden eşleştir"
          />
        </Grid>
      </Grid>

      <Button
        variant="contained"
        size="large"
        startIcon={<PlayArrowIcon />}
        onClick={handleStartBatch}
        disabled={running}
        fullWidth
      >
        {running ? 'Eşleştirme Devam Ediyor...' : 'Eşleştirmeyi Başlat'}
      </Button>

      {/* Progress Bar */}
      {running && (
        <Box sx={{ mt: 2 }}>
          <LinearProgress variant="determinate" value={progress} />
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
            İşleniyor... %{progress}
          </Typography>
        </Box>
      )}

      {/* Error */}
      {error && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {error}
        </Alert>
      )}

      {/* Summary */}
      {summary && (
        <Box sx={{ mt: 3 }}>
          <Alert severity="success" sx={{ mb: 2 }}>
            Toplu eşleştirme başarıyla tamamlandı!
          </Alert>

          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={3}>
              <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'grey.50' }}>
                <Typography variant="h4" color="primary">
                  {summary.totalProcessed}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Toplam İşlenen
                </Typography>
              </Paper>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'success.50' }}>
                <Typography variant="h4" color="success.main">
                  {summary.matchedCount}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Eşleşen
                </Typography>
              </Paper>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'warning.50' }}>
                <Typography variant="h4" color="warning.main">
                  {summary.unmatchedCount}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Eşleşmeyen
                </Typography>
              </Paper>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'info.50' }}>
                <Typography variant="h4" color="info.main">
                  {summary.durationMs ? `${(summary.durationMs / 1000).toFixed(1)}s` : '-'}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Süre
                </Typography>
              </Paper>
            </Grid>
          </Grid>

          {/* Güven Skoru Dağılımı */}
          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              Güven Skoru Dağılımı
            </Typography>
            <Box display="flex" gap={1} flexWrap="wrap">
              <Chip
                label={`Yüksek (≥85%): ${summary.highConfidenceCount || 0}`}
                color="success"
                size="small"
              />
              <Chip
                label={`Orta (70-84%): ${summary.mediumConfidenceCount || 0}`}
                color="warning"
                size="small"
              />
              <Chip
                label={`Düşük (<70%): ${summary.lowConfidenceCount || 0}`}
                color="error"
                size="small"
              />
            </Box>
          </Box>
        </Box>
      )}
    </Paper>
  );
}

export default BatchMatchingPanel;
