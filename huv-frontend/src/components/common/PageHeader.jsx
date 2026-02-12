// ============================================
// PAGE HEADER COMPONENT
// ============================================
// Sayfa başlığı için ortak component
// icon: string (emoji) veya React Component olabilir
// ============================================

import React from 'react';
import { Box, Typography, Breadcrumbs, Link } from '@mui/material';
import { useNavigate } from 'react-router-dom';

function PageHeader({ 
  title, 
  subtitle, 
  icon,
  breadcrumbs = [],
  actions 
}) {
  const navigate = useNavigate();

  // Icon string mi yoksa component mi kontrol et
  const isIconString = typeof icon === 'string';

  return (
    <Box mb={4}>
      {/* Breadcrumbs */}
      {breadcrumbs.length > 0 && (
        <Breadcrumbs sx={{ mb: 2 }}>
          {breadcrumbs.map((crumb, index) => (
            crumb.path ? (
              <Link
                key={index}
                underline="hover"
                color="inherit"
                onClick={() => navigate(crumb.path)}
                sx={{ cursor: 'pointer' }}
              >
                {crumb.label}
              </Link>
            ) : (
              <Typography key={index} color="text.primary">
                {crumb.label}
              </Typography>
            )
          ))}
        </Breadcrumbs>
      )}

      {/* Başlık ve Aksiyonlar */}
      <Box display="flex" justifyContent="space-between" alignItems="center">
        <Box display="flex" alignItems="center" gap={2}>
          {icon && (
            isIconString ? (
              <Typography sx={{ fontSize: 40 }}>{icon}</Typography>
            ) : (
              React.createElement(icon, { sx: { fontSize: 40, color: 'primary.main' } })
            )
          )}
          <Box>
            <Typography variant="h4" component="h1">
              {title}
            </Typography>
            {subtitle && (
              <Typography variant="body1" color="textSecondary" sx={{ mt: 0.5 }}>
                {subtitle}
              </Typography>
            )}
          </Box>
        </Box>
        {actions && <Box>{actions}</Box>}
      </Box>
    </Box>
  );
}

export default PageHeader;
