// ============================================
// LOADING SPINNER COMPONENT
// ============================================
// Yükleme durumu için merkezi spinner
// ============================================

import { Box, CircularProgress, Typography } from '@mui/material';

function LoadingSpinner({ message = 'Yükleniyor...', size = 60, inline = false }) {
  // Inline mode - sadece spinner (butonlar için)
  if (inline) {
    return <CircularProgress size={size} />;
  }

  // Full page mode - spinner + mesaj
  return (
    <Box
      display="flex"
      flexDirection="column"
      justifyContent="center"
      alignItems="center"
      minHeight="60vh"
      gap={2}
    >
      <CircularProgress size={size} />
      {message && (
        <Typography variant="body1" color="textSecondary">
          {message}
        </Typography>
      )}
    </Box>
  );
}

export default LoadingSpinner;
