import { Paper, Typography, Box } from '@mui/material';

function StatCard({ title, value, icon: Icon, color = 'primary.main', subtitle, sx }) {
  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2.5,
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        borderRadius: 2,
        transition: 'box-shadow 0.2s',
        '&:hover': { boxShadow: 2 },
        ...sx,
      }}
    >
      {Icon && (
        <Box
          sx={{
            width: 48,
            height: 48,
            borderRadius: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: `${String(color).split('.')[0]}.50`,
            color,
            flexShrink: 0,
          }}
        >
          <Icon fontSize="medium" />
        </Box>
      )}
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="body2" color="text.secondary" noWrap>
          {title}
        </Typography>
        <Typography variant="h5" fontWeight={700} noWrap>
          {value ?? '-'}
        </Typography>
        {subtitle && (
          <Typography variant="caption" color="text.secondary" noWrap>
            {subtitle}
          </Typography>
        )}
      </Box>
    </Paper>
  );
}

export default StatCard;
