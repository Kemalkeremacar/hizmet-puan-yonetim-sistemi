// ============================================
// EMPTY STATE COMPONENT
// ============================================
// Veri olmadığında gösterilecek component
// ============================================

import { Box, Typography, Button } from '@mui/material';
import { Inbox as InboxIcon } from '@mui/icons-material';

function EmptyState({ 
  message = 'Veri bulunamadı',
  icon: Icon = InboxIcon,
  actionLabel,
  onAction
}) {
  return (
    <Box
      display="flex"
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      py={8}
      gap={2}
    >
      <Icon sx={{ fontSize: 80, color: 'text.disabled' }} />
      <Typography variant="h6" color="textSecondary">
        {message}
      </Typography>
      {actionLabel && onAction && (
        <Button variant="contained" onClick={onAction} sx={{ mt: 2 }}>
          {actionLabel}
        </Button>
      )}
    </Box>
  );
}

export default EmptyState;
