// ============================================
// ERROR ALERT COMPONENT
// ============================================
// Hata mesajları için ortak component
// ============================================

import { Alert, AlertTitle, Button, Box } from '@mui/material';
import { Refresh as RefreshIcon } from '@mui/icons-material';

function ErrorAlert({ 
  error, 
  title = 'Hata Oluştu',
  onRetry,
  showRetry = true 
}) {
  return (
    <Alert 
      severity="error" 
      sx={{ mb: 3 }}
      action={
        showRetry && onRetry && (
          <Button
            color="inherit"
            size="small"
            startIcon={<RefreshIcon />}
            onClick={onRetry}
          >
            Tekrar Dene
          </Button>
        )
      }
    >
      <AlertTitle>{title}</AlertTitle>
      {typeof error === 'string' ? error : error?.message || 'Bilinmeyen bir hata oluştu'}
    </Alert>
  );
}

export default ErrorAlert;
