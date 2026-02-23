// ============================================
// MATCHING STATS CHARTS
// ============================================
// Eşleştirme istatistikleri grafikleri
// ============================================

import {
  Box,
  Paper,
  Typography,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  LinearProgress,
  Chip,
} from '@mui/material';

// ============================================
// MatchingStatsCharts Component
// ============================================
function MatchingStatsCharts({ stats }) {
  if (!stats) return null;

  // ============================================
  // Güven skoru dağılımı yüzdeleri
  // ============================================
  const totalMatched = stats.matchedCount || 0;
  const highPercent = totalMatched > 0 ? (stats.confidenceDistribution?.high / totalMatched) * 100 : 0;
  const mediumPercent = totalMatched > 0 ? (stats.confidenceDistribution?.medium / totalMatched) * 100 : 0;
  const lowPercent = totalMatched > 0 ? (stats.confidenceDistribution?.low / totalMatched) * 100 : 0;

  // ============================================
  // Kural tipi dağılımı
  // ============================================
  const ruleTypeLabels = {
    first_letter: 'İlk Harf',
    surgical_similarity: 'Cerrahi Benzerlik',
    radiology_keyword: 'Radyoloji',
    general_similarity: 'Genel Benzerlik'
  };

  const ruleTypeData = stats.matchesByRuleType || {};
  const ruleTypeTotal = Object.values(ruleTypeData).reduce((sum, count) => sum + count, 0);

  return (
    <Grid container spacing={3}>
      {/* Güven Skoru Dağılımı */}
      <Grid item xs={12} md={6}>
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Güven Skoru Dağılımı
          </Typography>
          <Typography variant="body2" color="text.secondary" paragraph>
            Eşleşmelerin güven skorlarına göre dağılımı
          </Typography>

          <Box sx={{ mb: 3 }}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
              <Typography variant="body2">
                Yüksek (≥85%)
              </Typography>
              <Chip
                label={`${stats.confidenceDistribution?.high || 0} (%${highPercent.toFixed(1)})`}
                color="success"
                size="small"
              />
            </Box>
            <LinearProgress
              variant="determinate"
              value={highPercent}
              color="success"
              sx={{ height: 8, borderRadius: 1 }}
            />
          </Box>

          <Box sx={{ mb: 3 }}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
              <Typography variant="body2">
                Orta (70-84%)
              </Typography>
              <Chip
                label={`${stats.confidenceDistribution?.medium || 0} (%${mediumPercent.toFixed(1)})`}
                color="warning"
                size="small"
              />
            </Box>
            <LinearProgress
              variant="determinate"
              value={mediumPercent}
              color="warning"
              sx={{ height: 8, borderRadius: 1 }}
            />
          </Box>

          <Box>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
              <Typography variant="body2">
                Düşük (&lt;70%)
              </Typography>
              <Chip
                label={`${stats.confidenceDistribution?.low || 0} (%${lowPercent.toFixed(1)})`}
                color="error"
                size="small"
              />
            </Box>
            <LinearProgress
              variant="determinate"
              value={lowPercent}
              color="error"
              sx={{ height: 8, borderRadius: 1 }}
            />
          </Box>
        </Paper>
      </Grid>

      {/* Kural Tipi Dağılımı */}
      <Grid item xs={12} md={6}>
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Eşleştirme Kuralı Dağılımı
          </Typography>
          <Typography variant="body2" color="text.secondary" paragraph>
            Hangi kuralla kaç eşleşme yapıldı
          </Typography>

          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Kural Tipi</TableCell>
                <TableCell align="right">Sayı</TableCell>
                <TableCell align="right">Oran</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {Object.entries(ruleTypeData).map(([ruleType, count]) => {
                const percent = ruleTypeTotal > 0 ? (count / ruleTypeTotal) * 100 : 0;
                return (
                  <TableRow key={ruleType}>
                    <TableCell>
                      <Typography variant="body2">
                        {ruleTypeLabels[ruleType] || ruleType}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Chip label={count} size="small" />
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" color="text.secondary">
                        %{percent.toFixed(1)}
                      </Typography>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Paper>
      </Grid>

      {/* Onay Durumu */}
      <Grid item xs={12} md={6}>
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Onay Durumu
          </Typography>
          <Typography variant="body2" color="text.secondary" paragraph>
            Eşleşmelerin onay durumu
          </Typography>

          <Box sx={{ mb: 3 }}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
              <Typography variant="body2">
                Onaylanmış
              </Typography>
              <Chip
                label={stats.approvedCount || 0}
                color="success"
                size="small"
              />
            </Box>
            <LinearProgress
              variant="determinate"
              value={totalMatched > 0 ? ((stats.approvedCount || 0) / totalMatched) * 100 : 0}
              color="success"
              sx={{ height: 8, borderRadius: 1 }}
            />
          </Box>

          <Box>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
              <Typography variant="body2">
                Onay Bekleyen
              </Typography>
              <Chip
                label={stats.needsReviewCount || 0}
                color="warning"
                size="small"
              />
            </Box>
            <LinearProgress
              variant="determinate"
              value={totalMatched > 0 ? ((stats.needsReviewCount || 0) / totalMatched) * 100 : 0}
              color="warning"
              sx={{ height: 8, borderRadius: 1 }}
            />
          </Box>
        </Paper>
      </Grid>

      {/* Manuel Değişiklikler */}
      <Grid item xs={12} md={6}>
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Manuel Müdahaleler
          </Typography>
          <Typography variant="body2" color="text.secondary" paragraph>
            Otomatik eşleşmelere yapılan manuel değişiklikler
          </Typography>

          <Box display="flex" alignItems="center" justifyContent="space-between">
            <Typography variant="body2">
              Manuel Değiştirilen Eşleşmeler
            </Typography>
            <Chip
              label={stats.manualOverridesCount || 0}
              color="info"
              size="medium"
            />
          </Box>

          {totalMatched > 0 && (
            <Box sx={{ mt: 2 }}>
              <LinearProgress
                variant="determinate"
                value={((stats.manualOverridesCount || 0) / totalMatched) * 100}
                color="info"
                sx={{ height: 8, borderRadius: 1 }}
              />
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                Toplam eşleşmelerin %{(((stats.manualOverridesCount || 0) / totalMatched) * 100).toFixed(1)}'i manuel değiştirildi
              </Typography>
            </Box>
          )}
        </Paper>
      </Grid>
    </Grid>
  );
}

export default MatchingStatsCharts;
